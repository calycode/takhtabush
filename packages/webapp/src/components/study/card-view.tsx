import { StudyCard as SharedStudyCard } from '@caly/ui/study';
import type { Card, ReviewResponse, StudyCardData, StudyMode } from '@caly/shared';

export { interactionFor } from '@caly/shared';

export function toStudyCardData(item: Card): StudyCardData {
   return {
      id: item.id,
      type: item.type,
      front: item.front,
      back: item.back,
      clozeText: item.clozeText,
      choices: item.choices,
      correctChoice: item.correctChoice,
      imageUrl: item.imageMediaId ? `/media/${item.imageMediaId}` : null,
      audioUrl: item.audioMediaId ? `/media/${item.audioMediaId}` : null,
   };
}

export function StudyCard({
   card,
   mode,
   pool,
   busy,
   onAnswered,
}: {
   card: Card;
   mode: StudyMode;
   pool: Card[];
   busy: boolean;
   onAnswered: (response: ReviewResponse) => void;
}) {
   return (
      <SharedStudyCard
         card={toStudyCardData(card)}
         mode={mode}
         pool={pool.map(toStudyCardData)}
         busy={busy}
         onAnswered={onAnswered}
      />
   );
}
