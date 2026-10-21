import { buttonVariants } from '@caly/ui/components/button';

export function NotFound() {
   return (
      <section className='flex flex-col items-start gap-4'>
         <h1 className='font-heading text-2xl font-medium'>Not found</h1>
         <p className='text-sm text-muted-foreground'>That route does not exist.</p>
         <a
            href='/'
            className={buttonVariants()}
         >
            Go home
         </a>
      </section>
   );
}
