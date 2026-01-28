/**
 * Supabase Client Configuration
 * Initialize when credentials are available
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Will be null if credentials not configured
export const supabase: SupabaseClient | null =
    supabaseUrl && supabaseAnonKey
        ? createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                storage: AsyncStorage,
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

export type StoryPreferencesInput = {
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
        throw new Error(error.message);
    }

    if (!data.user?.id) {
        throw new Error('Anonymous user not available.');
    }

    return data.user.id;
}

export async function saveStoryPreferences(input: StoryPreferencesInput) {
    if (!supabase) {
        throw new Error('Supabase client not configured. Set environment variables.');
    }

    const userId = await ensureAnonymousUserId();

    const { error } = await supabase
        .from('story_preferences')
        .upsert(
            {
                user_id: userId,
                genres: input.genres,
                content_rating: input.contentRating,
                language: input.language,
                updated_at: new Date().toISOString(),
            },
            {
                onConflict: 'user_id',
            }
        );

    if (error) {
        throw new Error(error.message);
    }
}
