/**
 * Supabase Client Configuration
 * Initialize when credentials are available
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

type StorageLike = {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
};

const inMemoryStore = new Map<string, string>();

const memoryStorage: StorageLike = {
    getItem: async (key: string) => inMemoryStore.get(key) ?? null,
    setItem: async (key: string, value: string) => {
        inMemoryStore.set(key, value);
    },
    removeItem: async (key: string) => {
        inMemoryStore.delete(key);
    },
};

function getStorage(): StorageLike | undefined {
    try {
        // AsyncStorage may be unavailable until native rebuild
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const module = require('@react-native-async-storage/async-storage');
        const storage = module?.default ?? module;
        if (storage?.getItem && storage?.setItem && storage?.removeItem) {
            return storage as StorageLike;
        }
        return undefined;
    } catch {
        return undefined;
    }
}

const storage = getStorage();

const safeStorage: StorageLike = {
    getItem: async (key: string) => {
        if (storage) {
            try {
                const value = await storage.getItem(key);
                if (value !== null) {
                    return value;
                }
            } catch {
                // fall back to in-memory storage
            }
        }
        return memoryStorage.getItem(key);
    },
    setItem: async (key: string, value: string) => {
        if (storage) {
            try {
                await storage.setItem(key, value);
                return;
            } catch {
                // fall back to in-memory storage
            }
        }
        await memoryStorage.setItem(key, value);
    },
    removeItem: async (key: string) => {
        if (storage) {
            try {
                await storage.removeItem(key);
                return;
            } catch {
                // fall back to in-memory storage
            }
        }
        await memoryStorage.removeItem(key);
    },
};

// Will be null if credentials not configured
export const supabase: SupabaseClient | null =
    supabaseUrl && supabaseAnonKey
        ? createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                storage: safeStorage,
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: false,
            },
        })
        : null;

/**
 * Call Supabase Edge Function
 */
export async function invokeEdgeFunction<T>(
    functionName: string,
    body: Record<string, unknown>
): Promise<T> {
    if (!supabase) {
        throw new Error('Supabase client not configured. Set environment variables.');
    }

    const { data, error } = await supabase.functions.invoke(functionName, {
        body,
    });

    if (error) {
        throw new Error(`Edge function error: ${error.message}`);
    }

    return data as T;
}

export type StoryBookInput = {
    genres: string[];
    contentRating: string;
    language: string;
};

async function ensureAnonymousUserId(): Promise<string> {
    if (!supabase) {
        throw new Error('Supabase client not configured. Set environment variables.');
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
        throw new Error(sessionError.message);
    }

    if (sessionData.session?.user?.id) {
        return sessionData.session.user.id;
    }

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
        throw new Error(
            `Anonymous sign-in failed. Enable "Allow anonymous sign-ins" in Supabase Auth settings. (${error.message})`
        );
    }

    if (data.session?.access_token && data.session.refresh_token) {
        const { error: setSessionError } = await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
        });
        if (setSessionError) {
            throw new Error(setSessionError.message);
        }
    }

    await new Promise((resolve) => setTimeout(resolve, 100));

    const { data: sessionAfter, error: sessionAfterError } = await supabase.auth.getSession();
    if (sessionAfterError) {
        throw new Error(sessionAfterError.message);
    }

    if (!sessionAfter.session?.user?.id) {
        throw new Error(
            'Auth session missing! Restart the app after enabling anonymous sign-ins, and ensure the device can reach Supabase.'
        );
    }

    return sessionAfter.session.user.id;
}

export async function saveStoryBookInput(input: StoryBookInput) {
    if (!supabase) {
        throw new Error('Supabase client not configured. Set environment variables.');
    }

    const userId = await ensureAnonymousUserId();

    const { error } = await supabase
        .from('story_book_inputs')
        .insert({
            user_id: userId,
            genres: input.genres,
            content_rating: input.contentRating,
            language: input.language,
        });

    if (error) {
        if (error.code === '42501') {
            throw new Error(
                'Row-level security blocked this insert. Ensure anonymous sign-ins are enabled and the insert policy exists.'
            );
        }
        throw new Error(error.message);
    }
}
