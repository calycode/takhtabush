import { useMemo } from 'react';
import type { AccuracyTrendPoint } from '@caly/shared';

const WIDTH = 640;
const HEIGHT = 180;
const PADDING = { top: 16, right: 16, bottom: 28, left: 36 };

function formatPercent(value: number): string {
   return `${Math.round(value * 100)}%`;
}

export function AccuracyTrendChart({ points }: { points: AccuracyTrendPoint[] }) {
   const sorted = useMemo(() => [...points].sort((a, b) => a.date.localeCompare(b.date)), [points]);

   if (sorted.length < 2) {
      return (
         <p className='py-6 text-center text-sm text-muted-foreground'>
            Review this deck on at least two days to see an accuracy trend.
         </p>
      );
   }

   const innerWidth = WIDTH - PADDING.left - PADDING.right;
   const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
   const stepX = innerWidth / (sorted.length - 1);
   const x = (index: number) => PADDING.left + index * stepX;
   const y = (accuracy: number) => PADDING.top + (1 - accuracy) * innerHeight;
   const line = sorted.map((point, index) => `${x(index)},${y(point.accuracy)}`).join(' ');
   const area = [
      `${PADDING.left},${PADDING.top + innerHeight}`,
      ...sorted.map((point, index) => `${x(index)},${y(point.accuracy)}`),
      `${PADDING.left + innerWidth},${PADDING.top + innerHeight}`,
   ].join(' ');
   const first = sorted[0]!;
   const last = sorted[sorted.length - 1]!;

   return (
      <div className='overflow-x-auto'>
         <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className='h-48 w-full min-w-[480px]'
            role='img'
            aria-label='Accuracy trend over time'
         >
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
               const gridY = y(ratio);
               return (
                  <g key={ratio}>
                     <line
                        x1={PADDING.left}
                        x2={WIDTH - PADDING.right}
                        y1={gridY}
                        y2={gridY}
                        className='stroke-border'
                        strokeDasharray={ratio === 0 ? undefined : '3 4'}
                     />
                     <text
                        x={PADDING.left - 8}
                        y={gridY + 4}
                        textAnchor='end'
                        className='fill-muted-foreground text-[10px]'
                     >
                        {formatPercent(ratio)}
                     </text>
                  </g>
               );
            })}

            <polygon
               points={area}
               className='fill-primary/10'
            />
            <polyline
               points={line}
               fill='none'
               strokeWidth={2}
               className='stroke-primary'
               strokeLinejoin='round'
               strokeLinecap='round'
            />

            {sorted.map((point, index) => (
               <circle
                  key={point.date}
                  cx={x(index)}
                  cy={y(point.accuracy)}
                  r={3}
                  className='fill-primary stroke-card'
                  strokeWidth={1.5}
               >
                  <title>
                     {point.date}: {formatPercent(point.accuracy)} accuracy over {point.total}{' '}
                     review{point.total === 1 ? '' : 's'}
                  </title>
               </circle>
            ))}

            <text
               x={PADDING.left}
               y={HEIGHT - 6}
               className='fill-muted-foreground text-[10px]'
            >
               {first.date}
            </text>
            <text
               x={WIDTH - PADDING.right}
               y={HEIGHT - 6}
               textAnchor='end'
               className='fill-muted-foreground text-[10px]'
            >
               {last.date}
            </text>
         </svg>
      </div>
   );
}
