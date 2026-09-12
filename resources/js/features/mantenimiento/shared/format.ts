// Formato de moneda compartido por RESUMEN/MO/MAT/GG — antes duplicado idéntico en cada
// hoja; centralizado para garantizar que un cambio de formato se vea igual en las 4.
export function money(value: string, decimals = 2): string {
    const negative = value.startsWith('-');
    const [int, frac = ''] = value.replace('-', '').split('.');
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${negative ? '-' : ''}S/ ${grouped}.${frac.padEnd(decimals, '0').slice(0, decimals)}`;
}
