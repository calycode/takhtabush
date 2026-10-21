import type { ComponentChildren } from 'preact';
import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'system';

type ThemeProviderState = {
   theme: Theme;
   canonicalTheme: 'dark' | 'light';
   setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
   theme: 'system',
   canonicalTheme: 'light',
   setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

function resolveTheme(theme: Theme): 'dark' | 'light' {
   if (theme !== 'system') return theme;
   return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({
   children,
   defaultTheme = 'system',
   storageKey = 'takhtabush-theme',
}: {
   children: ComponentChildren;
   defaultTheme?: Theme;
   storageKey?: string;
}) {
   const [theme, setTheme] = useState<Theme>(
      () => (localStorage.getItem(storageKey) as Theme) || defaultTheme,
   );

   useEffect(() => {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(resolveTheme(theme));
   }, [theme]);

   const value: ThemeProviderState = {
      theme,
      canonicalTheme: resolveTheme(theme),
      setTheme: (next: Theme) => {
         localStorage.setItem(storageKey, next);
         setTheme(next);
      },
   };

   return <ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>;
}

export function useTheme() {
   return useContext(ThemeProviderContext);
}
