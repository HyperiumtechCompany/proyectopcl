import { TIPO_LABEL } from './styles';
import type { GrupoTipo } from './types';

interface Props {
    value: GrupoTipo | null;
    onChange: (tipo: GrupoTipo | null) => void;
    className?: string;
}

/** Clasificación del padre de nivel 1 (P1: solo el nivel 1 se clasifica). */
export default function GrupoTipoSelect({ value, onChange, className = '' }: Props) {
    return (
        <select
            value={value ?? ''}
            onChange={(event) => onChange((event.target.value || null) as GrupoTipo | null)}
            onClick={(event) => event.stopPropagation()}
            title="Clasificación del nivel"
            className={`rounded border border-white/20 bg-transparent px-1 py-0.5 text-[10px] font-normal outline-none ${className}`}
        >
            <option value="" className="text-slate-900">Sin clasificar</option>
            {Object.entries(TIPO_LABEL).map(([key, label]) => (
                <option key={key} value={key} className="text-slate-900">{label}</option>
            ))}
        </select>
    );
}
