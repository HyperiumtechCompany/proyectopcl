import type { ElectricalNetworkData } from '../domain/types';

export function ElectricalTreeView({
    data,
    onSelect,
}: {
    data: ElectricalNetworkData;
    onSelect: (id: string) => void;
}) {
    const nodes = new Map(data.nodes.map((node) => [node.id, node]));
    const children = new Map<string, string[]>();
    for (const edge of data.edges)
        children.set(edge.sourceNodeId, [
            ...(children.get(edge.sourceNodeId) ?? []),
            edge.targetNodeId,
        ]);
    const branch = (id: string, seen = new Set<string>()): React.ReactNode => {
        const node = nodes.get(id);
        if (!node || seen.has(id)) return null;
        const next = new Set(seen).add(id);
        return (
            <li key={id}>
                <button
                    type="button"
                    onClick={() => onSelect(id)}
                    className="rounded px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
                >
                    {node.label}
                </button>
                {(children.get(id)?.length ?? 0) > 0 && (
                    <ul className="ml-4 border-l border-slate-200 pl-2 dark:border-slate-700">
                        {children.get(id)!.map((child) => branch(child, next))}
                    </ul>
                )}
            </li>
        );
    };
    return (
        <ul className="p-3">
            {data.rootNodeId ? (
                branch(data.rootNodeId)
            ) : (
                <li className="text-xs text-slate-500">Sin raíz</li>
            )}
        </ul>
    );
}
