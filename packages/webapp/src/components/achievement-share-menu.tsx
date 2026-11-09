import { Share2Icon } from 'lucide-react';
import type { Achievement } from '@caly/shared';
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
} from '@caly/ui/components/dropdown-menu';
import { announceAchievements } from '../lib/achievements';
import {
   copyAchievementShare,
   openAchievementShare,
   recordAchievementShare,
   type ShareNetwork,
} from '../lib/achievement-share';
import { ShareGlyph } from './share-glyphs';

const NETWORKS: Array<{ network: ShareNetwork | 'copy'; label: string }> = [
   { network: 'x', label: 'Share on x.com' },
   { network: 'reddit', label: 'Share on Reddit' },
   { network: 'bluesky', label: 'Share on Bluesky' },
   { network: 'copy', label: 'Copy link' },
];

export function AchievementShareMenu({
   achievement,
   retro = false,
}: {
   achievement: Achievement;
   retro?: boolean;
}) {
   function pick(network: ShareNetwork | 'copy') {
      if (network === 'copy') {
         void copyAchievementShare(achievement);
      } else {
         openAchievementShare(network, achievement);
      }
      void recordAchievementShare(achievement)
         .then((items) => announceAchievements(items))
         .catch(() => undefined);
   }

   return (
      <DropdownMenu>
         <DropdownMenuTrigger
            className={
               retro
                  ? 'retro border-2 border-foreground bg-[#1a2430] p-1.5 text-amber-300 [&_svg]:size-3.5'
                  : 'border-0 p-1.5 [&_svg]:size-4'
            }
            ariaLabel={`Share ${achievement.title}`}
         >
            <Share2Icon />
         </DropdownMenuTrigger>
         <DropdownMenuContent>
            {NETWORKS.map((item) => (
               <DropdownMenuItem
                  key={item.network}
                  onSelect={() => pick(item.network)}
               >
                  <ShareGlyph network={item.network} />
                  {item.label}
               </DropdownMenuItem>
            ))}
         </DropdownMenuContent>
      </DropdownMenu>
   );
}
