import { useCallback, useEffect, useState } from 'react';

export type UiStyle = 'standard' | 'pixel';

const UI_STYLE_KEY = 'takhtabush:ui-style';
const UI_STYLE_EVENT = 'takhtabush:ui-style-change';

export function readUiStyle(): UiStyle {
   try {
      return localStorage.getItem(UI_STYLE_KEY) === 'pixel' ? 'pixel' : 'standard';
   } catch {
      return 'standard';
   }
}

function applyUiStyle(style: UiStyle) {
   document.documentElement.dataset.ui = style;
}

/** Apply the saved skin before the first render (the inline bootstrap covers reloads). */
export function initUiStyle() {
   applyUiStyle(readUiStyle());
}

/**
 * Global shell style. Unlike the old achievements-only retro flag, this is a
 * single preference every screen follows: the CSS skin keys off
 * `data-ui="pixel"` on <html>.
 */
export function useUiStyle(): {
   uiStyle: UiStyle;
   pixel: boolean;
   setUiStyle: (value: UiStyle) => void;
   setPixel: (value: boolean) => void;
} {
   const [uiStyle, setUiStyleState] = useState<UiStyle>(readUiStyle);

   useEffect(() => {
      applyUiStyle(uiStyle);
   }, [uiStyle]);

   useEffect(() => {
      const onLocalChange = (event: Event) => {
         const detail = (event as CustomEvent<UiStyle>).detail;
         if (detail === 'standard' || detail === 'pixel') setUiStyleState(detail);
      };
      const onStorage = (event: StorageEvent) => {
         if (event.key === UI_STYLE_KEY) {
            setUiStyleState(event.newValue === 'pixel' ? 'pixel' : 'standard');
         }
      };
      window.addEventListener(UI_STYLE_EVENT, onLocalChange);
      window.addEventListener('storage', onStorage);
      return () => {
         window.removeEventListener(UI_STYLE_EVENT, onLocalChange);
         window.removeEventListener('storage', onStorage);
      };
   }, []);

   const setUiStyle = useCallback((value: UiStyle) => {
      setUiStyleState(value);
      applyUiStyle(value);
      try {
         localStorage.setItem(UI_STYLE_KEY, value);
      } catch {
         // Storage can be unavailable in private windows; the in-memory state is enough.
      }
      window.dispatchEvent(new CustomEvent<UiStyle>(UI_STYLE_EVENT, { detail: value }));
   }, []);

   const setPixel = useCallback(
      (value: boolean) => setUiStyle(value ? 'pixel' : 'standard'),
      [setUiStyle],
   );

   return { uiStyle, pixel: uiStyle === 'pixel', setUiStyle, setPixel };
}
