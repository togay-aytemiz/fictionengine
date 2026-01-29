/**
 * Supabase Client Configuration
 * Initialize when credentials are available
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { StoryListItem } from './story-cache';

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
    body: Record<string, unknown>,
    options?: { accessToken?: string }
): Promise<T> {
    if (!supabase) {
        throw new Error('Supabase client not configured. Set environment variables.');
    }

    let authHeader: Record<string, string> | undefined;
    try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (accessToken) {
            const { error: userError } = await supabase.auth.getUser();
            if (!userError) {
                authHeader = { Authorization: `Bearer ${accessToken}` };
            } else {
                await supabase.auth.signOut();
            }
        }
    } catch {
        // ignore session lookup failure
    }

    if (options?.accessToken) {
        authHeader = { Authorization: `Bearer ${options.accessToken}` };
    }

    const headers = {
        ...(authHeader ?? {}),
        apikey: supabaseAnonKey,
        'Content-Type': 'application/json',
    } as Record<string, string>;

    const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });

    const rawText = await response.text();
    if (!response.ok) {
        let message = rawText || response.statusText;
        try {
            const payload = JSON.parse(rawText);
            if (payload?.error) {
                message = payload.error;
                if (payload.details) {
                    message = `${message}: ${payload.details}`;
                }
            } else if (payload?.message) {
                message = payload.message;
            }
        } catch {
            // ignore JSON parse failure
        }
        throw new Error(`Edge function error (${response.status}): ${message}`);
    }

    if (!rawText) {
        return {} as T;
    }

    return JSON.parse(rawText) as T;
}

export type StoryBookInput = {
    genres: string[];
    contentRating: string;
    language: string;
};

export type StoryCreateInput = {
    genre: string;
    contentRating: 'PG' | 'PG-13' | 'ADULT';
    language: string;
};

async function ensureAnonymousUserId(): Promise<string> {
    const session = await ensureAnonymousSession();
    return session.userId;
}

async function ensureAnonymousSession(): Promise<{ userId: string; accessToken: string }> {
    if (!supabase) {
        throw new Error('Supabase client not configured. Set environment variables.');
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    console.log('[ensureAnonymousSession] Current session:', {
        hasSession: !!sessionData.session,
        userId: sessionData.session?.user?.id,
        error: sessionError?.message
    });

    if (sessionError) {
        throw new Error(sessionError.message);
    }

    if (sessionData.session?.access_token) {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        console.log('[ensureAnonymousSession] getUser result:', {
            userId: userData?.user?.id,
            error: userError?.message
        });
        if (!userError && userData.user?.id) {
            return {
                userId: userData.user.id,
                accessToken: sessionData.session.access_token,
            };
        }
        console.log('[ensureAnonymousSession] Signing out due to invalid user');
        await supabase.auth.signOut();
    }

    console.log('[ensureAnonymousSession] Creating new anonymous session...');

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

    const accessToken = sessionAfter.session?.access_token ?? data.session?.access_token;
    const userId = sessionAfter.session?.user?.id ?? data.user?.id;

    if (!accessToken || !userId) {
        throw new Error(
            'Auth session missing! Restart the app after enabling anonymous sign-ins, and ensure the device can reach Supabase.'
        );
    }

    return { userId, accessToken };
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

export async function createStory(input: StoryCreateInput) {
    const session = await ensureAnonymousSession();
    console.log('[createStory] Got session:', {
        userId: session.userId,
        tokenLength: session.accessToken?.length,
        tokenStart: session.accessToken?.slice(0, 20)
    });
    const payload = {
        genre: input.genre,
        content_rating: input.contentRating,
        app_lang: input.language,
        user_id: session.userId,
        is_anonymous: true,
    };

    try {
        return await invokeEdgeFunction('story-create', payload, {
            accessToken: session.accessToken,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('Invalid JWT') || message.includes('(401)')) {
            await supabase?.auth.signOut();
            const freshSession = await ensureAnonymousSession();
            return await invokeEdgeFunction(
                'story-create',
                {
                    ...payload,
                    user_id: freshSession.userId,
                },
                { accessToken: freshSession.accessToken }
            );
        }
        throw error;
    }
}

export async function fetchStoryList(): Promise<StoryListItem[]> {
    if (!supabase) {
        throw new Error('Supabase client not configured. Set environment variables.');
    }

    const userId = await ensureAnonymousUserId();
    console.log('[fetchStoryList] Fetching for userId:', userId);

    const { data: sessions, error } = await supabase
        .from('sessions')
        .select(
            'id, story_id, current_episode_number, created_at, stories(id, title, logline, genre, content_rating)'
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    console.log('[fetchStoryList] Sessions result:', { count: sessions?.length, error: error?.message });
    console.log('[fetchStoryList] Raw sessions:', JSON.stringify(sessions, null, 2));

    if (error) {
        throw new Error(error.message);
    }

    if (!sessions || sessions.length === 0) {
        return [];
    }

    const items = await Promise.all(
        sessions.map(async (session) => {
            const story = (session as any).stories;
            let episode;
            if (story?.id) {
                const { data: episodeRow } = await supabase
                    .from('episodes')
                    .select('id, story_id, episode_number, title, text, choices')
                    .eq('story_id', story.id)
                    .eq('episode_number', session.current_episode_number)
                    .single();
                episode = episodeRow ?? undefined;
            }
            return {
                story,
                session: {
                    id: session.id,
                    story_id: session.story_id,
                    current_episode_number: session.current_episode_number,
                },
                episode,
            } as StoryListItem;
        })
    );

    return items.filter((item) => item.story);
}

/**
 * Delete a story and its associated session
 * Uses cascade delete - deleting the session will remove user's access
 * Then deletes the story which cascades to episodes, profiles, etc.
 */
export async function deleteStory(storyId: string, sessionId: string): Promise<void> {
    if (!supabase) {
        throw new Error('Supabase client not configured');
    }

    // Delete session first (user's connection to the story)
    const { error: sessionError } = await supabase
        .from('sessions')
        .delete()
        .eq('id', sessionId);

    if (sessionError) {
        throw new Error(`Failed to delete session: ${sessionError.message}`);
    }

    // Delete the story (cascades to episodes, story_profiles, continuity_notes)
    const { error: storyError } = await supabase
        .from('stories')
        .delete()
        .eq('id', storyId);

    if (storyError) {
        throw new Error(`Failed to delete story: ${storyError.message}`);
    }
}
