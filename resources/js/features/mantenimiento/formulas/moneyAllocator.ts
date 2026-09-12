import Decimal from 'decimal.js';

export function allocateMoney(totalMinor: number, weights: Record<string, string>): Record<string, number> {
    const entries = Object.entries(weights);
    if (entries.length === 0) return {};
    if (entries.some(([, weight]) => !/^\d+(?:\.\d+)?$/.test(weight) || new Decimal(weight).isNegative())) throw new Error('Los pesos deben ser decimales no negativos.');
    const weightTotal = entries.reduce((sum, [, weight]) => sum.plus(weight), new Decimal(0));
    if (weightTotal.isZero()) throw new Error('La suma de pesos debe ser mayor que cero.');
    const absolute = Math.abs(totalMinor);
    const ranked = entries.map(([id, weight], index) => {
        const quota = new Decimal(absolute).times(weight).div(weightTotal);
        const base = quota.floor();
        return { id, index, base: base.toNumber(), remainder: quota.minus(base) };
    });
    let remaining = absolute - ranked.reduce((sum, item) => sum + item.base, 0);
    [...ranked].sort((left, right) => right.remainder.comparedTo(left.remainder) || left.index - right.index)
        .forEach((item) => { if (remaining-- > 0) item.base++; });
    return Object.fromEntries(ranked.map((item) => [item.id, totalMinor < 0 ? -item.base : item.base]));
}
