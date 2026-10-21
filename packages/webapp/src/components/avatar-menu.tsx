import { useLocation } from 'preact-iso';
import {
   ChevronsUpDownIcon,
   LogOutIcon,
   MoonIcon,
   ServerIcon,
   SettingsIcon,
   SunIcon,
} from 'lucide-react';
import { Identicon } from '@caly/ui/components/identicon';
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuGroup,
   DropdownMenuItem,
   DropdownMenuLabel,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from '@caly/ui/components/dropdown-menu';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';

export function AvatarMenu() {
   const { user, signOut } = useAuth();
   const { canonicalTheme, setTheme } = useTheme();
   const { route } = useLocation();

   if (!user) {
      return (
         <a
            href='/login'
            className='text-sm text-muted-foreground hover:text-foreground'
         >
            Sign in
         </a>
      );
   }

   const isDark = canonicalTheme === 'dark';
   const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');

   return (
      <DropdownMenu>
         <DropdownMenuTrigger className='gap-2 rounded-lg border-0 px-1.5 py-1'>
            <Identicon
               seed={user.id}
               size={28}
               className='rounded-lg'
            />
            <div className='hidden text-left text-xs leading-tight sm:grid'>
               <span className='truncate font-medium'>{user.displayName}</span>
               <span className='truncate text-muted-foreground'>{user.email}</span>
            </div>
            <ChevronsUpDownIcon className='size-3.5 text-muted-foreground' />
         </DropdownMenuTrigger>

         <DropdownMenuContent className='min-w-56'>
            <DropdownMenuLabel className='p-0 font-normal'>
               <div className='flex items-center gap-2 px-1 py-1.5'>
                  <Identicon
                     seed={user.id}
                     size={32}
                     className='rounded-lg'
                  />
                  <div className='grid text-left text-xs leading-tight'>
                     <span className='truncate font-medium'>{user.displayName}</span>
                     <span className='truncate text-muted-foreground'>{user.email}</span>
                  </div>
               </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
               <DropdownMenuItem onSelect={() => route('/settings')}>
                  <SettingsIcon />
                  Settings
               </DropdownMenuItem>
               <DropdownMenuItem onSelect={() => route('/mcp')}>
                  <ServerIcon />
                  MCP
               </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <div
               role='button'
               tabIndex={0}
               onClick={toggleTheme}
               onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                     event.preventDefault();
                     toggleTheme();
                  }
               }}
               className='flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted [&_svg]:size-4 [&_svg]:shrink-0'
            >
               {isDark ? <MoonIcon /> : <SunIcon />}
               <span className='flex-1'>Theme</span>
               <span className='text-muted-foreground'>{isDark ? 'Dark' : 'Light'}</span>
            </div>

            <DropdownMenuSeparator />

            <DropdownMenuItem
               onSelect={() => {
                  void signOut().then(() => route('/login'));
               }}
            >
               <LogOutIcon />
               Sign out
            </DropdownMenuItem>
         </DropdownMenuContent>
      </DropdownMenu>
   );
}
