import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, typography } from '../../design/tokens';
import { MediumHeader } from '../../components/MediumHeader';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? colors.dark : colors.light;
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <MediumHeader title="Profile" onBack={() => router.back()} />

      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text.primary }]}>
          Profile coming soon
        </Text>
        <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
          We will add account settings and reading preferences here.
        </Text>
      </View>
    </View>
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
