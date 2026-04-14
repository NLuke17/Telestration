/**
 * Default phrases for random fallbacks (initial prompts, timed-out guesses, etc.).
 */
export const FALLBACK_PROMPTS: readonly string[] = [
  'A cat wearing a top hat',
  'A robot dancing in the rain',
  'A dragon eating ice cream',
  'A wizard casting a spell',
  'A superhero flying over a city',
  'An astronaut on the moon',
  'A pirate searching for treasure',
  'A ninja in a library',
  'A detective solving a mystery',
  'A chef cooking a meal',
  'A knight fighting a dragon',
  'A surfer riding a wave',
  'A scientist in a lab',
  'A musician playing guitar',
  'A firefighter saving a cat',
  'A teacher in a classroom',
];

export function pickRandomFallbackPrompt(): string {
  const i = Math.floor(Math.random() * FALLBACK_PROMPTS.length);
  return FALLBACK_PROMPTS[i] ?? 'Something surprising';
}
