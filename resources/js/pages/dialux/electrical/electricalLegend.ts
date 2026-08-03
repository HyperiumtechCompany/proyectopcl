export type ElectricalLegendItem = {
    code: string;
    cadCode?: string;
    label: string;
    group: 'Iluminación' | 'Interruptores' | 'Tomacorrientes' | 'Tableros' | 'Cableado';
    color: string;
};

/** Fuente única para la leyenda mostrada en el editor y exportada a CAD. */
export const ELECTRICAL_LEGEND_ITEMS: ElectricalLegendItem[] = [
    { code: '⊗', cadCode: 'L', label: 'Luminaria', group: 'Iluminación', color: '#facc15' },
    { code: 'E', label: 'Luminaria de emergencia', group: 'Iluminación', color: '#22c55e' },
    { code: 'S', label: 'Interruptor simple', group: 'Interruptores', color: '#d946ef' },
    { code: '2S', label: 'Interruptor doble', group: 'Interruptores', color: '#d946ef' },
    { code: 'Sc', label: 'Interruptor conmutado', group: 'Interruptores', color: '#d946ef' },
    { code: 'T', label: 'Tomacorriente bajo · 0.40 m', group: 'Tomacorrientes', color: '#22c55e' },
    { code: 'TI', label: 'Tomacorriente inicial · 1.50 m', group: 'Tomacorrientes', color: '#22c55e' },
    { code: 'TA', label: 'Tomacorriente alto · 1.20/1.80 m', group: 'Tomacorrientes', color: '#3b82f6' },
    { code: 'TC', label: 'Tomacorriente de techo', group: 'Tomacorrientes', color: '#22c55e' },
    { code: 'TR', label: 'Tomacorriente comunicaciones · 2.00 m', group: 'Tomacorrientes', color: '#ef4444' },
    { code: 'TP', label: 'Tomacorriente de piso · NPT', group: 'Tomacorrientes', color: '#16a34a' },
    { code: 'TG', label: 'Tablero general', group: 'Tableros', color: '#ef4444' },
    { code: 'TD', label: 'Tablero de distribución por piso', group: 'Tableros', color: '#22c55e' },
    { code: '—', label: 'Cableado pared/techo', group: 'Cableado', color: '#ef4444' },
    { code: '⌒', cadCode: 'ARCO', label: 'Cableado empotrado en piso', group: 'Cableado', color: '#f97316' },
];
