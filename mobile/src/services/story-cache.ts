import AsyncStorage from '@react-native-async-storage/async-storage';

export type StoryCreateResponse = {
    story: {
        id: string;
        title: string;
        logline: string;
        genre: string;
        content_rating: string;
    };
    story_profile: {
        id: string;
        story_id: string;
        version: number;
        jsonb_profile: Record<string, unknown>;
    };
    continuity_notes: Array<{ id: string; key: string; value: string }>;
    episode_1: {
        id: string;
        story_id: string;
        episode_number: number;
        title: string;
        text: string;
        choices: Array<{
            choice_id: 'A' | 'B';
            text: string;
            intent: string;
            risk_level: 'low' | 'medium' | 'high';
            leads_to: string;
        }>;
    };
    session: {
        id: string;
        story_id: string;
        current_episode_number: number;
    };
};

export type StoryListItem = {
    story: StoryCreateResponse['story'];
    session: StoryCreateResponse['session'];
    episode?: StoryCreateResponse['episode_1'];
};

const SESSION_KEY = 'fictionengine:story_session';
const LIST_KEY = 'fictionengine:story_list';

const memoryStore = new Map<string, string>();

async function getItem(key: string) {
    try {
        const value = await AsyncStorage.getItem(key);
        if (value !== null) {
            return value;
        }
    } catch {
        // ignore AsyncStorage failure
    }
    return memoryStore.get(key) ?? null;
}

async function setItem(key: string, value: string) {
    try {
        await AsyncStorage.setItem(key, value);
        return;
    } catch {
        // ignore AsyncStorage failure
    }
    memoryStore.set(key, value);
}

async function removeItem(key: string) {
    try {
        await AsyncStorage.removeItem(key);
        return;
    } catch {
        // ignore AsyncStorage failure
    }
    memoryStore.delete(key);
}

let cachedStory: StoryCreateResponse | null = null;
let cachedList: StoryListItem[] | null = null;

export async function setStorySession(story: StoryCreateResponse) {
    cachedStory = story;
    await setItem(SESSION_KEY, JSON.stringify(story));
}

export async function getStorySession() {
    if (cachedStory) {
        return cachedStory;
    }
    const raw = await getItem(SESSION_KEY);
    if (!raw) {
        return null;
    }
    try {
        cachedStory = JSON.parse(raw) as StoryCreateResponse;
    } catch {
        await removeItem(SESSION_KEY);
        return null;
    }
    return cachedStory;
}

export async function clearStorySession() {
    cachedStory = null;
    await removeItem(SESSION_KEY);
}

export async function setStoryList(items: StoryListItem[]) {
    cachedList = items;
    await setItem(LIST_KEY, JSON.stringify(items));
}

export async function getStoryList() {
    if (cachedList) {
        return cachedList;
    }
    const raw = await getItem(LIST_KEY);
    if (!raw) {
        return [];
    }
    try {
        cachedList = JSON.parse(raw) as StoryListItem[];
    } catch {
        await removeItem(LIST_KEY);
        return [];
    }
    return cachedList ?? [];
}

export async function upsertStoryListItem(item: StoryListItem) {
    const list = await getStoryList();
    const index = list.findIndex((entry) => entry.story.id === item.story.id);
    if (index >= 0) {
        list[index] = item;
    } else {
        list.unshift(item);
    }
    await setStoryList(list);
    return list;
}

export async function removeStoryFromList(storyId: string) {
    const list = await getStoryList();
    const filtered = list.filter((entry) => entry.story.id !== storyId);
    await setStoryList(filtered);
    return filtered;
}
