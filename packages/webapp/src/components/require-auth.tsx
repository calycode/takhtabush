import type { ComponentChildren } from 'preact';
import { useEffect } from 'react';
import { useLocation } from 'preact-iso';
import { Skeleton } from '@caly/ui/components/skeleton';
import { useAuth } from '../lib/auth';

/** Redirects anonymous visitors to the login screen, preserving the target. */
export function RequireAuth({ children }: { children: ComponentChildren }) {
   const { status } = useAuth();
   const { url, route } = useLocation();

   useEffect(() => {
      if (status === 'anonymous') {
         route(`/login?next=${encodeURIComponent(url)}`);
      }
   }, [status, url, route]);

   if (status === 'loading') {
      return (
         <div className='flex flex-col gap-3'>
            <Skeleton className='h-8 w-48' />
            <Skeleton className='h-40' />
         </div>
      );
   }

   if (status === 'anonymous') return null;
   return <>{children}</>;
}
