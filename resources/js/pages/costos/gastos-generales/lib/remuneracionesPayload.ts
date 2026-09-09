import type { RemuneracionRow } from '../stores/remuneracionesStore';
import { factorParticipacion, numeroSeguro } from './calculos';

export function normalizarRemuneracionesParaGuardar(rows: RemuneracionRow[]) {
    return rows.map((row) => ({
        id: row.id,
        presupuesto_id: row.presupuesto_id,
        gg_variable_id: row.gg_variable_id ?? null,
        cargo: String(row.cargo || 'Nuevo Cargo').trim() || 'Nuevo Cargo',
        categoria: row.categoria || null,
        participacion: factorParticipacion(row.participacion) * 100,
        cantidad: Math.max(0, numeroSeguro(row.cantidad, 1)),
        meses: Math.max(1, numeroSeguro(row.meses, 1)),
        sueldo_basico: Math.max(0, numeroSeguro(row.sueldo_basico)),
        asignacion_familiar: Math.max(0, numeroSeguro(row.asignacion_familiar)),
        snp: Math.max(0, numeroSeguro(row.snp)),
        essalud: Math.max(0, numeroSeguro(row.essalud)),
        cts: Math.max(0, numeroSeguro(row.cts)),
        vacaciones: Math.max(0, numeroSeguro(row.vacaciones)),
        gratificacion: Math.max(0, numeroSeguro(row.gratificacion)),
    }));
}

export function obtenerMensajeValidacion(error: unknown): string {
    const response = (error as { response?: { data?: { errors?: Record<string, string[]>; error?: string } } })?.response;
    const data = response?.data;
    if (data?.error) return data.error;
    const firstError = data?.errors ? Object.values(data.errors).flat()[0] : undefined;
    return firstError || 'No se pudieron guardar las remuneraciones.';
}
