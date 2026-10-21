import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'preact-iso';
import { Button } from '@caly/ui/components/button';
import { Input } from '@caly/ui/components/input';
import { Label } from '@caly/ui/components/label';
import { Select } from '@caly/ui/components/select';
import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from '@caly/ui/components/card';
import { Alert, AlertDescription } from '@caly/ui/components/alert';
import { Badge } from '@caly/ui/components/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@caly/ui/components/tabs';
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from '@caly/ui/components/table';
import type { SessionInfo } from '@caly/shared';
import {
   listSessions,
   requestMagicLink,
   revokeOtherSessions,
   revokeSession,
} from '../lib/api/auth';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';

function when(iso: string): string {
   return new Date(iso).toLocaleString();
}

export function Settings() {
   const { route } = useLocation();
   const { user, signOut } = useAuth();
   const { theme, setTheme } = useTheme();
   const [tab, setTab] = useState('account');
   const [invite, setInvite] = useState('');
   const [sessions, setSessions] = useState<SessionInfo[]>([]);
   const [status, setStatus] = useState<string | null>(null);
   const [devToken, setDevToken] = useState<string | null>(null);
   const [error, setError] = useState<string | null>(null);

   const loadSessions = useCallback(async () => {
      const result = await listSessions().catch(() => null);
      if (result) setSessions(result.data);
   }, []);

   useEffect(() => {
      void loadSessions();
   }, [loadSessions]);

   async function signOutNow() {
      await signOut();
      route('/login');
   }

   async function signOutSession(id: string) {
      await revokeSession(id).catch(() => undefined);
      await loadSessions();
   }

   async function signOutOthers() {
      const result = await revokeOtherSessions().catch(() => null);
      if (result) setStatus(`Signed out ${result.data.revoked} other session(s).`);
      await loadSessions();
   }

   async function resend() {
      if (!user?.email) return;
      setError(null);
      const result = await requestMagicLink(user.email, invite || undefined).catch(() => null);
      if (!result) {
         setError('Could not send a sign-in link.');
         return;
      }
      if (result.data.devToken) setDevToken(result.data.devToken);
      setStatus('Sign-in link sent.');
   }

   return (
      <section className='flex flex-col gap-6'>
         <h1 className='font-heading text-2xl font-medium'>Settings</h1>

         <Tabs
            value={tab}
            onValueChange={setTab}
         >
            <TabsList>
               <TabsTrigger value='account'>Account</TabsTrigger>
               <TabsTrigger value='sessions'>Sessions</TabsTrigger>
               <TabsTrigger value='preferences'>Preferences</TabsTrigger>
            </TabsList>

            <TabsContent value='account'>
               <Card>
                  <CardHeader>
                     <CardTitle>Account</CardTitle>
                     <CardDescription>Signed in as {user?.email ?? '—'}.</CardDescription>
                  </CardHeader>
                  <CardContent className='flex flex-col gap-3'>
                     <div className='flex flex-wrap gap-2'>
                        <Button
                           size='sm'
                           variant='outline'
                           onClick={() => void resend()}
                        >
                           Send a new sign-in link
                        </Button>
                        <Button
                           size='sm'
                           variant='destructive'
                           onClick={() => void signOutNow()}
                        >
                           Sign out
                        </Button>
                     </div>
                     {status && (
                        <Alert variant='info'>
                           <AlertDescription className='break-all'>
                              {status}
                              {devToken ? ` Dev token: ${devToken}` : ''}
                           </AlertDescription>
                        </Alert>
                     )}
                     {error && (
                        <Alert variant='destructive'>
                           <AlertDescription>{error}</AlertDescription>
                        </Alert>
                     )}
                  </CardContent>
               </Card>
            </TabsContent>

            <TabsContent value='sessions'>
               <Card>
                  <CardHeader>
                     <CardTitle>Sessions</CardTitle>
                     <CardDescription>Devices currently signed in to your account.</CardDescription>
                  </CardHeader>
                  <CardContent className='flex flex-col gap-3'>
                     {sessions.length === 0 ? (
                        <p className='text-sm text-muted-foreground'>No active sessions.</p>
                     ) : (
                        <Table>
                           <TableHeader>
                              <TableRow>
                                 <TableHead>Device</TableHead>
                                 <TableHead>Signed in</TableHead>
                                 <TableHead>Expires</TableHead>
                                 <TableHead />
                              </TableRow>
                           </TableHeader>
                           <TableBody>
                              {sessions.map((session) => (
                                 <TableRow key={session.id}>
                                    <TableCell className='max-w-52 truncate'>
                                       {session.userAgent ?? 'Unknown device'}{' '}
                                       {session.current && (
                                          <Badge variant='secondary'>This device</Badge>
                                       )}
                                    </TableCell>
                                    <TableCell className='text-muted-foreground'>
                                       {when(session.createdAt)}
                                    </TableCell>
                                    <TableCell className='text-muted-foreground'>
                                       {when(session.expiresAt)}
                                    </TableCell>
                                    <TableCell className='text-right'>
                                       <Button
                                          variant='ghost'
                                          size='sm'
                                          onClick={() => void signOutSession(session.id)}
                                       >
                                          Sign out
                                       </Button>
                                    </TableCell>
                                 </TableRow>
                              ))}
                           </TableBody>
                        </Table>
                     )}
                     <div>
                        <Button
                           size='sm'
                           variant='outline'
                           onClick={() => void signOutOthers()}
                        >
                           Sign out other sessions
                        </Button>
                     </div>
                  </CardContent>
               </Card>
            </TabsContent>

            <TabsContent value='preferences'>
               <Card>
                  <CardHeader>
                     <CardTitle>Preferences</CardTitle>
                     <CardDescription>
                        Study limits are applied server-side (20 new, 200 reviews/day).
                     </CardDescription>
                  </CardHeader>
                  <CardContent className='grid gap-3 sm:grid-cols-2'>
                     <div className='flex flex-col gap-1.5'>
                        <Label htmlFor='theme'>Theme</Label>
                        <Select
                           id='theme'
                           value={theme}
                           onValueChange={(value) => setTheme(value as 'light' | 'dark' | 'system')}
                           items={[
                              { value: 'system', label: 'System' },
                              { value: 'light', label: 'Light' },
                              { value: 'dark', label: 'Dark' },
                           ]}
                        />
                     </div>
                     <div className='flex flex-col gap-1.5'>
                        <Label htmlFor='invite'>Owner invite token</Label>
                        <Input
                           id='invite'
                           value={invite}
                           placeholder='Only when the deployment requires it'
                           onInput={(event) => setInvite((event.target as HTMLInputElement).value)}
                        />
                     </div>
                  </CardContent>
               </Card>
            </TabsContent>
         </Tabs>
      </section>
   );
}
