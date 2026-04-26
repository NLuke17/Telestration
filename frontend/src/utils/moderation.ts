import { Filter } from 'glin-profanity';

export const wordFilter = new Filter({
    languages: ['english'],
    detectLeetspeak: true,
    leetspeakLevel: 'moderate', // Catches @$$, f4ck, etc.
    replaceWith: '***' 
});