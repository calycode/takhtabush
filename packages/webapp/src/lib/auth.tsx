import type { ComponentChildren } from 'preact';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { User } from '@caly/shared';
import { ApiError } from './api/client';
import { getMe, logout as apiLogout } from './api/auth';

type Status = 'loading' | 'authenticated' | 'anonymous';

type AuthState = {
   status: Status;
   user: User | null;
   refresh: () => Promise<void>;
   signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
   status: 'loading',
   user: null,
   refresh: async () => undefined,
   signOut: async () => undefined,
});

/** Loads the current session once and exposes it to the whole app. */
export function AuthProvider({ children }: { children: ComponentChildren }) {
   const [status, setStatus] = useState<Status>('loading');
   const [user, setUser] = useState<User | null>(null);

   const refresh = useCallback(async () => {
      try {
         const result = await getMe();
         setUser(result.data.user);
         setStatus('authenticated');
      } catch (cause) {
         if (cause instanceof ApiError && cause.status === 401) {
            setUser(null);
            setStatus('anonymous');
            return;
         }
         // Network/other errors: treat as anonymous but do not crash the shell.
         setUser(null);
         setStatus('anonymous');
      }
   }, []);

   const signOut = useCallback(async () => {
      await apiLogout().catch(() => undefined);
      setUser(null);
      setStatus('anonymous');
   }, []);

   useEffect(() => {
      void refresh();
   }, [refresh]);

   return (
      <AuthContext.Provider value={{ status, user, refresh, signOut }}>
         {children}
      </AuthContext.Provider>
   );
}

export function useAuth() {
   return useContext(AuthContext);
}
