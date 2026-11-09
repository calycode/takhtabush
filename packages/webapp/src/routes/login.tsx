import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'preact-iso';
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
import { getAuthStatus, requestMagicLink, verifyLoginCode, verifyMagicLink } from '../lib/api/auth';
import { useAuth } from '../lib/auth';

function safeNext(raw: string | null): string {
   // Only allow same-site relative paths to avoid open redirects.
   if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
   return '/';
}

/** Server-owned paths must use a full navigation instead of the SPA router. */
function isServerRoute(next: string): boolean {
   return (
      next.startsWith('/oauth/') ||
      next.startsWith('/.well-known/') ||
      next.startsWith('/mcp') ||
      next.startsWith('/api/') ||
      next.startsWith('/media/')
   );
}

export function Login() {
   const { route } = useLocation();
   const { refresh } = useAuth();
   const [email, setEmail] = useState('');
   const [invite, setInvite] = useState('');
   const [code, setCode] = useState('');
   const [phase, setPhase] = useState<'email' | 'sent'>('email');
   const [devLink, setDevLink] = useState<string | null>(null);
   const [devCode, setDevCode] = useState<string | null>(null);
   const [message, setMessage] = useState<string | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [setupEnabled, setSetupEnabled] = useState(false);
   const [busy, setBusy] = useState(false);
   const verifying = useRef(false);

   useEffect(() => {
      getAuthStatus()
         .then((result) => setSetupEnabled(result.data.setupEnabled))
         .catch(() => undefined);
   }, []);

   const next = safeNext(new URLSearchParams(window.location.search).get('next'));

   function goToNext(target: string) {
      if (isServerRoute(target)) window.location.assign(target);
      else route(target);
   }

   async function finishSignIn() {
      await refresh();
      goToNext(safeNext(new URLSearchParams(window.location.search).get('next')));
   }

   useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      if (!token || verifying.current) return;
      verifying.current = true;
      setBusy(true);
      verifyMagicLink(token)
         .then(finishSignIn)
         .catch((cause) => {
            setError(cause instanceof ApiError ? cause.message : 'Sign-in failed');
         })
         .finally(() => setBusy(false));
   }, [refresh, route]);

   async function submit(event: Event) {
      event.preventDefault();
      setBusy(true);
      setError(null);
      setMessage(null);
      setDevLink(null);
      setDevCode(null);
      try {
         const result = await requestMagicLink(email, invite || undefined, next);
         setCode('');
         setPhase('sent');
         if (result.data.devToken) {
            const params = new URLSearchParams({ token: result.data.devToken });
            if (next !== '/') params.set('next', next);
            setDevLink(`/login?${params.toString()}`);
            setDevCode(result.data.devCode ?? null);
            setMessage('Email is not configured, so use the development code or link below.');
         } else {
            setMessage('Check your email for a 6-digit code and a sign-in link.');
         }
      } catch (cause) {
         setError(cause instanceof ApiError ? cause.message : 'Request failed');
      } finally {
         setBusy(false);
      }
   }

   async function submitCode(event: Event) {
      event.preventDefault();
      setBusy(true);
      setError(null);
      try {
         await verifyLoginCode(email, code);
         await finishSignIn();
      } catch (cause) {
         setError(cause instanceof ApiError ? cause.message : 'Sign-in failed');
      } finally {
         setBusy(false);
      }
   }

   function resetEmail() {
      setPhase('email');
      setCode('');
      setDevLink(null);
      setDevCode(null);
      setError(null);
      setMessage(null);
   }

   return (
      <section className='mx-auto flex max-w-md flex-col gap-4'>
         <Card>
            <CardHeader>
               <CardTitle>{phase === 'sent' ? 'Check your email' : 'Sign in'}</CardTitle>
               <CardDescription>
                  {phase === 'sent'
                     ? `We sent a 6-digit code and a sign-in link to ${email.trim()}.`
                     : 'We email you a one-time code and a sign-in link.'}
               </CardDescription>
            </CardHeader>
            <CardContent className='flex flex-col gap-3'>
               {phase === 'email' ? (
                  <form
                     className='flex flex-col gap-3'
                     onSubmit={submit}
                  >
                     <div className='flex flex-col gap-1.5'>
                        <Label htmlFor='email'>Email</Label>
                        <Input
                           id='email'
                           type='email'
                           required
                           autoFocus
                           value={email}
                           onInput={(event) => setEmail((event.target as HTMLInputElement).value)}
                           placeholder='you@example.com'
                        />
                     </div>
                     <div className='flex flex-col gap-1.5'>
                        <Label htmlFor='invite'>Invite token (if required)</Label>
                        <Input
                           id='invite'
                           value={invite}
                           onInput={(event) => setInvite((event.target as HTMLInputElement).value)}
                           placeholder='Optional'
                        />
                     </div>
                     <Button
                        type='submit'
                        disabled={busy}
                     >
                        {busy ? 'Working…' : 'Send sign-in code'}
                     </Button>
                  </form>
               ) : (
                  <form
                     className='flex flex-col gap-3'
                     onSubmit={submitCode}
                  >
                     <div className='flex flex-col gap-1.5'>
                        <Label htmlFor='code'>6-digit code</Label>
                        <Input
                           id='code'
                           inputMode='numeric'
                           autoComplete='one-time-code'
                           pattern='[0-9]*'
                           maxLength={6}
                           required
                           autoFocus
                           className='text-center font-mono text-lg tracking-[0.35em]'
                           value={code}
                           onInput={(event) =>
                              setCode(
                                 (event.target as HTMLInputElement).value
                                    .replace(/\D/g, '')
                                    .slice(0, 6),
                              )
                           }
                           placeholder='123456'
                        />
                        <p className='text-sm text-muted-foreground'>
                           Sent to {email.trim()}. The code expires in 15 minutes.
                        </p>
                     </div>
                     <Button
                        type='submit'
                        disabled={busy || code.length !== 6}
                     >
                        {busy ? 'Signing in…' : 'Sign in with code'}
                     </Button>
                     <Button
                        type='button'
                        variant='ghost'
                        disabled={busy}
                        onClick={resetEmail}
                     >
                        Use a different email
                     </Button>
                  </form>
               )}

               <Button
                  type='button'
                  variant='outline'
                  disabled={busy}
                  onClick={() => {
                     void refresh().then(() => goToNext(next));
                  }}
               >
                  I've signed in in another tab — continue
               </Button>
            </CardContent>
         </Card>

         {setupEnabled && (
            <Alert variant='info'>
               <AlertDescription>
                  First time here, or locked out?{' '}
                  <a
                     className='underline underline-offset-4'
                     href='/setup'
                  >
                     Set up or recover owner access
                  </a>
                  .
               </AlertDescription>
            </Alert>
         )}

         {message && (
            <Alert variant='info'>
               <AlertDescription className='flex flex-col gap-2'>
                  <span>{message}</span>
                  {devCode && (
                     <span className='flex flex-wrap items-center gap-2'>
                        <code className='rounded bg-muted px-2 py-1 font-mono text-base tracking-widest'>
                           {devCode}
                        </code>
                        <Button
                           type='button'
                           size='sm'
                           variant='outline'
                           disabled={busy}
                           onClick={() => setCode(devCode)}
                        >
                           Use code
                        </Button>
                     </span>
                  )}
                  {devLink && (
                     <a
                        className='underline underline-offset-4'
                        href={devLink}
                     >
                        Open sign-in link
                     </a>
                  )}
               </AlertDescription>
            </Alert>
         )}
         {error && (
            <Alert variant='destructive'>
               <AlertDescription>{error}</AlertDescription>
            </Alert>
         )}
      </section>
   );
}
