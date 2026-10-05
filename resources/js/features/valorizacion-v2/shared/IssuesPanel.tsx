import { Chip } from './Chip';

/** Lista plegable de observaciones a corregir (no se muestra si no hay). */
export function IssuesPanel({ issues }: { issues: string[] }) {
    if (issues.length === 0) {
        return null;
    }

    return (
        <details className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm dark:border-stone-800 dark:bg-stone-900">
            <summary className="cursor-pointer font-medium text-stone-700 dark:text-stone-200">
                <Chip tone="orange">{issues.length}</Chip> <span className="ml-1">observaciones por corregir</span>
            </summary>
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-stone-600 dark:text-stone-400">
                {issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                ))}
            </ul>
        </details>
    );
}
