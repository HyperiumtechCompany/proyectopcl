export function abbreviateText(text: string, maxLength = 72): string {
    const cleanText = text.replace(/\s+/g, ' ').trim();

    if (cleanText.length <= maxLength) {
        return cleanText;
    }

    return `${cleanText.slice(0, maxLength).trimEnd()}...`;
}
