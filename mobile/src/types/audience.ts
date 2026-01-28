/**
 * Audience Profile Types
 * Controls content rating, reading level, and content filters
 */

export type ContentRating = 'PG' | 'PG-13' | 'R';
export type ReadingLevel = 'A2' | 'B1' | 'B2' | 'C1';
export type IntensityLevel = 'none' | 'mild' | 'medium' | 'graphic';
export type RomanceLevel = 'none' | 'mild' | 'explicit';
export type HorrorLevel = 'none' | 'mild' | 'intense';
export type HumorStyle = 'light' | 'dry' | 'dark';

// Blocked topics that are never allowed
export const ALWAYS_BLOCKED_TOPICS = [
    'self-harm',
    'sexual violence',
    'hate',
] as const;

export type BlockedTopic = typeof ALWAYS_BLOCKED_TOPICS[number] | string;

export interface AudienceProfile {
    age: number;
    content_rating: ContentRating;
    reading_level: ReadingLevel;
    violence: IntensityLevel;
    romance: RomanceLevel;
    horror: HorrorLevel;
    humor: HumorStyle;
    topics_blocklist: BlockedTopic[];
}

// Story metadata
export interface StoryMeta {
    app_lang: string;
    audience_profile: AudienceProfile;
    genre: string;
    tone: string;
    segment_goal: string;
    length: {
        target_words: number;
        min_words: number;
        max_words: number;
    };
}

// Default audience profile for new users
export const DEFAULT_AUDIENCE_PROFILE: AudienceProfile = {
    age: 18,
    content_rating: 'PG-13',
    reading_level: 'B1',
    violence: 'mild',
    romance: 'mild',
    horror: 'none',
    humor: 'light',
    topics_blocklist: [...ALWAYS_BLOCKED_TOPICS],
};
