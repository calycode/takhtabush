import { useMemo, useState } from 'react';
import { useLocation } from 'preact-iso';
import { Button } from '@caly/ui/components/button';
import {
   Card,
   CardContent,
   CardDescription,
   CardFooter,
   CardHeader,
   CardTitle,
} from '@caly/ui/components/card';
import { Alert, AlertDescription } from '@caly/ui/components/alert';
import { Badge } from '@caly/ui/components/badge';
import { createApiKey } from '../lib/api/api-keys';
import { ApiError } from '../lib/api/client';
import { useAuth } from '../lib/auth';

const EXTENSION_SCOPES = ['decks:read', 'decks:write'] as const;

/** Only Chrome/Firefox extension callback origins are accepted. */
function safeExtensionRedirect(raw: string | null): URL | null {
   if (!raw) return null;

   let url: URL;
   try {
      url = new URL(raw);
   } catch {
      return null;
   }

   const host = url.hostname.toLowerCase();
   const isExtensionHost =
      host.endsWith('.chromiumapp.org') || host.endsWith('.extensions.allizom.org');
   const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';

   if (!isExtensionHost && !isLoopback) return null;
   if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback)) return null;
   return url;
}

export function ExtensionConnect() {
   const { user } = useAuth();
   const { query } = useLocation();
   const redirectUri = typeof query.redirect_uri === 'string' ? query.redirect_uri : null;
   const state = typeof query.state === 'string' ? query.state : '';
   const redirect = useMemo(() => safeExtensionRedirect(redirectUri), [redirectUri]);
   const [busy, setBusy] = useState(false);
   const [error, setError] = useState<string | null>(null);

   function finish(values: Record<string, string>): void {
      if (!redirect) return;
      const target = new URL(redirect.toString());
      for (const [key, value] of Object.entries(values)) target.searchParams.set(key, value);
      window.location.assign(target.toString());
   }

   async function approve(): Promise<void> {
      if (!redirect) return;
      setBusy(true);
      setError(null);
      try {
         const result = await createApiKey({
            name: 'Takhtabush browser extension',
            scopes: [...EXTENSION_SCOPES],
            expiresInDays: 365,
         });
         finish({
            token: result.data.secret,
            ...(state ? { state } : {}),
         });
      } catch (cause) {
         setError(
            cause instanceof ApiError ? cause.message : 'Could not create the extension key.',
         );
         setBusy(false);
      }
   }

   function deny(): void {
      finish({
         error: 'access_denied',
         ...(state ? { state } : {}),
      });
   }

   if (!redirect) {
      return (
         <section className='mx-auto flex w-full max-w-lg flex-col gap-4'>
            <Card>
               <CardHeader>
                  <CardTitle>Browser extension connection</CardTitle>
                  <CardDescription>
                     This page only works when it is opened by the Takhtabush browser extension.
                  </CardDescription>
               </CardHeader>
               <CardContent className='flex flex-col gap-3 text-sm text-muted-foreground'>
                  <p>
                     Open the extension settings, enter this instance URL, and choose{' '}
                     <strong>Connect Takhtabush</strong>.
                  </p>
                  <p>
                     You can also create an API key manually on the{' '}
                     <a
                        className='underline underline-offset-4'
                        href='/mcp'
                     >
                        MCP page
                     </a>{' '}
                     and paste it into the extension.
                  </p>
               </CardContent>
            </Card>
         </section>
      );
   }

   return (
      <section className='mx-auto flex w-full max-w-lg flex-col gap-4'>
         <Card>
            <CardHeader>
               <CardTitle>Connect the browser extension</CardTitle>
               <CardDescription>
                  Allow the Takhtabush extension to clone Quizlet sets into your account.
               </CardDescription>
            </CardHeader>
            <CardContent className='flex flex-col gap-4 text-sm'>
               <div className='rounded-lg border bg-muted/40 p-3'>
                  <p>
                     Signed in as <strong>{user?.email ?? 'your account'}</strong>.
                  </p>
                  <p className='mt-3 text-muted-foreground'>The extension will be able to:</p>
                  <ul className='mt-2 list-disc pl-5 text-muted-foreground'>
                     <li>Read your decks and cards</li>
                     <li>Create decks and import cards</li>
                  </ul>
                  <div className='mt-3 flex flex-wrap gap-1'>
                     {EXTENSION_SCOPES.map((scope) => (
                        <Badge
                           key={scope}
                           variant='secondary'
                        >
                           {scope}
                        </Badge>
                     ))}
                  </div>
               </div>

               <p className='text-xs text-muted-foreground'>
                  This creates an API key that expires after one year. You can revoke it at any time
                  on the{' '}
                  <a
                     className='underline underline-offset-4'
                     href='/mcp'
                  >
                     MCP page
                  </a>
                  .
               </p>
               <p className='break-all text-xs text-muted-foreground'>
                  Extension callback: {redirect.host}
               </p>
               {error && (
                  <Alert variant='destructive'>
                     <AlertDescription>{error}</AlertDescription>
                  </Alert>
               )}
            </CardContent>
            <CardFooter className='flex flex-wrap justify-end gap-2'>
               <Button
                  variant='outline'
                  disabled={busy}
                  onClick={deny}
               >
                  Cancel
               </Button>
               <Button
                  disabled={busy}
                  onClick={() => void approve()}
               >
                  {busy ? 'Connecting…' : 'Allow access'}
               </Button>
            </CardFooter>
         </Card>
      </section>
   );
}
