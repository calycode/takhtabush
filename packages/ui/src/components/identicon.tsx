import { cn } from '#lib/utils';

function hashString(value: string): number {
   let hash = 2166136261;
   for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
   }
   return hash >>> 0;
}

/**
 * A deterministic, generated avatar (5×5 mirrored identicon) derived from a
 * seed such as a user id — no image storage required.
 */
export function Identicon({
   seed,
   size = 28,
   className,
}: {
   seed: string;
   size?: number;
   className?: string;
}) {
   const hash = hashString(seed || 'anonymous');
   const hue = hash % 360;
   const foreground = `hsl(${hue} 62% 42%)`;
   const background = `hsl(${hue} 45% 92%)`;

   const cells: Array<[number, number]> = [];
   for (let col = 0; col < 3; col++) {
      for (let row = 0; row < 5; row++) {
         if ((hash >> (row * 3 + col)) & 1) {
            cells.push([col, row]);
            if (col < 2) cells.push([4 - col, row]);
         }
      }
   }

   return (
      <svg
         width={size}
         height={size}
         viewBox='0 0 5 5'
         className={cn('shrink-0', className)}
         role='img'
         aria-hidden='true'
      >
         <rect
            width='5'
            height='5'
            fill={background}
         />
         {cells.map(([x, y]) => (
            <rect
               key={`${x}-${y}`}
               x={x}
               y={y}
               width='1'
               height='1'
               rx='0.18'
               fill={foreground}
            />
         ))}
      </svg>
   );
}
