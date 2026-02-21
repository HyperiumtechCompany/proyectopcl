export function resolveAvatarUrl(avatar?: string | null): string | undefined {
    if (!avatar) return undefined;

    const value = avatar.trim();
    if (!value) return undefined;

    if (
        value.startsWith('http://') ||
        value.startsWith('https://') ||
        value.startsWith('data:') ||
        value.startsWith('blob:')
    ) {
        return value;
    }

    if (value.startsWith('/storage/')) {
        return value;
    }

    if (value.startsWith('storage/')) {
        return `/${value}`;
    }

    if (value.startsWith('/')) {
        return value;
    }

    return `/storage/${value}`;
}
