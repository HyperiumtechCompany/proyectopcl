import React, { useState } from 'react';
import {
    Document, Paragraph, TextRun, ImageRun, Header, Footer, Table, TableRow, TableCell,
    AlignmentType, HeadingLevel, BorderStyle, WidthType, VerticalAlign, UnderlineType,
    LineRuleType, PageNumber, SectionType, Packer
} from 'docx';
import { saveAs } from 'file-saver';

interface WordExportProps {
    isOpen: boolean;
    onClose: () => void;
    getData: () => any[];
    proyecto?: any;
    onGenerateStart?: () => void;
    onGenerateEnd?: () => void;
    showNotification?: (type: 'success' | 'error' | 'warning', message: string) => void;
}

// Función auxiliar para crear párrafos de detalle
const crearParrafoDetalle = (titulo: string, descripcion: string) =>
    new Paragraph({
        children: [
            new TextRun({ text: `${titulo} `, bold: true, font: "Arial", color: "#000000", size: 24 }),
            new TextRun({ text: descripcion, font: "Arial", color: "#000000", size: 24 }),
        ],
        spacing: { after: 100, line: 750, lineRule: LineRuleType.AUTO },
    });

// Configuración de sin bordes
const sinBordes = () => ({
    top: { style: BorderStyle.NONE, size: 0, color: "000000" },
    bottom: { style: BorderStyle.NONE, size: 0, color: "000000" },
    left: { style: BorderStyle.NONE, size: 0, color: "000000" },
    right: { style: BorderStyle.NONE, size: 0, color: "000000" },
});

// Procesa contenido HTML a elementos docx
const procesarContenido = (contenido: string): Paragraph[] => {
    if (!contenido || typeof contenido !== 'string') return [];

    const paragraphs: Paragraph[] = [];

    // Eliminar etiquetas HTML y obtener texto plano
    const plainText = contenido.replace(/<[^>]*>/g, '');
    const lines = plainText.split('\n').filter(line => line.trim());

    lines.forEach(line => {
        if (line.trim()) {
            paragraphs.push(new Paragraph({
                children: [new TextRun({
                    text: line.trim(),
                    font: "Arial Narrow",
                    size: 24,
                    color: "#000000"
                })],
                spacing: { after: 200, line: 480 },
                indent: { left: 720, firstLine: 0 },
            }));
        }
    });

    return paragraphs;
};

// Agregar secciones al documento
const addSectionsToWord = (sections: any[], docSections: any[]) => {
    if (!sections || !Array.isArray(sections) || sections.length === 0) return;

    sections.forEach(section => {
        if (!section) return;

        const titulo = (section.titulo || section.title || 'DETALLE').toUpperCase();
        const contenido = section.contenido || section.content || '';

        docSections.push(new Paragraph({
            children: [new TextRun({
                text: `${titulo}:`,
                bold: true,
                font: "Arial Narrow",
                size: 24,
                color: "#000000"
            })],
            spacing: { after: 200, line: 480 },
            indent: { left: 720, firstLine: 0 },
        }));

        const procesado = procesarContenido(contenido);
        if (procesado.length > 0) {
            docSections.push(...procesado);
        } else if (contenido && contenido.trim()) {
            // Fallback texto plano
            docSections.push(new Paragraph({
                children: [new TextRun({
                    text: contenido,
                    font: "Arial Narrow",
                    size: 24,
                    color: "#000000"
                })],
                spacing: { after: 200, line: 480 },
                indent: { left: 720, firstLine: 0 },
            }));
        }
    });
};

// Procesar items jerárquicos
const processHierarchicalItemsToWord = (items: any[], sections: any[], level: number) => {
    if (!items || !Array.isArray(items) || items.length === 0) return;

    items.forEach(item => {
        if (!item) return;

        let headingLevel;
        switch (level) {
            case 1: headingLevel = HeadingLevel.HEADING_1; break;
            case 2: headingLevel = HeadingLevel.HEADING_2; break;
            default: headingLevel = HeadingLevel.HEADING_3; break;
        }

        // Título del item
        const titulo = `${item.item || ''} ${item.descripcion || ''}`.trim();
        if (titulo) {
            sections.push(new Paragraph({
                children: [new TextRun({
                    text: titulo,
                    bold: true,
                    font: "Arial Narrow",
                    color: "#000000",
                    size: 24,
                })],
                heading: headingLevel,
                spacing: { before: 300, after: 100, line: 480 },
            }));
        }

        // Unidad de medida
        if (item.unidad && item.unidad.trim()) {
            sections.push(new Paragraph({
                children: [new TextRun({
                    text: `(Unidad de medida: ${item.unidad})`,
                    font: "Arial Narrow",
                    size: 22,
                    color: "#000000"
                })],
                spacing: { after: 100, line: 480 },
                indent: { left: 360, firstLine: 0 },
            }));
        }

        // Metrado
        if (item.metrado) {
            sections.push(new Paragraph({
                children: [new TextRun({
                    text: `Metrado: ${item.metrado}`,
                    font: "Arial Narrow",
                    size: 24,
                    color: "#000000"
                })],
                spacing: { after: 200, line: 480 },
                indent: { left: 720, firstLine: 0 },
            }));
        }

        // Secciones (descripción técnica)
        if (item.secciones && Array.isArray(item.secciones) && item.secciones.length > 0) {
            addSectionsToWord(item.secciones, sections);
        }

        // Procesar hijos recursivamente
        if (item._children && Array.isArray(item._children) && item._children.length > 0) {
            processHierarchicalItemsToWord(item._children, sections, level + 1);
        }
    });
};

// Generar secciones del documento
const generateSectionsForWord = (data: any[], sectionName: string): any[] => {
    if (!data || !Array.isArray(data) || data.length === 0) {
        return [new Paragraph({
            text: "No se encontraron datos para esta sección.",
            children: [new TextRun({ text: "No se encontraron datos para esta sección." })]
        })];
    }

    const sections: any[] = [];

    sections.push(new Paragraph({
        text: sectionName.toUpperCase(),
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 200 },
    }));

    processHierarchicalItemsToWord(data, sections, 1);
    return sections;
};

// Filtrar datos por sección
const filterTreeData = (data: any[], sectionName: string): any[] => {
    if (!data || !Array.isArray(data)) return [];

    const sectionKeywords: Record<string, string[]> = {
        'ESTRUCTURAS': ['estructura', 'concreto', 'acero', 'cimentación', 'columna', 'viga'],
        'ARQUITECTURA': ['arquitectura', 'acabado', 'piso', 'cielorraso', 'tabique', 'revoque'],
        'INSTALACIONES SANITARIAS': ['sanitaria', 'agua', 'desagüe', 'tubería', 'cisterna', 'tanque'],
        'INSTALACIONES ELECTRICAS': ['eléctrica', 'eléctrico', 'electricas', 'alumbrado', 'tomacorriente', 'tablero'],
        'INSTALACIONES DE COMUNICACIONES': ['comunicacion', 'comunicaciones', 'datos', 'teléfono', 'red'],
        'INSTALACIONES DE GAS': ['gas', 'gasfitería', 'tubería de gas']
    };

    const keywords = sectionKeywords[sectionName] || [];

    const filterItems = (items: any[]): any[] => {
        if (!items || !Array.isArray(items)) return [];

        return items.reduce((acc: any[], item: any) => {
            if (!item) return acc;

            const descripcion = (item.descripcion || '').toLowerCase();
            const itemCode = (item.item || '').toLowerCase();

            const matches = keywords.some(keyword =>
                descripcion.includes(keyword.toLowerCase()) ||
                itemCode.includes(keyword.toLowerCase())
            );

            if (matches) {
                acc.push({ ...item });
            } else if (item._children && Array.isArray(item._children) && item._children.length > 0) {
                const filteredChildren = filterItems(item._children);
                if (filteredChildren.length > 0) {
                    acc.push({
                        ...item,
                        _children: filteredChildren
                    });
                }
            }
            return acc;
        }, []);
    };

    return filterItems(data);
};

// Cargar imagen desde URL
const loadImageFromUrl = async (url: string | null): Promise<string | null> => {
    if (!url) return null;
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Error loading image:", error);
        return null;
    }
};

// Leer archivo como DataURL
const readFileAsDataURL = (file: File): Promise<string | null> =>
    new Promise((resolve) => {
        if (!file) {
            resolve(null);
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
    });

// Generar documento Word para una sección
const generarWordParaSeccion = async (
    datosFiltrados: any[],
    nombreArchivoBase: string,
    showNotification?: (type: 'success' | 'error' | 'warning', message: string) => void,
    proyecto?: any
) => {
    // Obtener referencias a los inputs de archivo
    const logoFile = (document.getElementById('logoFile') as HTMLInputElement)?.files?.[0];
    const escudoFile = (document.getElementById('escudoFile') as HTMLInputElement)?.files?.[0];
    const principalFile = (document.getElementById('logoPrinFile') as HTMLInputElement)?.files?.[0];
    const firmaFile = (document.getElementById('firmaFile') as HTMLInputElement)?.files?.[0];

    let logoDataUrl = null;
    let escudoDataUrl = null;
    let principalDataUrl = null;
    let firmaDataUrl = null;

    try {
        // Prioridad: archivo manual > imagen del proyecto
        if (logoFile) logoDataUrl = await readFileAsDataURL(logoFile);
        else if (proyecto?.plantilla_logo_izq_url) logoDataUrl = await loadImageFromUrl(proyecto.plantilla_logo_izq_url);

        if (escudoFile) escudoDataUrl = await readFileAsDataURL(escudoFile);
        else if (proyecto?.plantilla_logo_der_url) escudoDataUrl = await loadImageFromUrl(proyecto.plantilla_logo_der_url);

        if (principalFile) principalDataUrl = await readFileAsDataURL(principalFile);
        else if (proyecto?.portada_logo_center_url) principalDataUrl = await loadImageFromUrl(proyecto.portada_logo_center_url);

        if (firmaFile) firmaDataUrl = await readFileAsDataURL(firmaFile);
        else if (proyecto?.plantilla_firma_url) firmaDataUrl = await loadImageFromUrl(proyecto.plantilla_firma_url);
    } catch (error) {
        console.error("Error al procesar las imágenes:", error);
    }

    // Crear ImageRuns solo si hay datos
    const logoImageRun = logoDataUrl ? new ImageRun({
        data: logoDataUrl,
        transformation: { width: 70, height: 70 },
    }) : null;

    const escudoImageRun = escudoDataUrl ? new ImageRun({
        data: escudoDataUrl,
        transformation: { width: 70, height: 70 },
    }) : null;

    const principalImageRun = principalDataUrl ? new ImageRun({
        data: principalDataUrl,
        transformation: { width: 300, height: 400 },
    }) : null;

    const firmaImageRun = firmaDataUrl ? new ImageRun({
        data: firmaDataUrl,
        transformation: { width: 70, height: 70 },
    }) : null;

    // Header
    const header = new Header({
        children: [
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: sinBordes(),
                rows: [
                    new TableRow({
                        children: [
                            new TableCell({
                                width: { size: 15, type: WidthType.PERCENTAGE },
                                borders: sinBordes(),
                                children: logoImageRun ? [new Paragraph({
                                    alignment: AlignmentType.LEFT,
                                    children: [logoImageRun]
                                })] : [new Paragraph({ text: "" })],
                            }),
                            new TableCell({
                                width: { size: 70, type: WidthType.PERCENTAGE },
                                borders: sinBordes(),
                                children: [
                                    new Paragraph({
                                        alignment: AlignmentType.CENTER,
                                        children: [new TextRun({
                                            text: "MEJORAMIENTO DE LOS SERVICIOS DE EDUCACION INICIAL DE LA IEI N° 358 CIUDAD DE CONTAMANA DEL DISTRITO DE CONTAMANA- PROVINCIA DE UCAYALI – DEPARTAMENTO DE LORETO",
                                            bold: true,
                                            size: 16,
                                            color: "#000000",
                                            font: "Arial"
                                        })]
                                    }),
                                    new Paragraph({
                                        alignment: AlignmentType.CENTER,
                                        children: [new TextRun({
                                            text: "CUI: 2484411; CÓDIGO MODULAR: 0651216; CÓDIGO LOCAL: 390867",
                                            bold: true,
                                            size: 16,
                                            color: "#000000",
                                            font: "Arial"
                                        })]
                                    }),
                                    new Paragraph({
                                        alignment: AlignmentType.CENTER,
                                        children: [new TextRun({
                                            text: "I.E.I:358; UNIDAD EJECUTORA: MUNICIPALIDAD PROVINCIAL DE UCAYALI",
                                            bold: true,
                                            size: 16,
                                            color: "#000000",
                                            font: "Arial"
                                        })]
                                    }),
                                ],
                            }),
                            new TableCell({
                                width: { size: 15, type: WidthType.PERCENTAGE },
                                borders: sinBordes(),
                                children: escudoImageRun ? [new Paragraph({
                                    alignment: AlignmentType.RIGHT,
                                    children: [escudoImageRun]
                                })] : [new Paragraph({ text: "" })],
                            }),
                        ],
                    }),
                ],
            }),
            new Paragraph({
                border: {
                    bottom: { color: "#000000", space: 1, style: BorderStyle.SINGLE, size: 1 }
                },
                children: [new TextRun({ text: "" })]
            }),
        ],
    });

    // Footer
    const footer = new Footer({
        children: [
            firmaImageRun ? new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [firmaImageRun]
            }) : new Paragraph({ text: "" }),
            new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                    new TextRun({ text: "Página ", bold: true, color: "#000000", font: "Arial", size: 20 }),
                    new TextRun({ children: [PageNumber.CURRENT], bold: true, color: "#000000", font: "Arial", size: 20 }),
                    new TextRun({ text: " | ", bold: true, color: "#000000", font: "Arial", size: 20 }),
                    new TextRun({ children: [PageNumber.TOTAL_PAGES], bold: true, color: "#000000", font: "Arial", size: 20 }),
                ],
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({
                    text: "MUNICIPALIDAD PROVINCIAL DE UCAYALI",
                    bold: true,
                    color: "#000000",
                    font: "Arial",
                    size: 20
                })]
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({
                    text: "CENTRO POBLADO DE CONTAMANA",
                    color: "#000000",
                    font: "Arial",
                    size: 18
                })]
            }),
        ],
    });

    // Página de portada
    const coverPage = [
        new Paragraph({
            children: [new TextRun({
                text: `ESPECIFICACIONES TECNICAS-${nombreArchivoBase.toUpperCase()}`,
                bold: true,
                size: 44,
                font: "Arial",
                color: "#000000",
                underline: { type: UnderlineType.SINGLE }
            })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
        }),
        new Paragraph({
            text: "",
            border: { bottom: { color: "#000000", space: 1, style: BorderStyle.SINGLE, size: 1 } },
            spacing: { after: 400 }
        }),
        new Paragraph({
            children: [
                new TextRun({ text: "PROYECTO:", bold: true, font: "Arial", size: 28, color: "#000000" }),
                new TextRun({ text: "\t", font: "Arial", size: 28 }),
                new TextRun({
                    text: "MEJORAMIENTO DE LOS SERVICIOS DE EDUCACION INICIAL DE LA IEI N°558 CIUDAD DE CONTAMANA DEL DISTRITO DE CONTAMANA-PROVINCIA DE UCAYALI - DEPARTAMENTO DE LORETO",
                    font: "Arial",
                    size: 28,
                    color: "#000000"
                }),
            ],
            spacing: { after: 400, line: 360 },
            alignment: AlignmentType.JUSTIFIED,
        }),
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: sinBordes(),
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            width: { size: 60, type: WidthType.PERCENTAGE },
                            verticalAlign: VerticalAlign.CENTER,
                            children: [
                                crearParrafoDetalle("CÓDIGO UNIFICADO:", "2484411"),
                                crearParrafoDetalle("CÓDIGO MODULAR:", "0561216"),
                                crearParrafoDetalle("I.E.I. N°:", "558"),
                                crearParrafoDetalle("CÓDIGO LOCAL:", "390867"),
                                crearParrafoDetalle("DEPARTAMENTO:", "LORETO"),
                                crearParrafoDetalle("PROVINCIA:", "UCAYALI"),
                                crearParrafoDetalle("DISTRITO:", "CONTAMANA"),
                                crearParrafoDetalle("C.P.:", "CONTAMANA"),
                            ],
                            borders: sinBordes(),
                        }),
                        new TableCell({
                            width: { size: 40, type: WidthType.PERCENTAGE },
                            verticalAlign: VerticalAlign.CENTER,
                            children: principalImageRun ? [new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [principalImageRun]
                            })] : [new Paragraph({ text: "" })],
                            borders: sinBordes(),
                        }),
                    ],
                }),
            ],
        }),
    ];

    // Tabla de contenido
    const tableOfContents = [
        new Paragraph({
            children: [new TextRun({
                text: "TABLA DE CONTENIDO",
                bold: true,
                font: "Arial",
                size: 24,
                color: "#000000"
            })],
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
        }),
    ];

    const contentSections = generateSectionsForWord(datosFiltrados, nombreArchivoBase);

    const documentSections = [
        {
            properties: { type: SectionType.NEW_PAGE },
            headers: { default: header },
            footers: { default: footer },
            children: coverPage
        },
        {
            properties: { type: SectionType.NEW_PAGE },
            headers: { default: header },
            footers: { default: footer },
            children: tableOfContents
        },
        {
            properties: { type: SectionType.CONTINUOUS },
            headers: { default: header },
            footers: { default: footer },
            children: contentSections
        },
    ];

    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: { font: "Arial", color: "#000000", size: 24 }
                },
                paragraph: { spacing: { line: 276 } }
            },
            paragraphStyles: [
                {
                    id: "Heading1",
                    name: "Heading 1",
                    run: { font: "Arial", size: 36, bold: true, color: "#000000" },
                    paragraph: { spacing: { before: 240, after: 120 } }
                },
                {
                    id: "Heading2",
                    name: "Heading 2",
                    run: { font: "Arial", size: 30, bold: true, color: "#000000" },
                    paragraph: { spacing: { before: 240, after: 120 } }
                },
                {
                    id: "Heading3",
                    name: "Heading 3",
                    run: { font: "Arial", size: 26, bold: true, color: "#000000" },
                    paragraph: { spacing: { before: 240, after: 120 } }
                },
            ],
        },
        sections: documentSections,
    });

    try {
        const blob = await Packer.toBlob(doc);
        const safeName = nombreArchivoBase.replace(/[^a-z0-9]/gi, '_');
        saveAs(blob, `especificaciones_tecnicas_${safeName}.docx`);
        showNotification?.('success', `Documento para ${nombreArchivoBase} generado con éxito`);
    } catch (error) {
        console.error("Error al generar el documento:", error);
        showNotification?.('error', "Error al generar el documento Word");
        throw error;
    }
};

// Componente Modal
const WordExportModal: React.FC<WordExportProps> = ({
    isOpen,
    onClose,
    getData,
    proyecto,
    onGenerateStart,
    onGenerateEnd,
    showNotification
}) => {
    const [generatingWord, setGeneratingWord] = useState(false);
    const [selectedSections, setSelectedSections] = useState({
        estructura: false,
        arquitectura: false,
        sanitarias: false,
        electricas: false,
        comunicaciones: false,
        gas: false,
    });

    const sectionLabels: Record<string, string> = {
        estructura: 'ESTRUCTURAS',
        arquitectura: 'ARQUITECTURA',
        sanitarias: 'INSTALACIONES SANITARIAS',
        electricas: 'INSTALACIONES ELECTRICAS',
        comunicaciones: 'INSTALACIONES DE COMUNICACIONES',
        gas: 'INSTALACIONES DE GAS'
    };

    const handleGenerateWord = async () => {
        const data = getData();

        console.log('Datos en modal (primer nivel):', data);

        const selectedSecciones = Object.entries(selectedSections)
            .filter(([_, value]) => value)
            .map(([key]) => sectionLabels[key]);

        if (selectedSecciones.length === 0) {
            showNotification?.('error', 'Debe seleccionar al menos una sección');
            return;
        }

        if (!data || data.length === 0) {
            showNotification?.('warning', 'No hay datos para generar el documento');
            return;
        }

        setGeneratingWord(true);
        onGenerateStart?.();

        try {
            for (const seccion of selectedSecciones) {
                const datosFiltrados = filterTreeData(data, seccion);
                if (datosFiltrados.length > 0) {
                    await generarWordParaSeccion(datosFiltrados, seccion, showNotification, proyecto);
                } else {
                    showNotification?.('warning', `No se encontraron datos para la sección ${seccion}`);
                }
            }
            onClose();
        } catch (error) {
            console.error("Error generando documentos:", error);
            showNotification?.('error', "Error al generar los documentos");
        } finally {
            setGeneratingWord(false);
            onGenerateEnd?.();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                <div className="bg-gray-100 px-6 py-4 rounded-t-lg border-b">
                    <h2 className="text-lg font-bold text-gray-800">Generar Documento Word</h2>
                </div>
                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                    <div>
                        <p className="text-sm text-gray-600 mb-2">Seleccione las secciones a incluir:</p>
                        <div className="space-y-2">
                            {Object.entries(selectedSections).map(([key, value]) => (
                                <label key={key} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={value}
                                        onChange={e => setSelectedSections(prev => ({ ...prev, [key]: e.target.checked }))}
                                        className="w-4 h-4 text-blue-600 rounded"
                                    />
                                    <span className="text-sm text-gray-700 capitalize">{key}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="border-t border-gray-200 pt-3">
                        <p className="text-sm font-medium text-gray-700 mb-2">Imágenes para el documento:</p>
                        {(proyecto?.plantilla_logo_izq_url || proyecto?.plantilla_logo_der_url ||
                            proyecto?.portada_logo_center_url || proyecto?.plantilla_firma_url) ? (
                            <p className="text-xs text-green-600 mb-2">
                                ✅ Se usarán las imágenes configuradas en el proyecto. Suba archivos solo si desea sobreescribirlas.
                            </p>
                        ) : null}
                        <div className="space-y-2">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">
                                    Logo izquierdo (header) {proyecto?.plantilla_logo_izq_url &&
                                        <span className="text-green-600">✅ Configurado</span>}
                                </label>
                                <input
                                    type="file"
                                    id="logoFile"
                                    accept="image/*"
                                    className="w-full text-sm border border-gray-300 rounded-md p-1.5"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">
                                    Logo derecho / Escudo (header) {proyecto?.plantilla_logo_der_url &&
                                        <span className="text-green-600">✅ Configurado</span>}
                                </label>
                                <input
                                    type="file"
                                    id="escudoFile"
                                    accept="image/*"
                                    className="w-full text-sm border border-gray-300 rounded-md p-1.5"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">
                                    Imagen principal (portada) {proyecto?.portada_logo_center_url &&
                                        <span className="text-green-600">✅ Configurado</span>}
                                </label>
                                <input
                                    type="file"
                                    id="logoPrinFile"
                                    accept="image/*"
                                    className="w-full text-sm border border-gray-300 rounded-md p-1.5"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">
                                    Firma (footer) {proyecto?.plantilla_firma_url &&
                                        <span className="text-green-600">✅ Configurado</span>}
                                </label>
                                <input
                                    type="file"
                                    id="firmaFile"
                                    accept="image/*"
                                    className="w-full text-sm border border-gray-300 rounded-md p-1.5"
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-gray-100 px-6 py-4 rounded-b-lg flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                        disabled={generatingWord}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleGenerateWord}
                        disabled={generatingWord}
                        className={`px-4 py-2 rounded-md text-sm font-medium ${generatingWord
                                ? 'bg-gray-400 cursor-not-allowed text-white'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                    >
                        {generatingWord ? 'Generando...' : 'Generar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WordExportModal;