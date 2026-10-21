import { useState } from 'react';
import { Button } from '@caly/ui/components/button';
import { Label } from '@caly/ui/components/label';
import { Alert, AlertDescription } from '@caly/ui/components/alert';
import { cn } from '@caly/ui/lib/utils';
import { ApiError } from '../lib/api/client';
import { uploadCardMedia } from '../lib/api/media';

const ACCEPT: Record<'image' | 'audio', string> = {
   image: 'image/png,image/jpeg,image/webp,image/gif',
   audio: 'audio/webm,audio/mpeg,audio/mp4,audio/wav',
};

/** Dropzone that uploads to R2 and returns the media id used by a card. */
export function MediaPicker({
   label,
   kind,
   value,
   onChange,
}: {
   label: string;
   kind: 'image' | 'audio';
   value?: string;
   onChange: (mediaId?: string) => void;
}) {
   const [busy, setBusy] = useState(false);
   const [dragging, setDragging] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const inputId = `media-${kind}`;

   async function upload(file: File) {
      setBusy(true);
      setError(null);
      try {
         const media = await uploadCardMedia(file);
         onChange(media.id);
      } catch (cause) {
         setError(cause instanceof ApiError ? cause.message : 'Upload failed');
      } finally {
         setBusy(false);
      }
   }

   function pick(event: Event) {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      input.value = '';
      if (file) void upload(file);
   }

   function drop(event: DragEvent) {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer?.files?.[0];
      if (file) void upload(file);
   }

   return (
      <div className='flex flex-col gap-1.5'>
         <Label htmlFor={inputId}>{label}</Label>

         {value ? (
            <div className='flex items-center gap-2'>
               {kind === 'image' ? (
                  <img
                     src={`/media/${value}`}
                     alt='Uploaded'
                     className='h-20 rounded-md border object-contain'
                  />
               ) : (
                  <audio
                     controls
                     src={`/media/${value}`}
                  />
               )}
               <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={() => onChange(undefined)}
               >
                  Remove
               </Button>
            </div>
         ) : (
            <label
               htmlFor={inputId}
               onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
               }}
               onDragLeave={() => setDragging(false)}
               onDrop={drop}
               className={cn(
                  'flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed px-4 py-5 text-center text-xs transition-colors',
                  dragging ? 'border-primary bg-muted/50' : 'border-border hover:bg-muted/40',
               )}
            >
               <span className='font-medium'>
                  {busy
                     ? 'Uploading…'
                     : `Drop ${kind === 'image' ? 'an image' : 'audio'} here, or click to choose`}
               </span>
               <span className='text-muted-foreground'>
                  {kind === 'image'
                     ? 'PNG, JPEG, WebP, GIF · up to 5 MB'
                     : 'WebM, MP3, M4A, WAV · up to 10 MB'}
               </span>
               <input
                  id={inputId}
                  type='file'
                  accept={ACCEPT[kind]}
                  className='hidden'
                  disabled={busy}
                  onChange={pick}
               />
            </label>
         )}

         {error && (
            <Alert variant='destructive'>
               <AlertDescription>{error}</AlertDescription>
            </Alert>
         )}
      </div>
   );
}
