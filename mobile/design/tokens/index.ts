/**
 * Design Tokens for FictionEngine
 * Updated to match Medium's clean, reading-focused aesthetic.
 */

import { Platform } from 'react-native';

export const colors = {
  // Brand
  primary: '#1A8917', // Medium green
  primaryDark: '#156D12',

  // Light mode
  light: {
    background: '#FFFFFF',
    surface: '#FAFAFA',
    text: {
      primary: '#191919',
      secondary: '#6B6B6B',
      muted: '#8F8F8F',
    },
    accent: '#1A8917',
    accentSoft: '#E8F5E8',
    border: '#E6E6E6',
    icon: '#191919',
    iconMuted: '#6B6B6B',
    button: {
      primary: '#1A8917',
      primaryText: '#FFFFFF',
      secondary: '#FFFFFF',
      secondaryText: '#191919',
      outline: 'transparent',
      outlineText: '#1A8917',
      disabled: '#E6E6E6',
      disabledText: '#B3B3B3',
    },
    card: {
      background: '#FFFFFF',
      border: '#E6E6E6',
      selected: '#1A8917',
    },
  },
  // Dark mode - optimized for reading
  dark: {
    background: '#121212',
    surface: '#1A1A1A',
    text: {
      primary: '#F3F3F3',
      secondary: '#B5B5B5',
      muted: '#7A7A7A',
    },
    accent: '#1A8917',
    accentSoft: '#173117',
    border: '#2A2A2A',
    icon: '#F3F3F3',
    iconMuted: '#B5B5B5',
    button: {
      primary: '#1A8917',
      primaryText: '#FFFFFF',
      secondary: '#1F1F1F',
      secondaryText: '#F3F3F3',
      outline: 'transparent',
      outlineText: '#1A8917',
      disabled: '#2A2A2A',
      disabledText: '#6B6B6B',
    },
    card: {
      background: '#1A1A1A',
      border: '#2A2A2A',
      selected: '#1A8917',
    },
  },
};

export const fonts = {
  serif: Platform.select({
    ios: 'Georgia',
    android: 'serif',
    web: "Georgia, 'Times New Roman', serif",
    default: 'serif',
  }),
  sans: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    web: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    default: 'System',
  }),
  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    web: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    default: 'monospace',
  }),
};

export const typography = {
  display: {
    fontFamily: fonts.serif,
    fontSize: 40,
    fontWeight: '600' as const,
    lineHeight: 46,
    letterSpacing: -0.3,
  },
  h1: {
    fontFamily: fonts.serif,
    fontSize: 30,
    fontWeight: '600' as const,
    lineHeight: 36,
    letterSpacing: -0.2,
  },
  h2: {
    fontFamily: fonts.serif,
    fontSize: 24,
    fontWeight: '600' as const,
    lineHeight: 30,
  },
  body: {
    fontFamily: fonts.serif,
    fontSize: 18,
    lineHeight: 28,
    letterSpacing: 0.2,
    fontWeight: '400' as const,
  },
  ui: {
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400' as const,
  },
  caption: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400' as const,
  },
  label: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500' as const,
    letterSpacing: 0.2,
  },
  navTitle: {
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600' as const,
    letterSpacing: 0.2,
  },
  button: {
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600' as const,
    letterSpacing: 0.3,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  // Reading-specific
  screenPadding: 20,
  paragraphGap: 20,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 18,
  full: 9999,
};

export const icons = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
};

export const sizes = {
  headerHeight: 52,
  iconButton: 40,
  buttonHeight: 48,
  pillHeight: 36,
  onboardingTitleOffset: 16,
};

export const buttons = {
  height: sizes.buttonHeight,
  radius: borderRadius.full,
  paddingHorizontal: 24,
};

export const animation = {
  duration: {
    fast: 150,
    normal: 250,
    slow: 400,
  },
  easing: 'ease-out',
};

export type ColorScheme = 'light' | 'dark';
