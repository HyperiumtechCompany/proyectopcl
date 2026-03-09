// resources/js/pages/costos/metrados/metrado_estructura/show.tsx
import { router, usePage } from '@inertiajs/react';
import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import type { MetradoEstructuraSpreadsheet } from '@/types/metrado_estructura';
import * as estructuraRoutes from '@/routes/metrados/estructura';
import metradoRoutes from '@/routes/metrados';
import Luckysheet from '@/components/costos/tablas/Luckysheet';

interface PageProps {
    spreadsheet: MetradoEstructuraSpreadsheet;
    auth: { user: { id: number; plan: string; name: string } };
    [key: string]: unknown;
}

// Columnas con subcolumnas - ¡ESTA ES LA ORGANIZACIÓN CORRECTA!
const COLS = {
    // Columnas normales
    ITEM: 0,              // A
    DESCRIPCION: 1,       // B
    UNID: 2,              // C
    ELEM_SIMIL: 3,        // D
    
    // DIMENSIONES (columna principal con 3 subcolumnas)
    LARGO: 4,             // E (subcolumna 1 de DIMENSIONES)
    ANCHO: 5,             // F (subcolumna 2 de DIMENSIONES)
    ALTO: 6,              // G (subcolumna 3 de DIMENSIONES)
    
    // Columna normal
    N_VECES: 7,           // H
    
    // METRADO (columna principal con 5 subcolumnas)
    LON: 8,               // I (subcolumna 1 de METRADO)
    AREA: 9,              // J (subcolumna 2 de METRADO)
    VOL: 10,              // K (subcolumna 3 de METRADO)
    KG: 11,               // L (subcolumna 4 de METRADO)
    UNID_METRADO: 12,     // M (subcolumna 5 de METRADO)
    
    // Columna normal
    TOTAL: 13             // N
};

// Headers con estructura de subcolumnas - FILA 1 (encabezados principales)
const HEADERS_ROW1 = [
    'ITEM',               // A
    'DESCRIPCIÓN',        // B
    'UNID',               // C
    'ELEM.',              // D
    'DIMENSIONES',        // E (ocupa E, F, G)
    '',                   // F (parte de DIMENSIONES)
    '',                   // G (parte de DIMENSIONES)
    'N° VECES',           // H
    'METRADO',            // I (ocupa I, J, K, L, M)
    '',                   // J (parte de METRADO)
    '',                   // K (parte de METRADO)
    '',                   // L (parte de METRADO)
    '',                   // M (parte de METRADO)
    'TOTAL'               // N
];

// Headers con estructura de subcolumnas - FILA 2 (subencabezados)
const HEADERS_ROW2 = [
    '',                   // A
    '',                   // B
    '',                   // C
    '',                   // D
    'Largo',              // E
    'Ancho',              // F
    'Alto',               // G
    '',                   // H
    'LON.',               // I
    'AREA',               // J
    'VOL',                // K
    'KG',                 // L
    'UNID.',              // M
    ''                    // N
];

// Letras del abecedario hasta R
const COL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R'];

/**
 * Calcula automáticamente según unidad
 */
const calculateRow = (row: any[]): any[] => {
    const newRow = [...row];
    const unidad = (newRow[COLS.UNID] || '').toLowerCase().trim();
    
    const getNum = (idx: number): number => {
        const val = newRow[idx];
        if (val === null || val === undefined || val === '') return 0;
        const num = typeof val === 'string' ? parseFloat(val) : (typeof val === 'number' ? val : 0);
        return isNaN(num) ? 0 : num;
    };
    
    const elem = getNum(COLS.ELEM_SIMIL) || 1;
    const largo = getNum(COLS.LARGO);
    const ancho = getNum(COLS.ANCHO);
    const alto = getNum(COLS.ALTO);
    const nVeces = getNum(COLS.N_VECES) || 1;

    // Limpiar campos calculados (subcolumnas de METRADO)
    newRow[COLS.LON] = 0;
    newRow[COLS.AREA] = 0;
    newRow[COLS.VOL] = 0;
    newRow[COLS.KG] = 0;
    newRow[COLS.UNID_METRADO] = 0;
    newRow[COLS.TOTAL] = 0;

    // CÁLCULOS AUTOMÁTICOS según la unidad
    if (unidad === 'm3') {
        const vol = largo * ancho * alto * elem * nVeces;
        newRow[COLS.VOL] = vol;
        newRow[COLS.KG] = vol * 2400;
        newRow[COLS.UNID_METRADO] = vol;
        newRow[COLS.TOTAL] = vol;
    } 
    else if (unidad === 'm2') {
        const area = largo * ancho * elem * nVeces;
        newRow[COLS.AREA] = area;
        newRow[COLS.UNID_METRADO] = area;
        newRow[COLS.TOTAL] = area;
    } 
    else if (unidad === 'm') {
        const lon = largo * elem * nVeces;
        newRow[COLS.LON] = lon;
        newRow[COLS.UNID_METRADO] = lon;
        newRow[COLS.TOTAL] = lon;
    } 
    else if (unidad === 'kg') {
        const kg = largo * elem * nVeces;
        newRow[COLS.KG] = kg;
        newRow[COLS.UNID_METRADO] = kg;
        newRow[COLS.TOTAL] = kg;
    } 
    else if (unidad === 'und') {
        const und = elem * nVeces;
        newRow[COLS.UNID_METRADO] = und;
        newRow[COLS.TOTAL] = und;
    }
    
    return newRow;
};

/**
 * Convierte a formato Luckysheet con estructura de subcolumnas
 */
const toLuckysheetData = (rows: any[][]): any[] => {
    const celldata: any[] = [];
    
    // FILA 0: Abecedario A-R
    COL_LETTERS.forEach((letter, col) => {
        celldata.push({
            r: 0, c: col,
            v: {
                m: letter, v: letter,
                ct: { fa: '@', t: 'g' },
                bg: '#f3f4f6', fc: '#4b5563',
                ht: 1, vt: 1, ff: 'Arial', fs: 9,
                bl: 0
            }
        });
    });
    
    // FILA 1: Encabezados principales
    HEADERS_ROW1.forEach((text, col) => {
        if (text) {
            celldata.push({
                r: 1, c: col,
                v: {
                    m: text, v: text,
                    ct: { fa: '@', t: 'g' },
                    bl: 1, bg: '#374151', fc: '#ffffff',
                    ht: 1, vt: 1, ff: 'Arial', fs: 10,
                    bs: { left: [1,'#000'], right: [1,'#000'], top: [1,'#000'], bottom: [1,'#000'] }
                }
            });
        }
    });
    
    // FILA 2: Subencabezados
    HEADERS_ROW2.forEach((text, col) => {
        if (text) {
            celldata.push({
                r: 2, c: col,
                v: {
                    m: text, v: text,
                    ct: { fa: '@', t: 'g' },
                    bl: 1, bg: '#4b5563', fc: '#ffffff',
                    ht: 1, vt: 1, ff: 'Arial', fs: 9,
                    bs: { left: [1,'#000'], right: [1,'#000'], top: [1,'#000'], bottom: [1,'#000'] }
                }
            });
        }
    });
    
    // FILAS DE DATOS (desde fila 3)
    rows.forEach((row, rowIndex) => {
        row.forEach((value, colIndex) => {
            if (value !== null && value !== undefined && value !== '') {
                // Identificar si es una columna calculada (subcolumnas de METRADO)
                const isCalculated = [8,9,10,11,12].includes(colIndex);
                
                celldata.push({
                    r: rowIndex + 3, c: colIndex,
                    v: {
                        m: String(value),
                        v: !isNaN(parseFloat(value)) ? parseFloat(value) : value,
                        ct: { fa: !isNaN(parseFloat(value)) ? '0.00' : '@', t: !isNaN(parseFloat(value)) ? 'n' : 'g' },
                        bg: isCalculated ? '#fef3c7' : '#ffffff',
                        fc: isCalculated ? '#92400e' : '#000000',
                        ht: 1, vt: 1, ff: 'Arial', fs: 10,
                        bs: { left: [1,'#000'], right: [1,'#000'], top: [1,'#000'], bottom: [1,'#000'] }
                    }
                });
            }
        });
    });

    return [{
        name: 'Metrado Estructura',
        status: 1, order: 0, celldata,
        config: {
            columnlen: { 
                0:80, 1:300, 2:60, 3:70, 4:70, 5:70, 6:70, 7:70, 
                8:80, 9:80, 10:80, 11:80, 12:80, 13:100,
                14:50, 15:50, 16:50, 17:50
            },
            showGridLines: true,
            defaultColWidth: 70,
            merge: {
                // Combinar "DIMENSIONES" desde (fila1, col4) hasta (fila1, col6)
                '1_4': { r: 1, c: 4, rs: 1, cs: 3 },
                // Combinar "METRADO" desde (fila1, col8) hasta (fila1, col12)
                '1_8': { r: 1, c: 8, rs: 1, cs: 5 }
            }
        }
    }];
};

/**
 * Extrae datos de Luckysheet
 */
const fromLuckysheetData = (sheets: any[]): any[][] => {
    if (!sheets?.[0]?.celldata) return [];
    
    // Ignorar filas 0 (abecedario), 1 (headers) y 2 (subheaders)
    const celldata = sheets[0].celldata.filter((c: any) => c.r > 2);
    if (celldata.length === 0) return [];
    
    const maxRow = Math.max(...celldata.map((c: any) => c.r));
    const rows: any[][] = [];
    
    for (let r = 3; r <= maxRow; r++) {
        rows[r - 3] = [];
        for (let c = 0; c <= 13; c++) {
            const cell = celldata.find((cell: any) => cell.r === r && cell.c === c);
            rows[r - 3][c] = cell?.v?.v ?? '';
        }
    }
    return rows;
};

export default function Show() {
    const { spreadsheet, auth } = usePage<PageProps>().props;
    const [isEditing, setIsEditing] = useState(true);
    const [showJson, setShowJson] = useState(false);
    const [showCollabModal, setShowCollabModal] = useState(false);
    const [collabCode, setCollabCode] = useState(spreadsheet.collab_code || '');
    const [sheetData, setSheetData] = useState<any[]>([]);
    const [rows, setRows] = useState<any[][]>([]);
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [status, setStatus] = useState('');
    
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastDataRef = useRef<string>('');
    const isProcessing = useRef(false);
    const pendingCalcRef = useRef(false);

    // Inicializar datos
    useEffect(() => {
        const initial = Array.isArray(spreadsheet.sheet_data) && spreadsheet.sheet_data.length > 0
            ? spreadsheet.sheet_data
            : [
                ['05', 'INSTALACIONES ELECTRICAS', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['05.01', 'SALIDA PARA INSTALACIONES ELECTRICAS', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['05.01.01', 'SALIDAS', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['', 'MÓDULO (TD-01)', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['05.01.01.01', 'Salida alumbrado interior', 'und', '1', '0', '0', '0', '12', '', '', '', '', '', ''],
                ['05.01.01.02', 'Salida alumbrado interior', 'und', '1', '0', '0', '0', '15', '', '', '', '', '', ''],
                ['', 'MÓDULO II (TD-02)', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['05.01.01.03', 'Salida alumbrado interior', 'und', '1', '0', '0', '0', '8', '', '', '', '', '', ''],
                ['06.01.01.01', 'Columna de concreto C1', 'm3', '4', '0.25', '0.25', '2.80', '12', '', '', '', '', '', ''],
            ];
        setRows(initial);
        setSheetData(toLuckysheetData(initial));
    }, [spreadsheet.sheet_data]);

    // Función principal de cálculo
    const processAndCalculate = useCallback((sheets: any[]) => {
        if (isProcessing.current) {
            pendingCalcRef.current = true;
            return;
        }
        
        isProcessing.current = true;
        setStatus('🔄');
        
        try {
            const newRows = fromLuckysheetData(sheets);
            if (newRows.length === 0) {
                isProcessing.current = false;
                setStatus('');
                return;
            }
            
            let hasChanges = false;
            const calculated = newRows.map((row, idx) => {
                const unidad = row[COLS.UNID]?.toLowerCase()?.trim();
                if (unidad && (row[COLS.ELEM_SIMIL] || row[COLS.LARGO] || row[COLS.ANCHO] || row[COLS.ALTO] || row[COLS.N_VECES])) {
                    const result = calculateRow(row);
                    if (JSON.stringify(result) !== JSON.stringify(row)) {
                        hasChanges = true;
                    }
                    return result;
                }
                return row;
            });
            
            if (hasChanges) {
                setRows(calculated);
                const newData = toLuckysheetData(calculated);
                setSheetData(newData);
                setStatus('✅');
                setTimeout(() => setStatus(''), 1000);
            }
            
            if (saveTimer.current) clearTimeout(saveTimer.current);
            saveTimer.current = setTimeout(() => {
                if (spreadsheet.can_edit && hasChanges) {
                    setSaving(true);
                    router.patch(
                        estructuraRoutes.update.url(spreadsheet.id),
                        { sheet_data: calculated },
                        {
                            preserveScroll: true,
                            onFinish: () => {
                                setSaving(false);
                                setLastSaved(new Date());
                            },
                        },
                    );
                }
            }, 2000);
            
        } catch (err) {
            console.error('Error:', err);
            setStatus('❌');
        } finally {
            isProcessing.current = false;
            if (pendingCalcRef.current) {
                pendingCalcRef.current = false;
                const currentData = (window as any).luckysheet?.getAllSheets?.();
                if (currentData) processAndCalculate(currentData);
            }
        }
    }, [spreadsheet.can_edit, spreadsheet.id]);

    // Detectar cambios
    useEffect(() => {
        if (!spreadsheet.can_edit || !isEditing) return;
        
        const interval = setInterval(() => {
            const ls = (window as any).luckysheet;
            if (!ls?.getAllSheets) return;
            
            const currentData = ls.getAllSheets();
            if (currentData?.[0]?.celldata) {
                const dataString = JSON.stringify(currentData[0].celldata);
                
                if (dataString !== lastDataRef.current) {
                    lastDataRef.current = dataString;
                    processAndCalculate(currentData);
                }
            }
        }, 150);
        
        return () => clearInterval(interval);
    }, [spreadsheet.can_edit, isEditing, processAndCalculate]);

    const handleDataChange = useCallback((sheets: any[]) => {
        processAndCalculate(sheets);
    }, [processAndCalculate]);

    // Colaboración
    const handleRemoteUpdate = useCallback((payload: any) => {
        if (payload.sheet_data) {
            const remoteRows = Array.isArray(payload.sheet_data) ? payload.sheet_data : [];
            setRows(remoteRows);
            setSheetData(toLuckysheetData(remoteRows));
        }
    }, []);

    const { lastEditorName } = useRealtimeSync({
        spreadsheetId: spreadsheet.id,
        currentUserId: auth.user.id,
        onRemoteUpdate: handleRemoteUpdate,
        isCollaborative: spreadsheet.is_collaborative,
        channelPrefix: 'metrado-estructura.',
    });

    // Exportar JSON
    const handleExportJson = useCallback(() => {
        const json = JSON.stringify(rows, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${spreadsheet.name ?? 'metrado'}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [rows, spreadsheet.name]);

    // Habilitar colaboración
    const handleEnableCollab = () => {
        router.post(estructuraRoutes.enableCollab.url(spreadsheet.id), {}, {
            preserveScroll: true,
            onSuccess: (page: any) => {
                if (page.props.flash?.collab_code) {
                    setCollabCode(page.props.flash.collab_code);
                    setShowCollabModal(true);
                }
            }
        });
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('Código copiado');
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Metrados', href: metradoRoutes.index.url() },
        { title: 'Estructura', href: estructuraRoutes.index.url() },
        { title: spreadsheet.name || 'Sin nombre', href: '#' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            {/* Barra superior con botones */}
            <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
                <div>
                    <h1 className="text-xl font-semibold text-gray-800">{spreadsheet.name}</h1>
                    <p className="text-sm text-gray-500">
                        {spreadsheet.project_name} · {spreadsheet.building_type} · {spreadsheet.structural_system}
                    </p>
                </div>

                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => setIsEditing(!isEditing)}
                        className={`px-3 py-1.5 text-sm border rounded ${
                            isEditing 
                                ? 'bg-green-500 text-white border-green-600' 
                                : 'bg-white border-gray-300'
                        }`}
                    >
                        {isEditing ? 'Editando' : 'Editable'}
                    </button>
                    <button
                        onClick={handleExportJson}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white"
                    >
                        ↓ JSON
                    </button>
                    {spreadsheet.is_owner && (
                        <button
                            onClick={handleEnableCollab}
                            className="px-3 py-1.5 text-sm border border-indigo-300 rounded bg-indigo-50 text-indigo-700"
                        >
                            Habilitar Colaboración
                        </button>
                    )}
                </div>
            </div>

            {/* Barra de estado */}
            <div className="flex items-center justify-end px-6 py-1 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center gap-2 text-xs">
                    {status && (
                        <span className={`px-2 py-0.5 rounded font-mono font-bold ${
                            status === '✅' ? 'bg-green-100 text-green-700' :
                            status === '❌' ? 'bg-red-100 text-red-700' :
                            'bg-blue-100 text-blue-700 animate-pulse'
                        }`}>
                            {status}
                        </span>
                    )}
                    
                    {saving && (
                        <span className="flex items-center gap-1 text-yellow-600">
                            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-400" />
                            Guardando…
                        </span>
                    )}
                    {!saving && lastSaved && (
                        <span className="flex items-center gap-1 text-gray-500">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
                            {lastSaved.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                    {lastEditorName && (
                        <span className="ml-2 flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                            📡 {lastEditorName}
                        </span>
                    )}
                </div>
            </div>

            {/* Modal de colaboración */}
            {showCollabModal && collabCode && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="w-96 rounded-lg bg-white p-6">
                        <h3 className="mb-4 text-lg font-semibold">Código de Colaboración</h3>
                        <div className="mb-4 flex items-center space-x-2">
                            <code className="flex-1 rounded bg-gray-100 p-2 text-center font-mono text-lg">
                                {collabCode}
                            </code>
                            <button
                                onClick={() => copyToClipboard(collabCode)}
                                className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
                            >
                                Copiar
                            </button>
                        </div>
                        <button
                            onClick={() => setShowCollabModal(false)}
                            className="w-full rounded border px-4 py-2 hover:bg-gray-50"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            )}

            {/* Área de trabajo - Luckysheet */}
            <div className="flex-1 p-6 pt-2">
                {showJson ? (
                    <pre className="h-full overflow-auto bg-gray-100 p-4 rounded">
                        {JSON.stringify(rows, null, 2)}
                    </pre>
                ) : (
                    <div className="h-full w-full border border-gray-300 rounded-lg overflow-hidden">
                        <Luckysheet
                            data={sheetData}
                            onDataChange={handleDataChange}
                            canEdit={spreadsheet.can_edit && isEditing}
                            height="calc(100vh - 200px)"
                            options={{
                                title: spreadsheet.name ?? 'Metrado Estructura',
                                showinfobar: false,
                                showstatisticBar: true,
                                columnRange: 18,
                            }}
                        />
                    </div>
                )}
            </div>
        </AppLayout>
    );
}