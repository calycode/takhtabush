import { useMemo, useState } from 'react';
import { Button, buttonVariants } from '@caly/ui/components/button';
import { Label } from '@caly/ui/components/label';
import { Textarea } from '@caly/ui/components/textarea';
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
import { cn } from '@caly/ui/lib/utils';
import {
   ImportParseError,
   MAX_IMPORT_ROWS,
   parseImportContent,
   type DelimiterChoice,
   type ImportFormat,
   type ImportResult,
   type TagSeparator,
} from '@caly/shared';
import { ApiError } from '../../lib/api/client';
import { importDeck } from '../../lib/api/decks';

const SAMPLE = `front,back,tags
hola,hello,spanish;greetings
gato,cat,spanish;animals`;

const MAX_FILE_BYTES = 1_000_000;
const PREVIEW_ROWS = 8;
const ACCEPT = '.csv,.tsv,.json,text/csv,text/tab-separated-values,application/json';
const EXTENSION_FORMAT: Record<string, ImportFormat> = { csv: 'csv', tsv: 'tsv', json: 'json' };

function validate(
   format: ImportFormat,
   content: string,
   hasHeader: boolean,
   delimiter: DelimiterChoice,
   tagSeparator: TagSeparator,
) {
   try {
      return {
         ok: true as const,
         ...parseImportContent(format, content, hasHeader, { delimiter, tagSeparator }),
      };
   } catch (cause) {
      return {
         ok: false as const,
         message: cause instanceof ImportParseError ? cause.message : 'Could not parse content',
      };
   }
}

export function DeckImport({ id }: { id?: string }) {
   const deckId = id ?? '';
   const [format, setFormat] = useState<ImportFormat>('csv');
   const [hasHeader, setHasHeader] = useState(true);
   const [delimiter, setDelimiter] = useState<DelimiterChoice>('auto');
   const [tagSeparator, setTagSeparator] = useState<TagSeparator>(';');
   const [content, setContent] = useState('');
   const [result, setResult] = useState<ImportResult | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [fileError, setFileError] = useState<string | null>(null);
   const [dragging, setDragging] = useState(false);
   const [busy, setBusy] = useState(false);

   const validation = useMemo(
      () => validate(format, content, hasHeader, delimiter, tagSeparator),
      [format, content, hasHeader, delimiter, tagSeparator],
   );
   const rowCount = validation.ok ? validation.rows.length : 0;

   async function handleFile(file: File) {
      setFileError(null);
      setResult(null);
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!EXTENSION_FORMAT[ext]) {
         setFileError('Unsupported file type. Use .csv, .tsv, or .json.');
         return;
      }
      if (file.size > MAX_FILE_BYTES) {
         setFileError('File is too large (maximum 1 MB).');
         return;
      }
      try {
         setFormat(EXTENSION_FORMAT[ext]);
         setContent(await file.text());
      } catch {
         setFileError('Could not read the file.');
      }
   }

   function pickFile(event: Event) {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      input.value = '';
      if (file) void handleFile(file);
   }

   function drop(event: DragEvent) {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer?.files?.[0];
      if (file) void handleFile(file);
   }

   async function submit(event: Event) {
      event.preventDefault();
      if (!validation.ok || rowCount === 0) return;
      setBusy(true);
      setError(null);
      try {
         const response = await importDeck(deckId, {
            format,
            content,
            hasHeader,
            tags: [],
            delimiter,
            tagSeparator,
         });
         setResult(response.data);
      } catch (cause) {
         setError(cause instanceof ApiError ? cause.message : 'Import failed');
      } finally {
         setBusy(false);
      }
   }

   return (
      <section className='mx-auto flex max-w-2xl flex-col gap-4'>
         <h1 className='font-heading text-2xl font-medium'>Import cards</h1>
         <Card>
            <CardHeader>
               <CardTitle>Upload or paste</CardTitle>
               <CardDescription>
                  CSV, TSV, or JSON. Columns: front, back, tags — check the preview before
                  importing.
               </CardDescription>
            </CardHeader>
            <CardContent>
               <form
                  className='flex flex-col gap-3'
                  onSubmit={submit}
               >
                  <label
                     htmlFor='file'
                     onDragOver={(event) => {
                        event.preventDefault();
                        setDragging(true);
                     }}
                     onDragLeave={() => setDragging(false)}
                     onDrop={drop}
                     className={cn(
                        'flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed px-6 py-8 text-center text-sm transition-colors',
                        dragging ? 'border-primary bg-muted/50' : 'border-border hover:bg-muted/40',
                     )}
                  >
                     <span className='font-medium'>Drop a file here, or click to choose</span>
                     <span className='text-xs text-muted-foreground'>
                        CSV, TSV, or JSON · up to 1 MB
                     </span>
                     <input
                        id='file'
                        type='file'
                        accept={ACCEPT}
                        className='hidden'
                        onChange={pickFile}
                     />
                  </label>

                  <div className='grid gap-3 sm:grid-cols-2'>
                     <div className='flex flex-col gap-1.5'>
                        <Label htmlFor='format'>Format</Label>
                        <Select
                           id='format'
                           value={format}
                           onValueChange={(value) => setFormat(value as ImportFormat)}
                           items={[
                              { value: 'csv', label: 'CSV' },
                              { value: 'tsv', label: 'TSV' },
                              { value: 'json', label: 'JSON' },
                           ]}
                        />
                     </div>
                     <div className='flex items-end gap-2 pb-1'>
                        <input
                           id='has-header'
                           type='checkbox'
                           checked={hasHeader}
                           onChange={(event) =>
                              setHasHeader((event.target as HTMLInputElement).checked)
                           }
                        />
                        <Label htmlFor='has-header'>First row is a header</Label>
                     </div>
                     {format === 'csv' && (
                        <div className='flex flex-col gap-1.5'>
                           <Label htmlFor='delimiter'>Column delimiter</Label>
                           <Select
                              id='delimiter'
                              value={delimiter}
                              onValueChange={(value) => setDelimiter(value as DelimiterChoice)}
                              items={[
                                 { value: 'auto', label: 'Auto-detect' },
                                 { value: ',', label: 'Comma  ,' },
                                 { value: ';', label: 'Semicolon  ;' },
                                 { value: '\t', label: 'Tab' },
                                 { value: '|', label: 'Pipe  |' },
                              ]}
                           />
                        </div>
                     )}
                     {format !== 'json' && (
                        <div className='flex flex-col gap-1.5'>
                           <Label htmlFor='tag-separator'>Tag separator</Label>
                           <Select
                              id='tag-separator'
                              value={tagSeparator}
                              onValueChange={(value) => setTagSeparator(value as TagSeparator)}
                              items={[
                                 { value: ';', label: 'Semicolon  ;' },
                                 { value: ',', label: 'Comma  ,' },
                                 { value: '|', label: 'Pipe  |' },
                                 { value: ' ', label: 'Space' },
                                 { value: 'none', label: 'None (one tag)' },
                              ]}
                           />
                        </div>
                     )}
                  </div>
                  <div className='flex flex-col gap-1.5'>
                     <Label htmlFor='content'>Or paste content</Label>
                     <Textarea
                        id='content'
                        className='min-h-40 font-mono'
                        placeholder={SAMPLE}
                        value={content}
                        onInput={(event) => setContent((event.target as HTMLTextAreaElement).value)}
                     />
                  </div>

                  {fileError && (
                     <Alert variant='destructive'>
                        <AlertDescription>{fileError}</AlertDescription>
                     </Alert>
                  )}
                  {content.trim() &&
                     (validation.ok ? (
                        <Alert variant={validation.errors.length > 0 ? 'destructive' : 'info'}>
                           <AlertDescription>
                              Parsed {validation.rows.length} row(s)
                              {validation.errors.length > 0
                                 ? `, ${validation.errors.length} issue(s)`
                                 : ''}
                              .
                              {validation.rows.length > MAX_IMPORT_ROWS
                                 ? ` Only the first ${MAX_IMPORT_ROWS} rows will import.`
                                 : ''}
                           </AlertDescription>
                        </Alert>
                     ) : (
                        <Alert variant='destructive'>
                           <AlertDescription>{validation.message}</AlertDescription>
                        </Alert>
                     ))}

                  {validation.ok && validation.rows.length > 0 && (
                     <div className='overflow-x-auto rounded-md border'>
                        <table className='w-full text-left text-xs'>
                           <thead className='bg-muted/50 text-muted-foreground'>
                              <tr>
                                 <th className='px-2 py-1.5 font-medium'>Front</th>
                                 <th className='px-2 py-1.5 font-medium'>Back</th>
                                 <th className='px-2 py-1.5 font-medium'>Tags</th>
                              </tr>
                           </thead>
                           <tbody>
                              {validation.rows.slice(0, PREVIEW_ROWS).map((row, index) => {
                                 const tags = row.tags ?? [];
                                 return (
                                    <tr
                                       key={index}
                                       className='border-t align-top'
                                    >
                                       <td className='px-2 py-1.5'>{row.front}</td>
                                       <td
                                          className={cn(
                                             'px-2 py-1.5',
                                             row.back ? '' : 'text-muted-foreground',
                                          )}
                                       >
                                          {row.back ?? '—'}
                                       </td>
                                       <td className='px-2 py-1.5'>
                                          <div className='flex flex-wrap gap-1'>
                                             {tags.length > 0 ? (
                                                tags.map((tag) => (
                                                   <Badge
                                                      key={tag}
                                                      variant='secondary'
                                                   >
                                                      {tag}
                                                   </Badge>
                                                ))
                                             ) : (
                                                <span className='text-muted-foreground'>—</span>
                                             )}
                                          </div>
                                       </td>
                                    </tr>
                                 );
                              })}
                           </tbody>
                        </table>
                        {validation.rows.length > PREVIEW_ROWS && (
                           <p className='border-t px-2 py-1.5 text-xs text-muted-foreground'>
                              +{validation.rows.length - PREVIEW_ROWS} more row(s)
                           </p>
                        )}
                     </div>
                  )}

                  {validation.ok && validation.errors.length > 0 && (
                     <ul className='flex flex-col gap-1 text-xs text-destructive'>
                        {validation.errors.slice(0, 5).map((issue) => (
                           <li key={issue.row}>
                              Row {issue.row}: {issue.message}
                           </li>
                        ))}
                        {validation.errors.length > 5 && (
                           <li>+{validation.errors.length - 5} more issue(s)</li>
                        )}
                     </ul>
                  )}

                  <div className='flex gap-2'>
                     <Button
                        type='submit'
                        disabled={busy || !validation.ok || rowCount === 0}
                     >
                        Import
                     </Button>
                     <a
                        href={`/decks/${deckId}`}
                        className={buttonVariants({ variant: 'outline' })}
                     >
                        Back to deck
                     </a>
                  </div>
               </form>
            </CardContent>
         </Card>

         {error && (
            <Alert variant='destructive'>
               <AlertDescription>{error}</AlertDescription>
            </Alert>
         )}

         {result && (
            <Alert variant='info'>
               <AlertDescription>
                  Imported {result.imported}, updated {result.updated}, skipped {result.skipped}.
                  {result.errors.length > 0 && ` ${result.errors.length} row error(s).`}
               </AlertDescription>
            </Alert>
         )}
      </section>
   );
}
