import { router, usePage } from '@inertiajs/react';
import React, {
    useCallback,
    useMemo,
    useRef,
    useState,
    useEffect,
} from 'react';
import AppLayout from '@/layouts/app-layout';
import Luckysheet from '@/components/costos/tablas/Luckysheet';
import type { BreadcrumbItem } from '@/types';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    ChevronLeft,
    Settings2,
    Save,
    RefreshCcw,
    CheckCircle2,
    AlertCircle,
    Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ColumnDef {
    key: string;
    label: string;
    width: number;
}

interface SanitariasPageProps {
    project: {
        id: number;
        nombre: string;
    };
    config: {
        cantidad_modulos: number;
        nombre_proyecto?: string | null;
    };
    modulos: Record<string, Record<string, any>[]>;
    exterior: Record<string, any>[];
    cisterna: Record<string, any>[];
    resumen: Record<string, any>[];
    [key: string]: unknown;
}

const BASE_COLUMNS: ColumnDef[] = [
    // { key: 'node_type', label: 'Tipo', width: 60 },
    // { key: 'titulo', label: 'Título', width: 200 },
    { key: 'partida', label: 'Partida', width: 80 },
    { key: 'descripcion', label: 'Descripción', width: 250 },
    { key: 'unidad', label: 'Und', width: 50 },
    { key: 'elsim', label: 'elem_simil.', width: 80 },
    { key: 'largo', label: 'Largo', width: 80 },
    { key: 'ancho', label: 'Ancho', width: 80 },
    { key: 'alto', label: 'Alto', width: 80 },
    { key: 'nveces', label: 'N° veces', width: 80 },
    { key: 'lon', label: 'Lon.', width: 80 },
    { key: 'area', label: 'Área', width: 80 },
    { key: 'vol', label: 'Vol.', width: 90 },
    { key: 'kg', label: 'Kg.', width: 90 },
    { key: 'und', label: 'Und.', width: 90 },
    { key: 'total', label: 'Total', width: 90 },
    { key: 'observacion', label: 'Obs.', width: 120 },
];

const RESUMEN_COLUMNS: ColumnDef[] = [
    { key: 'node_type', label: 'Tipo', width: 60 },
    { key: 'titulo', label: 'Título', width: 200 },
    { key: 'partida', label: 'Partida', width: 80 },
    { key: 'descripcion', label: 'Descripción', width: 250 },
    { key: 'unidad', label: 'Und', width: 50 },
    { key: 'total_modulos', label: 'Total Módulos', width: 110 },
    { key: 'total_exterior', label: 'Total Exterior', width: 110 },
    { key: 'total_cisterna', label: 'Total Cisterna', width: 110 },
    { key: 'total_general', label: 'Total General', width: 110 },
    { key: 'observacion', label: 'Obs.', width: 120 },
];

const SAVE_DEBOUNCE_MS = 2000;

function rowsToSheetData(
    rows: Record<string, any>[],
    columns: ColumnDef[],
    sheetName: string,
) {
    const headerCells: any[] = columns.map((col, ci) => ({
        r: 0,
        c: ci,
        v: {
            v: col.label,
            m: col.label,
            ct: { fa: 'General', t: 'g' },
            bg: '#e2e8f0',
            bl: 1,
            fs: 10,
        },
    }));

    const dataCells: any[] = [];
    rows.forEach((row, ri) => {
        columns.forEach((col, ci) => {
            const value = row[col.key];
            if (value !== null && value !== undefined && value !== '') {
                const isNumber =
                    typeof value === 'number' ||
                    (!isNaN(Number(value)) && value !== '');
                dataCells.push({
                    r: ri + 1,
                    c: ci,
                    v: {
                        v: isNumber ? Number(value) : value,
                        m: String(value),
                        ct: {
                            fa: isNumber ? '#,##0.0000' : 'General',
                            t: isNumber ? 'n' : 'g',
                        },
                    },
                });
            }
        });
    });

    const columnlen: Record<number, number> = {};
    columns.forEach((col, ci) => {
        columnlen[ci] = col.width;
    });

    return {
        name: sheetName,
        status: 1,
        order: 0,
        row: Math.max(rows.length + 20, 50),
        column: Math.max(columns.length + 5, 26),
        celldata: [...headerCells, ...dataCells],
        config: {
            columnlen,
            rowlen: { 0: 28 },
        },
        frozen: { type: 'row', range: { row_focus: 0 } },
    };
}

function sheetDataToRows(
    sheet: any,
    columns: ColumnDef[],
): Record<string, any>[] {
    if (!sheet) return [];
    const data = sheet.data || [];
    const rows: Record<string, any>[] = [];

    for (let r = 1; r < data.length; r++) {
        const row: Record<string, any> = {};
        let hasData = false;

        columns.forEach((col, ci) => {
            const cell = data[r]?.[ci];
            if (
                cell &&
                cell.v !== null &&
                cell.v !== undefined &&
                cell.v !== ''
            ) {
                row[col.key] = cell.v;
                hasData = true;
            } else {
                row[col.key] = null;
            }
        });

        if (hasData) {
            rows.push(row);
        }
    }

    return rows;
}

export default function SanitariasIndex() {
    const { project, config, modulos, exterior, cisterna, resumen } =
        usePage<SanitariasPageProps>().props;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Costos', href: '/costos' },
        { title: project.nombre, href: `/costos/${project.id}` },
        { title: 'Metrado Sanitarias', href: '#' },
    ];

    const moduleCount = Math.max(1, Number(config?.cantidad_modulos ?? 1));

    // --- Estado para el Modal de Configuración ---
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [newModuleCount, setNewModuleCount] = useState(moduleCount);
    const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);

    // --- Estado para Sincronización ---
    const [isSyncing, setIsSyncing] = useState(false);

    const initialSheets = useMemo(() => {
        const sheets: any[] = [];

        for (let i = 1; i <= moduleCount; i++) {
            const rows = modulos?.[String(i)] ?? [];
            sheets.push(rowsToSheetData(rows, BASE_COLUMNS, `Módulo ${i}`));
        }

        sheets.push(rowsToSheetData(exterior ?? [], BASE_COLUMNS, 'Exterior'));
        sheets.push(rowsToSheetData(cisterna ?? [], BASE_COLUMNS, 'Cisterna'));
        sheets.push(rowsToSheetData(resumen ?? [], RESUMEN_COLUMNS, 'Resumen'));

        return sheets;
    }, [moduleCount, modulos, exterior, cisterna, resumen]);

    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latestSheets = useRef<any[]>([]);

    const handleUpdateConfig = async () => {
        if (newModuleCount === moduleCount) {
            setIsConfigOpen(false);
            return;
        }

        setIsUpdatingConfig(true);
        try {
            await router.patch(
                `/costos/${project.id}/metrado-sanitarias/config`,
                {
                    cantidad_modulos: newModuleCount,
                },
                {
                    onSuccess: () => {
                        setIsConfigOpen(false);
                        // El reload ocurre automáticamente por Inertia si el controller redirige o devuelve x
                    },
                    preserveScroll: true,
                },
            );
        } catch (e) {
            console.error('Error updating config:', e);
            setError('Error al actualizar la configuración.');
        } finally {
            setIsUpdatingConfig(false);
        }
    };

    const doSave = useCallback(
        async (sheets: any[]) => {
            setSaving(true);
            setError(null);

            const csrfToken =
                document.querySelector<HTMLMetaElement>(
                    'meta[name="csrf-token"]',
                )?.content || '';
            const commonHeaders = {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': csrfToken,
                'X-Requested-With': 'XMLHttpRequest',
            };

            const requests: Array<{ url: string; body: any }> = [];

            sheets.forEach((sheet: any) => {
                const name = String(sheet?.name ?? '');
                if (name.startsWith('Módulo')) {
                    const match = name.match(/(\d+)/);
                    const moduloNumero = match ? Number(match[1]) : NaN;
                    if (!Number.isNaN(moduloNumero)) {
                        requests.push({
                            url: `/costos/${project.id}/metrado-sanitarias/modulo/${moduloNumero}`,
                            body: {
                                rows: sheetDataToRows(sheet, BASE_COLUMNS),
                                modulo_nombre: name,
                            },
                        });
                    }
                } else if (name === 'Exterior') {
                    requests.push({
                        url: `/costos/${project.id}/metrado-sanitarias/exterior`,
                        body: { rows: sheetDataToRows(sheet, BASE_COLUMNS) },
                    });
                } else if (name === 'Cisterna') {
                    requests.push({
                        url: `/costos/${project.id}/metrado-sanitarias/cisterna`,
                        body: { rows: sheetDataToRows(sheet, BASE_COLUMNS) },
                    });
                } else if (name === 'Resumen') {
                    requests.push({
                        url: `/costos/${project.id}/metrado-sanitarias/resumen`,
                        body: { rows: sheetDataToRows(sheet, RESUMEN_COLUMNS) },
                    });
                }
            });

            try {
                const results = await Promise.all(
                    requests.map((req) =>
                        fetch(req.url, {
                            method: 'PATCH',
                            headers: commonHeaders,
                            body: JSON.stringify(req.body),
                        }).then((res) => ({
                            ok: res.ok,
                            status: res.status,
                            url: req.url,
                        })),
                    ),
                );

                const failed = results.find((r) => !r.ok);
                if (failed) {
                    console.error('Failed request:', failed);
                    setError(`Error al guardar: ${failed.status}`);
                } else {
                    setLastSaved(new Date());
                }
            } catch (e: any) {
                console.error('Save error:', e);
                setError(e.message);
            } finally {
                setSaving(false);
            }
        },
        [project.id],
    );

    const handleSyncResumen = () => {
        setIsSyncing(true);
        setTimeout(() => {
            const ls = (window as any).luckysheet;
            if (!ls) {
                setIsSyncing(false);
                return;
            }

            const allSheets = ls.getAllSheets();

            // 1. Recopilar datos de todas las hojas
            const modulosData: Record<string, any>[] = [];
            let exteriorData: Record<string, any>[] = [];
            let cisternaData: Record<string, any>[] = [];
            let resumenIndex = -1;

            allSheets.forEach((sheet: any, index: number) => {
                if (sheet.name.startsWith('Módulo')) {
                    modulosData.push(...sheetDataToRows(sheet, BASE_COLUMNS));
                } else if (sheet.name === 'Exterior') {
                    exteriorData = sheetDataToRows(sheet, BASE_COLUMNS);
                } else if (sheet.name === 'Cisterna') {
                    cisternaData = sheetDataToRows(sheet, BASE_COLUMNS);
                } else if (sheet.name === 'Resumen') {
                    resumenIndex = index;
                }
            });

            if (resumenIndex === -1) {
                setIsSyncing(false);
                return;
            }

            // 2. Calcular totales por partida
            const totalsByPartida: Record<
                string,
                {
                    desc: string;
                    und: string;
                    mod: number;
                    ext: number;
                    cis: number;
                }
            > = {};

            const processRows = (rows: any[], type: 'mod' | 'ext' | 'cis') => {
                rows.forEach((row) => {
                    // Only process rows that are 'partida' type
                    if (row.node_type !== 'partida' || !row.partida) return;
                    if (!totalsByPartida[row.partida]) {
                        totalsByPartida[row.partida] = {
                            desc: row.descripcion || '',
                            und: row.unidad || '',
                            mod: 0,
                            ext: 0,
                            cis: 0,
                        };
                    }
                    totalsByPartida[row.partida][type] +=
                        Number(row.total) || 0;
                });
            };

            processRows(modulosData, 'mod');
            processRows(exteriorData, 'ext');
            processRows(cisternaData, 'cis');

            // 3. Generar nuevas filas para el resumen
            const newResumenRows = Object.entries(totalsByPartida)
                .sort(([a], [b]) =>
                    a.localeCompare(b, undefined, { numeric: true }),
                )
                .map(([partida, vals]) => ({
                    partida,
                    descripcion: vals.desc,
                    unidad: vals.und,
                    total_modulos: vals.mod,
                    total_exterior: vals.ext,
                    total_cisterna: vals.cis,
                    total_general: vals.mod + vals.ext + vals.cis,
                }));

            // 4. Actualizar la hoja de Resumen en Luckysheet
            const updatedResumenData = rowsToSheetData(
                newResumenRows,
                RESUMEN_COLUMNS,
                'Resumen',
            );

            // Usamos la API de Luckysheet para actualizar el contenido de la hoja
            // Nota: Luckysheet no tiene un "updateSheetData" directo fácil,
            // a veces es mejor reemplazarla o usar setCellValue en bucle.
            // Para simplicidad en este wrapper, forzamos un re-render o usamos la API directamente.

            // Opción: Luckysheet API setCellValue
            ls.setSheetAdd({ name: 'Resumen_Temp', order: allSheets.length }); // temp
            ls._currentSheet = 'Resumen';
            // ... (esto es complejo con la API de LS si no queremos borrar formatos)

            // Acceso directo al objeto de la hoja (peligroso pero efectivo en LS)
            const resumenSheetObj = allSheets[resumenIndex];
            resumenSheetObj.celldata = updatedResumenData.celldata;

            // Forzar refresco visual
            ls.refresh();

            // 5. Guardar todo
            doSave(allSheets);
            setIsSyncing(false);
        }, 500);
    };

    const scheduleSave = useCallback(
        (sheets: any[]) => {
            latestSheets.current = sheets;
            if (saveTimer.current) clearTimeout(saveTimer.current);
            saveTimer.current = setTimeout(() => {
                doSave(latestSheets.current);
            }, SAVE_DEBOUNCE_MS);
        },
        [doSave],
    );

    const handleDataChange = useCallback(
        (sheets: any[]) => {
            scheduleSave(sheets);
        },
        [scheduleSave],
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="flex h-[calc(100vh-65px)] w-full flex-col overflow-hidden bg-[#f8fafc] dark:bg-gray-950">
                {/* --- Header Premium --- */}
                <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200/60 bg-white/70 px-6 py-3 backdrop-blur-md dark:border-gray-800/60 dark:bg-gray-900/70">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.get(`/costos/${project.id}`)}
                            className="h-8 w-8 rounded-full p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex flex-col">
                            <h1 className="text-sm font-bold tracking-tight text-gray-900 dark:text-gray-100">
                                Metrado Sanitarias
                            </h1>
                            <span className="text-[10px] font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                                {project.nombre}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Estado de Guardado */}
                        <div className="flex items-center gap-2 rounded-full bg-gray-100/50 px-3 py-1 dark:bg-gray-800/50">
                            {saving ? (
                                <div className="flex items-center gap-2 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    <span>Guardando...</span>
                                </div>
                            ) : error ? (
                                <div className="flex items-center gap-2 text-[11px] font-medium text-red-600 dark:text-red-400">
                                    <AlertCircle className="h-3 w-3" />
                                    <span>{error}</span>
                                </div>
                            ) : lastSaved ? (
                                <div className="flex items-center gap-2 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 className="h-3 w-3" />
                                    <span>
                                        Sincronizado{' '}
                                        {lastSaved.toLocaleTimeString('es-ES', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-[11px] font-medium text-gray-400">
                                    <Save className="h-3 w-3" />
                                    <span>Sin cambios</span>
                                </div>
                            )}
                        </div>

                        {/* Botones de Acción */}
                        <div className="flex items-center gap-2 border-l border-gray-200 pl-4 dark:border-gray-800">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => doSave(latestSheets.current)}
                                disabled={saving}
                                className="h-8 gap-1.5 text-xs font-medium"
                            >
                                <Save className="h-3.5 w-3.5" />
                                {saving ? 'Guardando...' : 'Guardar Ahora'}
                            </Button>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleSyncResumen}
                                disabled={isSyncing || saving}
                                className="h-8 gap-1.5 text-xs font-medium transition-all"
                            >
                                <RefreshCcw
                                    className={cn(
                                        'h-3.5 w-3.5',
                                        isSyncing && 'animate-spin',
                                    )}
                                />
                                {isSyncing
                                    ? 'Sincronizando...'
                                    : 'Sincronizar Resumen'}
                            </Button>

                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setIsConfigOpen(true)}
                                className="h-8 gap-1.5 text-xs font-medium"
                            >
                                <Settings2 className="h-3.5 w-3.5" />
                                Configurar
                            </Button>
                        </div>
                    </div>
                </header>

                {/* --- Contenedor Luckysheet --- */}
                <main className="relative flex-1 bg-white shadow-inner dark:bg-[#111]">
                    <Luckysheet
                        data={initialSheets}
                        onDataChange={handleDataChange}
                        height="calc(100vh - 125px)"
                        options={{
                            title: 'Metrado Sanitarias',
                            showinfobar: false,
                            sheetFormulaBar: true,
                            showstatisticBar: true,
                            contextMenu: {
                                row: [
                                    {
                                        text: 'Insertar Título',
                                        type: 'button',
                                        onClick: () => {
                                            const ls = (window as any)
                                                .luckysheet;
                                            if (!ls) return;
                                            const range = ls.getRange();
                                            if (!range || range.length === 0)
                                                return;
                                            const rowIndex = range[0].row[0];
                                            ls.insertRow(rowIndex, 1);
                                            // Set node_type to 'titulo'
                                            setTimeout(() => {
                                                ls.setCellValue(
                                                    rowIndex,
                                                    0,
                                                    'titulo',
                                                    {
                                                        sheetId:
                                                            ls.getSheetId(),
                                                    },
                                                );
                                            }, 100);
                                        },
                                    },
                                    {
                                        text: 'Insertar Partida',
                                        type: 'button',
                                        onClick: () => {
                                            const ls = (window as any)
                                                .luckysheet;
                                            if (!ls) return;
                                            const range = ls.getRange();
                                            if (!range || range.length === 0)
                                                return;
                                            const rowIndex = range[0].row[0];
                                            ls.insertRow(rowIndex, 1);
                                            // Set node_type to 'partida'
                                            setTimeout(() => {
                                                ls.setCellValue(
                                                    rowIndex,
                                                    0,
                                                    'partida',
                                                    {
                                                        sheetId:
                                                            ls.getSheetId(),
                                                    },
                                                );
                                            }, 100);
                                        },
                                    },
                                    {
                                        text: 'Eliminar Fila',
                                        type: 'button',
                                        onClick: () => {
                                            const ls = (window as any)
                                                .luckysheet;
                                            if (!ls) return;
                                            const range = ls.getRange();
                                            if (!range || range.length === 0)
                                                return;
                                            const rowIndex = range[0].row[0];
                                            ls.deleteRow(rowIndex, 1);
                                        },
                                    },
                                ],
                            },
                        }}
                    />
                </main>

                {/* --- Modal de Configuración --- */}
                <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Configuración de Módulos</DialogTitle>
                            <DialogDescription>
                                Ajusta la cantidad de módulos dinámicos para
                                este proyecto.
                                <span className="mt-2 block font-semibold text-amber-600 dark:text-amber-400">
                                    ⚠️ Reducir el número puede causar pérdida de
                                    datos en módulos eliminados.
                                </span>
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label
                                    htmlFor="module-count"
                                    className="text-right"
                                >
                                    Cantidad
                                </Label>
                                <Input
                                    id="module-count"
                                    type="number"
                                    min={1}
                                    max={50}
                                    value={newModuleCount}
                                    onChange={(e) =>
                                        setNewModuleCount(
                                            parseInt(e.target.value),
                                        )
                                    }
                                    className="col-span-3"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                variant="ghost"
                                onClick={() => setIsConfigOpen(false)}
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleUpdateConfig}
                                disabled={isUpdatingConfig}
                                className="gap-2"
                            >
                                {isUpdatingConfig && (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                )}
                                Guardar Cambios
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}
