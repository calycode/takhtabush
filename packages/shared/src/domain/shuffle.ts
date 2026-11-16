/**
 * Small deterministic PRNG shared by option shuffling, interval fuzzing, and
 * arcade boss draws. The same seed always yields the same sequence, so the
 * scheduler stays rebuildable from events and a session can be reproduced.
 */
function seedHash(seed: string): number {
   let hash = 2166136261;
   for (let i = 0; i < seed.length; i++) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
   }
   return hash >>> 0;
}

/** Deterministic number in [0, 1) for a seed string. */
export function seededRandom(seed: string): number {
   let hash = seedHash(seed);
   hash += 0x6d2b79f5;
   let t = hash;
   t = Math.imul(t ^ (t >>> 15), t | 1);
   t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
   return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Deterministic Fisher-Yates shuffle so option and pairing order stays stable. */
export function seededShuffle<T>(items: T[], seed: string): T[] {
   let hash = seedHash(seed);
   const rand = () => {
      hash += 0x6d2b79f5;
      let t = hash;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
   };
   const copy = [...items];
   for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
   }
   return copy;
}
