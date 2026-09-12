// Mismo catálogo que BudgetTree.tsx (módulo Presupuesto) para que la unidad se lea igual
// en todo Costos. Si el valor guardado no está en el catálogo (dato legado / importado) se
// agrega como primera opción en vez de perderlo silenciosamente.
const UNIDADES_COMUNES = ['gl', 'und', 'm', 'm²', 'm³', 'kg', 'ton', 'hh', 'hm', 'dia', 'mes', 'est'];

interface Props {
    value: string;
    editable: boolean;
    className?: string;
    onCommit: (value: string | null) => void;
}

export default function MoUnitSelect({ value, editable, className = '', onCommit }: Props) {
    if (!editable) {
        return <span className={`block px-2 py-1 text-center ${className}`}>{value || '—'}</span>;
    }

    const options = value && !UNIDADES_COMUNES.includes(value) ? [value, ...UNIDADES_COMUNES] : UNIDADES_COMUNES;

    return (
        <select
            value={value}
            onChange={(event) => onCommit(event.target.value || null)}
            className={`w-full cursor-pointer appearance-none bg-transparent px-1 py-1 text-center outline-none focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 dark:focus:bg-blue-950/40 ${className}`}
        >
            <option value="">—</option>
            {options.map((u) => (
                <option key={u} value={u} className="bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                    {u}
                </option>
            ))}
        </select>
    );
}
