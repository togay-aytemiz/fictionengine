import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, typography } from '../../design/tokens';
import { MediumHeader } from '../../components/MediumHeader';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? colors.dark : colors.light;
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <Animated.View style={[styles.container, { backgroundColor: theme.background, opacity: fadeAnim }]}>
      <MediumHeader
        title="Home"
        rightIconName="person-circle-outline"
        onRightPress={() => router.push('/(story)/profile')}
        rightAccessibilityLabel="Open profile"
      />

      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text.primary }]}>
          Your stories will appear here
        </Text>
        <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
          Continue reading or start a new adventure.
        </Text>
      </View>
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
