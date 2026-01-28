import { useEffect, useState } from 'react';
import { Appearance, type ColorSchemeName, useColorScheme as useRNColorScheme } from 'react-native';

export function useColorScheme() {
  const rnScheme = useRNColorScheme();
  const [scheme, setScheme] = useState<ColorSchemeName>(
    rnScheme ?? Appearance.getColorScheme()
  );

  useEffect(() => {
    const currentScheme = Appearance.getColorScheme();
    if (currentScheme) {
      setScheme(currentScheme);
    }

    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setScheme(colorScheme);
    });

    const timeout = setTimeout(() => {
      const lateScheme = Appearance.getColorScheme();
      if (lateScheme) {
        setScheme(lateScheme);
      }
    }, 100);

    return () => {
      clearTimeout(timeout);
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (rnScheme) {
      setScheme(rnScheme);
    }
  }, [rnScheme]);

  return scheme ?? 'light';
}
