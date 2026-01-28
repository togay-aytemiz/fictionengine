import { useState } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography, sizes } from '../../design/tokens';
import { Button } from '../../components/Button';
import { MediumHeader } from '../../components/MediumHeader';
import { useColorScheme } from '@/hooks/use-color-scheme';

const GENRES = [
    { id: 'fantasy', label: 'Fantasy', emoji: '🏰' },
    { id: 'scifi', label: 'Sci-Fi', emoji: '🚀' },
    { id: 'mystery', label: 'Mystery', emoji: '🔍' },
    { id: 'romance', label: 'Romance', emoji: '💕' },
    { id: 'adventure', label: 'Adventure', emoji: '⚔️' },
    { id: 'horror', label: 'Horror', emoji: '👻' },
];

export default function PreferencesScreen() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? colors.dark : colors.light;
    const insets = useSafeAreaInsets();
    const router = useRouter();

    // Fix: Initialize with empty array
    const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

    const toggleGenre = (id: string) => {
        setSelectedGenres(prev =>
            prev.includes(id)
                ? prev.filter(g => g !== id)
                : [...prev, id]
        );
    };

    const canContinue = selectedGenres.length > 0;

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <MediumHeader title="Welcome to FictionEngine" onBack={() => router.back()} />

            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingTop: 0 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Title */}
                <Text style={[styles.title, { color: theme.text.primary }]}>
                    What kind of story?
                </Text>

                {/* Subtitle */}
                <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
                    Choose the genres you enjoy.{'\n'}Select one or more.
                </Text>

                {/* Genre Pills - Like Medium */}
                <View style={styles.pillsContainer}>
                    {GENRES.map((genre) => {
                        const isSelected = selectedGenres.includes(genre.id);
                        return (
                            <Pressable
                                key={genre.id}
                                onPress={() => toggleGenre(genre.id)}
                                style={[
                                    styles.pill,
                                    isSelected
                                        ? styles.pillSelected
                                        : { borderColor: theme.border }
                                ]}
                            >
                                <Text style={styles.pillEmoji}>{genre.emoji}</Text>
                                <Text
                                    style={[
                                        styles.pillLabel,
                                        { color: isSelected ? theme.button.primaryText : theme.text.primary },
                                    ]}
                                >
                                    {genre.label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
            </ScrollView>

            {/* Main Action Button - Same Layout as Welcome Screen */}
            <View style={[styles.actionContainer, { paddingBottom: insets.bottom + spacing.lg }]}>
                <View style={[styles.separator, { backgroundColor: theme.border }]} />
                <Button
                    title="Next"
                    disabled={!canContinue}
                    onPress={() => {
                        if (!canContinue) {
                            return;
                        }
                        router.push({
                            pathname: '/(onboarding)/profile',
                            params: {
                                genres: selectedGenres.join(','),
                            },
                        });
                    }}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: spacing.screenPadding,
        paddingTop: spacing.lg,
        flexGrow: 1,
        paddingBottom: 40,
    },
    title: {
        ...typography.h1,
        textAlign: 'center',
        marginTop: sizes.onboardingTitleOffset,
        marginBottom: spacing.md,
    },
    subtitle: {
        ...typography.ui,
        textAlign: 'center',
        marginBottom: spacing.xl,
    },
    pillsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: spacing.sm,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: sizes.pillHeight,
        paddingHorizontal: 16,
        borderRadius: borderRadius.full,
        borderWidth: StyleSheet.hairlineWidth,
        backgroundColor: 'transparent',
        gap: 6,
    },
    pillSelected: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    pillEmoji: {
        fontSize: 16,
    },
    pillLabel: {
        ...typography.label,
    },
    actionContainer: {
        paddingHorizontal: spacing.screenPadding,
        paddingTop: 16,
    },
    separator: {
        height: 1,
        marginBottom: 16,
    },
});
