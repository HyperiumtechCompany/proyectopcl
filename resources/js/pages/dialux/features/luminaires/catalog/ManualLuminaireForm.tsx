import { Wrench } from 'lucide-react';
import { useState } from 'react';
import { createManualLuminaire, extractErrorMessage, type ImportedLuminaireProduct, updateLuminaire } from './catalogApi';
import {
    DEFAULT_PHOTOMETRIC_CURVE_POINTS,
    MIN_PHOTOMETRIC_CURVE_POINTS,
    PhotometricCurveEditor,
    type PhotometricCurvePoint,
} from './PhotometricCurveEditor';

/**
 * Formulario de creación manual de luminaria (sin archivo IES/LDT), extraído
 * de `components/CatalogPanel.tsx` (Fase 2) sin cambiar comportamiento —
 * mismo endpoint, misma validación, mismo JSX.
 */

interface ManualLuminaireFormProps {
    onCreated: (product: ImportedLuminaireProduct) => void;
    product?: ImportedLuminaireProduct | null;
    onCancel?: () => void;
}

export function ManualLuminaireForm({ onCreated, product = null, onCancel }: ManualLuminaireFormProps) {
    const isEditing = product !== null;
    const [manualName, setManualName] = useState(product?.name ?? '');
    const [manualManufacturer, setManualManufacturer] = useState(product?.manufacturer ?? '');
    const [manualCatalogNumber, setManualCatalogNumber] = useState(product?.catalog_number ?? '');
    const [manualTotalLumens, setManualTotalLumens] = useState(product?.total_lumens?.toString() ?? '');
    const [manualPowerWatts, setManualPowerWatts] = useState(product?.power_watts?.toString() ?? '');
    const [manualCct, setManualCct] = useState(product?.cct ?? '');
    const [manualCriRa, setManualCriRa] = useState(product?.cri_ra?.toString() ?? '');
    const [manualBeamAngle50, setManualBeamAngle50] = useState('');
    const [manualUseCustomCurve, setManualUseCustomCurve] = useState(false);
    const [manualCurvePoints, setManualCurvePoints] = useState<PhotometricCurvePoint[]>(DEFAULT_PHOTOMETRIC_CURVE_POINTS);
    const [isSubmittingManual, setIsSubmittingManual] = useState(false);
    const [manualError, setManualError] = useState<string | null>(null);
    const [manualMessage, setManualMessage] = useState<string | null>(null);

    const submitManualProduct = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setManualError(null);
        setManualMessage(null);

        const totalLumens = Number.parseFloat(manualTotalLumens);
        const beamAngle50 = Number.parseFloat(manualBeamAngle50);

        if (!manualName.trim()) {
            setManualError('El nombre de la luminaria es obligatorio.');
            return;
        }
        if (!Number.isFinite(totalLumens) || totalLumens <= 0) {
            setManualError('Ingresa el flujo luminoso total (lm).');
            return;
        }

        let photometricTable: Array<{ gamma: number; candela: number }> | undefined;

        if (manualUseCustomCurve) {
            const parsedPoints = manualCurvePoints
                .map((point) => ({ gamma: Number.parseFloat(point.gamma), candela: Number.parseFloat(point.candela) }))
                .filter((point) => Number.isFinite(point.gamma) && Number.isFinite(point.candela));

            if (parsedPoints.length < MIN_PHOTOMETRIC_CURVE_POINTS) {
                setManualError('Ingresa al menos 3 puntos válidos (gamma, candela) de la curva fotométrica.');
                return;
            }
            if (parsedPoints.some((point) => point.gamma < 0 || point.gamma > 180 || point.candela < 0)) {
                setManualError('Los ángulos gamma deben estar entre 0-180° y las candelas no pueden ser negativas.');
                return;
            }
            photometricTable = parsedPoints;
        } else if (!isEditing && (!Number.isFinite(beamAngle50) || beamAngle50 <= 0 || beamAngle50 >= 180)) {
            setManualError('Ingresa el ángulo de apertura (beam angle 50%) en grados, entre 1 y 179.');
            return;
        }

        setIsSubmittingManual(true);

        try {
            const payload = {
                name: manualName.trim(),
                manufacturer: manualManufacturer.trim() || undefined,
                catalog_number: manualCatalogNumber.trim() || undefined,
                total_lumens: totalLumens,
                power_watts: manualPowerWatts ? Number.parseFloat(manualPowerWatts) : undefined,
                cct: manualCct.trim() || undefined,
                cri_ra: manualCriRa ? Number.parseFloat(manualCriRa) : undefined,
            };
            const { product: savedProduct, message } = isEditing
                ? await updateLuminaire(product.id, payload)
                : await createManualLuminaire({
                ...payload,
                beam_angle_50: photometricTable ? undefined : beamAngle50,
                photometric_table: photometricTable,
            });

            onCreated(savedProduct);
            setManualName('');
            setManualManufacturer('');
            setManualCatalogNumber('');
            setManualTotalLumens('');
            setManualPowerWatts('');
            setManualCct('');
            setManualCriRa('');
            setManualBeamAngle50('');
            setManualUseCustomCurve(false);
            setManualCurvePoints(DEFAULT_PHOTOMETRIC_CURVE_POINTS);
            setManualMessage(message ?? (isEditing ? 'Luminaria actualizada correctamente.' : 'Luminaria creada correctamente.'));
        } catch (error) {
            setManualError(extractErrorMessage(error, isEditing ? 'No se pudo actualizar la luminaria.' : 'No se pudo crear la luminaria.'));
        } finally {
            setIsSubmittingManual(false);
        }
    };

    return (
        <form
            onSubmit={submitManualProduct}
            className="mb-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-slate-700 dark:border-amber-800/60 dark:bg-amber-950/20 dark:text-slate-200 sm:p-4 [&_input:not([type='checkbox'])]:h-9 [&_input:not([type='checkbox'])]:rounded-lg [&_input:not([type='checkbox'])]:border-slate-300 [&_input:not([type='checkbox'])]:bg-white [&_input:not([type='checkbox'])]:px-3 [&_input:not([type='checkbox'])]:text-xs [&_input:not([type='checkbox'])]:text-slate-900 dark:[&_input:not([type='checkbox'])]:border-slate-700 dark:[&_input:not([type='checkbox'])]:bg-slate-900 dark:[&_input:not([type='checkbox'])]:text-slate-100"
        >
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {isEditing ? 'Editar luminaria' : 'Crear luminaria propia (sin archivo IES/LDT)'}
            </p>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {isEditing
                    ? 'Modifica los datos técnicos de esta luminaria y guarda los cambios.'
                    : 'Con el flujo luminoso y el ángulo de apertura (beam angle 50%) del datasheet se calcula una distribución fotométrica real para el cálculo punto-por-punto.'}
            </p>
            {!isEditing && <label className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-white/70 p-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-slate-950/30 dark:text-amber-200">
                <input
                    type="checkbox"
                    checked={manualUseCustomCurve}
                    onChange={(event) => setManualUseCustomCurve(event.target.checked)}
                    className="accent-amber-500"
                />
                Tengo la curva fotométrica real del fabricante (avanzado)
            </label>}
            <div className="mt-3 grid grid-cols-1 gap-2">
                <input
                    type="text"
                    value={manualName}
                    onChange={(event) => setManualName(event.target.value)}
                    placeholder="Nombre de la luminaria *"
                    className="rounded border border-gray-700/70 bg-gray-950/40 px-2 py-1 text-[9px] text-gray-200 placeholder:text-gray-600 focus:border-amber-600 focus:outline-none"
                />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                        type="text"
                        value={manualManufacturer}
                        onChange={(event) => setManualManufacturer(event.target.value)}
                        placeholder="Marca"
                        className="rounded border border-gray-700/70 bg-gray-950/40 px-2 py-1 text-[9px] text-gray-200 placeholder:text-gray-600 focus:border-amber-600 focus:outline-none"
                    />
                    <input
                        type="text"
                        value={manualCatalogNumber}
                        onChange={(event) => setManualCatalogNumber(event.target.value)}
                        placeholder="Código catálogo"
                        className="rounded border border-gray-700/70 bg-gray-950/40 px-2 py-1 text-[9px] text-gray-200 placeholder:text-gray-600 focus:border-amber-600 focus:outline-none"
                    />
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                        type="number"
                        min="1"
                        value={manualTotalLumens}
                        onChange={(event) => setManualTotalLumens(event.target.value)}
                        placeholder="Flujo luminoso (lm) *"
                        className="rounded border border-gray-700/70 bg-gray-950/40 px-2 py-1 text-[9px] text-gray-200 placeholder:text-gray-600 focus:border-amber-600 focus:outline-none"
                    />
                    {!isEditing && !manualUseCustomCurve && (
                        <input
                            type="number"
                            min="1"
                            max="179"
                            value={manualBeamAngle50}
                            onChange={(event) => setManualBeamAngle50(event.target.value)}
                            placeholder="Ángulo apertura 50% (°) *"
                            className="rounded border border-gray-700/70 bg-gray-950/40 px-2 py-1 text-[9px] text-gray-200 placeholder:text-gray-600 focus:border-amber-600 focus:outline-none"
                        />
                    )}
                </div>

                {!isEditing && manualUseCustomCurve && (
                    <PhotometricCurveEditor points={manualCurvePoints} onChange={setManualCurvePoints} />
                )}

                <div className="grid grid-cols-3 gap-1">
                    <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={manualPowerWatts}
                        onChange={(event) => setManualPowerWatts(event.target.value)}
                        placeholder="Potencia (W)"
                        className="rounded border border-gray-700/70 bg-gray-950/40 px-2 py-1 text-[9px] text-gray-200 placeholder:text-gray-600 focus:border-amber-600 focus:outline-none"
                    />
                    <input
                        type="text"
                        value={manualCct}
                        onChange={(event) => setManualCct(event.target.value)}
                        placeholder="CCT (ej. 4000K)"
                        className="rounded border border-gray-700/70 bg-gray-950/40 px-2 py-1 text-[9px] text-gray-200 placeholder:text-gray-600 focus:border-amber-600 focus:outline-none"
                    />
                    <input
                        type="number"
                        min="0"
                        max="100"
                        value={manualCriRa}
                        onChange={(event) => setManualCriRa(event.target.value)}
                        placeholder="CRI (Ra)"
                        className="rounded border border-gray-700/70 bg-gray-950/40 px-2 py-1 text-[9px] text-gray-200 placeholder:text-gray-600 focus:border-amber-600 focus:outline-none"
                    />
                </div>
            </div>
            <div className="mt-3 flex gap-2">
                {isEditing && <button type="button" onClick={onCancel} className="h-10 flex-1 rounded-lg border border-slate-300 px-4 text-xs font-semibold dark:border-slate-700">Cancelar</button>}
                <button
                    type="submit"
                    className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isSubmittingManual}
                >
                    <Wrench size={9} />
                    {isSubmittingManual ? (isEditing ? 'Guardando...' : 'Creando...') : (isEditing ? 'Guardar cambios' : 'Crear luminaria')}
                </button>
            </div>
            {manualError && <p className="mt-1 text-[8px] leading-tight text-red-300">{manualError}</p>}
            {manualMessage && <p className="mt-1 text-[8px] leading-tight text-emerald-300">{manualMessage}</p>}
        </form>
    );
}
