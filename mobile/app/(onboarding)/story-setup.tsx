import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, borderRadius, typography, sizes } from '../../design/tokens';
import { Button } from '../../components/Button';
import { MediumHeader } from '../../components/MediumHeader';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { saveStoryBookInput } from '../../src/services/supabase';

const CONTENT_RATINGS = [
    { id: 'PG', label: 'PG', description: 'Suitable for all ages' },
    { id: 'PG-13', label: 'PG-13', description: 'Some mature themes' },
    { id: 'R', label: 'R', description: 'Adult content' },
];

const LANGUAGES = [
    { id: 'tr', label: 'Türkçe', description: 'Varsayılan dil' },
    { id: 'en', label: 'English', description: 'Uluslararası' },
];

const LOREM_LINES = [
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.',
    'Nisi ut aliquip ex ea commodo consequat.',
    'Duis aute irure dolor in reprehenderit in voluptate velit esse.',
    'Cillum dolore eu fugiat nulla pariatur.',
    'Excepteur sint occaecat cupidatat non proident.',
    'Sunt in culpa qui officia deserunt mollit anim id est laborum.',
    'Vivamus sagittis lacus vel augue laoreet rutrum faucibus dolor.',
    'Aenean lacinia bibendum nulla sed consectetur.',
    'Maecenas sed diam eget risus varius blandit sit amet non magna.',
    'Praesent commodo cursus magna, vel scelerisque nisl consectetur et.',
];

const LOADING_SUBTITLES = [
    'Sahne ışıkları hazırlanıyor',
    'Karakterler yerine geçiyor',
    'Diyaloglar akıyor',
    'Son dokunuşlar yapılıyor',
];

export default function StorySetupScreen() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? colors.dark : colors.light;
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { genres } = useLocalSearchParams<{ genres?: string | string[] }>();
    const selectedGenres = Array.isArray(genres)
        ? genres.flatMap((item) => item.split(',')).filter(Boolean)
        : typeof genres === 'string' && genres.length > 0
            ? genres.split(',').filter(Boolean)
            : [];
    const fadeToTransparent = `${theme.background}00`;

    const [selectedRating, setSelectedRating] = useState<string | null>(null);
    const [selectedLanguage, setSelectedLanguage] = useState<string>('tr');
    const [isLoading, setIsLoading] = useState(false);
    const scrollAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const contentFadeAnim = useRef(new Animated.Value(0)).current;
    const pageFadeAnim = useRef(new Animated.Value(1)).current; // New: Full page fade
    const [scrollAreaHeight, setScrollAreaHeight] = useState(0);
    const [scrollContentHeight, setScrollContentHeight] = useState(0);
    const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

    const handleStart = () => {
        if (isLoading) {
            return;
        }
        if (!selectedRating) {
            return;
        }
        setIsLoading(true);

        // Start premium entrance animation
        Animated.sequence([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 600,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
            }),
            Animated.timing(contentFadeAnim, {
                toValue: 1,
                duration: 800,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
            }),
        ]).start();

        saveStoryBookInput({
            genres: selectedGenres,
            contentRating: selectedRating,
            language: selectedLanguage,
        }).catch((error) => {
            console.warn('Failed to save preferences:', error);
            // Revert loading on error
            setIsLoading(false);
            fadeAnim.setValue(0);
            contentFadeAnim.setValue(0);
        });
    };

    useEffect(() => {
        if (!isLoading) {
            scrollAnim.stopAnimation();
            scrollAnim.setValue(0);
            return;
        }

        const scrollDistance = Math.max(scrollContentHeight - scrollAreaHeight, 0);
        if (scrollDistance <= 0) {
            return;
        }

        scrollAnim.setValue(0);
        const animation = Animated.loop(
            Animated.timing(scrollAnim, {
                toValue: 1,
                duration: 8000,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        );
        animation.start();

        return () => {
            animation.stop();
        };
    }, [isLoading, scrollAreaHeight, scrollContentHeight, scrollAnim]);

    useEffect(() => {
        if (!isLoading) {
            return;
        }

        setLoadingMessageIndex(0);
        const interval = setInterval(() => {
            setLoadingMessageIndex((prev) => (prev + 1) % LOADING_SUBTITLES.length);
        }, 1800);

        return () => {
            clearInterval(interval);
        };
    }, [isLoading]);

    useEffect(() => {
        if (!isLoading) {
            return;
        }

        const redirectTimeout = setTimeout(() => {
            // Start page-level fade out before redirecting
            Animated.timing(pageFadeAnim, {
                toValue: 0,
                duration: 800,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
            }).start(() => {
                router.replace('/(story)');
            });
        }, 12000);

        return () => {
            clearTimeout(redirectTimeout);
        };
    }, [isLoading, router, pageFadeAnim]);

    const canContinue = selectedRating !== null && selectedLanguage !== null;

    return (
        <Animated.View style={[styles.container, { backgroundColor: theme.background, opacity: pageFadeAnim }]}>
            <MediumHeader title="Story Setup" onBack={() => router.back()} />

            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingTop: 0 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Title */}
                <Text style={[styles.title, { color: theme.text.primary }]}>
                    Content preferences
                </Text>

                {/* Subtitle */}
                <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
                    Set your comfort level.{'\n'}You can change this anytime.
                </Text>

                {/* Rating Options */}
                <View style={styles.optionList}>
                    {CONTENT_RATINGS.map((rating) => {
                        const isSelected = selectedRating === rating.id;
                        return (
                            <Pressable
                                key={rating.id}
                                onPress={() => setSelectedRating(rating.id)}
                                style={[
                                    styles.optionCard,
                                    {
                                        borderColor: isSelected ? theme.accent : theme.border,
                                        backgroundColor: isSelected ? theme.accentSoft : theme.surface,
                                    },
                                ]}
                            >
                                <Text style={[styles.optionTitle, { color: theme.text.primary }]}>
                                    {rating.label}
                                </Text>
                                <Text style={[styles.optionSubtitle, { color: theme.text.secondary }]}>
                                    {rating.description}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>

                <Text style={[styles.sectionLabel, { color: theme.text.secondary }]}>
                    Dil
                </Text>

                <View style={styles.languageGrid}>
                    {LANGUAGES.map((language, index) => {
                        const isSelected = selectedLanguage === language.id;
                        const isLastOdd = LANGUAGES.length % 2 === 1 && index === LANGUAGES.length - 1;
                        return (
                            <Pressable
                                key={language.id}
                                onPress={() => setSelectedLanguage(language.id)}
                                style={[
                                    styles.languageCard,
                                    isLastOdd && styles.languageCardFull,
                                    {
                                        borderColor: isSelected ? theme.accent : theme.border,
                                        backgroundColor: isSelected ? theme.accentSoft : theme.surface,
                                    },
                                ]}
                            >
                                <Text style={[styles.optionTitle, { color: theme.text.primary }]}>
                                    {language.label}
                                </Text>
                                <Text style={[styles.optionSubtitle, { color: theme.text.secondary }]}>
                                    {language.description}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
            </ScrollView>

            {/* Main Action Button - Same Layout as Welcome Screen */}
            <View style={[styles.actionContainer, { paddingBottom: insets.bottom + spacing.lg, backgroundColor: theme.background }]}>
                <View style={[styles.separator, { backgroundColor: theme.border }]} />
                <Button
                    title="Generate My Story"
                    onPress={handleStart}
                    disabled={!canContinue}
                    loading={isLoading}
                />
            </View>

            {isLoading && (
                <Animated.View
                    style={[
                        styles.loadingOverlay,
                        {
                            backgroundColor: theme.background,
                            paddingTop: insets.top,
                            paddingBottom: insets.bottom,
                            opacity: fadeAnim,
                        },
                    ]}
                >
                    <View
                        style={styles.scrollWindow}
                        onLayout={(event) => setScrollAreaHeight(event.nativeEvent.layout.height)}
                    >
                        <Animated.View
                            style={[
                                styles.loadingScrollContent,
                                {
                                    opacity: contentFadeAnim,
                                    transform: [
                                        {
                                            translateY: scrollAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [0, -Math.max(scrollContentHeight - scrollAreaHeight, 0)],
                                            }),
                                        },
                                    ],
                                },
                            ]}
                            onLayout={(event) => setScrollContentHeight(event.nativeEvent.layout.height)}
                        >
                            {LOREM_LINES.concat(LOREM_LINES).map((line, index) => (
                                <Text key={`${line}-${index}`} style={[styles.loadingText, { color: theme.text.secondary }]}>
                                    {line}
                                </Text>
                            ))}
                        </Animated.View>
                        <LinearGradient
                            pointerEvents="none"
                            colors={[fadeToTransparent, theme.background]}
                            style={styles.fadeBottom}
                        />
                    </View>

                    <Animated.View
                        style={[
                            styles.loadingFooter,
                            {
                                opacity: contentFadeAnim,
                                transform: [
                                    {
                                        translateY: contentFadeAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [20, 0],
                                        }),
                                    },
                                ],
                            },
                        ]}
                    >
                        <Text style={[styles.loadingTitle, { color: theme.text.primary }]}>
                            Hikaye yazılıyor
                        </Text>
                        <Text style={[styles.loadingSubtitle, { color: theme.text.secondary }]}>
                            {LOADING_SUBTITLES[loadingMessageIndex]}
                        </Text>
                    </Animated.View>
                </Animated.View>
            )}
        </Animated.View>
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
    optionList: {
        gap: spacing.md,
    },
    sectionLabel: {
        ...typography.label,
        marginTop: spacing.xl,
        marginBottom: spacing.sm,
    },
    languageGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    languageCard: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: borderRadius.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        width: '48%',
        minHeight: 72,
        justifyContent: 'center',
        marginBottom: spacing.md,
    },
    languageCardFull: {
        width: '100%',
    },
    optionCard: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: borderRadius.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        width: '100%',
    },
    optionTitle: {
        ...typography.label,
        marginBottom: 6,
    },
    optionSubtitle: {
        ...typography.caption,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'flex-start',
        zIndex: 10,
    },
    loadingTitle: {
        ...typography.h1,
        textAlign: 'center',
    },
    loadingSubtitle: {
        ...typography.ui,
        textAlign: 'center',
        marginTop: spacing.xs,
    },
    scrollWindow: {
        width: '100%',
        flex: 2,
        paddingHorizontal: spacing.screenPadding,
        overflow: 'hidden',
        position: 'relative',
    },
    loadingScrollContent: {
        gap: spacing.sm,
    },
    loadingText: {
        ...typography.body,
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'left',
    },
    fadeBottom: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 80,
    },
    loadingFooter: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.screenPadding,
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
