import { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, spacing, typography, borderRadius } from '../../design/tokens';
import { MediumHeader } from '../../components/MediumHeader';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getStoryList, type StoryListItem } from '../../src/services/story-cache';

export default function StoryDetailScreen() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? colors.dark : colors.light;
    const router = useRouter();
    const { storyId } = useLocalSearchParams<{ storyId: string }>();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const [storyItem, setStoryItem] = useState<StoryListItem | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
        }).start();
    }, [fadeAnim]);

    useEffect(() => {
        getStoryList().then((list) => {
            const found = list.find((item) => item.story.id === storyId);
            setStoryItem(found ?? null);
            setIsLoading(false);
        });
    }, [storyId]);

    if (isLoading) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <MediumHeader title="Loading..." onBack={() => router.back()} />
                <View style={styles.loadingContainer}>
                    <Text style={[styles.loadingText, { color: theme.text.secondary }]}>
                        Loading story...
                    </Text>
                </View>
            </View>
        );
    }

    if (!storyItem) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <MediumHeader title="Story" onBack={() => router.back()} />
                <View style={styles.loadingContainer}>
                    <Text style={[styles.loadingText, { color: theme.text.secondary }]}>
                        Story not found
                    </Text>
                </View>
            </View>
        );
    }

    const { story, episode } = storyItem;

    return (
        <Animated.View style={[styles.container, { backgroundColor: theme.background, opacity: fadeAnim }]}>
            <MediumHeader title={story.title} onBack={() => router.back()} />

            <ScrollView contentContainerStyle={styles.content}>
                {/* Story Header */}
                <View style={styles.header}>
                    <View style={[styles.genreBadge, { backgroundColor: theme.accentSoft }]}>
                        <Text style={[styles.genreText, { color: theme.accent }]}>
                            {story.genre}
                        </Text>
                    </View>
                    <Text style={[styles.title, { color: theme.text.primary }]}>
                        {story.title}
                    </Text>
                    <Text style={[styles.logline, { color: theme.text.secondary }]}>
                        {story.logline}
                    </Text>
                </View>

                {/* Current Episode */}
                {episode && (
                    <View style={styles.episodeSection}>
                        <Text style={[styles.episodeLabel, { color: theme.text.secondary }]}>
                            BÖLÜM {episode.episode_number}
                        </Text>
                        <Text style={[styles.episodeTitle, { color: theme.text.primary }]}>
                            {episode.title}
                        </Text>
                        <Text style={[styles.episodeText, { color: theme.text.primary }]}>
                            {episode.text}
                        </Text>

                        {/* Choices */}
                        {episode.choices && episode.choices.length > 0 && (
                            <View style={styles.choicesContainer}>
                                <Text style={[styles.choicesLabel, { color: theme.text.secondary }]}>
                                    Ne yapacaksın?
                                </Text>
                                {episode.choices.map((choice: any) => (
                                    <Pressable
                                        key={choice.choice_id}
                                        style={[
                                            styles.choiceButton,
                                            { backgroundColor: theme.surface, borderColor: theme.border },
                                        ]}
                                        onPress={() => {
                                            // TODO: Handle choice selection
                                            console.log('Choice selected:', choice.choice_id);
                                        }}
                                    >
                                        <Text style={[styles.choiceId, { color: theme.accent }]}>
                                            {choice.choice_id}
                                        </Text>
                                        <Text style={[styles.choiceText, { color: theme.text.primary }]}>
                                            {choice.text}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        ...typography.ui,
    },
    content: {
        paddingHorizontal: spacing.screenPadding,
        paddingTop: spacing.lg,
        paddingBottom: spacing.xxl,
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    genreBadge: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        marginBottom: spacing.md,
    },
    genreText: {
        ...typography.label,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    title: {
        ...typography.h1,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    logline: {
        ...typography.ui,
        textAlign: 'center',
    },
    episodeSection: {
        marginTop: spacing.lg,
    },
    episodeLabel: {
        ...typography.label,
        textTransform: 'uppercase',
        letterSpacing: 1.4,
        marginBottom: spacing.xs,
    },
    episodeTitle: {
        ...typography.h2,
        marginBottom: spacing.md,
    },
    episodeText: {
        ...typography.body,
        lineHeight: 28,
    },
    choicesContainer: {
        marginTop: spacing.xl,
    },
    choicesLabel: {
        ...typography.label,
        marginBottom: spacing.md,
    },
    choiceButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: StyleSheet.hairlineWidth,
        marginBottom: spacing.sm,
    },
    choiceId: {
        ...typography.label,
        marginRight: spacing.md,
        width: 24,
    },
    choiceText: {
        ...typography.body,
        flex: 1,
    },
});
