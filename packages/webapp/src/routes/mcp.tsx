import { useCallback, useEffect, useState } from 'react';
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
import { Badge } from '@caly/ui/components/badge';
import { Separator } from '@caly/ui/components/separator';
import { Alert, AlertDescription } from '@caly/ui/components/alert';
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from '@caly/ui/components/table';
import { MCP_ALL_SCOPES, MCP_TOOL_DEFINITIONS, type ApiKey, type McpScope } from '@caly/shared';
import { createApiKey, listApiKeys, revokeApiKey } from '../lib/api/api-keys';

function configSnippet(url: string, key: string) {
   return `{
  "mcpServers": {
     "takhtabush": {
      "url": "${url}",
      "headers": { "Authorization": "Bearer ${key}" }
    }
  }
}`;
}

export function McpGuide() {
   const endpoint = `${window.location.origin}/mcp`;
   const [keys, setKeys] = useState<ApiKey[]>([]);
   const [name, setName] = useState('MCP client');
   const [scopes, setScopes] = useState<McpScope[]>([...MCP_ALL_SCOPES]);
   const [expiresInDays, setExpiresInDays] = useState('');
   const [secret, setSecret] = useState<string | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [busy, setBusy] = useState(false);

   const refresh = useCallback(async () => {
      const result = await listApiKeys().catch(() => null);
      if (result) setKeys(result.data);
   }, []);

   useEffect(() => {
      void refresh();
   }, [refresh]);

   function toggleScope(scope: McpScope, checked: boolean) {
      setScopes((current) =>
         checked ? [...new Set([...current, scope])] : current.filter((value) => value !== scope),
      );
   }

   async function create() {
      if (!name.trim() || scopes.length === 0) {
         setError('Provide a name and at least one scope.');
         return;
      }
      setBusy(true);
      setError(null);
      try {
         const result = await createApiKey({
            name: name.trim(),
            scopes,
            expiresInDays: expiresInDays ? Number(expiresInDays) : undefined,
         });
         setSecret(result.data.secret);
         setKeys((current) => [result.data.apiKey, ...current]);
      } catch (cause) {
         setError(cause instanceof Error ? cause.message : 'Failed to create key');
      } finally {
         setBusy(false);
      }
   }

   async function revoke(id: string) {
      await revokeApiKey(id).catch(() => undefined);
      setKeys((current) => current.filter((key) => key.id !== id));
   }

   return (
      <section className='flex flex-col gap-6'>
         <div className='flex flex-col gap-2'>
            <h1 className='font-heading text-2xl font-medium'>MCP</h1>
            <p className='text-sm text-muted-foreground'>
               Connect coding agents and MCP clients with a URL and an API key header.
            </p>
         </div>

         <Card>
            <CardHeader>
               <CardTitle>Create an API key</CardTitle>
               <CardDescription>
                  The secret is shown once. Scope it to only what the client needs.
               </CardDescription>
            </CardHeader>
            <CardContent className='flex flex-col gap-3'>
               <div className='flex flex-col gap-1.5'>
                  <Label htmlFor='key-name'>Name</Label>
                  <Input
                     id='key-name'
                     value={name}
                     onInput={(event) => setName((event.target as HTMLInputElement).value)}
                  />
               </div>
               <div className='flex flex-wrap gap-3'>
                  {MCP_ALL_SCOPES.map((scope) => (
                     <label
                        key={scope}
                        className='flex items-center gap-1.5 text-xs'
                     >
                        <input
                           type='checkbox'
                           checked={scopes.includes(scope)}
                           onChange={(event) =>
                              toggleScope(scope, (event.target as HTMLInputElement).checked)
                           }
                        />
                        {scope}
                     </label>
                  ))}
               </div>
               <div className='flex flex-col gap-1.5 sm:max-w-xs'>
                  <Label htmlFor='key-expiry'>Expiration</Label>
                  <Select
                     id='key-expiry'
                     value={expiresInDays}
                     onValueChange={setExpiresInDays}
                     items={[
                        { value: '', label: 'Never' },
                        { value: '30', label: '30 days' },
                        { value: '90', label: '90 days' },
                        { value: '365', label: '1 year' },
                     ]}
                  />
               </div>
               {error && (
                  <Alert variant='destructive'>
                     <AlertDescription>{error}</AlertDescription>
                  </Alert>
               )}
               <div>
                  <Button
                     size='sm'
                     disabled={busy}
                     onClick={() => void create()}
                  >
                     Create key
                  </Button>
               </div>

               {secret && (
                  <Alert variant='info'>
                     <AlertDescription className='flex flex-col gap-2'>
                        <span className='font-medium'>
                           Copy this secret now — it will not be shown again.
                        </span>
                        <code className='break-all rounded-md bg-muted px-2 py-1'>{secret}</code>
                        <pre className='overflow-x-auto rounded-md bg-muted px-2 py-1 text-xs'>
                           {configSnippet(endpoint, secret)}
                        </pre>
                        <div className='flex gap-2'>
                           <Button
                              size='sm'
                              variant='outline'
                              onClick={() => navigator.clipboard?.writeText(secret)}
                           >
                              Copy key
                           </Button>
                           <Button
                              size='sm'
                              variant='outline'
                              onClick={() =>
                                 navigator.clipboard?.writeText(configSnippet(endpoint, secret))
                              }
                           >
                              Copy config
                           </Button>
                        </div>
                     </AlertDescription>
                  </Alert>
               )}
            </CardContent>
         </Card>

         <Card>
            <CardHeader>
               <CardTitle>Active keys</CardTitle>
               <CardDescription>Endpoint: {endpoint}</CardDescription>
            </CardHeader>
            <CardContent>
               {keys.length === 0 ? (
                  <p className='text-sm text-muted-foreground'>No API keys yet.</p>
               ) : (
                  <Table>
                     <TableHeader>
                        <TableRow>
                           <TableHead>Name</TableHead>
                           <TableHead>Prefix</TableHead>
                           <TableHead>Scopes</TableHead>
                           <TableHead>Expires</TableHead>
                           <TableHead>Last used</TableHead>
                           <TableHead />
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {keys.map((key) => (
                           <TableRow key={key.id}>
                              <TableCell className='font-medium'>{key.name}</TableCell>
                              <TableCell className='font-mono'>{key.keyPrefix}…</TableCell>
                              <TableCell>
                                 <span className='flex flex-wrap gap-1'>
                                    {key.scopes.map((scope) => (
                                       <Badge
                                          key={scope}
                                          variant='secondary'
                                       >
                                          {scope}
                                       </Badge>
                                    ))}
                                 </span>
                              </TableCell>
                              <TableCell className='text-muted-foreground'>
                                 {!key.expiresAt ? (
                                    'Never'
                                 ) : key.expiresAt < new Date().toISOString() ? (
                                    <Badge variant='destructive'>expired</Badge>
                                 ) : (
                                    new Date(key.expiresAt).toLocaleDateString()
                                 )}
                              </TableCell>
                              <TableCell className='text-muted-foreground'>
                                 {key.lastUsedAt ?? '—'}
                              </TableCell>
                              <TableCell className='text-right'>
                                 <Button
                                    variant='ghost'
                                    size='sm'
                                    onClick={() => void revoke(key.id)}
                                 >
                                    Revoke
                                 </Button>
                              </TableCell>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               )}
            </CardContent>
         </Card>

         <Card>
            <CardHeader>
               <CardTitle>Tools</CardTitle>
               <CardDescription>Curated workflow tools, scoped and audited.</CardDescription>
            </CardHeader>
            <CardContent>
               <Table>
                  <TableHeader>
                     <TableRow>
                        <TableHead>Tool</TableHead>
                        <TableHead>Scope</TableHead>
                        <TableHead>Purpose</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {MCP_TOOL_DEFINITIONS.map((tool) => (
                        <TableRow key={tool.name}>
                           <TableCell className='font-mono'>{tool.name}</TableCell>
                           <TableCell>
                              <Badge variant='secondary'>{tool.scope}</Badge>
                           </TableCell>
                           <TableCell className='text-muted-foreground'>
                              {tool.description}
                           </TableCell>
                        </TableRow>
                     ))}
                  </TableBody>
               </Table>
            </CardContent>
         </Card>

         <Separator />
         <p className='text-xs text-muted-foreground'>
            MCP never accesses D1 or R2 directly, and cannot invoke Clef outside `get_study_plan`.
         </p>
      </section>
   );
}
