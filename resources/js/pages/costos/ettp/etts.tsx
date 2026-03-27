import React, { useEffect, useRef, useState } from 'react';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import Swal from 'sweetalert2';
import toastr from 'toastr';
import 'toastr/build/toastr.min.css';

declare const Tabulator: any;

interface Props {
    especificacionesId?: number;
    initialData?: any;
    proyecto?: any;
}

const DEFAULT_DATA = [
    {
        "id": 1,
        "item": "05",
        "descripcion": "INSTALACIONES ELECTRICAS",
        "unidad": "",
        "_children": [
            {
                "id": 2,
                "item": "05.01",
                "descripcion": "CONEXION A LA RED EXTERNA DE SUMINISTRO DE ENERGIA ELECTRICA",
                "unidad": "",
                "_children": [
                    {
                        "id": 3,
                        "item": "05.01.01",
                        "descripcion": "ACOMETIDA MONO.FÁSICA DE ENERGÍA ELÉCTRICA DE RED SECUNDARIA CON MEDIDOR.",
                        "unidad": "GLB",
                    },
                    {
                        "id": 4,
                        "item": "05.01.02",
                        "descripcion": "Acondicionamiento de tubo de FG, tubo PVC y baston para acometida.",
                        "unidad": "GLB",
                    }
                ]
            }
        ]
    }
];

const EttpIndex = ({ especificacionesId, initialData, proyecto }: Props) => {
    const tableRef = useRef<HTMLDivElement>(null);
    const tabulatorRef = useRef<any>(null);
    const [datosBase, setDatosBase] = useState(initialData || DEFAULT_DATA);
    const [descriptivosTemplates, setDescriptivosTemplates] = useState([]);
    const [selectedRow, setSelectedRow] = useState<any>(null);

    const [currentData, setCurrentData] = useState<any>(null);
    const [currentSections, setCurrentSections] = useState<any[]>([]);
    const [selectedSections, setSelectedSections] = useState({
        estructura: false,
        arquitectura: false,
        sanitarias: false,
        electricas: false,
        comunicaciones: false,
        gas: false,
    });
    const [showWordModal, setShowWordModal] = useState(false);
    const [showMetradosPanel, setShowMetradosPanel] = useState(false);
    const [generatingWord, setGeneratingWord] = useState(false);
    const [showDetailsPanel, setShowDetailsPanel] = useState(false);
    const [activeTab, setActiveTab] = useState(0);

    const showNotification = (type: 'success' | 'error' | 'warning', message: string) => {
        if (toastr) {
            toastr[type](message);
        } else {
            Swal.fire({
                title: type === 'error' ? 'Error' : type === 'warning' ? 'Advertencia' : 'Éxito',
                text: message,
                icon: type,
            });
        }
    };

    const buscarTemplateRecursivo = (templates: any[], codigoABuscar: string): any => {
        if (!templates?.length) return null;

        const codigoNormalizado = codigoABuscar.toString().trim().toLowerCase();

        const buscarEnNivel = (items: any[]): any => {
            for (const item of items) {
                if (item.codigo_completo?.toLowerCase() === codigoNormalizado) return item;
                if (item.codigo?.toLowerCase() === codigoNormalizado) return item;
                if (item.subpartidas?.length) {
                    const encontrado = buscarEnNivel(item.subpartidas);
                    if (encontrado) return encontrado;
                }
            }
            for (const item of items) {
                if (item.codigo_completo?.toLowerCase().includes(codigoNormalizado)) return item;
                if (item.codigo?.toLowerCase().includes(codigoNormalizado)) return item;
                if (item.subpartidas?.length) {
                    const encontrado = buscarEnNivel(item.subpartidas);
                    if (encontrado) return encontrado;
                }
            }
            return null;
        };

        return buscarEnNivel(templates);
    };

    const mostrarFormularioDetalles = (data: any) => {
        const detalles = data.detallesTecnicos || {};
        const sections = [
            { title: 'Descripción', content: detalles.descripcion || '' },
            { title: 'Método de Ejecución', content: detalles.metodo_de_ejecucion || '' },
            { title: 'Método de Medición', content: detalles.metodo_de_medicion || '' },
            { title: 'Condiciones de Pago', content: detalles.condiciones_de_pago || '' },
        ];

        Object.entries(detalles).forEach(([key, value]) => {
            if (!['descripcion', 'metodo_de_ejecucion', 'metodo_de_medicion', 'condiciones_de_pago'].includes(key)) {
                sections.push({
                    title: key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                    content: value as string || ''
                });
            }
        });

        setCurrentData(data);
        setCurrentSections(sections);
        setShowDescriptionModal(true);
    };

    const saveDescription = () => {
        if (!selectedRow) {
            showNotification('error', 'No hay una fila seleccionada');
            return;
        }

        const detallesTecnicos: any = {};
        currentSections.forEach(section => {
            const key = section.title.toLowerCase().replace(/ /g, '_');
            detallesTecnicos[key] = section.content;
        });

        const currentDataRow = selectedRow.getData();
        currentDataRow.detallesTecnicos = detallesTecnicos;
        selectedRow.update(currentDataRow);

        Swal.fire({
            title: '¡Guardado exitoso!',
            text: 'Los detalles técnicos se han actualizado correctamente',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
        });
        setShowDescriptionModal(false);
    };

    const showDescription = (row: any) => {
        const data = row.getData();
        setSelectedRow(row);
        setCurrentData(data);

        // Crear las secciones desde los detalles técnicos existentes
        const detalles = data.detallesTecnicos || {};
        const sections = [
            { title: 'Descripción', content: detalles.descripcion || '' },
            { title: 'Método de Ejecución', content: detalles.metodo_de_ejecucion || '' },
            { title: 'Método de Medición', content: detalles.metodo_de_medicion || '' },
            { title: 'Condiciones de Pago', content: detalles.condiciones_de_pago || '' },
        ];

        // Agregar secciones adicionales que puedan existir
        Object.entries(detalles).forEach(([key, value]) => {
            if (!['descripcion', 'metodo_de_ejecucion', 'metodo_de_medicion', 'condiciones_de_pago'].includes(key)) {
                sections.push({
                    title: key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                    content: value as string || ''
                });
            }
        });

        setCurrentSections(sections);
        setActiveTab(0);
        setShowDetailsPanel(true);

        // Si hay plantilla y no tiene detalles, se puede autocompletar
        if (descriptivosTemplates.length && !data.detallesTecnicos) {
            const template = buscarTemplateRecursivo(descriptivosTemplates, data.item);
            if (template) {
                // Opcional: autocompletar con los datos de la plantilla
                const nuevosDetalles = {
                    descripcion: template.descripcion || '',
                    metodo_de_ejecucion: template.metodo_de_ejecucion || '',
                    metodo_de_medicion: template.metodo_de_medicion || '',
                    condiciones_de_pago: template.condiciones_de_pago || '',
                };
                // Puedes mostrar una notificación preguntando si quiere cargar la plantilla
            }
        }
    };

    const organizeAndSortData = (data: any[]): any[] => {
        if (!data?.length) return [];

        const organized = [...data];
        organized.sort((a, b) => (a.nivel ?? 0) - (b.nivel ?? 0));

        const idMap = new Map();
        organized.forEach(item => idMap.set(item.id, item));

        organized.forEach(item => {
            if (item.parent_id && idMap.has(item.parent_id)) {
                const parent = idMap.get(item.parent_id);
                if (!parent._children) parent._children = [];
                if (!parent._children.some((c: any) => c.id === item.id)) {
                    parent._children.push(item);
                }
            }
        });

        return organized.filter(item => !item.parent_id || !idMap.has(item.parent_id));
    };

    const fetchMetradosData = async (proyectoId: string, options: any) => {
        console.log('Fetching metrados con options:', options);

        try {
            const response = await axios.post('/obtener-metrados-ettp', {
                proyecto_id: proyectoId,
                estructura: options.estructura,
                arquitectura: options.arquitectura,
                sanitarias: options.sanitarias,
                electricas: options.electricas,
                comunicacion: options.comunicacion,
                gas: options.gas
            }, {
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    'Content-Type': 'application/json'
                }
            });

            console.log('Respuesta del servidor:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error al llamar al endpoint:', error);
            return [];
        }
    };

    const handleLoadMetrados = async () => {
        console.log('handleLoadMetrados iniciado');
        console.log('tabulatorRef.current:', tabulatorRef.current);

        if (!tabulatorRef.current) {
            showNotification('warning', 'La tabla aún se está inicializando. Espere un momento...');
            return;
        }

        const proyectoId = (document.getElementById('proyecto_id') as HTMLInputElement)?.value || proyecto?.id;
        console.log('proyectoId:', proyectoId);

        if (!proyectoId) {
            showNotification('error', 'Debe seleccionar un proyecto');
            return;
        }

        const options = {
            estructura: selectedSections.estructura ? 1 : 0,
            arquitectura: selectedSections.arquitectura ? 1 : 0,
            sanitarias: selectedSections.sanitarias ? 1 : 0,
            electricas: selectedSections.electricas ? 1 : 0,
            comunicacion: selectedSections.comunicaciones ? 1 : 0,
            gas: selectedSections.gas ? 1 : 0
        };

        console.log('Opciones seleccionadas:', options);

        if (!Object.values(options).some(v => v === 1)) {
            showNotification('error', 'Seleccione al menos una categoría');
            return;
        }

        try {
            Swal.fire({
                title: 'Cargando datos...',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            const rawData = await fetchMetradosData(proyectoId, options);
            console.log('Datos recibidos del servidor:', rawData);

            if (!rawData || rawData.length === 0) {
                Swal.close();
                showNotification('warning', 'No se encontraron datos para las especialidades seleccionadas');
                return;
            }

            // Limpiar datos antes de cargar nuevos
            tabulatorRef.current.clearData();

            // Cargar nuevos datos
            tabulatorRef.current.setData(rawData);
            setDatosBase(rawData);

            Swal.close();
            showNotification('success', `Se cargaron ${rawData.length} registros correctamente`);

        } catch (error) {
            console.error('Error en handleLoadMetrados:', error);
            Swal.close();
            showNotification('error', 'Error al procesar los datos');
        }
    };

    const loadDataFromServer = async () => {
        if (!especificacionesId) return;

        try {
            const response = await axios.post('/obtener-especificaciones-tecnicas',
                { id: especificacionesId },
                { headers: { 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '' } }
            );

            if (response.data?.data) {
                const parsed = typeof response.data.data === 'string' ? JSON.parse(response.data.data) : response.data.data;
                const dataToSet = Array.isArray(parsed) ? parsed : DEFAULT_DATA;
                setDatosBase(dataToSet);
                if (tabulatorRef.current) tabulatorRef.current.setData(dataToSet);
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
    };

    const handleSaveData = async () => {
        const idProyecto = especificacionesId || proyecto?.id;

        // Agrega estos console.log para debug
        console.log('=== DEBUG GUARDAR ===');
        console.log('especificacionesId:', especificacionesId);
        console.log('proyecto:', proyecto);
        console.log('idProyecto:', idProyecto);
        console.log('datos de la tabla:', tabulatorRef.current?.getData());

        if (!idProyecto) {
            showNotification('error', 'ID de proyecto no encontrado');
            return;
        }
        if (!tabulatorRef.current) return;

        const datosGenerales = tabulatorRef.current.getData();

        try {
            const response = await axios.post(`/guardar-especificaciones-tecnicas/${idProyecto}`,
                { especificaciones_tecnicas: datosGenerales },
                { headers: { 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '' } }
            );
            console.log('Respuesta del servidor:', response.data);
            Swal.fire({ title: "Éxito", text: "Datos guardados correctamente", icon: "success", timer: 1500, showConfirmButton: false });
        } catch (error: any) {
            console.error("Error al guardar:", error);
            console.error("Respuesta del error:", error.response?.data);
            Swal.fire({ title: "Error", text: error.response?.data?.error || "No se pudieron guardar los datos", icon: "error" });
        }
    };

    const handleGenerateWord = () => {
        const hasSelection = Object.values(selectedSections).some(v => v);
        if (!hasSelection) {
            showNotification('error', 'Seleccione al menos una sección');
            return;
        }
        setShowWordModal(false);
        showNotification('success', 'Generación de Word en desarrollo');
    };

    useEffect(() => {
        if (!tableRef.current) return;

        const checkTabulator = setInterval(() => {
            const Tabulator = (window as any).Tabulator;
            if (Tabulator && tableRef.current) {
                clearInterval(checkTabulator);

                const table = new Tabulator(tableRef.current, {
                    data: datosBase,
                    dataTree: true,
                    dataTreeStartExpanded: false,
                    layout: "fitDataStretch",
                    height: "calc(100vh - 140px)",
                    virtualDom: true,
                    dataTreeChildField: "_children",
                    columns: [
                        { title: "Items", field: "item", width: 200, editor: "input" },
                        { title: "Descripción", field: "descripcion", width: 450, editor: "input" },
                        { title: "Und", field: "unidad", width: 80, editor: "input" },
                        {
                            title: "Detalles",
                            width: 80,
                            formatter: (cell: any) => {
                                return '<button class="btn-details" style="background:#3b82f6; color:white; border:none; border-radius:4px; padding:4px 8px; cursor:pointer;">📋</button>';
                            },
                            cellClick: (e: any, cell: any) => {
                                if (e.target.classList.contains('btn-details')) {
                                    showDescription(cell.getRow());
                                }
                            }
                        }
                    ],
                });

                tabulatorRef.current = table;
                console.log('Tabla inicializada');
            }
        }, 100);

        fetch('/assets/data/descriptivos-templates.json')
            .then(res => {
                if (!res.ok) throw new Error('Archivo no encontrado');
                return res.json();
            })
            .then(data => setDescriptivosTemplates(data))
            .catch(err => console.error('Error cargando templates:', err));

        return () => {
            clearInterval(checkTabulator);
            if (tabulatorRef.current) tabulatorRef.current.destroy();
        };
    }, []);

    useEffect(() => {
        if (especificacionesId) loadDataFromServer();
    }, [especificacionesId]);

    return (
        <>
            <Head title="Especificaciones Técnicas" />
            <style>{`
                .tabulator {
                    font-size: 13px;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    overflow: hidden;
                }
                .tabulator .tabulator-header {
                    background-color: #f3f4f6;
                    border-bottom: 1px solid #e5e7eb;
                }
                .tabulator .tabulator-header .tabulator-col {
                    background-color: #f3f4f6;
                    font-weight: 600;
                    color: #1f2937;
                    border-right: none;
                }
                .tabulator .tabulator-row {
                    border-bottom: 1px solid #f3f4f6;
                }
                .tabulator .tabulator-row:hover {
                    background-color: #f9fafb;
                }
                .tabulator .tabulator-cell {
                    padding: 10px 8px;
                    border-right: none;
                }
                .tabulator .tabulator-cell .btn-details {
                    background: #3b82f6;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    padding: 4px 8px;
                    cursor: pointer;
                    font-size: 12px;
                }
                .tabulator .tabulator-cell .btn-details:hover {
                    background: #2563eb;
                }
                .tabulator .tabulator-editing {
                    border: 2px solid #3b82f6 !important;
                }
            `}</style>
            <div className="min-h-screen bg-gray-50">
                {/* Header */}
                <div className="bg-gray-800 shadow-lg">
                    <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
                        <h1 className="text-white font-bold text-lg">ESPECIFICACIONES TÉCNICAS</h1>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowMetradosPanel(!showMetradosPanel)}
                                className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-md text-sm font-medium transition"
                            >
                                📊 Cargar Metrados
                            </button>
                            <button
                                onClick={handleSaveData}
                                className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-md text-sm font-medium transition"
                            >
                                💾 Guardar
                            </button>
                            <button
                                onClick={() => setShowWordModal(true)}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium transition"
                            >
                                📄 Generar Word
                            </button>
                        </div>
                    </div>
                </div>

                {/* Panel Metrados */}
                {showMetradosPanel && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 shadow-sm">
                        <div className="max-w-7xl mx-auto px-6 py-5">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-sm font-bold text-blue-800 uppercase tracking-wide">📋 ESPECIALIDADES</span>
                                <div className="flex-1 h-px bg-blue-200"></div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                {/* Estructura */}
                                <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={selectedSections.estructura}
                                        onChange={(e) => setSelectedSections({ ...selectedSections, estructura: e.target.checked })}
                                        className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-gray-800 group-hover:text-blue-600">🏗️ Estructuras</span>
                                        <span className="text-xs text-gray-500">Metrados de concreto y acero</span>
                                    </div>
                                </label>

                                {/* Arquitectura */}
                                <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={selectedSections.arquitectura}
                                        onChange={(e) => setSelectedSections({ ...selectedSections, arquitectura: e.target.checked })}
                                        className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-gray-800 group-hover:text-blue-600">🏛️ Arquitectura</span>
                                        <span className="text-xs text-gray-500">Acabados y elementos arquitectónicos</span>
                                    </div>
                                </label>

                                {/* Sanitarias */}
                                <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={selectedSections.sanitarias}
                                        onChange={(e) => setSelectedSections({ ...selectedSections, sanitarias: e.target.checked })}
                                        className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-gray-800 group-hover:text-blue-600">🚰 Inst. Sanitarias</span>
                                        <span className="text-xs text-gray-500">Agua y desagüe</span>
                                    </div>
                                </label>

                                {/* Eléctricas */}
                                <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={selectedSections.electricas}
                                        onChange={(e) => setSelectedSections({ ...selectedSections, electricas: e.target.checked })}
                                        className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-gray-800 group-hover:text-blue-600">⚡ Inst. Eléctricas</span>
                                        <span className="text-xs text-gray-500">Iluminación y fuerza</span>
                                    </div>
                                </label>

                                {/* Comunicaciones */}
                                <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={selectedSections.comunicaciones}
                                        onChange={(e) => setSelectedSections({ ...selectedSections, comunicaciones: e.target.checked })}
                                        className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-gray-800 group-hover:text-blue-600">📡 Comunicaciones</span>
                                        <span className="text-xs text-gray-500">Datos y telefonía</span>
                                    </div>
                                </label>

                                {/* Gas */}
                                <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={selectedSections.gas}
                                        onChange={(e) => setSelectedSections({ ...selectedSections, gas: e.target.checked })}
                                        className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-gray-800 group-hover:text-blue-600">🔥 Inst. de Gas</span>
                                        <span className="text-xs text-gray-500">Redes de gas natural</span>
                                    </div>
                                </label>
                            </div>

                            {/* Botón de carga */}
                            <div className="flex justify-end mt-5 pt-3 border-t border-blue-200">
                                <button
                                    onClick={handleLoadMetrados}
                                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wide shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                                >
                                    <span>📥</span>
                                    Cargar Datos Seleccionados
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Layout de dos columnas */}
                <div className="flex flex-1 px-4 py-6 gap-4">
                    {/* Columna de la tabla */}
                    <div className={`transition-all duration-300 ${showDetailsPanel ? 'w-2/3' : 'w-full'}`}>
                        <div
                            ref={tableRef}
                            className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200"
                            style={{ height: 'calc(100vh - 180px)' }}
                        />
                    </div>

                    {/* Panel Lateral de Detalles */}
                    {showDetailsPanel && currentData && (
                        <div className="w-1/3 bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col overflow-hidden">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <p className="text-xs uppercase tracking-wide opacity-80">Detalles Técnicos</p>
                                        <h3 className="text-sm font-bold mt-1 truncate">{currentData.item} - {currentData.descripcion}</h3>
                                    </div>
                                    <button
                                        onClick={() => setShowDetailsPanel(false)}
                                        className="text-white hover:text-gray-200 text-2xl leading-none ml-2"
                                    >
                                        &times;
                                    </button>
                                </div>
                            </div>

                            {/* Contenido en columna (scroll) */}
                            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                                {currentSections.map((section, idx) => (
                                    <div key={idx} className="bg-white rounded-lg border border-gray-200 mb-4 overflow-hidden shadow-sm">
                                        <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                                            <h4 className="font-bold text-blue-600 text-sm uppercase tracking-wide">{section.title}</h4>
                                            <button
                                                onClick={() => {
                                                    if (currentSections.length > 1) {
                                                        const newSections = [...currentSections];
                                                        newSections.splice(idx, 1);
                                                        setCurrentSections(newSections);
                                                    } else {
                                                        showNotification('warning', 'Debe mantener al menos una sección');
                                                    }
                                                }}
                                                className="text-red-500 hover:text-red-700 text-xs font-medium"
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                        <textarea
                                            value={section.content}
                                            onChange={(e) => {
                                                const newSections = [...currentSections];
                                                newSections[idx].content = e.target.value;
                                                setCurrentSections(newSections);
                                            }}
                                            className="w-full border-0 p-4 text-sm focus:outline-none focus:ring-0 resize-y"
                                            rows={6}
                                            placeholder={`Ingrese ${section.title.toLowerCase()}...`}
                                        />
                                    </div>
                                ))}

                                {/* Agregar nueva sección */}
                                <div className="mt-4 flex gap-2">
                                    <input
                                        type="text"
                                        id="newSectionPanel"
                                        placeholder="Nombre de nueva sección (ej: Materiales, Herramientas, etc.)"
                                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                                setCurrentSections([...currentSections, { title: e.currentTarget.value.trim(), content: '' }]);
                                                e.currentTarget.value = '';
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={() => {
                                            const input = document.getElementById('newSectionPanel') as HTMLInputElement;
                                            if (input?.value.trim()) {
                                                setCurrentSections([...currentSections, { title: input.value.trim(), content: '' }]);
                                                input.value = '';
                                            }
                                        }}
                                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                                    >
                                        Agregar
                                    </button>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="border-t p-3 bg-white flex justify-end gap-2">
                                <button onClick={() => setShowDetailsPanel(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">
                                    Cancelar
                                </button>
                                <button onClick={saveDescription} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium">
                                    Guardar Cambios
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal Word */}
                {showWordModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowWordModal(false)}>
                        <div className="bg-white rounded-lg w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
                            <div className="bg-gray-100 px-6 py-4 rounded-t-lg border-b">
                                <h2 className="text-lg font-bold text-gray-800">Generar Documento Word</h2>
                            </div>
                            <div className="p-6">
                                <p className="text-sm text-gray-600 mb-4">Seleccione las secciones a incluir:</p>
                                <div className="space-y-2">
                                    {Object.entries(selectedSections).map(([key, value]) => (
                                        <label key={key} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={value}
                                                onChange={(e) => setSelectedSections({ ...selectedSections, [key]: e.target.checked })}
                                                className="w-4 h-4 text-blue-600 rounded"
                                            />
                                            <span className="text-sm text-gray-700 capitalize">{key}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-gray-100 px-6 py-4 rounded-b-lg flex justify-end gap-3">
                                <button onClick={() => setShowWordModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
                                <button onClick={handleGenerateWord} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">Generar</button>
                            </div>
                        </div>
                    </div>
                )}


            </div>
        </>
    );
};

export default EttpIndex;