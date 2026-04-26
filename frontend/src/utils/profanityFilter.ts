const BLACKLIST = [
    'badword1',
    'badword2',
    // Add your words here
];

/**
 * Returns true if the text contains a blacklisted word.
 * Uses Regex to ensure we don't accidentally flag "button" because it contains "butt".
 */
export const containsProfanity = (text: string): boolean => {
    const lowerText = text.toLowerCase();
    
    return BLACKLIST.some(word => {
        // \b creates a word boundary so you only match the exact word
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        return regex.test(lowerText);
    });
};