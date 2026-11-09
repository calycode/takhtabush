import { useCallback, useEffect, useState } from 'react';

const RETRO_KEY = 'takhtabush:retro-ui';
const RETRO_EVENT = 'takhtabush:retro-ui-change';

function readRetro(): boolean {
   try {
      return localStorage.getItem(RETRO_KEY) === '1';
   } catch {
      return false;
   }
}

/**
 * Opt-in 8-bit styling for surfaces outside the arcade cabinet. Every hook
 * instance follows the same preference, so the achievements page and the
 * celebration toast stay in sync when the toggle flips.
 */
export function useRetroPreference(): {
   retro: boolean;
   setRetro: (value: boolean) => void;
} {
   const [retro, setRetroState] = useState(readRetro);

   useEffect(() => {
      const onLocalChange = (event: Event) => {
         const detail = (event as CustomEvent<boolean>).detail;
         if (typeof detail === 'boolean') setRetroState(detail);
      };
      const onStorage = (event: StorageEvent) => {
         if (event.key === RETRO_KEY) setRetroState(event.newValue === '1');
      };
      window.addEventListener(RETRO_EVENT, onLocalChange);
      window.addEventListener('storage', onStorage);
      return () => {
         window.removeEventListener(RETRO_EVENT, onLocalChange);
         window.removeEventListener('storage', onStorage);
      };
   }, []);

   const setRetro = useCallback((value: boolean) => {
      setRetroState(value);
      try {
         localStorage.setItem(RETRO_KEY, value ? '1' : '0');
      } catch {
         // Storage can be unavailable in private windows; the in-memory state is enough.
      }
      window.dispatchEvent(new CustomEvent<boolean>(RETRO_EVENT, { detail: value }));
   }, []);

   return { retro, setRetro };
}
