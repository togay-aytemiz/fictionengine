/**
 * TypeScript interfaces for Story/Episode structures
 * Based on PRD JSON schema
 */

// Episode segment
export interface Segment {
    title: string;
    text: string;
    word_count: number;
}

// Choice presented to user
export interface Choice {
    choice_id: 'A' | 'B';
    text: string;
    intent: string;
    risk_level: 'low' | 'medium' | 'high';
    leads_to: string;
}

// Inventory delta operation
export interface InventoryDelta {
    op: 'add' | 'remove' | 'update';
    owner_id: string;
    item: string;
    notes?: string;
}

// State update after episode
export interface StateUpdate {
    time: string;
    location_id: string;
    characters_present: string[];
    inventory_delta: InventoryDelta[];
    open_threads_delta: {
        add: string[];
        resolve: string[];
    };
}

// Ledger update for persistent facts
export interface LedgerUpdate {
    key: string;
    value: string;
    introduced_in: string;
    status: 'active' | 'resolved';
}

// Continuity check result
export interface ContinuityCheck {
    rule: 'Story Bible compliance' | 'Facts Ledger compliance' | 'Audience rating compliance';
    result: 'pass' | 'warn';
    note: string;
}

// Complete episode response from API
export interface Episode {
    episode_id: string;
    segment: Segment;
    choices: [Choice, Choice];
    state_update: StateUpdate;
    ledger_updates: LedgerUpdate[];
    continuity_checks: ContinuityCheck[];
    assumptions: string[];
}

// Character in story bible
export interface Character {
    id: string;
    name: string;
    age?: string;
    personality: string[];
    goals: string[];
    fears: string[];
    relationships: Array<{
        with_id: string;
        type: string;
        notes?: string;
    }>;
}

// Location in story bible
export interface Location {
    id: string;
    name: string;
    notes?: string;
}

// Story Bible - source of truth for world/characters/style
export interface StoryBible {
    premise: string;
    world_rules: string[];
    characters: Character[];
    locations: Location[];
    style_rules: {
        pov: 'third_limited' | 'first';
        tense: 'past' | 'present';
        forbidden: string[];
    };
}

// Active fact in ledger
export interface Fact {
    key: string;
    value: string;
    introduced_in: string;
    status: 'active' | 'resolved';
}

// Episode recap
export interface EpisodeRecap {
    episode_id: string;
    summary_bullets: string[];
}

// Current story state
export interface StoryState {
    time: string;
    location_id: string;
    characters_present: string[];
    inventory: Array<{
        owner_id: string;
        item: string;
        notes?: string;
    }>;
}

// Recent recaps for context
export interface RecentRecaps {
    last_episode: {
        episode_id: string;
        summary_bullets: string[];
        open_threads: string[];
        state: StoryState;
    };
    last_3_episodes_summaries: EpisodeRecap[];
    arc_summary?: string;
}
