import { router, usePage } from '@inertiajs/react';
import ExcelJS from 'exceljs';
import { Download, Calculator, UploadCloud, FileSpreadsheet, Settings, Save, ArrowLeft, Users } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import AppLayout from '@/layouts/app-layout';
import * as spattPararrayosRoutes from '@/routes/spatt-pararrayos';
import type { BreadcrumbItem } from '@/types';
import type { SpattPararrayoSpreadsheet } from '@/types/spatt-pararrayos';

interface PageProps {
    auth: { user: { name: string; email: string; plan: string } };
    spreadsheet: SpattPararrayoSpreadsheet;
    [key: string]: unknown;
}

const opcionesVarilla = [
    { nombre: '3/8″ (0.0095 m)', valor: 0.0095 },
    { nombre: '1/2″ (0.0127 m)', valor: 0.0127 },
    { nombre: '5/8″ (0.015875 m)', valor: 0.015875 },
    { nombre: '3/4″ (0.0190 m)', valor: 0.0190 },
    { nombre: '1″ (0.0254 m)', valor: 0.0254 },
    { nombre: 'Otro', valor: 0 }
];

const terrainDescs: Record<string, string> = {
    GW: 'Grava de buen grado, mezcla de grava y arena',
    GP: 'Grava de bajo grado, mezcla de grava y arena',
    GC: 'Grava con arcilla, mezcla de grava y arcilla',
    SM: 'Arena con limo, mezcla de bajo grado de arena con limo',
    SC: 'Arena con arcilla, mezcla de bajo grado de arena con arcilla',
    ML: 'Arena fina con arcilla de ligera plasticidad',
    MH: 'Arena fina o terreno con limo, terrenos elásticos',
    CL: 'Arcilla pobre con grava, arena, limo',
    CH: 'Arcilla inorgánica de alta plasticidad'
};

const resistividades: Record<string, number> = {
    GW: 800, GP: 1750, GC: 300, SM: 300, SC: 125,
    ML: 55, MH: 190, CL: 42.5, CH: 32.5
};

export default function Show() {
    const { spreadsheet, auth } = usePage<PageProps>().props;
    const canEdit = spreadsheet.can_edit;
    const isOwner = spreadsheet.is_owner;
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'pozo' | 'pararrayo'>('pozo');

    const [header, setHeader] = useState({
        proyecto: spreadsheet.project_name || '“MEJORAMIENTO DE LOS SERVICIOS DE EDUCACIÓN INICIAL Y PRIMARIA...”',
        cui: 'CUI: ',
        codigoModular: 'CÓDIGO MODULAR: ',
        codigoLocal: 'CÓDIGO LOCAL: ',
        unidadEjecutora: 'UNIDAD EJECUTORA: ',
        distrito: 'DISTRITO: ',
        provincia: 'PROVINCIA: ',
        departamento: 'DEPARTAMENTO: ',
    });

    const [logo1, setLogo1] = useState<File | null>(null);
    const [logo2, setLogo2] = useState<File | null>(null);

    const defaultPozo = {
        L: 2.4, a: 0.015875, resistividad: 32.5, tipoTerreno: 'CH', isCustomA: false,
        dosisReduccion: [
            { rInicial: 0, reduccion: 0, rFinal: 0, descripcion: '1ra dosis' },
            { rInicial: 0, reduccion: 0, rFinal: 0, descripcion: '2da dosis' },
            { rInicial: 0, reduccion: 0, rFinal: 0, descripcion: '3ra dosis' }
        ],
        resultados: null as any
    };

    const [pozo, setPozo] = useState(spreadsheet.pozo_data || defaultPozo);

    const defaultPararrayo = {
        td: 80, L: 103.08, W: 46.92, H: 13.94, h: 10,
        c1: 0.5, c2: 1, c3: 1, c4: 1, c5: 1,
        resultados: null as any
    };

    const [pararrayo, setPararrayo] = useState(spreadsheet.pararrayo_data || defaultPararrayo);

    const [showModal, setShowModal] = useState(false);
    const [exportOption, setExportOption] = useState<'both' | 'pozo' | 'pararrayo'>('both');

    useEffect(() => {
        if (resistividades[pozo.tipoTerreno] && resistividades[pozo.tipoTerreno] !== pozo.resistividad) {
            setPozo(p => ({ ...p, resistividad: resistividades[p.tipoTerreno] }));
        }
    }, [pozo.tipoTerreno]);

    const calcularPozoTierra = () => {
        const { L, a, resistividad } = pozo;
        if (!L || !a || !resistividad || a <= 0) {
            alert('Por favor, completa todos los campos requeridos y que sean mayores a 0.');
            return;
        }

        const factor1 = resistividad / (2 * Math.PI * L);
        const factor2 = Math.log((4 * L) / a) - 1;
        const resistencia = Math.round((factor1 * factor2) * 100) / 100;

        let prevR = resistencia;
        const nuevasDosis = pozo.dosisReduccion.map(dosis => {
            const dec = dosis.reduccion / 100;
            const rFinal = Math.round(prevR * (1 - dec) * 100) / 100;
            const nueva = { ...dosis, rInicial: prevR, rFinal };
            prevR = rFinal;
            return nueva;
        });

        setPozo(p => ({
            ...p,
            dosisReduccion: nuevasDosis,
            resultados: { calculado: true, resistencia }
        }));
    };

    const calcularPararrayo = () => {
        const { td, L, W, H, c1, c2, c3, c4, c5 } = pararrayo;
        if (!td || !L || !W || !H) {
            alert('Por favor, complete todos los campos requeridos'); return;
        }

        const nkng = parseFloat((Math.pow(td, 1.25) * 0.04).toFixed(3));
        const aeData = (L * W) + (6 * H * (L + W)) + (Math.PI * 9 * H * H);
        const areaEquivalente = Math.round(aeData * 100) / 100;
        const NdExacto = nkng * areaEquivalente * c1 * 1e-6;
        const Nd = Math.round(NdExacto * 1e6) / 1e6;
        const ncExacto = (1.5 * Math.pow(10, -3)) / (c2 * c3 * c4 * c5);
        const nc = Math.round(ncExacto * 1e6) / 1e6;

        const requiereProteccion = Nd > nc;
        let eficienciaRequerida = 0;
        let nivelProteccion = 1;

        if (requiereProteccion) {
            eficienciaRequerida = Math.round((1 - (nc / Nd)) * 1000) / 1000;
            if (eficienciaRequerida >= 0.98) nivelProteccion = 1;
            else if (eficienciaRequerida >= 0.95) nivelProteccion = 2;
            else if (eficienciaRequerida >= 0.80) nivelProteccion = 3;
            else nivelProteccion = 4;
        }

        setPararrayo(p => ({
            ...p,
            resultados: {
                calculado: true, nkng, areaEquivalente, Nd, nc,
                requiereProteccion, eficienciaRequerida, nivelProteccion
            }
        }));
    };

    const handleSave = () => {
        setIsSaving(true);
        router.patch(spattPararrayosRoutes.update.url(spreadsheet.id), {
            pozo_data: pozo,
            pararrayo_data: pararrayo,
        }, {
            preserveScroll: true,
            onFinish: () => setIsSaving(false),
            onSuccess: () => alert('Hoja guardada exitosamente.')
        });
    };

    const handleEnableCollab = () => {
        if (confirm('¿Habilitar colaboración para esta hoja? Los usuarios con el código podrán editarla.')) {
            // Utilizamos el path directo para evitar tener que ejecutar wayfinder otra vez justo ahora
            router.post(`/spatt-pararrayos/${spreadsheet.id}/enable-collab`, {}, { preserveScroll: true });
        }
    };

    const copyCollabCode = () => {
        if (spreadsheet.collab_code) {
            navigator.clipboard.writeText(spreadsheet.collab_code);
            alert('Código de colaboración copiado portapapeles.');
        }
    };

    const exportToExcel = async () => {
        // Lógica de exportación igual a la implementada anteriormente (removida por brevedad en este snippet, puedes dejarla intacta de la versión anterior o ajustarla... voy a incluir la funcion completa para evitar que se pierda la funcionalidad de exportación del archivo original)
        if (!logo1 || !logo2) {
            setShowModal(true); return;
        }

        if ((exportOption === 'both' || exportOption === 'pozo') && !pozo.resultados?.calculado) {
            alert('Calcula el Pozo a Tierra antes de exportar.'); return;
        }
        if ((exportOption === 'both' || exportOption === 'pararrayo') && !pararrayo.resultados?.calculado) {
            alert('Calcula el Pararrayo antes de exportar.'); return;
        }

        const fileToBuffer = (file: File): Promise<ArrayBuffer> => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target?.result as ArrayBuffer);
                reader.onerror = reject;
                reader.readAsArrayBuffer(file);
            });
        };

        const addEncabezado = (sheet: ExcelJS.Worksheet, workbook: ExcelJS.Workbook, l1Buf: ArrayBuffer, l1Ext: string, l2Buf: ArrayBuffer, l2Ext: string) => {
            sheet.getRow(1).height = 100;
            const img1 = workbook.addImage({ buffer: l1Buf, extension: l1Ext as any });
            const img2 = workbook.addImage({ buffer: l2Buf, extension: l2Ext as any });
            sheet.addImage(img1, { tl: { col: 0, row: 0 }, ext: { width: 90, height: 90 } });
            sheet.addImage(img2, { tl: { col: 13, row: 0 }, ext: { width: 90, height: 90 } });

            sheet.mergeCells('B1:M1');
            const cell = sheet.getCell('B1');
            cell.value = `${header.proyecto}\n${header.cui}; ${header.codigoModular}; ${header.codigoLocal}\n${header.unidadEjecutora}`;
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.font = { bold: true, size: 11, name: 'Calibri' };
            sheet.getColumn('A').width = 13;
            sheet.getColumn('N').width = 13;
        };

        const l1Buf = await fileToBuffer(logo1);
        const l2Buf = await fileToBuffer(logo2);
        const l1Ext = logo1.name.split('.').pop()?.toLowerCase().replace('jpg', 'jpeg') || 'png';
        const l2Ext = logo2.name.split('.').pop()?.toLowerCase().replace('jpg', 'jpeg') || 'png';

        const workbook = new ExcelJS.Workbook();

        if (exportOption === 'both' || exportOption === 'pozo') {
            const sheet = workbook.addWorksheet('Pozo a Tierra');
            addEncabezado(sheet, workbook, l1Buf, l1Ext, l2Buf, l2Ext);

            sheet.mergeCells('B2:M2');
            const title = sheet.getCell('B2');
            title.value = 'CÁLCULO DE LA RESISTENCIA DE PUESTA A TIERRA';
            title.alignment = { horizontal: 'center', vertical: 'middle' };
            title.font = { bold: true, size: 14, color: { argb: '002060' } };

            sheet.addRow([]);
            const fRow = sheet.addRow(['', 'Ecuación de cálculo:']);
            fRow.getCell(2).font = { bold: true, italic: true };
            sheet.addRow(['', 'R = (ρ / 2πL) × [ ln(4L / a) – 1 ]']);

            sheet.addRow([]);

            const tRow = sheet.addRow(['', 'CARACTERÍSTICAS DEL TERRENO']);
            sheet.mergeCells(`B${tRow.number}:M${tRow.number}`);
            tRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '002060' } };
            tRow.getCell(2).font = { bold: true, color: { argb: 'FFFFFF' } };

            const hTer = sheet.addRow(['', 'I.E. N°', 'Tipo de Terreno', 'ρ (Ω·m)', 'Descripción']);
            hTer.eachCell((c, i) => { if (i > 1) c.font = { bold: true }; });
            sheet.addRow(['', '64193', pozo.tipoTerreno, pozo.resistividad, terrainDescs[pozo.tipoTerreno]]);

            sheet.addRow([]);

            const trRow = sheet.addRow(['', 'RESULTADOS DE CÁLCULO']);
            sheet.mergeCells(`B${trRow.number}:M${trRow.number}`);
            trRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '002060' } };
            trRow.getCell(2).font = { bold: true, color: { argb: 'FFFFFF' } };

            const hRes = sheet.addRow(['', 'I.E. N°', 'Terreno', 'ρ (Ω·m)', 'R (Ω)']);
            hRes.eachCell((c, i) => { if (i > 1) c.font = { bold: true }; });
            sheet.addRow(['', '64193', pozo.tipoTerreno, pozo.resistividad, pozo.resultados.resistencia]);
            sheet.addRow([]);

            const rRow = sheet.addRow(['', 'REDUCCIÓN DE LA RESISTENCIA DE PUESTA A TIERRA']);
            sheet.mergeCells(`B${rRow.number}:M${rRow.number}`);
            rRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '002060' } };
            rRow.getCell(2).font = { bold: true, color: { argb: 'FFFFFF' } };

            const hRed = sheet.addRow(['', 'R Inicial (Ω)', '% Reducción', 'R Final (Ω)', 'Descripción']);
            hRed.eachCell((c, i) => { if (i > 1) c.font = { bold: true }; });
            pozo.dosisReduccion.forEach(d => {
                sheet.addRow(['', d.rInicial, d.reduccion, d.rFinal, d.descripcion]);
            });

            sheet.getColumn('B').width = 25;
            sheet.getColumn('C').width = 20;
            sheet.getColumn('D').width = 20;
            sheet.getColumn('E').width = 20;
        }

        if (exportOption === 'both' || exportOption === 'pararrayo') {
            const sheet = workbook.addWorksheet('Pararrayo');
            addEncabezado(sheet, workbook, l1Buf, l1Ext, l2Buf, l2Ext);

            sheet.mergeCells('B2:M2');
            const title = sheet.getCell('B2');
            title.value = 'CÁLCULO DEL PARARRAYO';
            title.alignment = { horizontal: 'center', vertical: 'middle' };
            title.font = { bold: true, size: 14, color: { argb: '002060' } };

            sheet.addRow([]);
            const s1 = sheet.addRow(['', '1 Frecuencia anual de caída de rayos']);
            sheet.mergeCells(`B${s1.number}:M${s1.number}`);
            s1.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '002060' } };
            s1.getCell(2).font = { bold: true, color: { argb: 'FFFFFF' } };

            sheet.addRow(['', 'Td=', pararrayo.td, 'isocerauno']);
            sheet.addRow(['', 'Nk = Ng =', pararrayo.resultados.nkng, 'rayos/km²·año']);

            sheet.addRow([]);
            const s2 = sheet.addRow(['', '2 Cálculo de Área Equivalente']);
            sheet.mergeCells(`B${s2.number}:M${s2.number}`);
            s2.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '002060' } };
            s2.getCell(2).font = { bold: true, color: { argb: 'FFFFFF' } };
            sheet.addRow(['', `Ae: ${pararrayo.resultados.areaEquivalente} m²`]);

            sheet.addRow([]);
            const s5 = sheet.addRow(['', '5 Evaluación y comparación de riesgos']);
            sheet.mergeCells(`B${s5.number}:M${s5.number}`);
            s5.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '002060' } };
            s5.getCell(2).font = { bold: true, color: { argb: 'FFFFFF' } };

            const hEv = sheet.addRow(['', 'AREA', 'Nd', 'Nc', 'REQUIERE PROTECCIÓN']);
            hEv.eachCell((c, i) => { if (i > 1) c.font = { bold: true }; });
            sheet.addRow(['', pararrayo.resultados.areaEquivalente, pararrayo.resultados.Nd, pararrayo.resultados.nc, pararrayo.resultados.requiereProteccion ? 'SI' : 'NO']);

            sheet.getColumn('B').width = 30;
            sheet.getColumn('C').width = 25;
            sheet.getColumn('D').width = 25;
            sheet.getColumn('E').width = 25;
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `CÁLCULO SPAT PARARRAYOS - ${spreadsheet.name}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'SPAT y Pararrayos', href: spattPararrayosRoutes.index.url() },
        { title: spreadsheet.name, href: spattPararrayosRoutes.show.url(spreadsheet.id) }
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="mx-auto w-full p-6 md:px-12 bg-slate-50 dark:bg-gray-950 min-h-screen font-sans text-slate-800 dark:text-gray-100 transition-colors">
                {/* Cabecera */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 pb-4 border-b border-slate-200 dark:border-gray-800 gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <button onClick={() => router.get(spattPararrayosRoutes.index.url())} className="text-slate-400 hover:text-blue-600 transition-colors cursor-pointer">
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                                <Calculator className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                                {spreadsheet.name}
                            </h1>
                        </div>
                        <p className="text-slate-500 dark:text-gray-400 mt-1 pl-8">{spreadsheet.project_name || 'Sin proyecto asignado'}</p>
                    </div>

                    <div className="flex bg-white dark:bg-gray-900 shadow-sm p-1 rounded-lg border border-slate-200 dark:border-gray-800">
                        <button
                            onClick={() => setActiveTab('pozo')}
                            className={`px-5 py-2 text-sm font-semibold rounded-md transition-all ${activeTab === 'pozo' ? 'bg-blue-600 dark:bg-blue-500 text-white shadow' : 'text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-800'}`}
                        >
                            Pozo a Tierra
                        </button>
                        <button
                            onClick={() => setActiveTab('pararrayo')}
                            className={`px-5 py-2 text-sm font-semibold rounded-md transition-all ${activeTab === 'pararrayo' ? 'bg-blue-600 dark:bg-blue-500 text-white shadow' : 'text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-800'}`}
                        >
                            Pararrayos
                        </button>
                    </div>

                    <div className="flex gap-2">
                        {isOwner && !spreadsheet.is_collaborative && ['mensual', 'anual', 'lifetime'].includes(auth.user.plan) && (
                            <button onClick={handleEnableCollab} className="flex font-semibold items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg transition-colors">
                                <Users className="w-5 h-5" /> Habilitar Colaboración
                            </button>
                        )}
                        {spreadsheet.is_collaborative && (
                            <button onClick={copyCollabCode} className="flex font-semibold items-center gap-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-4 py-2.5 rounded-lg transition-colors" title="Copiar código">
                                <Users className="w-5 h-5" /> Cód: {spreadsheet.collab_code}
                            </button>
                        )}

                        {canEdit && (
                            <button onClick={handleSave} disabled={isSaving} className="flex font-semibold items-center gap-2 bg-slate-800 dark:bg-blue-600 hover:bg-slate-900 dark:hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50">
                                <Save className="w-5 h-5" /> {isSaving ? 'Guardando...' : 'Guardar Datos'}
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Panel Izquierdo - Settings & Export */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-slate-200 dark:border-gray-800 p-5">
                            <h3 className="font-bold text-slate-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                                <Settings className="w-5 h-5 text-slate-500 dark:text-gray-400" /> Ajustes Globales Export.
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 dark:text-gray-400 mb-1 block">Logo Organizacional 1</label>
                                    <input type="file" accept="image/*" onChange={(e) => setLogo1(e.target.files?.[0] || null)} className="block w-full text-xs text-slate-500 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/40 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900 transition-colors cursor-pointer" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 dark:text-gray-400 mb-1 block">Logo Organizacional 2</label>
                                    <input type="file" accept="image/*" onChange={(e) => setLogo2(e.target.files?.[0] || null)} className="block w-full text-xs text-slate-500 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/40 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900 transition-colors cursor-pointer" />
                                </div>
                            </div>

                            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-gray-800">
                                <button onClick={exportToExcel} className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-semibold transition-all shadow-sm hover:shadow">
                                    <FileSpreadsheet className="w-5 h-5" /> Exportar Excel
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Panel Central/Derecho - Calculadora Activa en Tablas Tipo Excel */}
                    <div className="lg:col-span-3">
                        {activeTab === 'pozo' ? (
                            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-slate-200 dark:border-gray-800 overflow-x-auto p-4 md:p-6">
                                <table className="w-full text-sm text-left align-middle border-collapse">
                                    <thead>
                                        <tr>
                                            <th colSpan={5} className="py-3 px-4 text-center font-bold text-lg bg-[#002060] text-white border border-[#002060]">
                                                CÁLCULO DE LA RESISTENCIA DE PUESTA A TIERRA
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700">
                                        <tr className="border-b border-gray-300 dark:border-gray-700">
                                            <td colSpan={2} className="py-2 px-4 font-bold italic text-right">Ecuación de cálculo:</td>
                                            <td colSpan={3} className="py-2 px-4 font-mono font-medium tracking-wide">R = (ρ / 2πL) × [ ln(4L / a) – 1 ]</td>
                                        </tr>
                                        <tr className="bg-[#002060] text-white">
                                            <td colSpan={5} className="py-2 px-4 font-bold border border-[#002060]">CARACTERÍSTICAS DEL TERRENO</td>
                                        </tr>
                                        <tr className="bg-slate-100 dark:bg-gray-800 font-bold border-b border-gray-300 dark:border-gray-700">
                                            <td className="py-2 px-4 border-r border-gray-300 dark:border-gray-700 text-center">I.E. N°</td>
                                            <td className="py-2 px-4 border-r border-gray-300 dark:border-gray-700 text-center">Tipo de Terreno</td>
                                            <td colSpan={2} className="py-2 px-4 border-r border-gray-300 dark:border-gray-700 text-center">ρ (Ω·m)</td>
                                            <td className="py-2 px-4 text-center">Descripción</td>
                                        </tr>
                                        <tr className="border-b border-gray-300 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-800/50">
                                            <td className="py-2 px-4 border-r border-gray-300 dark:border-gray-700 text-center">64193</td>
                                            <td className="py-1 px-1 border-r border-gray-300 dark:border-gray-700 text-center">
                                                <select
                                                    value={pozo.tipoTerreno}
                                                    onChange={e => setPozo({ ...pozo, tipoTerreno: e.target.value })}
                                                    disabled={!canEdit}
                                                    className="w-full text-sm bg-transparent border-none focus:ring-0 dark:text-white disabled:opacity-80 py-1"
                                                >
                                                    {Object.keys(terrainDescs).map(k => (
                                                        <option key={k} value={k}>{k}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td colSpan={2} className="py-1 px-1 border-r border-gray-300 dark:border-gray-700 text-center">
                                                <input disabled={!canEdit} type="number" value={pozo.resistividad} onChange={e => setPozo({ ...pozo, resistividad: +e.target.value })} className="w-full text-sm text-center bg-transparent border-none focus:ring-0 dark:text-white p-1" />
                                            </td>
                                            <td className="py-2 px-4 text-center text-xs text-gray-500 dark:text-gray-400">{terrainDescs[pozo.tipoTerreno]}</td>
                                        </tr>
                                        <tr><td colSpan={5} className="py-2"></td></tr>

                                        {/* Ajustar parámetros extra como diámetro y longitud antes de resultados */}
                                        <tr className="bg-[#002060] text-white">
                                            <td colSpan={5} className="py-2 px-4 font-bold border border-[#002060]">PARÁMETROS DE DISEÑO</td>
                                        </tr>
                                        <tr className="bg-slate-100 dark:bg-gray-800 font-bold border-b border-gray-300 dark:border-gray-700">
                                            <td colSpan={2} className="py-2 px-4 border-r border-gray-300 dark:border-gray-700 text-center">Construir</td>
                                            <td className="py-2 px-4 border-r border-gray-300 dark:border-gray-700 text-center">Longitud L (m)</td>
                                            <td colSpan={2} className="py-2 px-4 text-center">Diámetro Varilla a (m)</td>
                                        </tr>
                                        <tr className="border-b border-gray-300 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-800/50">
                                            <td colSpan={2} className="py-2 px-4 border-r border-gray-300 dark:border-gray-700 text-center">Pozo a Tierra</td>
                                            <td className="py-1 px-1 border-r border-gray-300 dark:border-gray-700 text-center">
                                                <input disabled={!canEdit} type="number" step="0.1" value={pozo.L} onChange={e => setPozo({ ...pozo, L: +e.target.value })} className="w-full text-center text-sm bg-transparent border border-gray-200 dark:border-gray-600 rounded px-2 py-1 focus:ring-0 dark:text-white max-w-24 mx-auto" />
                                            </td>
                                            <td colSpan={2} className="py-1 px-4 text-center flex flex-col items-center justify-center">
                                                <select
                                                    value={pozo.isCustomA ? 0 : pozo.a}
                                                    disabled={!canEdit}
                                                    onChange={e => {
                                                        const val = +e.target.value;
                                                        setPozo({ ...pozo, a: val, isCustomA: val === 0 });
                                                    }}
                                                    className="text-sm bg-transparent border-gray-200 dark:border-gray-600 rounded py-1 px-2 focus:ring-0 dark:text-white"
                                                >
                                                    {opcionesVarilla.map(o => <option key={o.nombre} value={o.valor}>{o.nombre}</option>)}
                                                </select>
                                                {pozo.isCustomA && (
                                                    <input disabled={!canEdit} type="number" step="0.001" value={pozo.a} onChange={e => setPozo({ ...pozo, a: +e.target.value })} placeholder="Valor manual" className="mt-1 text-center text-sm border-gray-200 dark:border-gray-600 rounded p-1 dark:text-white max-w-24" />
                                                )}
                                            </td>
                                        </tr>
                                        {canEdit && (
                                            <tr>
                                                <td colSpan={5} className="py-4 px-4 text-center">
                                                    <button onClick={calcularPozoTierra} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors shadow">
                                                        Calcular Resistencia
                                                    </button>
                                                </td>
                                            </tr>
                                        )}
                                        <tr><td colSpan={5} className="py-2"></td></tr>

                                        <tr className="bg-[#002060] text-white">
                                            <td colSpan={5} className="py-2 px-4 font-bold border border-[#002060] uppercase">Resultados de Cálculo</td>
                                        </tr>
                                        <tr className="bg-slate-100 dark:bg-gray-800 font-bold border-b border-gray-300 dark:border-gray-700">
                                            <td className="py-2 px-4 border-r border-gray-300 dark:border-gray-700 text-center">I.E. N°</td>
                                            <td className="py-2 px-4 border-r border-gray-300 dark:border-gray-700 text-center">Terreno</td>
                                            <td colSpan={2} className="py-2 px-4 border-r border-gray-300 dark:border-gray-700 text-center">ρ (Ω·m)</td>
                                            <td className="py-2 px-4 text-center">R (Ω)</td>
                                        </tr>
                                        {pozo.resultados?.calculado ? (
                                            <tr className="border-b border-gray-300 dark:border-gray-700 bg-blue-50/50 dark:bg-blue-900/20">
                                                <td className="py-3 px-4 border-r border-gray-300 dark:border-gray-700 text-center">64193</td>
                                                <td className="py-3 px-4 border-r border-gray-300 dark:border-gray-700 text-center font-semibold text-blue-800 dark:text-blue-300">{pozo.tipoTerreno}</td>
                                                <td colSpan={2} className="py-3 px-4 border-r border-gray-300 dark:border-gray-700 text-center font-semibold text-blue-800 dark:text-blue-300">{pozo.resistividad}</td>
                                                <td className="py-3 px-4 text-center font-extrabold text-lg text-blue-900 dark:text-blue-400">{pozo.resultados.resistencia} Ω</td>
                                            </tr>
                                        ) : (
                                            <tr><td colSpan={5} className="py-8 text-center text-gray-400 italic">Haz clic en calcular para ver los resultados</td></tr>
                                        )}
                                        <tr><td colSpan={5} className="py-2"></td></tr>

                                        <tr className="bg-[#002060] text-white">
                                            <td colSpan={5} className="py-2 px-4 font-bold border border-[#002060]">REDUCCIÓN DE LA RESISTENCIA DE PUESTA A TIERRA</td>
                                        </tr>
                                        <tr className="bg-slate-100 dark:bg-gray-800 font-bold border-b border-gray-300 dark:border-gray-700">
                                            <td className="py-2 px-4 border-r border-gray-300 dark:border-gray-700 text-center">R Inicial (Ω)</td>
                                            <td colSpan={2} className="py-2 px-4 border-r border-gray-300 dark:border-gray-700 text-center">% Reducción</td>
                                            <td className="py-2 px-4 border-r border-gray-300 dark:border-gray-700 text-center">R Final (Ω)</td>
                                            <td className="py-2 px-4 text-center">Descripción</td>
                                        </tr>
                                        {pozo.dosisReduccion.map((dosis, idx) => (
                                            <tr key={idx} className="border-b border-gray-300 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-800/50">
                                                <td className="py-2 px-4 border-r border-gray-300 dark:border-gray-700 text-center font-mono">{dosis.rInicial > 0 ? dosis.rInicial : '-'}</td>
                                                <td colSpan={2} className="py-1 px-1 border-r border-gray-300 dark:border-gray-700 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <input disabled={!canEdit} type="number" value={dosis.reduccion} onChange={e => { const n = [...pozo.dosisReduccion]; n[idx].reduccion = +e.target.value; setPozo({ ...pozo, dosisReduccion: n }); }} onBlur={calcularPozoTierra} className="w-16 text-center text-sm border-gray-300 dark:border-gray-600 bg-transparent rounded dark:text-white p-1 focus:ring-0" />
                                                        <span className="text-gray-500">%</span>
                                                    </div>
                                                </td>
                                                <td className="py-2 px-4 border-r border-gray-300 dark:border-gray-700 text-center font-bold text-green-700 dark:text-green-400">{dosis.rFinal > 0 ? dosis.rFinal : '-'}</td>
                                                <td className="py-2 px-4 text-center text-sm">{dosis.descripcion}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-slate-200 dark:border-gray-800 overflow-x-auto p-4 md:p-6">
                                <table className="w-full text-sm text-left align-middle border-collapse border border-gray-300 dark:border-gray-700">
                                    <thead>
                                        <tr>
                                            <th colSpan={4} className="py-3 px-4 text-center font-bold text-lg bg-[#002060] text-white border border-[#002060]">
                                                CÁLCULO DEL PARARRAYO
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-gray-700 dark:text-gray-300">
                                        <tr className="bg-[#002060] text-white text-left">
                                            <td colSpan={4} className="py-2 px-4 font-bold border border-[#002060]">1 Frecuencia anual de caída de rayos y Dimensiones</td>
                                        </tr>
                                        <tr className="border-b border-gray-300 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-800/50">
                                            <td className="py-3 px-4 border-r border-gray-300 dark:border-gray-700 font-semibold w-1/4">Td (Isoceraúnico)</td>
                                            <td className="py-2 px-2 border-r border-gray-300 dark:border-gray-700 text-center">
                                                <input disabled={!canEdit} type="number" value={pararrayo.td} onChange={e => setPararrayo({ ...pararrayo, td: +e.target.value })} className="w-full max-w-24 text-center border-gray-300 dark:border-gray-600 bg-transparent rounded dark:text-white p-1" />
                                            </td>
                                            <td className="py-3 px-4 font-semibold text-center border-r border-gray-300 dark:border-gray-700" colSpan={2}>
                                                Nk = Ng = {pararrayo.resultados?.calculado ? pararrayo.resultados.nkng : '-'} rayos/km²·año
                                            </td>
                                        </tr>
                                        <tr className="border-b border-gray-300 dark:border-gray-700 bg-slate-50 dark:bg-gray-800/30">
                                            <td className="py-2 px-4 border-r border-gray-300 dark:border-gray-700 font-semibold text-sm">Longitud (L) m</td>
                                            <td className="py-1 px-2 border-r border-gray-300 dark:border-gray-700 text-center">
                                                <input disabled={!canEdit} type="number" value={pararrayo.L} onChange={e => setPararrayo({ ...pararrayo, L: +e.target.value })} className="w-full max-w-24 text-center border-gray-300 dark:border-gray-600 bg-transparent rounded dark:text-white p-1" />
                                            </td>
                                            <td className="py-2 px-4 border-r border-gray-300 dark:border-gray-700 font-semibold text-sm text-right">Ancho (W) m</td>
                                            <td className="py-1 px-2 text-center">
                                                <input disabled={!canEdit} type="number" value={pararrayo.W} onChange={e => setPararrayo({ ...pararrayo, W: +e.target.value })} className="w-full max-w-24 text-center border-gray-300 dark:border-gray-600 bg-transparent rounded dark:text-white p-1" />
                                            </td>
                                        </tr>
                                        <tr className="border-b border-gray-300 dark:border-gray-700 bg-slate-50 dark:bg-gray-800/30">
                                            <td className="py-2 px-4 border-r border-gray-300 dark:border-gray-700 font-semibold text-sm">Altura Estruct. (H) m</td>
                                            <td className="py-1 px-2 border-r border-gray-300 dark:border-gray-700 text-center">
                                                <input disabled={!canEdit} type="number" value={pararrayo.H} onChange={e => setPararrayo({ ...pararrayo, H: +e.target.value })} className="w-full max-w-24 text-center border-gray-300 dark:border-gray-600 bg-transparent rounded dark:text-white p-1" />
                                            </td>
                                            <td colSpan={2} className="py-2 px-4 italic text-xs text-gray-500 text-center">Estos datos se usan para Ae.</td>
                                        </tr>
                                        <tr><td colSpan={4} className="py-2"></td></tr>

                                        <tr className="bg-[#002060] text-white">
                                            <td colSpan={4} className="py-2 px-4 font-bold border border-[#002060]">2 Cálculo de Área Equivalente (Ae)</td>
                                        </tr>
                                        <tr className="border-b border-gray-300 dark:border-gray-700">
                                            <td colSpan={4} className="py-4 px-6 text-center font-bold text-base text-blue-900 dark:text-blue-400 bg-blue-50/30 dark:bg-transparent">
                                                Ae: {pararrayo.resultados?.calculado ? pararrayo.resultados.areaEquivalente : '-'} m²
                                            </td>
                                        </tr>
                                        <tr><td colSpan={4} className="py-2"></td></tr>

                                        <tr className="bg-[#002060] text-white">
                                            <td colSpan={4} className="py-2 px-4 font-bold border border-[#002060]">Coeficientes de Riesgo</td>
                                        </tr>
                                        <tr className="bg-slate-100 dark:bg-gray-800 font-bold border-b border-gray-300 dark:border-gray-700">
                                            <td className="py-2 px-4 border-r border-gray-300 dark:border-gray-700 text-center" colSpan={4}>
                                                <div className="flex justify-around items-center w-full">
                                                    {['c1', 'c2', 'c3', 'c4', 'c5'].map((c: string) => (
                                                        <div key={c} className="flex flex-col items-center">
                                                            <span className="text-xs text-slate-500 uppercase">{c}</span>
                                                            <input disabled={!canEdit} type="number" step="0.1" value={(pararrayo as any)[c]} onChange={e => setPararrayo({ ...pararrayo, [c]: +e.target.value })} className="w-16 mt-1 text-center border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 rounded dark:text-white p-1" />
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>

                                        {canEdit && (
                                            <tr>
                                                <td colSpan={4} className="py-6 px-4 text-center border-b border-gray-300 dark:border-gray-700">
                                                    <button onClick={calcularPararrayo} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors shadow">
                                                        Calcular Evaluación de Pararrayo
                                                    </button>
                                                </td>
                                            </tr>
                                        )}
                                        <tr><td colSpan={4} className="py-2"></td></tr>

                                        <tr className="bg-[#002060] text-white">
                                            <td colSpan={4} className="py-2 px-4 font-bold border border-[#002060]">5 Evaluación y comparación de riesgos</td>
                                        </tr>
                                        <tr className="bg-slate-100 dark:bg-gray-800 font-bold border-b border-gray-300 dark:border-gray-700">
                                            <td className="py-2 px-4 border-r border-gray-300 dark:border-gray-700 text-center">ÁREA (Ae)</td>
                                            <td className="py-2 px-4 border-r border-gray-300 dark:border-gray-700 text-center">Nd</td>
                                            <td className="py-2 px-4 border-r border-gray-300 dark:border-gray-700 text-center">Nc</td>
                                            <td className="py-2 px-4 text-center">REQUIERE PROTECCIÓN</td>
                                        </tr>
                                        {pararrayo.resultados?.calculado ? (
                                            <tr className="border-b border-gray-300 dark:border-gray-700">
                                                <td className="py-4 px-4 border-r border-gray-300 dark:border-gray-700 text-center font-semibold">{pararrayo.resultados.areaEquivalente}</td>
                                                <td className="py-4 px-4 border-r border-gray-300 dark:border-gray-700 text-center font-semibold text-red-600 dark:text-red-400">{pararrayo.resultados.Nd}</td>
                                                <td className="py-4 px-4 border-r border-gray-300 dark:border-gray-700 text-center font-semibold text-green-600 dark:text-green-400">{pararrayo.resultados.nc}</td>
                                                <td className={`py-4 px-4 text-center font-extrabold ${pararrayo.resultados.requiereProteccion ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                                    {pararrayo.resultados.requiereProteccion ? 'SI' : 'NO'}
                                                </td>
                                            </tr>
                                        ) : (
                                            <tr><td colSpan={4} className="py-8 text-center text-gray-400 italic">Sin datos calculados</td></tr>
                                        )}
                                        {pararrayo.resultados?.calculado && pararrayo.resultados.requiereProteccion && (
                                            <tr className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-900 dark:text-yellow-200">
                                                <td colSpan={2} className="py-3 px-4 border-r border-yellow-200 dark:border-yellow-900/50 font-bold text-right">Eficiencia y Nivel:</td>
                                                <td className="py-3 px-4 text-center border-r border-yellow-200 dark:border-yellow-900/50">Eficiencia: {pararrayo.resultados.eficienciaRequerida}</td>
                                                <td className="py-3 px-4 text-center font-bold">Nivel de Protección: {pararrayo.resultados.nivelProteccion}</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
                        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-sm p-6 text-center ring-1 ring-gray-200 dark:ring-gray-800">
                            <UploadCloud className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Logos Requeridos</h3>
                            <p className="text-sm text-slate-600 dark:text-gray-400 mb-6">Debes seleccionar ambos logos del proyecto en los "Ajustes Globales" antes de exportar el Excel.</p>
                            <button onClick={() => setShowModal(false)} className="w-full bg-slate-800 dark:bg-slate-700 text-white font-semibold py-2 rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors">
                                Entendido
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
