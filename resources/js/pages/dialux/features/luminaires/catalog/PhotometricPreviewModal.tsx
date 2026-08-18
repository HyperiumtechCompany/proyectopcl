import { Fragment, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { buildCartesianSvgFromMatrix } from '@/pages/dialux/export/derived/data/buildCartesianSvgFromMatrix';
import { buildPolarSvgFromMatrix } from '@/pages/dialux/export/derived/data/buildPolarSvgFromMatrix';
import { computeConeDiagram, type ConeDiagramRow } from '@/pages/dialux/export/derived/data/computeConeDiagram';
import { computeEngineUgrTables } from '@/pages/dialux/export/derived/data/computeEngineUgrTable';
import type { ProductUgrTable } from '@/pages/dialux/export/domain/types';
import type { ImportedLuminaireProduct, PreviewedLuminaireProduct } from './catalogApi';
import { IntensityTable } from './IntensityTable';

/**
 * Modal de previsualización/edición de una luminaria — estructura de
 * pestañas equivalente al LDT Editor de DIALux (General / Luminaria /
 * Lámparas / Distribución lumínica → Curva polar / Diagrama cartesiano /
 * Diagrama de cono / Tabla UGR), con TODO lo que el parser extrajo del
 * archivo real, editable antes de guardar.
 *
 * Ronda 21d: mismo componente para DOS modos —
 *   'create': justo después de subir un archivo (Ronda 21, `preview` sin
 *     `id`, aún no persistido) — el botón guarda vía `/products/import`.
 *   'edit': una luminaria YA guardada con fotometría real (`id` numérico,
 *     abierta desde el lápiz del catálogo) — el botón guarda vía
 *     `/products/{id}` (PATCH), sin volver a subir el archivo. Las
 *     luminarias sin fotometría real (manuales/sintéticas) NO usan este
 *     modal para editar — siguen con `ManualLuminaireForm`, que sí sabe
 *     editar su curva sintética/manual.
 *
 * Hallazgo real que motivó la primera versión (2026-08-17): faltaba "Type of
 * lamps" (ej. "14W LED") — sin ese dato, la potencia de la LÁMPARA (14W) es
 * indistinguible de la potencia CONECTADA de la luminaria completa (17W,
 * incluye driver), dos magnitudes reales y distintas del mismo archivo.
 */

export interface PhotometricPreviewOverrides {
    name: string;
    manufacturer: string;
    total_lumens: string;
    power_watts: string;
    cct: string;
    cri_ra: string;
    lamp_type: string;
    /** Ronda 21f: imágenes editables en el mismo modal, en ambos modos — antes el formulario de subida (create) y este modal (edit) tenían estados de imagen separados y duplicados, y el usuario reportó que no podía adjuntarlas al crear. */
    productImage: File | null;
    brandLogo: File | null;
    clearProductImage: boolean;
    clearBrandLogo: boolean;
    /** Solo aplica en modo `edit` — reemplaza el archivo fotométrico original sin perder el `id` del producto. `null` en modo `create` (el archivo ya se seleccionó antes de abrir el modal). */
    replacementFile: File | null;
}

/** El producto mostrado puede venir de un parseo sin guardar (`id: null`) o de un producto ya persistido en el catálogo (`id: number`, modo edición). */
type PhotometricModalProduct = PreviewedLuminaireProduct | ImportedLuminaireProduct;

interface PhotometricPreviewModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: 'create' | 'edit';
    preview: PhotometricModalProduct;
    warnings: string[];
    isConfirming: boolean;
    onConfirm: (overrides: PhotometricPreviewOverrides) => void;
}

export const LUMINAIRE_TYPE_LABELS: Record<number, string> = {
    1: 'Punto, rotacionalmente simétrica',
    2: 'Lineal',
    3: 'No puntual, no rotacionalmente simétrica',
};

const MAIN_TABS = ['General', 'Luminaria', 'Lámparas', 'Distribución lumínica'] as const;
type MainTab = (typeof MAIN_TABS)[number];

const DISTRIBUTION_TABS = ['Tabla de intensidades', 'Curva polar', 'Diagrama cartesiano', 'Diagrama de cono', 'Tabla UGR'] as const;
type DistributionTab = (typeof DISTRIBUTION_TABS)[number];

function formatNumber(value: number | null | undefined, digits = 1): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    return value.toLocaleString('es-PE', { maximumFractionDigits: digits });
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
        >
            {children}
        </button>
    );
}

function ReadOnlyField({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <dt className="text-[11px] text-muted-foreground">{label}</dt>
            <dd className="text-sm">{value}</dd>
        </div>
    );
}

export function PhotometricPreviewModal({ open, onOpenChange, mode, preview, warnings, isConfirming, onConfirm }: PhotometricPreviewModalProps) {
    const [mainTab, setMainTab] = useState<MainTab>('General');
    const [distributionTab, setDistributionTab] = useState<DistributionTab>('Curva polar');

    const [name, setName] = useState(preview.name ?? '');
    const [manufacturer, setManufacturer] = useState(preview.manufacturer ?? '');
    const [totalLumens, setTotalLumens] = useState(preview.total_lumens != null ? String(preview.total_lumens) : '');
    const [powerWatts, setPowerWatts] = useState(preview.power_watts != null ? String(preview.power_watts) : '');
    const [cct, setCct] = useState(preview.cct ?? '');
    const [criRa, setCriRa] = useState(preview.cri_ra != null ? String(preview.cri_ra) : '');
    const [lampType, setLampType] = useState(preview.metadata?.lamp_type ?? '');
    const [ugrTables, setUgrTables] = useState<ProductUgrTable[] | null>(null);
    const [ugrUnavailableReason, setUgrUnavailableReason] = useState<string | null>(null);
    const [isRecalculating, setIsRecalculating] = useState(false);

    // Ronda 21f: imágenes se capturan AQUÍ en ambos modos — el formulario de
    // subida (`ImportPhotometryForm`) ya no las pide, solo selecciona el
    // archivo fotométrico; toda la ficha (nombre, marca, imágenes, lámpara)
    // se completa/edita en este modal antes de guardar, sea create o edit.
    const [productImage, setProductImage] = useState<File | null>(null);
    const [brandLogo, setBrandLogo] = useState<File | null>(null);
    const [clearProductImage, setClearProductImage] = useState(false);
    const [clearBrandLogo, setClearBrandLogo] = useState(false);
    const [replacementFile, setReplacementFile] = useState<File | null>(null);
    const currentProductImageUrl = preview.product_image_url ?? null;
    const currentBrandLogoUrl = preview.brand_logo_url ?? null;

    const web = preview.photometric_web ?? null;

    const polarSvg = useMemo(() => (web ? buildPolarSvgFromMatrix(web, name || 'Producto') : null), [web, name]);
    const cartesianSvg = useMemo(() => (web ? buildCartesianSvgFromMatrix(web, name || 'Producto') : null), [web, name]);
    const coneRows = useMemo<ConeDiagramRow[] | null>(() => computeConeDiagram(web, preview.beam_angle_50), [web, preview.beam_angle_50]);

    const editedLumens = Number(totalLumens);
    const referenceLumens = web?.reference_lumens ?? null;
    const candelaScale = referenceLumens && referenceLumens > 0 && Number.isFinite(editedLumens) && editedLumens > 0 ? editedLumens / referenceLumens : 1;

    const recalculateUgrTable = () => {
        if (!web) {
            setUgrTables(null);
            setUgrUnavailableReason('Sin matriz fotométrica — no se puede calcular una tabla UGR de referencia.');
            return;
        }
        setIsRecalculating(true);
        try {
            const scaledWeb =
                candelaScale !== 1
                    ? { ...web, candela: web.candela.map((row) => row.map((value) => value * candelaScale)), reference_lumens: editedLumens }
                    : web;
            const result = computeEngineUgrTables({ photometricWeb: scaledWeb });
            if (result.available) {
                setUgrTables(result.tables);
                setUgrUnavailableReason(null);
            } else {
                setUgrTables(null);
                setUgrUnavailableReason(result.reason);
            }
        } finally {
            setIsRecalculating(false);
        }
    };

    const luminaireType = preview.metadata?.luminaire_type;
    const dimensions = preview.dimensions;
    const opening = preview.luminous_opening;
    const efficiency = Number.isFinite(editedLumens) && Number(powerWatts) > 0 ? editedLumens / Number(powerWatts) : null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[92vh] w-full max-w-[95vw] flex-col overflow-hidden sm:max-w-360">
                <DialogHeader>
                    <DialogTitle>{mode === 'edit' ? 'Editar luminaria' : 'Previsualizar luminaria importada'}</DialogTitle>
                </DialogHeader>

                {warnings.length > 0 && (
                    <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
                        <ul className="list-inside list-disc space-y-0.5">
                            {warnings.map((warning, index) => (
                                <li key={index}>{warning}</li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="flex items-center gap-1 border-b border-border pb-2">
                    {MAIN_TABS.map((tab) => (
                        <TabButton key={tab} active={mainTab === tab} onClick={() => setMainTab(tab)}>
                            {tab}
                        </TabButton>
                    ))}
                </div>

                <div className="-mx-6 flex-1 overflow-y-auto px-6 py-2">
                    {mainTab === 'General' && (
                        <div className="grid max-w-xl grid-cols-1 gap-3">
                            <div>
                                <Label htmlFor="preview-name" className="text-xs">Nombre</Label>
                                <Input id="preview-name" value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-xs" />
                            </div>
                            <div>
                                <Label htmlFor="preview-manufacturer" className="text-xs">Fabricante</Label>
                                <Input id="preview-manufacturer" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} className="h-8 text-xs" />
                            </div>
                            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                                <ReadOnlyField label="Código / número interno" value={preview.catalog_number ?? '—'} />
                                <ReadOnlyField label="Formato de origen" value={<span className="uppercase">{preview.source_format}</span>} />
                            </dl>

                            <div className="mt-2 grid grid-cols-2 gap-3 border-t border-border pt-3">
                                <div>
                                    <Label className="text-xs">Imagen del producto</Label>
                                    {currentProductImageUrl && !productImage && (
                                        <img src={currentProductImageUrl} alt="" className="mt-1 mb-1 h-16 w-16 rounded border border-border object-cover" />
                                    )}
                                    <Input
                                        type="file"
                                        accept="image/*"
                                        className="h-8 text-xs"
                                        onChange={(e) => setProductImage(e.target.files?.[0] ?? null)}
                                    />
                                    {currentProductImageUrl && !productImage && (
                                        <label className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                                            <input type="checkbox" checked={clearProductImage} onChange={(e) => setClearProductImage(e.target.checked)} />
                                            Quitar imagen actual
                                        </label>
                                    )}
                                </div>
                                <div>
                                    <Label className="text-xs">Logo de la marca</Label>
                                    {currentBrandLogoUrl && !brandLogo && (
                                        <img src={currentBrandLogoUrl} alt="" className="mt-1 mb-1 h-16 w-16 rounded border border-border object-contain bg-white" />
                                    )}
                                    <Input
                                        type="file"
                                        accept="image/*"
                                        className="h-8 text-xs"
                                        onChange={(e) => setBrandLogo(e.target.files?.[0] ?? null)}
                                    />
                                    {currentBrandLogoUrl && !brandLogo && (
                                        <label className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                                            <input type="checkbox" checked={clearBrandLogo} onChange={(e) => setClearBrandLogo(e.target.checked)} />
                                            Quitar logo actual
                                        </label>
                                    )}
                                </div>
                                {mode === 'edit' && (
                                    <div className="col-span-2">
                                        <Label className="text-xs">Reemplazar archivo fotométrico (.ies / .ldt / .gldf)</Label>
                                        <Input
                                            type="file"
                                            accept=".ies,.ldt,.gldf,.txt,.xml"
                                            className="h-8 text-xs"
                                            onChange={(e) => setReplacementFile(e.target.files?.[0] ?? null)}
                                        />
                                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                                            Sube un archivo nuevo solo si esta luminaria tiene el LDT/IES equivocado o incompleto — reemplaza la
                                            curva fotométrica, las tablas y los gráficos sin perder el registro ni sus referencias en proyectos guardados.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {mainTab === 'Luminaria' && (
                        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs md:grid-cols-3">
                            <ReadOnlyField label="Forma (Ityp)" value={luminaireType != null ? (LUMINAIRE_TYPE_LABELS[luminaireType] ?? `Código ${luminaireType}`) : '—'} />
                            <ReadOnlyField
                                label="Dimensiones de la luminaria (L×A×H)"
                                value={dimensions ? `${formatNumber(dimensions.length, 3)} × ${formatNumber(dimensions.width, 3)} × ${formatNumber(dimensions.height, 3)} m` : '—'}
                            />
                            <ReadOnlyField
                                label="Área luminosa (L×A)"
                                value={opening ? `${formatNumber(opening.length, 3)} × ${formatNumber(opening.width, 3)} m` : '—'}
                            />
                            <ReadOnlyField label="DFF — flujo hacia abajo" value={preview.metadata?.downward_flux_fraction_pct != null ? `${formatNumber(preview.metadata.downward_flux_fraction_pct)}%` : '—'} />
                            <ReadOnlyField label="LORL — rendimiento de la luminaria" value={preview.metadata?.light_output_ratio_pct != null ? `${formatNumber(preview.metadata.light_output_ratio_pct)}%` : '—'} />
                            <ReadOnlyField label="Factor de conversión" value={preview.metadata?.conversion_factor != null ? formatNumber(preview.metadata.conversion_factor, 3) : '—'} />
                            <ReadOnlyField label="Inclinación (tilt)" value={preview.metadata?.tilt_deg != null ? `${formatNumber(preview.metadata.tilt_deg)}°` : '—'} />
                            <ReadOnlyField label="Ángulo de haz (50%)" value={preview.beam_angle_50 != null ? `${formatNumber(preview.beam_angle_50)}°` : '—'} />
                            <ReadOnlyField label="Ángulo de campo (10%)" value={preview.beam_angle_10 != null ? `${formatNumber(preview.beam_angle_10)}°` : '—'} />
                            <ReadOnlyField label="Candela máxima" value={preview.max_candela != null ? `${formatNumber(preview.max_candela, 0)} cd` : '—'} />
                        </dl>
                    )}

                    {mainTab === 'Lámparas' && (
                        <div className="max-w-xl space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                                <ReadOnlyField label="Número de lámparas" value={preview.metadata?.num_lamps ?? '—'} />
                                <div>
                                    <Label htmlFor="preview-lamp-type" className="text-xs">Tipo de lámpara</Label>
                                    <Input id="preview-lamp-type" value={lampType} onChange={(e) => setLampType(e.target.value)} className="h-8 text-xs" placeholder="ej. 14W LED" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <Label htmlFor="preview-lumens" className="text-xs">Flujo luminoso total (lm)</Label>
                                    <Input id="preview-lumens" type="number" value={totalLumens} onChange={(e) => setTotalLumens(e.target.value)} className="h-8 text-xs" />
                                </div>
                                <div>
                                    <Label htmlFor="preview-watts" className="text-xs">Potencia conectada (W)</Label>
                                    <Input id="preview-watts" type="number" value={powerWatts} onChange={(e) => setPowerWatts(e.target.value)} className="h-8 text-xs" />
                                    <p className="mt-0.5 text-[10px] text-muted-foreground">Luminaria completa (incluye driver) — distinta de la potencia de la lámpara de arriba.</p>
                                </div>
                                <div>
                                    <Label htmlFor="preview-cct" className="text-xs">Temperatura de color (CCT)</Label>
                                    <Input id="preview-cct" value={cct} onChange={(e) => setCct(e.target.value)} className="h-8 text-xs" placeholder="4000K" />
                                </div>
                                <div>
                                    <Label htmlFor="preview-cri" className="text-xs">Índice de reproducción cromática (CRI/Ra)</Label>
                                    <Input id="preview-cri" type="number" value={criRa} onChange={(e) => setCriRa(e.target.value)} className="h-8 text-xs" />
                                </div>
                            </div>
                            <ReadOnlyField label="Rendimiento (calculado)" value={efficiency != null ? `${formatNumber(efficiency)} lm/W` : '—'} />
                        </div>
                    )}

                    {mainTab === 'Distribución lumínica' && (
                        <div>
                            <div className="mb-3 flex items-center gap-1">
                                {DISTRIBUTION_TABS.map((tab) => (
                                    <TabButton key={tab} active={distributionTab === tab} onClick={() => setDistributionTab(tab)}>
                                        {tab}
                                    </TabButton>
                                ))}
                            </div>

                            {distributionTab === 'Tabla de intensidades' && <IntensityTable web={web} />}

                            {distributionTab === 'Curva polar' &&
                                (polarSvg ? (
                                    <div className="w-fit rounded-md border border-border bg-white p-1" dangerouslySetInnerHTML={{ __html: polarSvg }} />
                                ) : (
                                    <p className="text-xs text-muted-foreground">Sin matriz fotométrica válida.</p>
                                ))}

                            {distributionTab === 'Diagrama cartesiano' &&
                                (cartesianSvg ? (
                                    <div className="w-fit rounded-md border border-border bg-white p-1" dangerouslySetInnerHTML={{ __html: cartesianSvg }} />
                                ) : (
                                    <p className="text-xs text-muted-foreground">Sin matriz fotométrica válida.</p>
                                ))}

                            {distributionTab === 'Diagrama de cono' &&
                                (coneRows ? (
                                    <div className="max-w-md space-y-2">
                                        <p className="text-[11px] text-muted-foreground">
                                            Proyección del haz (ángulo de apertura 50%) a distancias estándar bajo la luminaria — E0 en el centro, Eavg promedio dentro del círculo del haz.
                                        </p>
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="border-b border-border text-left text-muted-foreground">
                                                    <th className="py-1 pr-2 font-medium">Distancia</th>
                                                    <th className="py-1 pr-2 font-medium">Ø haz</th>
                                                    <th className="py-1 pr-2 font-medium">E0</th>
                                                    <th className="py-1 font-medium">Eavg</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {coneRows.map((row) => (
                                                    <tr key={row.distanceM} className="border-b border-border/50">
                                                        <td className="py-1 pr-2">{row.distanceM} m</td>
                                                        <td className="py-1 pr-2">{formatNumber(row.beamDiameterM, 2)} m</td>
                                                        <td className="py-1 pr-2">{formatNumber(row.e0Lux, 0)} lx</td>
                                                        <td className="py-1">{formatNumber(row.eAvgLux, 0)} lx</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground">Sin matriz fotométrica o ángulo de haz válido para proyectar el cono.</p>
                                ))}

                            {distributionTab === 'Tabla UGR' && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Button type="button" size="sm" variant="outline" onClick={recalculateUgrTable} disabled={isRecalculating}>
                                            {isRecalculating ? 'Calculando…' : 'Recalcular con los valores actuales'}
                                        </Button>
                                        <span className="text-[11px] text-muted-foreground">SHR = 0.25 · H = 2 m · observador a 1.2 m</span>
                                    </div>
                                    {ugrTables === null && ugrUnavailableReason === null && (
                                        <p className="text-xs text-muted-foreground">Pulsa "Recalcular" para generar la tabla con los valores de la pestaña Lámparas.</p>
                                    )}
                                    {ugrUnavailableReason && <p className="text-xs text-muted-foreground">{ugrUnavailableReason}</p>}
                                    {ugrTables && (
                                        <div className="space-y-2">
                                            <p className="rounded-md border border-blue-300 bg-blue-50 p-2 text-[11px] text-blue-900 dark:border-blue-800/60 dark:bg-blue-950/30 dark:text-blue-200">
                                                {ugrTables[0].disclaimer} Combinaciones de reflectancia habituales (techo/pared/piso) — no una transcripción letra por letra del grid del texto CIE 117 pagado.
                                            </p>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-xs">
                                                    <thead>
                                                        <tr className="border-b border-border text-left text-muted-foreground">
                                                            <th rowSpan={2} className="py-1 pr-2 align-bottom font-medium">Sala</th>
                                                            {ugrTables.map((table) => (
                                                                <th key={`${table.reflectances.ceiling}-${table.reflectances.wall}`} colSpan={2} className="border-l border-border py-1 pl-2 text-center font-medium">
                                                                    {table.reflectances.ceiling}/{table.reflectances.wall}/{table.reflectances.floor}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                        <tr className="border-b border-border text-left text-muted-foreground">
                                                            {ugrTables.map((table) => (
                                                                <Fragment key={`${table.reflectances.ceiling}-${table.reflectances.wall}-header`}>
                                                                    <th className="border-l border-border py-1 pl-2 font-normal">⊥</th>
                                                                    <th className="py-1 font-normal">∥</th>
                                                                </Fragment>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {ugrTables[0].entries.map((_, roomIndex) => (
                                                            <tr key={ugrTables[0].entries[roomIndex].roomLabel} className="border-b border-border/50">
                                                                <td className="py-1 pr-2 whitespace-nowrap">{ugrTables[0].entries[roomIndex].roomLabel}</td>
                                                                {ugrTables.map((table) => {
                                                                    const entry = table.entries[roomIndex];
                                                                    return (
                                                                        <Fragment key={`${table.reflectances.ceiling}-${table.reflectances.wall}-${entry.roomLabel}`}>
                                                                            <td className="border-l border-border py-1 pl-2">
                                                                                {entry.ugrCrosswise != null ? formatNumber(entry.ugrCrosswise) : '—'}
                                                                            </td>
                                                                            <td className="py-1">
                                                                                {entry.ugrEndwise != null ? formatNumber(entry.ugrEndwise) : '—'}
                                                                            </td>
                                                                        </Fragment>
                                                                    );
                                                                })}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground">⊥ = mirando perpendicular al eje de la luminaria (transversal) · ∥ = mirando a lo largo del eje (longitudinal)</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isConfirming}>
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        onClick={() =>
                            onConfirm({
                                name,
                                manufacturer,
                                total_lumens: totalLumens,
                                power_watts: powerWatts,
                                cct,
                                cri_ra: criRa,
                                lamp_type: lampType,
                                productImage,
                                brandLogo,
                                clearProductImage,
                                clearBrandLogo,
                                replacementFile,
                            })
                        }
                        disabled={isConfirming}
                    >
                        {isConfirming ? 'Guardando…' : mode === 'edit' ? 'Guardar cambios' : 'Guardar en catálogo'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
