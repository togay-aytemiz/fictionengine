import { Pressable, StyleSheet, Text, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { colors, typography, buttons } from '../design/tokens';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface ButtonProps {
    title: string;
    onPress?: () => void;
    variant?: 'primary' | 'secondary' | 'outline';
    disabled?: boolean;
    loading?: boolean;
    style?: ViewStyle;
    textStyle?: TextStyle;
}

export function Button({
    title,
    onPress,
    variant = 'primary',
    disabled = false,
    loading = false,
    style,
    textStyle
}: ButtonProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? colors.dark : colors.light;

    const getBackgroundColor = () => {
        if (disabled) return theme.button.disabled;
        switch (variant) {
            case 'primary': return theme.button.primary;
            case 'secondary': return theme.button.secondary;
            case 'outline': return theme.button.outline;
            default: return theme.button.primary;
        }
    };

    const getTextColor = () => {
        if (disabled) return theme.button.disabledText;
        switch (variant) {
            case 'primary': return theme.button.primaryText;
            case 'secondary': return theme.button.secondaryText;
            case 'outline': return theme.button.outlineText;
            default: return theme.button.primaryText;
        }
    };

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled || loading}
            style={({ pressed }) => [
                styles.container,
                {
                    backgroundColor: getBackgroundColor(),
                    opacity: pressed ? 0.9 : 1,
                    borderWidth: variant === 'outline' ? 1 : 0,
                    borderColor: variant === 'outline' ? theme.button.outlineText : 'transparent',
                },
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator color={getTextColor()} />
            ) : (
                <Text style={[styles.text, { color: getTextColor() }, textStyle]}>
                    {title}
                </Text>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        minHeight: buttons.height,
        paddingHorizontal: buttons.paddingHorizontal,
        borderRadius: buttons.radius,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    text: {
        fontFamily: typography.button.fontFamily,
        fontSize: typography.button.fontSize,
        fontWeight: typography.button.fontWeight,
        letterSpacing: typography.button.letterSpacing,
        lineHeight: typography.button.lineHeight,
    },
});
