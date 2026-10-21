import { useEffect, useState } from 'react';
import { useLocation } from 'preact-iso';
import type { AuthStatus } from '@caly/shared';
import { Button } from '@caly/ui/components/button';
import { Input } from '@caly/ui/components/input';
import { Label } from '@caly/ui/components/label';
import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from '@caly/ui/components/card';
import { Alert, AlertDescription } from '@caly/ui/components/alert';
import { ApiError } from '../lib/api/client';
import { getAuthStatus, setupOwner } from '../lib/api/auth';
import { useAuth } from '../lib/auth';

export function Setup() {
   const { route } = useLocation();
   const { refresh } = useAuth();
   const [status, setStatus] = useState<AuthStatus | null>(null);
   const [email, setEmail] = useState('');
   const [token, setToken] = useState('');
   const [error, setError] = useState<string | null>(null);
   const [busy, setBusy] = useState(false);

   useEffect(() => {
      let active = true;
      getAuthStatus()
         .then((result) => {
            if (active) setStatus(result.data);
         })
         .catch((cause) => {
            if (active) setError(cause instanceof ApiError ? cause.message : 'Setup check failed');
         });
      return () => {
         active = false;
      };
   }, []);

   async function submit(event: Event) {
      event.preventDefault();
      setBusy(true);
      setError(null);
      try {
         await setupOwner(email, token);
         await refresh();
         route('/');
      } catch (cause) {
         setError(cause instanceof ApiError ? cause.message : 'Setup failed');
      } finally {
         setBusy(false);
      }
   }

   if (!status) {
      return (
         <section className='mx-auto flex max-w-md flex-col gap-4'>
            {error ? (
               <Alert variant='destructive'>
                  <AlertDescription>{error}</AlertDescription>
               </Alert>
            ) : (
               <p className='text-sm text-muted-foreground'>Checking setup status…</p>
            )}
         </section>
      );
   }

   if (!status.setupEnabled) {
      return (
         <section className='mx-auto flex max-w-md flex-col gap-4'>
            <Card>
               <CardHeader>
                  <CardTitle>
                     {status.setupRequired
                        ? 'First-run setup is disabled'
                        : 'Owner recovery is disabled'}
                  </CardTitle>
                  <CardDescription>
                     Set the setup token and redeploy, or sign in with a magic link if email
                     delivery is configured.
                  </CardDescription>
               </CardHeader>
            </Card>
         </section>
      );
   }

   const recovering = status.initialized;

   return (
      <section className='mx-auto flex max-w-md flex-col gap-4'>
         <Card>
            <CardHeader>
               <CardTitle>
                  {recovering ? 'Recover owner access' : 'Set up this deployment'}
               </CardTitle>
               <CardDescription>
                  {recovering
                     ? 'Sign in as the owner with the setup token.'
                     : 'Create the owner account before any other user exists.'}
               </CardDescription>
            </CardHeader>
            <CardContent>
               <form
                  className='flex flex-col gap-3'
                  onSubmit={submit}
               >
                  <div className='flex flex-col gap-1.5'>
                     <Label htmlFor='setup-email'>Email</Label>
                     <Input
                        id='setup-email'
                        type='email'
                        required
                        autoFocus
                        value={email}
                        onInput={(event) => setEmail((event.target as HTMLInputElement).value)}
                        placeholder='you@example.com'
                     />
                  </div>
                  <div className='flex flex-col gap-1.5'>
                     <Label htmlFor='setup-token'>Setup / recovery token</Label>
                     <Input
                        id='setup-token'
                        type='password'
                        required
                        value={token}
                        onInput={(event) => setToken((event.target as HTMLInputElement).value)}
                        placeholder='Paste the setup token'
                     />
                  </div>
                  <Button
                     type='submit'
                     disabled={busy}
                  >
                     {busy ? 'Working…' : recovering ? 'Sign in as owner' : 'Create owner account'}
                  </Button>
               </form>
            </CardContent>
         </Card>

         {error && (
            <Alert variant='destructive'>
               <AlertDescription>{error}</AlertDescription>
            </Alert>
         )}
      </section>
   );
}
