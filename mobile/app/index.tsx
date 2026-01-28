import { StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../design/tokens';
import { Button } from '../components/Button';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function WelcomeScreen() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? colors.dark : colors.light;
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
            <View style={styles.content}>
                {/* Logo / Brand */}
                <Text style={[styles.logo, { color: theme.text.primary }]}>
                    FictionEngine
                </Text>

                <Text style={[styles.tagline, { color: theme.text.secondary }]}>
                    Your story, your choices
                </Text>
            </View>

            <View style={[styles.actions, { paddingBottom: insets.bottom + spacing.lg }]}>
                <Link href="/(onboarding)/preferences" asChild>
                    <Button title="Start Your Adventure" />
                </Link>

                <Text style={[styles.footnote, { color: theme.text.muted }]}>
                    Interactive stories crafted just for you
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'space-between',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.screenPadding,
    },
    logo: {
        ...typography.display,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    tagline: {
        ...typography.ui,
        textAlign: 'center',
    },
    actions: {
        paddingHorizontal: spacing.screenPadding,
        gap: spacing.md,
    },
    footnote: {
        ...typography.caption,
        textAlign: 'center',
    },
});
