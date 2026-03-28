import React, { useState } from 'react';
import {
    Document, Paragraph, TextRun, ImageRun, Header, Footer, Table, TableRow, TableCell,
    AlignmentType, HeadingLevel, BorderStyle, WidthType, VerticalAlign, UnderlineType,
    LineRuleType, PageNumber, SectionType, Packer
} from 'docx';
import { saveAs } from 'file-saver';

// Tipos
interface WordExportProps {
    isOpen: boolean;
    onClose: () => void;
    getData: () => any[];
    onGenerateStart?: () => void;
    onGenerateEnd?: () => void;
    showNotification?: (type: 'success' | 'error' | 'warning', message: string) => void;
}

// ─────────────────────────────────────────────
// FUNCIONES DE UTILIDAD PARA WORD
// ─────────────────────────────────────────────

const crearParrafoDetalle = (titulo: string, descripcion: string) => {
    return new Paragraph({
        children: [
            new TextRun({ text: `${titulo} `, bold: true, font: "Arial", color: "#000000" }),
            new TextRun({ text: descripcion, font: "Arial", color: "#000000" }),
        ],
        spacing: { after: 100, line: 750, lineRule: LineRuleType.AUTO },
    });
};

const sinBordes = () => {
    return {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
    };
};

const addTechnicalDetailsToWord = (detallesTecnicos: any, sections: any[]) => {
    if (!detallesTecnicos || typeof detallesTecnicos !== 'object') return;

    const procesarContenido = (contenido: string) => {
        if (!contenido) return [];

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = contenido;

        const elementos: any[] = [];

        tempDiv.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                if (node.textContent?.trim()) {
                    elementos.push(new Paragraph({
                        children: [new TextRun({ text: node.textContent, font: "Arial Narrow", size: 24, color: "#000000" })],
                        spacing: { after: 200, line: 480 },
                        indent: { left: 720, firstLine: 0 },
                    }));
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as HTMLElement;
                if (element.tagName === 'IMG') {
                    const src = element.getAttribute('src');
                    if (src && src.startsWith('data:image')) {
                        const base64Data = src.split(',')[1];
                        elementos.push(new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [new ImageRun({
                                data: base64Data,
                                transformation: { width: 400, height: 300 },
                            })],
                            spacing: { after: 200 },
                        }));
                    }
                } else if (element.tagName === 'P' || element.tagName === 'DIV') {
                    const texto = element.innerText;
                    if (texto.trim()) {
                        elementos.push(new Paragraph({
                            children: [new TextRun({ text: texto, font: "Arial Narrow", size: 24, color: "#000000" })],
                            spacing: { after: 200, line: 480 },
                            indent: { left: 720, firstLine: 0 },
                        }));
                    }
                }
            }
        });

        return elementos;
    };

    if (detallesTecnicos.descripcion) {
        sections.push(new Paragraph({
            children: [new TextRun({ text: "DESCRIPCIÓN:", bold: true, font: "Arial Narrow", size: 24, color: "#000000" })],
            spacing: { after: 200, line: 480 },
            indent: { left: 720, firstLine: 0 },
        }));
        sections.push(...procesarContenido(detallesTecnicos.descripcion));
    }

    const materialesKey = Object.keys(detallesTecnicos).find(key =>
        key.toLowerCase().includes('material') || key.toLowerCase().includes('herramienta')
    );
    if (materialesKey) {
        sections.push(new Paragraph({
            children: [new TextRun({ text: "MATERIALES:", bold: true, size: 24, font: "Arial Narrow", color: "#000000" })],
            spacing: { after: 200, line: 480 },
            indent: { left: 720, firstLine: 0 },
        }));

        const materiales = detallesTecnicos[materialesKey];
        if (typeof materiales === 'string') {
            sections.push(...procesarContenido(materiales));
        } else if (Array.isArray(materiales)) {
            materiales.forEach(material => {
                sections.push(new Paragraph({
                    children: [new TextRun({ text: "- " + material, font: "Arial Narrow", size: 24, color: "#000000" })],
                    spacing: { after: 200, line: 480 },
                    indent: { left: 720, firstLine: 0 },
                }));
            });
        }
        sections.push(new Paragraph({ text: "", spacing: { after: 100 } }));
    }

    const metodoEjecucionKey = Object.keys(detallesTecnicos).find(key =>
        key.toLowerCase().includes('ejecucion') || key.toLowerCase().includes('ejecución')
    );
    if (metodoEjecucionKey) {
        sections.push(new Paragraph({
            children: [new TextRun({ text: "MÉTODO DE EJECUCIÓN:", bold: true, font: "Arial Narrow", size: 24, color: "#000000" })],
            spacing: { after: 200, line: 480 },
            indent: { left: 720, firstLine: 0 },
        }));
        sections.push(...procesarContenido(detallesTecnicos[metodoEjecucionKey]));
    }

    const metodoMedicionKey = Object.keys(detallesTecnicos).find(key =>
        key.toLowerCase().includes('medicion') || key.toLowerCase().includes('medición')
    );
    if (metodoMedicionKey) {
        sections.push(new Paragraph({
            children: [new TextRun({ text: "MÉTODO DE MEDICIÓN:", bold: true, size: 24, font: "Arial Narrow", color: "#000000" })],
            spacing: { after: 200, line: 480 },
            indent: { left: 720, firstLine: 0 },
        }));
        sections.push(...procesarContenido(detallesTecnicos[metodoMedicionKey]));
    }

    const condicionesPagoKey = Object.keys(detallesTecnicos).find(key =>
        key.toLowerCase().includes('pago')
    );
    if (condicionesPagoKey) {
        sections.push(new Paragraph({
            children: [new TextRun({ text: "CONDICIONES DE PAGO:", bold: true, font: "Arial Narrow", size: 24, color: "#000000" })],
            spacing: { after: 200, line: 480 },
            indent: { left: 720, firstLine: 0 },
        }));
        sections.push(...procesarContenido(detallesTecnicos[condicionesPagoKey]));
    }
};

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

        sections.push(new Paragraph({
            children: [new TextRun({
                text: `${item.item || ''} ${item.descripcion || ''}`.trim(),
                bold: true,
                font: "Arial Narrow",
                color: "#000000",
                size: 24,
            })],
            heading: headingLevel,
            spacing: { before: 300, after: 100, line: 480 },
        }));

        if (item.unidad) {
            sections.push(new Paragraph({
                children: [new TextRun({ text: `(Unidad de medida: ${item.unidad})`, font: "Arial Narrow", size: 22, color: "#000000" })],
                spacing: { line: 480 },
            }));
        }

        if (item.metrado) {
            sections.push(new Paragraph({
                children: [new TextRun({ text: `Metrado: ${item.metrado}`, font: "Arial Narrow", size: 24, color: "#000000" })],
                spacing: { after: 200, line: 480 },
                indent: { left: 720, firstLine: 0 },
            }));
        }

        if (item.detallesTecnicos) {
            addTechnicalDetailsToWord(item.detallesTecnicos, sections);
        }

        if (item._children && item._children.length > 0) {
            processHierarchicalItemsToWord(item._children, sections, level + 1);
        }
    });
};

const generateSectionsForWord = (data: any[], sectionName: string): any[] => {
    if (!data || !Array.isArray(data) || data.length === 0) {
        return [new Paragraph({ text: "No se encontraron datos para esta sección." })];
    }

    const sections: any[] = [];

    sections.push(new Paragraph({
        text: sectionName.toUpperCase(),
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        bold: true,
        spacing: { before: 400, after: 200 },
    }));

    processHierarchicalItemsToWord(data, sections, 1);

    return sections;
};

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
        if (!items) return [];

        return items.reduce((acc: any[], item: any) => {
            const descripcion = (item.descripcion || '').toLowerCase();
            const itemCode = (item.item || '').toLowerCase();

            const matches = keywords.some(keyword =>
                descripcion.includes(keyword.toLowerCase()) ||
                itemCode.includes(keyword.toLowerCase())
            );

            if (matches) {
                acc.push({ ...item });
            } else if (item._children && item._children.length > 0) {
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

const generarWordParaSeccion = async (datosFiltrados: any[], nombreArchivoBase: string, showNotification?: (type: 'success' | 'error' | 'warning', message: string) => void) => {
    const logoFile = (document.getElementById('logoFile') as HTMLInputElement)?.files?.[0] || null;
    const escudoFile = (document.getElementById('escudoFile') as HTMLInputElement)?.files?.[0] || null;
    const principalFile = (document.getElementById('logoPrinFile') as HTMLInputElement)?.files?.[0] || null;
    const firmaFile = (document.getElementById('firmaFile') as HTMLInputElement)?.files?.[0] || null;

    const readFileAsDataURL = (file: File): Promise<string | null> => {
        return new Promise((resolve, reject) => {
            if (!file) {
                resolve(null);
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target?.result as string);
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(file);
        });
    };

    let logoDataUrl = null;
    let escudoDataUrl = null;
    let principalDataUrl = null;
    let firmaDataUrl = null;

    try {
        if (logoFile) logoDataUrl = await readFileAsDataURL(logoFile);
        if (escudoFile) escudoDataUrl = await readFileAsDataURL(escudoFile);
        if (principalFile) principalDataUrl = await readFileAsDataURL(principalFile);
        if (firmaFile) firmaDataUrl = await readFileAsDataURL(firmaFile);
    } catch (error) {
        console.error("Error al procesar las imágenes:", error);
    }

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

    const header = new Header({
        children: [
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                    insideHorizontal: { style: BorderStyle.NONE },
                    insideVertical: { style: BorderStyle.NONE },
                },
                rows: [
                    new TableRow({
                        children: [
                            new TableCell({
                                width: { size: 15, type: WidthType.PERCENTAGE },
                                borders: sinBordes(),
                                children: [new Paragraph({ alignment: AlignmentType.LEFT, children: logoImageRun ? [logoImageRun] : [] })],
                            }),
                            new TableCell({
                                width: { size: 70, type: WidthType.PERCENTAGE },
                                borders: sinBordes(),
                                children: [
                                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "MEJORAMIENTO DE LOS SERVICIOS DE EDUCACION INICIAL DE LA IEI N° 358 CIUDAD DE CONTAMANA DEL DISTRITO DE CONTAMANA- PROVINCIA DE UCAYALI – DEPARTAMENTO DE LORETO", bold: true, size: 16, color: "#000000", font: "Arial" })] }),
                                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "CUI: 2484411; CÓDIGO MODULAR: 0651216; CÓDIGO LOCAL: 390867", bold: true, size: 16, color: "#000000", font: "Arial" })] }),
                                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "I.E.I:358; UNIDAD EJECUTORA: MUNICIPALIDAD PROVINCIAL DE UCAYALI", bold: true, size: 16, color: "#000000", font: "Arial" })] }),
                                ],
                            }),
                            new TableCell({
                                width: { size: 15, type: WidthType.PERCENTAGE },
                                borders: sinBordes(),
                                children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: escudoImageRun ? [escudoImageRun] : [] })],
                            }),
                        ],
                    }),
                ],
            }),
            new Paragraph({ border: { bottom: { color: "#000000", space: 1, style: BorderStyle.SINGLE, size: 1 } }, children: [new TextRun("")] }),
        ],
    });

    const footer = new Footer({
        children: [
            new Paragraph({ alignment: AlignmentType.LEFT, children: firmaImageRun ? [firmaImageRun] : [] }),
            new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                    new TextRun({ text: "Página ", bold: true, color: "#000000", font: "Arial" }),
                    new TextRun({ children: [PageNumber.CURRENT], bold: true, color: "#000000", font: "Arial" }),
                    new TextRun({ text: " | ", bold: true, color: "#000000", font: "Arial" }),
                    new TextRun({ children: [PageNumber.TOTAL_PAGES], bold: true, color: "#000000", font: "Arial" }),
                ],
            }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "MUNICIPALIDAD PROVINCIAL DE UCAYALI", bold: true, color: "#000000", font: "Arial" })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "CENTRO POBLADO DE CONTAMANA", color: "#000000", font: "Arial" })] }),
        ],
    });

    const coverPage = [
        new Paragraph({
            children: [new TextRun({ text: `ESPECIFICACIONES TECNICAS-${nombreArchivoBase.toUpperCase()}`, bold: true, size: 44, font: "Arial", color: "#000000", underline: { type: UnderlineType.SINGLE } })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
        }),
        new Paragraph({ text: "", border: { bottom: { color: "#000000", space: 1, style: BorderStyle.SINGLE, size: 1 } }, spacing: { after: 400 } }),
        new Paragraph({
            children: [
                new TextRun({ text: "PROYECTO:", bold: true, font: "Arial", size: 28, color: "#000000" }),
                new TextRun({ text: "\t", font: "Arial", size: 28 }),
                new TextRun({ text: "MEJORAMIENTO DE LOS SERVICIOS DE EDUCACION INICIAL DE LA IEI N°558 CIUDAD DE CONTAMANA DEL DISTRITO DE CONTAMANA-PROVINCIA DE UCAYALI - DEPARTAMENTO DE LORETO", font: "Arial", size: 28, color: "#000000" }),
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
                            children: principalImageRun ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [principalImageRun] })] : [new Paragraph("")],
                            borders: sinBordes(),
                        }),
                    ],
                }),
            ],
        }),
    ];

    const tableOfContents = [
        new Paragraph({
            children: [new TextRun({ text: "TABLA DE CONTENIDO", bold: true, font: "Arial", size: 24, color: "#000000" })],
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
        }),
    ];

    const contentSections = generateSectionsForWord(datosFiltrados, nombreArchivoBase);

    const documentSections = [
        { properties: { type: SectionType.NEW_PAGE }, headers: { default: header }, footers: { default: footer }, children: coverPage },
        { properties: { type: SectionType.NEW_PAGE }, headers: { default: header }, footers: { default: footer }, children: tableOfContents },
        { properties: { type: SectionType.CONTINUOUS }, headers: { default: header }, footers: { default: footer }, children: contentSections },
    ];

    const doc = new Document({
        styles: {
            default: { document: { run: { font: "Arial", color: "#000000", size: 24 } }, paragraph: { spacing: { line: 276 } } },
            paragraphStyles: [
                { id: "Heading1", name: "Heading 1", run: { font: "Arial", size: 36, bold: true, color: "#000000" }, paragraph: { spacing: { before: 240, after: 120 } } },
                { id: "Heading2", name: "Heading 2", run: { font: "Arial", size: 30, bold: true, color: "#000000" }, paragraph: { spacing: { before: 240, after: 120 } } },
                { id: "Heading3", name: "Heading 3", run: { font: "Arial", size: 26, bold: true, color: "#000000" }, paragraph: { spacing: { before: 240, after: 120 } } },
            ],
        },
        sections: documentSections,
    });

    try {
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `especificaciones_tecnicas_${nombreArchivoBase.replace(/ /g, '_')}.docx`);
        if (showNotification) showNotification('success', `Documento para ${nombreArchivoBase} generado con éxito`);
    } catch (error) {
        console.error("Error al generar el documento:", error);
        if (showNotification) showNotification('error', "Error al generar el documento Word");
    }
};

// ─────────────────────────────────────────────
// COMPONENTE PRINCIPAL DE EXPORTACIÓN
// ─────────────────────────────────────────────

const WordExportModal: React.FC<WordExportProps> = ({ isOpen, onClose, getData, onGenerateStart, onGenerateEnd, showNotification }) => {
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

        const selectedSecciones = Object.entries(selectedSections)
            .filter(([_, value]) => value)
            .map(([key]) => sectionLabels[key]);

        if (selectedSecciones.length === 0) {
            if (showNotification) showNotification('error', 'Debe seleccionar al menos una sección');
            return;
        }

        if (!data || data.length === 0) {
            if (showNotification) showNotification('warning', 'No hay datos para generar el documento');
            return;
        }

        setGeneratingWord(true);
        if (onGenerateStart) onGenerateStart();

        try {
            for (const seccion of selectedSecciones) {
                const datosFiltrados = filterTreeData(data, seccion);
                if (datosFiltrados.length > 0) {
                    await generarWordParaSeccion(datosFiltrados, seccion, showNotification);
                } else {
                    if (showNotification) showNotification('warning', `No se encontraron datos para la sección ${seccion}`);
                }
            }
        } finally {
            setGeneratingWord(false);
            if (onGenerateEnd) onGenerateEnd();
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
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
                        <div className="space-y-2">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Logo izquierdo (header)</label>
                                <input type="file" id="logoFile" accept="image/*" className="w-full text-sm border border-gray-300 rounded-md p-1.5" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Logo derecho / Escudo (header)</label>
                                <input type="file" id="escudoFile" accept="image/*" className="w-full text-sm border border-gray-300 rounded-md p-1.5" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Imagen principal (portada)</label>
                                <input type="file" id="logoPrinFile" accept="image/*" className="w-full text-sm border border-gray-300 rounded-md p-1.5" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Firma (footer)</label>
                                <input type="file" id="firmaFile" accept="image/*" className="w-full text-sm border border-gray-300 rounded-md p-1.5" />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-gray-100 px-6 py-4 rounded-b-lg flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                        Cancelar
                    </button>
                    <button
                        onClick={handleGenerateWord}
                        disabled={generatingWord}
                        className={`px-4 py-2 rounded-md text-sm font-medium ${generatingWord ? 'bg-gray-400 cursor-not-allowed text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                    >
                        {generatingWord ? 'Generando...' : 'Generar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WordExportModal;