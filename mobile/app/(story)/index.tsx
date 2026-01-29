import { useEffect, useRef, useState, useCallback } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View, Pressable, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../../design/tokens';
import { MediumHeader } from '../../components/MediumHeader';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getStoryList, setStoryList, removeStoryFromList, type StoryListItem } from '../../src/services/story-cache';
import { fetchStoryList, deleteStory } from '../../src/services/supabase';
import { Button } from '../../components/Button';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? colors.dark : colors.light;
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [storyList, setStoryListState] = useState<StoryListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const loadStories = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) {
      setIsRefreshing(true);
    }

    try {
      // First load from cache
      const cached = await getStoryList();
      if (cached.length > 0) {
        setStoryListState(cached);
      }

      // Then fetch fresh data
      const fresh = await fetchStoryList();
      setStoryListState(fresh);
      await setStoryList(fresh);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to load stories.'
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    loadStories();
  }, [loadStories]);

  // Reload when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadStories();
    }, [loadStories])
  );

  const handleStoryPress = (storyId: string) => {
    router.push(`/(story)/${storyId}`);
  };

  const handleDeletePress = (item: StoryListItem) => {
    Alert.alert(
      'Hikayeyi Sil',
      `"${item.story.title}" hikayesini silmek istediğinize emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => performDelete(item),
        },
      ]
    );
  };

  const performDelete = async (item: StoryListItem) => {
    setDeletingId(item.story.id);
    try {
      await deleteStory(item.story.id, item.session.id);
      // Remove from local state immediately
      setStoryListState((prev) => prev.filter((s) => s.story.id !== item.story.id));
      // Update cache
      await removeStoryFromList(item.story.id);
    } catch (error) {
      Alert.alert(
        'Hata',
        error instanceof Error ? error.message : 'Hikaye silinemedi.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  const hasStories = storyList.length > 0;

  return (
    <Animated.View style={[styles.container, { backgroundColor: theme.background, opacity: fadeAnim }]}>
      <MediumHeader
        title="Home"
        rightIconName="person-circle-outline"
        onRightPress={() => router.push('/(story)/profile')}
        rightAccessibilityLabel="Open profile"
      />

      <ScrollView
        contentContainerStyle={[styles.content, hasStories && styles.storyContent]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadStories(true)}
            tintColor={theme.accent}
          />
        }
      >
        <View style={styles.topActions}>
          <Button
            title="Create New Story"
            onPress={() => router.push('/(onboarding)/preferences')}
            variant="outline"
          />
        </View>

        {isLoading && (
          <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
            Loading your stories...
          </Text>
        )}

        {errorMessage && (
          <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
            {errorMessage}
          </Text>
        )}

        {!isLoading && !hasStories && (
          <>
            <Text style={[styles.title, { color: theme.text.primary }]}>
              Your stories will appear here
            </Text>
            <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
              Continue reading or start a new adventure.
            </Text>
          </>
        )}

        {/* Story List - Medium Style */}
        {hasStories && (
          <View style={styles.storyListContainer}>
            {storyList.map((item, index) => (
              <View key={item.story.id}>
                <Pressable
                  onPress={() => handleStoryPress(item.story.id)}
                  style={({ pressed }) => [
                    styles.storyCard,
                    { backgroundColor: pressed ? theme.surface : theme.background },
                  ]}
                  disabled={deletingId === item.story.id}
                >
                  <View style={styles.storyCardContent}>
                    {/* Header Row with Genre and Menu */}
                    <View style={styles.cardHeader}>
                      <View style={[styles.genreBadge, { backgroundColor: theme.accentSoft }]}>
                        <Text style={[styles.genreText, { color: theme.accent }]}>
                          {item.story.genre}
                        </Text>
                      </View>

                      {/* Menu Button (3 dots) */}
                      <Pressable
                        onPress={() => handleDeletePress(item)}
                        style={({ pressed }) => [
                          styles.menuButton,
                          pressed && { opacity: 0.5 },
                        ]}
                        hitSlop={12}
                        disabled={deletingId === item.story.id}
                      >
                        <Ionicons
                          name="ellipsis-horizontal"
                          size={20}
                          color={deletingId === item.story.id ? theme.border : theme.text.secondary}
                        />
                      </Pressable>
                    </View>

                    {/* Title */}
                    <Text
                      style={[
                        styles.storyTitle,
                        { color: theme.text.primary },
                        deletingId === item.story.id && { opacity: 0.5 },
                      ]}
                      numberOfLines={2}
                    >
                      {item.story.title}
                    </Text>

                    {/* Logline */}
                    <Text
                      style={[
                        styles.storyLogline,
                        { color: theme.text.secondary },
                        deletingId === item.story.id && { opacity: 0.5 },
                      ]}
                      numberOfLines={2}
                    >
                      {item.story.logline}
                    </Text>

                    {/* Episode Info */}
                    {item.episode && (
                      <View style={styles.episodeInfo}>
                        <Text style={[styles.episodeLabel, { color: theme.text.muted }]}>
                          Bölüm {item.session.current_episode_number} • {item.episode.title}
                        </Text>
                      </View>
                    )}

                    {/* Meta Row */}
                    <View style={styles.metaRow}>
                      <View style={[styles.ratingBadge, { borderColor: theme.border }]}>
                        <Text style={[styles.ratingText, { color: theme.text.muted }]}>
                          {item.story.content_rating}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Pressable>

                {/* Subtle Divider - Medium Style */}
                {index < storyList.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                )}
              </View>
            ))}
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
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPadding,
  },
  storyContent: {
    flex: 0,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    paddingTop: spacing.lg,
  },
  topActions: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  storyListContainer: {
    width: '100%',
  },
  storyCard: {
    paddingVertical: spacing.lg,
  },
  storyCardContent: {
    gap: spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  genreBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  genreText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuButton: {
    padding: spacing.xs,
  },
  storyTitle: {
    ...typography.h2,
    marginBottom: 2,
  },
  storyLogline: {
    ...typography.body,
    lineHeight: 22,
  },
  episodeInfo: {
    marginTop: spacing.xs,
  },
  episodeLabel: {
    ...typography.caption,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  ratingBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ratingText: {
    fontSize: 10,
    fontWeight: '500',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 0,
  },
  title: {
    ...typography.h1,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.ui,
    textAlign: 'center',
  },
});
