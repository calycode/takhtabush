import { useCallback, useEffect, useState } from 'react';

const ARCADE_KEY = 'takhtabush:arcade-enabled';
const ARCADE_EVENT = 'takhtabush:arcade-enabled-change';

function readArcadeEnabled(): boolean {
   try {
      return localStorage.getItem(ARCADE_KEY) !== '0';
   } catch {
      return true;
   }
}

/** Arcade availability, on by default and shared across every mounted consumer. */
export function useArcadeEnabled(): {
   arcadeEnabled: boolean;
   setArcadeEnabled: (value: boolean) => void;
} {
   const [arcadeEnabled, setState] = useState(readArcadeEnabled);

   useEffect(() => {
      const onLocalChange = (event: Event) => {
         const detail = (event as CustomEvent<boolean>).detail;
         if (typeof detail === 'boolean') setState(detail);
      };
      const onStorage = (event: StorageEvent) => {
         if (event.key === ARCADE_KEY) setState(event.newValue !== '0');
      };
      window.addEventListener(ARCADE_EVENT, onLocalChange);
      window.addEventListener('storage', onStorage);
      return () => {
         window.removeEventListener(ARCADE_EVENT, onLocalChange);
         window.removeEventListener('storage', onStorage);
      };
   }, []);

   const setArcadeEnabled = useCallback((value: boolean) => {
      setState(value);
      try {
         localStorage.setItem(ARCADE_KEY, value ? '1' : '0');
      } catch {
         // Storage can be unavailable in private windows; the in-memory state is enough.
      }
      window.dispatchEvent(new CustomEvent<boolean>(ARCADE_EVENT, { detail: value }));
   }, []);

   return { arcadeEnabled, setArcadeEnabled };
}
