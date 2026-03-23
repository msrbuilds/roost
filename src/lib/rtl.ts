// Unicode ranges for RTL scripts
const RTL_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/**
 * Strips HTML tags from a string to get plain text for analysis.
 */
function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Detects if text content is predominantly RTL (Arabic, Urdu, Persian, etc.)
 * by checking the first meaningful characters.
 */
export function isRtlText(text: string): boolean {
    const plain = stripHtml(text);
    if (!plain) return false;

    // Find the first letter character (skip spaces, numbers, punctuation, emojis)
    for (const char of plain) {
        if (RTL_REGEX.test(char)) return true;
        // If we hit a Latin letter first, it's LTR
        if (/[a-zA-Z]/.test(char)) return false;
    }

    return false;
}

/**
 * Returns CSS class names for RTL text styling.
 */
export function getRtlClass(text: string): string {
    return isRtlText(text) ? 'rtl-text' : '';
}
