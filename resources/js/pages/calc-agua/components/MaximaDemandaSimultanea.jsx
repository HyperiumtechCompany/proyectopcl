import React, { useState, useEffect, useMemo, useCallback } from 'react';
import UHData from '../lib/uh-componets.js';

const categoryMap = {
    'inodoro': 'inodoro',
    'urinario': 'urinario',
    'lavatorio': 'lavatorio',
    'lavadero': 'lavadero',
    'lavadero_con_triturador': 'lavatorio',
    'bebedero': 'lavatorio',
    'ducha': 'ducha',
    'tina': 'ducha'
};

const uhPorAccesorio = {
    inodoro: 5,
    urinario: 3,
    lavatorio: 2,
    lavadero: 3,
    ducha: 4
};

export default function MaximaDemandaSimultanea({ initialData: data, editMode: isEdit, onChange }) {

    const [grades, setGrades] = useState(data?.grades || { inicial: true, primaria: false, secundaria: false });

    const [anexo02Data, setAnexo02Data] = useState(data?.anexo02 || [
        { id: 1, aparatoSanitario: 'Inodoro', tipo: 'Con Tanque - Descarga reducida', total: 2.5, afmax: 2.5, acmax: null },
        { id: 2, aparatoSanitario: 'Inodoro', tipo: 'Con Tanque', total: 5, afmax: 5, acmax: null },
        { id: 3, aparatoSanitario: 'Inodoro', tipo: 'C/ Válvula semiautomática y automática', total: 8, afmax: 8, acmax: null },
        { id: 4, aparatoSanitario: 'Inodoro', tipo: 'C/ Válvula semiaut. y autom. descarga reducida', total: 4, afmax: 4, acmax: null },
        { id: 5, aparatoSanitario: 'Lavatorio', tipo: 'Corriente', total: 2, afmax: 1.5, acmax: 1.5 },
        { id: 6, aparatoSanitario: 'Lavatorio', tipo: 'Múltiple', total: 2, afmax: 1.5, acmax: 1.5 },
        { id: 7, aparatoSanitario: 'Lavadero', tipo: 'Hotel restaurante', total: 4, afmax: 3, acmax: 3 },
        { id: 8, aparatoSanitario: 'Lavadero', tipo: '-', total: 3, afmax: 2, acmax: 2 },
        { id: 9, aparatoSanitario: 'Ducha', tipo: '-', total: 4, afmax: 3, acmax: 3 },
        { id: 10, aparatoSanitario: 'Tina', tipo: '-', total: 6, afmax: 3, acmax: 3 },
        { id: 11, aparatoSanitario: 'Urinario', tipo: 'Con Tanque', total: 3, afmax: 3, acmax: null },
        { id: 12, aparatoSanitario: 'Urinario', tipo: 'C/ Válvula semiautomática y automática', total: 5, afmax: 5, acmax: null },
        { id: 13, aparatoSanitario: 'Urinario', tipo: 'C/ Válvula semiaut. y autom. descarga reducida', total: 2.5, afmax: 2.5, acmax: null },
        { id: 14, aparatoSanitario: 'Urinario', tipo: 'Múltiple', total: 3, afmax: 3, acmax: null },
        { id: 15, aparatoSanitario: 'Bebedero', tipo: 'Simple', total: 1, afmax: 1, acmax: null },
        { id: 16, aparatoSanitario: 'Bebedero', tipo: 'Múltiple (UG por cada salida)', total: 1, afmax: 1, acmax: null },
    ]);

    const [exterioresData, setExterioresData] = useState(data?.exterioresData || {
        inicial: { nombre: 'AREA VERDE - INICIAL', areaRiego: 491.6, salidasRiego: 6, caudalPorSalida: 0.23, uh: 5.00, uhTotal: 30.00 },
        primaria: { nombre: 'AREA VERDE - PRIMARIA', areaRiego: 41.46, salidasRiego: 2, caudalPorSalida: 0.23, uh: 5.00, uhTotal: 10.00 },
        secundaria: { nombre: 'AREA VERDE - SECUNDARIA', areaRiego: 200.0, salidasRiego: 4, caudalPorSalida: 0.23, uh: 5.00, uhTotal: 20.00 }
    });

    const [tables, setTables] = useState(data?.tables || {
        inicial: { modules: [] },
        primaria: { modules: [] },
        secundaria: { modules: [] }
    });

    const gradeOptions = {
        inicial: { name: 'INICIAL', description: 'Educación Inicial (3-5 años)' },
        primaria: { name: 'PRIMARIA', description: 'Educación Primaria (6-11 años)' },
        secundaria: { name: 'SECUNDARIA', description: 'Educación Secundaria (12-16 años)' }
    };

    const hasSelectedGrades = Object.values(grades).some(Boolean);
    const selectedGradesList = Object.keys(grades).filter(g => grades[g]);

    const normalizeKey = text => text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_$/, '');

    // Computed accessories
    const extractedAccessories = useMemo(() => {
        const categoriesData = {};
        anexo02Data.forEach(row => {
            const normalized = normalizeKey(row.aparatoSanitario);
            const categoryKey = categoryMap[normalized] || normalized;
            if (!categoriesData[categoryKey]) {
                categoriesData[categoryKey] = {
                    key: categoryKey,
                    label: categoryKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                    udValue: 0,
                    totalCategoryCount: 0
                };
            }
            categoriesData[categoryKey].totalCategoryCount++;
        });
        Object.keys(categoriesData).forEach(k => { categoriesData[k].udValue = categoriesData[k].totalCategoryCount; });
        return Object.values(categoriesData);
    }, [anexo02Data]);

    // Data generation functions
    const createEmptyAccessories = useCallback(() => {
        const accs = {};
        extractedAccessories.forEach(acc => { accs[acc.key] = { cantidad: 0, uh: uhPorAccesorio[acc.key] || 0 }; });
        return accs;
    }, [extractedAccessories]);

    const calculateRowUD = (accs) => {
        if (!accs) return 0;
        return extractedAccessories.reduce((sum, acc) => {
            const c = parseFloat(accs[acc.key]?.cantidad) || 0;
            const u = parseFloat(accs[acc.key]?.uh) || 0;
            return sum + (c * u);
        }, 0);
    };

    const createEmptyDetail = useCallback(() => ({
        id: Date.now() + Math.random(), type: 'child', nivel: 'NIVEL', descripcion: 'Descripción del Nivel/Aula',
        accessories: createEmptyAccessories(), udTotal: 0
    }), [createEmptyAccessories]);

    const createEmptyChild = useCallback(() => ({
        id: Date.now() + Math.random(), type: 'child', nivel: 'SUB-NIVEL', descripcion: 'Descripción del Sub-Nivel',
        accessories: createEmptyAccessories(), udTotal: 0, details: []
    }), [createEmptyAccessories]);

    const createEmptyGrandchild = useCallback(() => ({
        id: Date.now() + Math.random(), type: 'grandchild', descripcion: 'Descripción del Detalle',
        accessories: createEmptyAccessories(), udTotal: 0
    }), [createEmptyAccessories]);

    const createEmptyModule = useCallback((moduleNumber) => {
        const initialDetail = createEmptyDetail();
        return {
            id: Date.now() + Math.random(), type: 'module', name: `MÓDULO ${moduleNumber}`,
            details: [initialDetail], children: [], totalUD: initialDetail.udTotal || 0
        };
    }, [createEmptyDetail]);

    // Ensure grades have tables initialized when toggled
    useEffect(() => {
        setTables(prev => {
            const next = { ...prev };
            Object.keys(grades).forEach(grade => {
                if (grades[grade]) {
                    if (!next[grade] || !next[grade].modules) next[grade] = { modules: [] };
                    if (next[grade].modules.length === 0) next[grade].modules = [createEmptyModule(1)];
                }
            });
            return next;
        });
    }, [grades, createEmptyModule]);

    // Update tables when accessories change
    useEffect(() => {
        setTables(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(grade => {
                if (!next[grade].modules) return;
                next[grade].modules = next[grade].modules.map(mod => {
                    const updateItem = (item) => {
                        const newAccs = { ...item.accessories };
                        extractedAccessories.forEach(acc => {
                            if (!newAccs[acc.key]) newAccs[acc.key] = { cantidad: 0, uh: uhPorAccesorio[acc.key] || 0 };
                        });
                        return { ...item, accessories: newAccs, udTotal: calculateRowUD(newAccs) };
                    };
                    mod.details = mod.details.map(updateItem);
                    mod.children = mod.children.map(child => ({
                        ...updateItem(child),
                        details: child.details.map(updateItem)
                    }));
                    mod.totalUD = (mod.details.reduce((s, d) => s + d.udTotal, 0) + mod.children.reduce((s, c) => s + c.udTotal + c.details.reduce((ss, gc) => ss + gc.udTotal, 0), 0));
                    return mod;
                });
            });
            return next;
        });
    }, [extractedAccessories]);

    const buscarCaudalPorUH = (uh) => ({ 1: 0.20, 2: 0.30, 3: 0.50, 4: 0.60, 5: 0.80 }[uh] || 0);

    const getTankFlow = useCallback((units) => {
        const u = parseFloat(units);
        if (isNaN(u) || u <= 0) return 0;

        // Exact match with small tolerance
        const exact = UHData.find(item => Math.abs(item.units - u) < 0.0001);
        if (exact) return exact.tankFlow;

        // Find surrounding values for interpolation
        let lower = null;
        let higher = null;

        for (const item of UHData) {
            if (item.units < u) {
                lower = item;
            } else if (item.units > u) {
                higher = item;
                break;
            }
        }

        if (lower && higher) {
            // Linear interpolation: y = y0 + (x - x0) * (y1 - y0) / (x1 - x0)
            return lower.tankFlow + (u - lower.units) * (higher.tankFlow - lower.tankFlow) / (higher.units - lower.units);
        }

        if (higher) return higher.tankFlow;
        if (lower) return lower.tankFlow; // Return last known value for values above the table
        return 0;
    }, []);

    // Helper functions for dynamic calculations
    const getRowUDTotal = useCallback((item) => {
        if (!item?.accessories) return 0;
        return extractedAccessories.reduce((sum, acc) => {
            const c = parseFloat(item.accessories[acc.key]?.cantidad) || 0;
            const u = parseFloat(item.accessories[acc.key]?.uh) || 0;
            return sum + (c * u);
        }, 0);
    }, [extractedAccessories]);

    const getModuleUDTotal = useCallback((mod) => {
        const detailsUD = (mod?.details || []).reduce((s, d) => s + getRowUDTotal(d), 0);
        const childrenUD = (mod?.children || []).reduce((s, c) => {
            const childBase = getRowUDTotal(c);
            const childDetails = (c.details || []).reduce((ss, gc) => ss + getRowUDTotal(gc), 0);
            return s + childBase + childDetails;
        }, 0);
        return detailsUD + childrenUD;
    }, [getRowUDTotal]);

    const getGradeUDTotal = useCallback((grade) => {
        return (tables[grade]?.modules || []).reduce((sum, mod) => sum + getModuleUDTotal(mod), 0);
    }, [tables, getModuleUDTotal]);

    // Computed totals using derived state to avoid stale data
    const totalsComputed = useMemo(() => {
        const gradeTotals = {};
        selectedGradesList.forEach(grade => {
            gradeTotals[grade] = getGradeUDTotal(grade);
        });

        const overallUDTotal = Object.values(gradeTotals).reduce((a, b) => a + b, 0);
        const exterioresUDTotal = selectedGradesList.reduce((sum, g) => sum + (parseFloat(exterioresData[g]?.uhTotal) || 0), 0);

        const qmdsInterior = getTankFlow(overallUDTotal);
        const qmdsRiego = getTankFlow(exterioresUDTotal);
        const qmdsTotal = qmdsInterior + qmdsRiego;

        return {
            gradeTotals,
            overallUDTotal,
            exterioresUDTotal,
            qmdsInterior,
            qmdsRiego,
            qmdsTotal
        };
    }, [selectedGradesList, tables, exterioresData, getGradeUDTotal, getTankFlow]);

    useEffect(() => {
        const totals = {
            sistemasInterior: {
                maximaDemandaSimultanea: totalsComputed.overallUDTotal,
                qmds: totalsComputed.qmdsInterior.toFixed(2)
            },
            sistemaRiego: {
                maximaDemandaSimultaneaRiego: totalsComputed.exterioresUDTotal,
                qmdsRiego: totalsComputed.qmdsRiego.toFixed(2)
            },
            qmdsTotal: totalsComputed.qmdsTotal.toFixed(2),
            totalUDPorGrado: totalsComputed.gradeTotals
        };

        // Update the table data with current calculations before sending to parent to ensure persistence
        const updatedTables = JSON.parse(JSON.stringify(tables));
        Object.keys(updatedTables).forEach(g => {
            if (updatedTables[g].modules) {
                updatedTables[g].modules.forEach(mod => {
                    mod.details.forEach(d => { d.udTotal = getRowUDTotal(d); });
                    mod.children.forEach(c => {
                        c.udTotal = getRowUDTotal(c);
                        c.details.forEach(gc => { gc.udTotal = getRowUDTotal(gc); });
                    });
                    mod.totalUD = getModuleUDTotal(mod);
                });
            }
        });

        document.dispatchEvent(new CustomEvent('maxima-demanda-simultanea-updated', {
            detail: { grades, exterioresData, tables: updatedTables, totals }
        }));

        if (onChange) {
            onChange({
                grades, tables: updatedTables, anexo02: anexo02Data, exterioresData,
                totals
            });
        }
    }, [grades, tables, anexo02Data, exterioresData, totalsComputed, getRowUDTotal, getModuleUDTotal]);

    const handleGradesChange = (gradeKey) => {
        if (!isEdit) return;
        setGrades(prev => ({ ...prev, [gradeKey]: !prev[gradeKey] }));
    };

    return (
        <div className="max-w-full mx-auto p-4">
            <header className="bg-white/80 backdrop-blur-lg border-b border-slate-200/60 shadow-lg sticky top-1 z-50 mb-8 rounded-xl">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg">
                                <i className="fas fa-water text-white text-lg"></i>
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-950">4. CALCULO DE LA MAXIMA DEMANDA SIMULTANEA</h1>
                                <p className="text-sm text-gray-950">Cálculo de consumo de agua</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-full mx-auto space-y-8">
                {/* Configuración de Grados */}
                <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
                    <h2 className="text-xl font-bold text-gray-950 mb-6 flex items-center">
                        <svg className="w-7 h-7 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                        </svg>
                        Configuración de Grados Educativos
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {Object.entries(gradeOptions).map(([key, info]) => (
                            <label key={key} className={`group ${isEdit ? 'cursor-pointer' : 'cursor-default'}`}>
                                <div className={`relative bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border-2 transition-all duration-300 ${grades[key] ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100 shadow-md transform scale-[1.02]' : 'border-gray-200'} ${isEdit && !grades[key] ? 'hover:border-blue-300 hover:shadow-lg' : ''}`}>
                                    <div className="flex items-start space-x-4">
                                        <div className="flex-shrink-0 mt-1">
                                            <input type="checkbox" disabled={!isEdit} checked={grades[key]} onChange={() => handleGradesChange(key)} className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 transition-colors" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-bold text-lg text-gray-950">{info.name}</div>
                                            <div className="text-sm text-gray-950 mt-1">{info.description}</div>
                                            {grades[key] && <div className="mt-2 text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded inline-block">✓ Seleccionado</div>}
                                        </div>
                                    </div>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Anexo-02 */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="bg-gradient-to-r from-yellow-500 to-orange-500 p-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white flex items-center">
                                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                Anexo-02 (Aparatos Sanitarios)
                            </h2>
                            {isEdit && (
                                <button onClick={() => setAnexo02Data([...anexo02Data, { id: Date.now(), aparatoSanitario: 'Nuevo Aparato', tipo: 'Nuevo Tipo', total: 1, afmax: null, acmax: null }])} className="bg-white text-orange-600 px-4 py-2 rounded-lg hover:bg-orange-50 transition-colors font-semibold shadow-md text-sm">
                                    + Agregar Aparato
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="p-6 overflow-x-auto">
                        <table className="min-w-full border-collapse">
                            <thead>
                                <tr className="bg-gray-100 text-gray-950 text-sm border-b-2 border-gray-200">
                                    <th className="px-4 py-3 text-left">Aparato Sanitario</th>
                                    <th className="px-4 py-3 text-left">Tipo</th>
                                    <th className="px-4 py-3 text-center">Total UD</th>
                                    <th className="px-4 py-3 text-center">AF</th>
                                    <th className="px-4 py-3 text-center">AC</th>
                                    {isEdit && <th className="px-4 py-3 text-center">Acciones</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {anexo02Data.map((row, i) => (
                                    <tr key={row.id} className="border-b hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-2 text-gray-950"><input disabled={!isEdit} value={row.aparatoSanitario} onChange={e => { const n = [...anexo02Data]; n[i].aparatoSanitario = e.target.value; setAnexo02Data(n); }} className="w-full bg-transparent border-0 focus:ring-2 focus:ring-blue-100 rounded px-2 py-1 text-gray-950" /></td>
                                        <td className="px-4 py-2 text-gray-950"><input disabled={!isEdit} value={row.tipo} onChange={e => { const n = [...anexo02Data]; n[i].tipo = e.target.value; setAnexo02Data(n); }} className="w-full bg-transparent border-0 focus:ring-2 focus:ring-blue-100 rounded px-2 py-1 text-gray-950" /></td>
                                        <td className="px-4 py-2 text-gray-950"><input disabled={!isEdit} type="number" value={row.total} onChange={e => { const n = [...anexo02Data]; n[i].total = +e.target.value; setAnexo02Data(n); }} className="w-full text-center bg-transparent border-0 focus:ring-2 focus:ring-blue-100 rounded px-2 py-1 font-semibold text-gray-950" /></td>
                                        <td className="px-4 py-2 text-gray-950"><input disabled={!isEdit} value={row.afmax || ''} onChange={e => { const n = [...anexo02Data]; n[i].afmax = e.target.value; setAnexo02Data(n); }} className="w-full text-center bg-transparent border-0 focus:ring-2 focus:ring-blue-100 rounded px-2 py-1 text-gray-950" /></td>
                                        <td className="px-4 py-2 text-gray-950"><input disabled={!isEdit} value={row.acmax || ''} onChange={e => { const n = [...anexo02Data]; n[i].acmax = e.target.value; setAnexo02Data(n); }} className="w-full text-center bg-transparent border-0 focus:ring-2 focus:ring-blue-100 rounded px-2 py-1 text-gray-950" /></td>
                                        {isEdit && <td className="px-4 py-2 text-center text-gray-950"><button onClick={() => { if (confirm('¿Eliminar?')) setAnexo02Data(anexo02Data.filter(r => r.id !== row.id)) }} className="text-red-500 hover:text-red-700 font-bold px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-gray-950">✕</button></td>}
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-50 font-bold border-t-2 border-gray-200">
                                <tr>
                                    <td colSpan="2" className="px-4 py-3 text-right text-gray-950">TOTAL UD</td>
                                    <td className="px-4 py-3 text-center text-blue-600">{anexo02Data.reduce((s, r) => s + (parseFloat(r.total) || 0), 0)}</td>
                                    <td colSpan={isEdit ? 3 : 2}></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {!hasSelectedGrades ? (
                    <div className="text-center py-20 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl shadow-lg border-2 border-dashed border-gray-300">
                        <svg className="mx-auto h-20 w-20 text-gray-950 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                        <h3 className="text-3xl font-bold text-gray-950 mb-4">Selecciona Grados Educativos</h3>
                        <p className="text-gray-950 text-lg mb-8 max-w-lg mx-auto">Selecciona al menos un grado educativo en la configuración superior para comenzar con los cálculos de la red interior y sumideros.</p>
                        {isEdit && <button onClick={() => handleGradesChange('inicial')} className="bg-blue-600 text-white px-8 py-4 rounded-xl hover:bg-blue-700 transition-colors font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-1">Comenzar con Nivel Inicial</button>}
                    </div>
                ) : (
                    <div className="space-y-10">
                        <div className="flex items-center">
                            <h2 className="text-3xl font-extrabold text-gray-950 flex items-center bg-clip-text text-transparent bg-gradient-to-r from-green-600 to-teal-600">
                                <svg className="w-10 h-10 text-green-500 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                                Cálculos por Grado Educativo
                            </h2>
                            <div className="ml-6 flex-1 h-1 bg-gradient-to-r from-green-200 to-transparent rounded-full"></div>
                        </div>

                        {selectedGradesList.map(grade => (
                            <div key={grade} className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                                <div className="bg-gradient-to-r from-green-500 to-teal-600 p-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-bold text-white uppercase tracking-wider">Cálculos para {gradeOptions[grade].name}</h3>
                                        {isEdit && <button onClick={() => {
                                            const t = { ...tables };
                                            t[grade].modules.push(createEmptyModule(t[grade].modules.length + 1));
                                            setTables(t);
                                        }} className="bg-white text-green-600 px-5 py-2.5 rounded-lg hover:bg-green-50 transition-colors font-bold shadow-md text-sm">+ Agregar Módulo</button>}
                                    </div>
                                </div>
                                <div className="p-0 overflow-x-auto">
                                    <table className="min-w-full border-collapse w-full text-gray-950">
                                        <thead>
                                            <tr className="bg-gray-100 border-b-2 border-gray-300">
                                                {isEdit && <th className="px-3 py-4 text-center border-r min-w-[100px] shadow-[inset_-1px_0_0_rgba(0,0,0,0.1)] sticky left-0 bg-gray-100 z-10 text-xs font-bold text-gray-950 uppercase">Acciones</th>}
                                                <th className="px-4 py-4 text-left border-r min-w-[200px] text-xs font-bold text-gray-950 uppercase">Módulo</th>
                                                <th className="px-4 py-4 text-left border-r min-w-[120px] text-xs font-bold text-gray-950 uppercase">Nivel</th>
                                                <th className="px-4 py-4 text-left border-r min-w-[200px] text-xs font-bold text-gray-950 uppercase">Descripción</th>
                                                {extractedAccessories.map(acc => (
                                                    <th key={acc.key} colSpan="2" className="px-2 py-4 text-center border-r border-gray-300 min-w-[140px] text-xs font-bold text-gray-950 uppercase bg-gray-50">
                                                        {acc.label}
                                                        <div className="text-[10px] text-blue-600 font-bold mt-1 bg-blue-100 inline-block px-2 rounded-full py-0.5">({acc.totalCategoryCount} U.D.)</div>
                                                    </th>
                                                ))}
                                                <th className="px-4 py-4 text-center border-gray-300 min-w-[120px] text-xs font-bold text-gray-950 uppercase bg-blue-50">Total U.D.</th>
                                            </tr>
                                            <tr className="bg-gray-50 border-b border-gray-300">
                                                {isEdit && <th className="p-2 border-r sticky left-0 bg-gray-50 z-10"></th>}
                                                {Array.from({ length: 3 }).map((_, i) => <th key={i} className="p-2 border-r"></th>)}
                                                {extractedAccessories.map(acc => (
                                                    <React.Fragment key={acc.key}>
                                                        <th className="px-2 py-2 text-center text-[10px] font-bold text-gray-950 border-r border-gray-200">CANTIDAD</th>
                                                        <th className="px-2 py-2 text-center text-[10px] font-bold text-gray-950 border-r border-gray-300">UH/U</th>
                                                    </React.Fragment>
                                                ))}
                                                <th className="p-2 bg-blue-50"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tables[grade].modules.map((mod, modIdx) => (
                                                <React.Fragment key={mod.id}>
                                                    <tr className="bg-blue-50/40 border-b border-blue-100 font-bold text-blue-900">
                                                        {isEdit && (
                                                            <td className="px-3 py-2 text-center border-r sticky left-0 bg-blue-50/90 z-10 border-blue-100">
                                                                <button onClick={() => { const t = { ...tables }; t[grade].modules[modIdx].children.push(createEmptyChild()); setTables(t); }} className="text-white bg-blue-500 hover:bg-blue-600 w-7 h-7 rounded text-sm mx-1 shadow-sm transition-transform hover:scale-110">+</button>
                                                                <button onClick={() => { if (confirm('¿Eliminar módulo?')) { const t = { ...tables }; t[grade].modules.splice(modIdx, 1); setTables(t); } }} className="text-white bg-red-500 hover:bg-red-600 w-7 h-7 rounded text-sm shadow-sm transition-transform hover:scale-110">×</button>
                                                            </td>
                                                        )}
                                                        <td className="px-4 py-3"><input disabled={!isEdit} value={mod.name} onChange={e => { const t = { ...tables }; t[grade].modules[modIdx].name = e.target.value; setTables(t); }} className="w-full bg-transparent font-bold border-0 focus:ring-2 focus:ring-blue-300 rounded px-2" /></td>
                                                        <td className="px-4 py-3 border-r border-blue-100"></td><td className="px-4 py-3 border-r border-blue-100 text-blue-700">Módulo Principal</td>
                                                        {extractedAccessories.map(acc => (<React.Fragment key={acc.key}><td className="px-2 py-3 border-r border-blue-100"></td><td className="px-2 py-3 border-r border-blue-200"></td></React.Fragment>))}
                                                        <td className="px-4 py-3 text-center text-lg bg-blue-100 border-b-2 border-blue-200 text-blue-800">{getModuleUDTotal(mod).toFixed(2)}</td>
                                                    </tr>
                                                    {mod.details.map((det, detIdx) => (
                                                        <tr key={det.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                                            {isEdit && (
                                                                <td className="px-3 py-2 text-center border-r sticky left-0 bg-white group-hover:bg-gray-50 z-10">
                                                                    <button onClick={() => { const t = { ...tables }; t[grade].modules[modIdx].details.push(createEmptyDetail()); setTables(t); }} className="text-white bg-blue-500 hover:bg-blue-600 w-6 h-6 rounded text-xs mx-1">+</button>
                                                                    <button onClick={() => { const t = { ...tables }; t[grade].modules[modIdx].details.splice(detIdx, 1); setTables(t); }} className="text-white bg-red-500 hover:bg-red-600 w-6 h-6 rounded text-xs">×</button>
                                                                </td>
                                                            )}
                                                            <td className="px-4 py-2 border-r text-gray-950 text-xs">-</td>
                                                            <td className="px-4 py-2 border-r"><input disabled={!isEdit} value={det.nivel} onChange={e => { const t = { ...tables }; t[grade].modules[modIdx].details[detIdx].nivel = e.target.value; setTables(t); }} className="w-full bg-transparent border-0 focus:ring-2 focus:ring-blue-100 px-1 rounded" /></td>
                                                            <td className="px-4 py-2 border-r"><input disabled={!isEdit} value={det.descripcion} onChange={e => { const t = { ...tables }; t[grade].modules[modIdx].details[detIdx].descripcion = e.target.value; setTables(t); }} className="w-full bg-transparent border-0 focus:ring-2 focus:ring-blue-100 px-1 rounded" /></td>
                                                            {extractedAccessories.map(acc => (
                                                                <React.Fragment key={acc.key}>
                                                                    <td className="px-2 py-2 border-r border-gray-200"><input disabled={!isEdit} type="number" min="0" value={det.accessories[acc.key]?.cantidad || ''} onChange={e => { const t = { ...tables }; t[grade].modules[modIdx].details[detIdx].accessories[acc.key].cantidad = +e.target.value; setTables(t); }} className="w-full text-center bg-transparent border border-gray-200 rounded px-1 py-1 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" /></td>
                                                                    <td className="px-2 py-2 border-r border-gray-300"><input disabled={!isEdit} type="number" step="0.1" value={det.accessories[acc.key]?.uh || ''} onChange={e => { const t = { ...tables }; t[grade].modules[modIdx].details[detIdx].accessories[acc.key].uh = +e.target.value; setTables(t); }} className="w-full text-center bg-transparent border border-gray-200 rounded px-1 py-1 text-gray-950 bg-gray-50 focus:border-blue-500" /></td>
                                                                </React.Fragment>
                                                            ))}
                                                            <td className="px-4 py-2 text-center font-bold bg-gray-50/50 text-gray-950">{getRowUDTotal(det).toFixed(2)}</td>
                                                        </tr>
                                                    ))}
                                                    {mod.children.map((child, childIdx) => (
                                                        <React.Fragment key={child.id}>
                                                            <tr className="bg-green-50/40 border-b border-green-100 font-semibold text-green-900">
                                                                {isEdit && (
                                                                    <td className="px-3 py-2 text-center border-r sticky left-0 bg-green-50/90 z-10 border-green-100">
                                                                        <button onClick={() => { const t = { ...tables }; t[grade].modules[modIdx].children[childIdx].details.push(createEmptyGrandchild()); setTables(t); }} className="text-white bg-blue-500 hover:bg-blue-600 w-6 h-6 rounded text-xs mx-1">+</button>
                                                                        <button onClick={() => { const t = { ...tables }; t[grade].modules[modIdx].children.splice(childIdx, 1); setTables(t); }} className="text-white bg-red-500 hover:bg-red-600 w-6 h-6 rounded text-xs">×</button>
                                                                    </td>
                                                                )}
                                                                <td className="px-4 py-2 border-r border-green-100 text-xs font-normal pl-8 text-green-700">↳ Sub-Nivel</td>
                                                                <td className="px-4 py-2 border-r border-green-100"><input disabled={!isEdit} value={child.nivel} onChange={e => { const t = { ...tables }; t[grade].modules[modIdx].children[childIdx].nivel = e.target.value; setTables(t); }} className="w-full bg-transparent border-0 focus:ring-2 focus:ring-green-300 font-semibold px-2 rounded" /></td>
                                                                <td className="px-4 py-2 border-r border-green-100"><input disabled={!isEdit} value={child.descripcion} onChange={e => { const t = { ...tables }; t[grade].modules[modIdx].children[childIdx].descripcion = e.target.value; setTables(t); }} className="w-full bg-transparent border-0 focus:ring-2 focus:ring-green-300 px-2 rounded" /></td>
                                                                {extractedAccessories.map(acc => (
                                                                    <React.Fragment key={acc.key}>
                                                                        <td className="px-2 py-2 border-r border-green-100"><input disabled={!isEdit} type="number" min="0" value={child.accessories[acc.key]?.cantidad || ''} onChange={e => { const t = { ...tables }; t[grade].modules[modIdx].children[childIdx].accessories[acc.key].cantidad = +e.target.value; setTables(t); }} className="w-full text-center bg-transparent border border-green-200 rounded px-1 py-1 focus:border-green-500 focus:ring-1 focus:ring-green-500 bg-white/70" /></td>
                                                                        <td className="px-2 py-2 border-r border-green-200"><input disabled={!isEdit} type="number" step="0.1" value={child.accessories[acc.key]?.uh || ''} onChange={e => { const t = { ...tables }; t[grade].modules[modIdx].children[childIdx].accessories[acc.key].uh = +e.target.value; setTables(t); }} className="w-full text-center bg-transparent border border-green-200 rounded px-1 py-1 text-green-800 bg-green-100/50 focus:border-green-500" /></td>
                                                                    </React.Fragment>
                                                                ))}
                                                                <td className="px-4 py-2 text-center font-bold bg-green-100/60 text-green-800">{getRowUDTotal(child).toFixed(2)}</td>
                                                            </tr>
                                                            {child.details.map((gc, gcIdx) => (
                                                                <tr key={gc.id} className="border-b border-gray-100 hover:bg-gray-50 bg-white">
                                                                    {isEdit && (
                                                                        <td className="px-3 py-1.5 text-center border-r sticky left-0 bg-white group-hover:bg-gray-50 z-10">
                                                                            <button onClick={() => { const t = { ...tables }; t[grade].modules[modIdx].children[childIdx].details.splice(gcIdx, 1); setTables(t); }} className="text-white bg-red-400 hover:bg-red-500 w-5 h-5 rounded text-[10px] shadow-sm">×</button>
                                                                        </td>
                                                                    )}
                                                                    <td className="px-4 py-1.5 border-r"></td><td className="px-4 py-1.5 border-r text-gray-950 text-xs pl-8">↳ Detalle</td>
                                                                    <td className="px-4 py-1.5 border-r"><input disabled={!isEdit} value={gc.descripcion} onChange={e => { const t = { ...tables }; t[grade].modules[modIdx].children[childIdx].details[gcIdx].descripcion = e.target.value; setTables(t); }} className="w-full bg-transparent border-0 focus:ring-2 focus:ring-blue-100 text-sm px-1 rounded text-gray-950" /></td>
                                                                    {extractedAccessories.map(acc => (
                                                                        <React.Fragment key={acc.key}>
                                                                            <td className="px-2 py-1.5 border-r border-gray-100"><input disabled={!isEdit} type="number" min="0" value={gc.accessories[acc.key]?.cantidad || ''} onChange={e => { const t = { ...tables }; t[grade].modules[modIdx].children[childIdx].details[gcIdx].accessories[acc.key].cantidad = +e.target.value; setTables(t); }} className="w-full text-center bg-transparent border border-gray-200 rounded px-1 py-0.5 text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-400" /></td>
                                                                            <td className="px-2 py-1.5 border-r border-gray-200"><input disabled={!isEdit} type="number" step="0.1" value={gc.accessories[acc.key]?.uh || ''} onChange={e => { const t = { ...tables }; t[grade].modules[modIdx].children[childIdx].details[gcIdx].accessories[acc.key].uh = +e.target.value; setTables(t); }} className="w-full text-center bg-transparent border border-gray-200 rounded px-1 py-0.5 text-xs text-gray-950 bg-gray-50 focus:border-blue-400" /></td>
                                                                        </React.Fragment>
                                                                    ))}
                                                                    <td className="px-4 py-1.5 text-center font-semibold text-gray-950 text-sm">{getRowUDTotal(gc).toFixed(2)}</td>
                                                                </tr>
                                                            ))}
                                                        </React.Fragment>
                                                    ))}
                                                </React.Fragment>
                                            ))}
                                            {tables[grade].modules.length === 0 && (
                                                <tr><td colSpan={extractedAccessories.length * 2 + (isEdit ? 5 : 4)} className="text-center py-8 text-gray-950">Ningún módulo agregado. Haz clic en 'Agregar Módulo' para comenzar.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="bg-gray-100 p-4 border-t border-gray-300 text-right font-bold text-gray-950 flex justify-end items-center">
                                    <span className="mr-6 text-sm uppercase text-gray-950 font-semibold tracking-wide">Total U.D. Nivel {grade}</span>
                                    <span className="text-2xl text-green-700 bg-green-100 px-6 py-2 rounded-xl shadow-inner border border-green-200">{totalsComputed.gradeTotals[grade].toFixed(2)}</span>
                                </div>
                            </div>
                        ))}

                        {/* Tabla Exterior */}
                        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-8 transform transition-all duration-300 hover:shadow-2xl">
                            <div className="bg-gradient-to-r from-teal-500 to-cyan-600 p-4">
                                <h2 className="text-lg font-bold text-white uppercase tracking-wider flex items-center">
                                    <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    Cálculos para Zonas Exteriores (Áreas Verdes)
                                </h2>
                            </div>
                            <div className="p-0 overflow-x-auto">
                                <table className="min-w-full border-collapse text-gray-950">
                                    <thead>
                                        <tr className="bg-gray-100 border-b-2 border-gray-300">
                                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-950 uppercase">Exterior</th>
                                            <th className="px-6 py-4 text-center text-xs font-bold text-gray-950 uppercase">Área de Riego (m²)</th>
                                            <th className="px-6 py-4 text-center text-xs font-bold text-gray-950 uppercase">Salidas de Riego</th>
                                            <th className="px-6 py-4 text-center text-xs font-bold text-gray-950 uppercase">Caudal por Punto</th>
                                            <th className="px-6 py-4 text-center text-xs font-bold text-gray-950 uppercase">U.H. (Unitario)</th>
                                            <th className="px-6 py-4 text-center text-xs font-bold text-gray-950 uppercase bg-teal-50">U.H. Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedGradesList.map(grade => {
                                            const eData = exterioresData[grade];
                                            return (
                                                <tr key={grade} className="border-b hover:bg-teal-50/30 transition-colors">
                                                    <td className="px-6 py-3 font-semibold text-gray-950"><input disabled={!isEdit} value={eData.nombre} onChange={e => { const n = { ...exterioresData }; n[grade].nombre = e.target.value; setExterioresData(n); }} className="w-full bg-transparent border-0 focus:ring-2 focus:ring-teal-200 rounded px-2 py-1" /></td>
                                                    <td className="px-6 py-3">
                                                        <input disabled={!isEdit} type="number" step="0.01" value={eData.areaRiego} onChange={e => {
                                                            const n = { ...exterioresData };
                                                            const v = +e.target.value;
                                                            n[grade].areaRiego = v;
                                                            if (grade === 'primaria' || grade === 'secundaria') {
                                                                n[grade].salidasRiego = Math.ceil(v / 100) + 1;
                                                                n[grade].uhTotal = n[grade].salidasRiego * n[grade].uh;
                                                            }
                                                            setExterioresData(n);
                                                        }} className="w-full text-center border-gray-300 rounded px-3 py-2 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 shadow-sm" />
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        <input disabled={!isEdit || (grade === 'primaria' || grade === 'secundaria')} type="number" value={eData.salidasRiego} onChange={e => {
                                                            const n = { ...exterioresData };
                                                            n[grade].salidasRiego = +e.target.value;
                                                            n[grade].uhTotal = n[grade].salidasRiego * n[grade].uh;
                                                            setExterioresData(n);
                                                        }} className={`w-full text-center border-gray-300 rounded px-3 py-2 shadow-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 ${(grade === 'primaria' || grade === 'secundaria') ? 'bg-gray-100 text-gray-950 cursor-not-allowed font-bold' : ''}`} />
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        <input disabled={!isEdit} type="number" step="0.01" value={eData.caudalPorSalida} onChange={e => { const n = { ...exterioresData }; n[grade].caudalPorSalida = +e.target.value; setExterioresData(n); }} className="w-full text-center border-gray-300 rounded px-3 py-2 focus:border-teal-500 shadow-sm focus:ring-1 focus:ring-teal-500" />
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        <input disabled={!isEdit} type="number" step="0.01" value={eData.uh} onChange={e => {
                                                            const n = { ...exterioresData };
                                                            const v = +e.target.value;
                                                            n[grade].uh = v;
                                                            n[grade].caudalPorSalida = buscarCaudalPorUH(v);
                                                            n[grade].uhTotal = n[grade].salidasRiego * v;
                                                            setExterioresData(n);
                                                        }} className="w-full text-center border-gray-300 rounded px-3 py-2 shadow-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500" />
                                                    </td>
                                                    <td className="px-6 py-3 text-center text-lg font-extrabold text-teal-700 bg-teal-50/50">{eData.uhTotal?.toFixed(2)}</td>
                                                </tr>
                                            )
                                        })}
                                        {selectedGradesList.length === 0 && <tr><td colSpan="6" className="text-center py-6 text-gray-950">Seleccione al menos un grado</td></tr>}
                                    </tbody>
                                    <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                                        <tr>
                                            <td colSpan="5" className="px-6 py-4 text-right font-bold text-gray-950 uppercase tracking-wider text-sm">TOTAL U.H. EXTERIORES</td>
                                            <td className="px-6 py-4 text-center text-2xl font-extrabold text-teal-800 bg-teal-100 border-l border-teal-200">{totalsComputed.exterioresUDTotal.toFixed(2)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        {/* Resultados Finales */}
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-3xl shadow-2xl border-2 border-green-200 p-8 md:p-12 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-green-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
                            <div className="absolute top-0 -left-4 w-72 h-72 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>

                            <h2 className="text-2xl font-extrabold text-center text-gray-950 mb-12 flex items-center justify-center relative z-10">
                                <svg className="w-5 h-5 text-green-600 mr-4 drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                Resumen General de Resultados
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 relative z-10">
                                {selectedGradesList.map(grade => (
                                    <div key={grade} className="bg-white/80 backdrop-blur-md rounded-3xl shadow-xl p-8 border-b-4 border-green-500 hover:transform hover:-translate-y-2 transition-all duration-300">
                                        <div className="text-center">
                                            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl rotate-3 flex items-center justify-center mx-auto mb-6 shadow-lg">
                                                <svg className="w-5 h-5 text-white -rotate-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                                            </div>
                                            <h4 className="text-xl font-black text-gray-950 mb-3 tracking-wide">{gradeOptions[grade].name}</h4>
                                            <div className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-600 mb-2">{totalsComputed.gradeTotals[grade].toFixed(2)} UD</div>
                                            <p className="text-sm font-semibold text-green-700 uppercase tracking-widest bg-green-100 py-1 px-3 rounded-full inline-block">Total Interior</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-white rounded-3xl shadow-2xl p-8 lg:p-12 border-4 border-white/50 relative z-10">
                                <h3 className="text-2xl lg:text-3xl font-black text-center text-gray-950 mb-10 tracking-tight">Cálculo de Demanda Simultánea Final (Q MDS)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="bg-gray-50 rounded-3xl p-6 shadow-inner border border-gray-200">
                                        <div className="text-center text-sm text-gray-950 font-bold uppercase tracking-widest mb-6 px-4 py-2 bg-white rounded-full inline-block shadow-sm">Sistema Interior</div>
                                        <div className="flex flex-col items-center space-y-4">
                                            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl px-6 py-6 text-white w-full text-center shadow-lg transform transition-transform hover:scale-105">
                                                <div className="text-xs font-bold mb-2 text-green-100 uppercase tracking-wider">Suma U.D. Interior</div>
                                                <div className="text-4xl font-black tracking-tight">{totalsComputed.overallUDTotal.toFixed(2)}</div>
                                            </div>
                                            <svg className="w-8 h-8 text-gray-950 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>
                                            <div className="bg-gradient-to-br from-orange-400 to-orange-500 rounded-2xl px-6 py-6 text-white w-full text-center shadow-lg shadow-orange-500/30 transform transition-transform hover:scale-105">
                                                <div className="text-xs font-bold mb-2 text-orange-100 uppercase tracking-wider">Q MDS Interior</div>
                                                <div className="text-4xl font-black tracking-tight">{totalsComputed.qmdsInterior.toFixed(2)} <span className="text-xl font-bold opacity-80">L/s</span></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 rounded-3xl p-6 shadow-inner border border-gray-200">
                                        <div className="text-center text-sm text-gray-950 font-bold uppercase tracking-widest mb-6 px-4 py-2 bg-white rounded-full inline-block shadow-sm">Sistema Riego</div>
                                        <div className="flex flex-col items-center space-y-4">
                                            <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl px-6 py-6 text-white w-full text-center shadow-lg transform transition-transform hover:scale-105">
                                                <div className="text-xs font-bold mb-2 text-teal-100 uppercase tracking-wider">Suma U.D. Exterior</div>
                                                <div className="text-4xl font-black tracking-tight">{totalsComputed.exterioresUDTotal.toFixed(2)}</div>
                                            </div>
                                            <svg className="w-8 h-8 text-gray-950 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>
                                            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl px-6 py-6 text-white w-full text-center shadow-lg shadow-blue-500/30 transform transition-transform hover:scale-105">
                                                <div className="text-xs font-bold mb-2 text-blue-100 uppercase tracking-wider">Q MDS Riego</div>
                                                <div className="text-4xl font-black tracking-tight">{totalsComputed.qmdsRiego.toFixed(2)} <span className="text-xl font-bold opacity-80">L/s</span></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-3xl px-8 py-10 text-white flex flex-col justify-center items-center shadow-2xl relative overflow-hidden group">
                                        <div className="absolute inset-0 bg-white/10 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                                        <div className="w-16 h-1 bg-purple-500 rounded-full mb-6"></div>
                                        <div className="text-sm font-bold text-purple-200 uppercase tracking-widest mb-4">Gran Total</div>
                                        <div className="text-6xl font-black tracking-tighter mb-4 drop-shadow-xl flex items-baseline">
                                            {totalsComputed.qmdsTotal.toFixed(2)} <span className="text-2xl ml-2 font-bold text-purple-300">L/s</span>
                                        </div>
                                        <div className="mt-4 px-6 py-2 bg-black/30 backdrop-blur-sm rounded-full text-xs font-semibold text-purple-200 border border-white/10 flex items-center">
                                            <span className="w-2 h-2 rounded-full bg-green-400 mr-2 animate-pulse"></span>
                                            Interior + Riego Integrados
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}


