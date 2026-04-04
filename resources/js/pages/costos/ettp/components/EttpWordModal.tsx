import React, { useState } from 'react';
import type { SelectedSections } from './types';
import { SECTION_LABELS } from './types';

interface Props {
    show: boolean;
    selectedSections: SelectedSections;
    onSelectedChange: (sections: SelectedSections) => void;
    onClose: () => void;
    getData: () => any[];
    showNotification: (type: 'success' | 'error' | 'warning', msg: string) => void;
    proyecto?: any;
}

const EttpWordModal: React.FC<Props> = ({
    show,
    selectedSections,
    onSelectedChange,
    onClose,
    getData,
    showNotification,
    proyecto,
}) => {
    const [generating, setGenerating] = useState(false);

    if (!show) return null;

    // ─── FILTRADO POR SECCIÓN ─────
    const filterTreeData = (data: any[], sectionName: string): any[] => {
        if (!data || !Array.isArray(data)) return [];

        const sectionKeywords: Record<string, string[]> = {
            'ESTRUCTURAS': ['estructura', 'concreto', 'acero', 'cimentación', 'columna', 'viga'],
            'ARQUITECTURA': ['arquitectura', 'acabado', 'piso', 'cielorraso', 'tabique', 'revoque'],
            'INSTALACIONES SANITARIAS': ['sanitaria', 'agua', 'desagüe', 'tubería', 'cisterna', 'tanque'],
            'INSTALACIONES ELECTRICAS': ['eléctrica', 'eléctrico', 'electricas', 'alumbrado', 'tomacorriente', 'tablero'],
            'INSTALACIONES DE COMUNICACIONES': ['comunicacion', 'comunicaciones', 'datos', 'teléfono', 'red'],
            'INSTALACIONES DE GAS': ['gas', 'gasfitería', 'tubería de gas'],
        };

        const keywords = sectionKeywords[sectionName] || [];

        const filterItems = (items: any[]): any[] => {
            if (!items) return [];
            return items.reduce((acc: any[], item: any) => {
                const descripcion = (item.descripcion || '').toLowerCase();
                const itemCode = (item.item || '').toLowerCase();
                const matches = keywords.some(kw =>
                    descripcion.includes(kw.toLowerCase()) || itemCode.includes(kw.toLowerCase())
                );

                if (matches) {
                    acc.push({ ...item });
                } else if (item._children?.length) {
                    const filtered = filterItems(item._children);
                    if (filtered.length > 0) acc.push({ ...item, _children: filtered });
                }
                return acc;
            }, []);
        };

        return filterItems(data);
    };

    // ─── HELPERS WORD ─────
    const crearParrafoDetalle = (docx: any, titulo: string, descripcion: string) => {
        return new docx.Paragraph({
            children: [
                new docx.TextRun({ text: `${titulo} `, bold: true, font: "Arial", color: "#000000" }),
                new docx.TextRun({ text: descripcion, font: "Arial", color: "#000000" }),
            ],
            spacing: { after: 100, line: 750, lineRule: docx.LineRuleType.AUTO },
        });
    };

    const sinBordes = (docx: any) => ({
        top: { style: docx.BorderStyle.NONE },
        bottom: { style: docx.BorderStyle.NONE },
        left: { style: docx.BorderStyle.NONE },
        right: { style: docx.BorderStyle.NONE },
    });

    const procesarContenido = async (docx: any, contenido: string) => {
        if (!contenido) return [];
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = contenido;
        const elementos: any[] = [];

        const procesarBloque = async (nodoBloque: HTMLElement) => {
            const runs: any[] = [];

            const procesarInline = async (nodo: Node) => {
                if (nodo.nodeType === Node.TEXT_NODE) {
                    if (nodo.textContent?.trim() !== '') {
                        runs.push(new docx.TextRun({ text: nodo.textContent?.replace(/\s+/g, ' ') || '', font: "Arial Narrow", size: 24, color: "#000000" }));
                    }
                } else if (nodo.nodeType === Node.ELEMENT_NODE) {
                    const el = nodo as HTMLElement;
                    if (el.tagName === 'IMG') {
                        const src = el.getAttribute('src');
                        if (src) {
                            let dataStr = "";
                            if (src.startsWith('data:image')) {
                                const partes = src.split(',');
                                if (partes.length > 1) dataStr = partes[1];
                            } else {
                                try {
                                    const response = await fetch(src);
                                    const blob = await response.blob();
                                    const base64Data = await new Promise<string>((resolve, reject) => {
                                        const reader = new FileReader();
                                        reader.onloadend = () => resolve(reader.result as string);
                                        reader.onerror = reject;
                                        reader.readAsDataURL(blob);
                                    });
                                    const partesUrl = base64Data.split(',');
                                    if (partesUrl.length > 1) dataStr = partesUrl[1];
                                } catch (err) { }
                            }
                            if (dataStr) {
                                runs.push(new docx.ImageRun({
                                    data: dataStr,
                                    transformation: { width: 200, height: 200 },
                                }));
                            }
                        }
                    } else if (el.tagName !== 'BR') {
                        for (const child of Array.from(nodo.childNodes)) {
                            await procesarInline(child);
                        }
                    }
                }
            };

            for (const child of Array.from(nodoBloque.childNodes)) {
                await procesarInline(child);
            }

            if (runs.length > 0) {
                const tieneImagen = runs.some(r => r.constructor.name === 'ImageRun' || (r.options && r.options.data));
                elementos.push(new docx.Paragraph({
                    alignment: tieneImagen ? docx.AlignmentType.CENTER : docx.AlignmentType.BOTH,
                    children: runs,
                    spacing: { after: 200, line: 480 },
                    indent: tieneImagen ? {} : { left: 720, firstLine: 0 },
                }));
            }
        };

        for (const child of Array.from(tempDiv.childNodes)) {
            if (child.nodeType === Node.ELEMENT_NODE) {
                await procesarBloque(child as HTMLElement);
            } else if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
                const fakeP = document.createElement('p');
                fakeP.textContent = child.textContent;
                await procesarBloque(fakeP);
            }
        }

        return elementos;
    };

    const addTechnicalDetails = async (docx: any, sectionsData: any[], sections: any[]) => {
        if (!sectionsData || !Array.isArray(sectionsData)) return;

        for (const section of sectionsData) {
            if (!section.titulo || !section.contenido) continue;

            sections.push(new docx.Paragraph({
                children: [new docx.TextRun({ text: `${section.titulo.toUpperCase()}:`, bold: true, font: "Arial Narrow", size: 24, color: "#000000" })],
                spacing: { after: 200, line: 480 }, indent: { left: 720, firstLine: 0 },
            }));

            const elementosParsed = await procesarContenido(docx, section.contenido);
            sections.push(...elementosParsed);
        }
    };

    const processHierarchicalItems = async (docx: any, items: any[], sections: any[], level: number) => {
        if (!items?.length) return;

        for (const item of items) {
            if (!item) continue;

            // Calcular nivel por cantidad de puntos en item.item
            const itemCode = item.item || '';
            const dotCount = (itemCode.match(/\./g) || []).length;

            let headingLevel;
            if (dotCount === 0) {
                headingLevel = docx.HeadingLevel.HEADING_1;
            } else if (dotCount === 1) {
                headingLevel = docx.HeadingLevel.HEADING_2;
            } else if (dotCount === 2) {
                headingLevel = docx.HeadingLevel.HEADING_3;
            } else {
                headingLevel = docx.HeadingLevel.HEADING_4;
            }

            sections.push(new docx.Paragraph({
                children: [new docx.TextRun({
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
                sections.push(new docx.Paragraph({
                    children: [new docx.TextRun({ text: `(Unidad de medida: ${item.unidad})`, font: "Arial Narrow", size: 22, color: "#000000" })],
                    spacing: { line: 480 },
                }));
            }

            if (item.secciones && item.secciones.length > 0) {
                await addTechnicalDetails(docx, item.secciones, sections);
            }

            if (item._children?.length) {
                await processHierarchicalItems(docx, item._children, sections, level + 1);
            }
        }
    };
    const readFileAsDataURL = (file: File): Promise<string | null> => {
        return new Promise((resolve, reject) => {
            if (!file) { resolve(null); return; }
            const reader = new FileReader();
            reader.onload = (ev) => resolve(ev.target?.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    // ─── GENERACIÓN PRINCIPAL ─────
    const fetchImageAsDataURL = async (url: string): Promise<string | null> => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.error("Error obteniendo imagen de proyecto:", e);
            return null;
        }
    };

    const generarWordParaSeccion = async (docx: any, datosFiltrados: any[], nombreArchivo: string) => {
        const logoFile = (document.getElementById('logoFile') as HTMLInputElement)?.files?.[0] || null;
        const escudoFile = (document.getElementById('escudoFile') as HTMLInputElement)?.files?.[0] || null;
        const principalFile = (document.getElementById('logoPrinFile') as HTMLInputElement)?.files?.[0] || null;
        const firmaFile = (document.getElementById('firmaFile') as HTMLInputElement)?.files?.[0] || null;

        let logoUrl: string | null = null, escudoUrl: string | null = null;
        let principalUrl: string | null = null, firmaUrl: string | null = null;

        try {
            if (proyecto?.plantilla_logo_izq_url) {
                logoUrl = await fetchImageAsDataURL(proyecto.plantilla_logo_izq_url);
            } else if (logoFile) {
                logoUrl = await readFileAsDataURL(logoFile);
            }

            if (proyecto?.plantilla_logo_der_url) {
                escudoUrl = await fetchImageAsDataURL(proyecto.plantilla_logo_der_url);
            } else if (escudoFile) {
                escudoUrl = await readFileAsDataURL(escudoFile);
            }

            if (principalFile) {
                principalUrl = await readFileAsDataURL(principalFile);
            }

            if (proyecto?.plantilla_firma_url) {
                firmaUrl = await fetchImageAsDataURL(proyecto.plantilla_firma_url);
            } else if (firmaFile) {
                firmaUrl = await readFileAsDataURL(firmaFile);
            }
        } catch (err) { console.error("Error procesando imágenes:", err); }

        const logoRun = logoUrl ? new docx.ImageRun({ data: logoUrl.split(',').length > 1 ? logoUrl.split(',')[1] : logoUrl, transformation: { width: 70, height: 70 } }) : null;
        const escudoRun = escudoUrl ? new docx.ImageRun({ data: escudoUrl.split(',').length > 1 ? escudoUrl.split(',')[1] : escudoUrl, transformation: { width: 70, height: 70 } }) : null;
        const principalRun = principalUrl ? new docx.ImageRun({ data: principalUrl.split(',').length > 1 ? principalUrl.split(',')[1] : principalUrl, transformation: { width: 300, height: 400 } }) : null;
        const firmaRun = firmaUrl ? new docx.ImageRun({ data: firmaUrl.split(',').length > 1 ? firmaUrl.split(',')[1] : firmaUrl, transformation: { width: 70, height: 70 } }) : null;

        const header = new docx.Header({
            children: [
                new docx.Table({
                    width: { size: 100, type: docx.WidthType.PERCENTAGE },
                    borders: { top: { style: docx.BorderStyle.NONE }, bottom: { style: docx.BorderStyle.NONE }, left: { style: docx.BorderStyle.NONE }, right: { style: docx.BorderStyle.NONE }, insideHorizontal: { style: docx.BorderStyle.NONE }, insideVertical: { style: docx.BorderStyle.NONE } },
                    rows: [new docx.TableRow({
                        children: [
                            new docx.TableCell({ width: { size: 15, type: docx.WidthType.PERCENTAGE }, borders: sinBordes(docx), children: [new docx.Paragraph({ alignment: docx.AlignmentType.LEFT, children: logoRun ? [logoRun] : [] })] }),
                            new docx.TableCell({
                                width: { size: 70, type: docx.WidthType.PERCENTAGE }, borders: sinBordes(docx), children: [
                                    new docx.Paragraph({ alignment: docx.AlignmentType.CENTER, children: [new docx.TextRun({ text: "ESPECIFICACIONES TÉCNICAS", bold: true, size: 16, color: "#000000", font: "Arial" })] }),
                                ]
                            }),
                            new docx.TableCell({ width: { size: 15, type: docx.WidthType.PERCENTAGE }, borders: sinBordes(docx), children: [new docx.Paragraph({ alignment: docx.AlignmentType.RIGHT, children: escudoRun ? [escudoRun] : [] })] }),
                        ],
                    })],
                }),
                new docx.Paragraph({ border: { bottom: { color: "#000000", space: 1, style: docx.BorderStyle.SINGLE, size: 1 } }, children: [new docx.TextRun("")] }),
            ],
        });

        const footer = new docx.Footer({
            children: [
                new docx.Paragraph({ alignment: docx.AlignmentType.LEFT, children: firmaRun ? [firmaRun] : [] }),
                new docx.Paragraph({
                    alignment: docx.AlignmentType.RIGHT,
                    children: [
                        new docx.TextRun({ text: "Página ", bold: true, color: "#000000", font: "Arial" }),
                        new docx.TextRun({ children: [docx.PageNumber.CURRENT], bold: true, color: "#000000", font: "Arial" }),
                        new docx.TextRun({ text: " | ", bold: true, color: "#000000", font: "Arial" }),
                        new docx.TextRun({ children: [docx.PageNumber.TOTAL_PAGES], bold: true, color: "#000000", font: "Arial" }),
                    ],
                }),
            ],
        });

        // Portada
        const coverPage = [
            new docx.Paragraph({
                children: [new docx.TextRun({ text: `ESPECIFICACIONES TECNICAS-${nombreArchivo.toUpperCase()}`, bold: true, size: 44, font: "Arial", color: "#000000", underline: { type: docx.UnderlineType.SINGLE } })],
                alignment: docx.AlignmentType.CENTER, spacing: { after: 200 },
            }),
            new docx.Paragraph({ text: "", border: { bottom: { color: "#000000", space: 1, style: docx.BorderStyle.SINGLE, size: 1 } }, spacing: { after: 400 } }),
        ];

        if (principalRun) {
            coverPage.push(new docx.Paragraph({ alignment: docx.AlignmentType.CENTER, children: [principalRun], spacing: { after: 400 } }));
        }

        // Tabla de contenido
        const generarTOC = (items: any[]): any[] => {
            const result: any[] = [];

            result.push(new docx.Paragraph({
                children: [new docx.TextRun({ text: "TABLA DE CONTENIDO", bold: true, size: 28, font: "Arial" })],
                alignment: docx.AlignmentType.CENTER,
                spacing: { after: 400 }
            }));

            const recorrer = (arr: any[], nivel: number) => {
                if (!arr || arr.length === 0) return;

                arr.forEach(item => {
                    if (!item.item) return;

                    const textoItem = `${item.item} ${item.descripcion || ''}`;
                    const puntos = (item.item.match(/\./g) || []).length;
                    const indent = puntos * 20;

                    result.push(new docx.Paragraph({
                        children: [
                            new docx.TextRun({ text: textoItem, size: 22, font: "Arial" }),
                            new docx.TextRun({ text: " .................................. ", size: 22, font: "Arial" }),
                            new docx.TextRun({ text: "Pág.", size: 22, font: "Arial" })
                        ],
                        indent: { left: indent },
                        spacing: { after: 60 }
                    }));

                    if (item._children?.length) {
                        recorrer(item._children, nivel + 1);
                    }
                });
            };

            recorrer(items, 0);
            return result;
        };

       
        // Contenido
        const contentSections: any[] = [];
        contentSections.push(new docx.Paragraph({ text: nombreArchivo.toUpperCase(), heading: docx.HeadingLevel.HEADING_1, alignment: docx.AlignmentType.CENTER, bold: true, spacing: { before: 400, after: 200 } }));
        await processHierarchicalItems(docx, datosFiltrados, contentSections, 1);

        const doc = new docx.Document({
            styles: {
                default: { document: { run: { font: "Arial", color: "#000000", size: 24 } }, paragraph: { spacing: { line: 276 } } },
                paragraphStyles: [
                    { id: "Heading1", name: "Heading 1", run: { font: "Arial", size: 36, bold: true, color: "#000000" }, paragraph: { spacing: { before: 240, after: 120 } } },
                    { id: "Heading2", name: "Heading 2", run: { font: "Arial", size: 30, bold: true, color: "#000000" }, paragraph: { spacing: { before: 240, after: 120 } } },
                    { id: "Heading3", name: "Heading 3", run: { font: "Arial", size: 26, bold: true, color: "#000000" }, paragraph: { spacing: { before: 240, after: 120 } } },
                ],
            },
            sections: [
                { properties: { type: docx.SectionType.NEW_PAGE }, headers: { default: header }, footers: { default: footer }, children: coverPage },
                { properties: { type: docx.SectionType.NEW_PAGE }, headers: { default: header }, footers: { default: footer }, children: toc },
                { properties: { type: docx.SectionType.CONTINUOUS }, headers: { default: header }, footers: { default: footer }, children: contentSections },
            ],
        });

        doc.Settings.updateFields = true;

        try {
            const blob = await docx.Packer.toBlob(doc);
            const saveAs = (window as any).saveAs;
            if (saveAs) {
                saveAs(blob, `especificaciones_tecnicas_${nombreArchivo.replace(/ /g, '_')}.docx`);
            } else {
                const { saveAs: fileSaverSaveAs } = await import('file-saver');
                fileSaverSaveAs(blob, `especificaciones_tecnicas_${nombreArchivo.replace(/ /g, '_')}.docx`);
            }
            showNotification('success', `Documento para ${nombreArchivo} generado con éxito`);
        } catch (err) {
            console.error("Error generando documento:", err);
            showNotification('error', "Error al generar el documento Word");
        }
    };

    // ─── HANDLER GENERAR ─────
    const handleGenerate = () => {
        const docx = (window as any).docx;
        if (!docx) {
            showNotification('error', 'La biblioteca docx no se ha cargado correctamente');
            return;
        }

        const selectedKeys = Object.entries(selectedSections)
            .filter(([_, v]) => v)
            .map(([k]) => SECTION_LABELS[k]);

        if (selectedKeys.length === 0) {
            showNotification('error', 'Debe seleccionar al menos una sección');
            return;
        }

        const data = getData();
        if (!data?.length) {
            showNotification('warning', 'No hay datos para generar el documento');
            return;
        }

        setGenerating(true);
        onClose();

        Promise.all(selectedKeys.map(async seccion => {
            const filtered = filterTreeData(data, seccion);
            if (filtered.length > 0) {
                await generarWordParaSeccion(docx, filtered, seccion);
            } else {
                showNotification('warning', `No se encontraron datos para ${seccion}`);
            }
        })).finally(() => setGenerating(false));
    };

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-lg w-full max-w-md mx-4"
                onClick={e => e.stopPropagation()}
            >
                <div className="bg-gray-100 px-6 py-4 rounded-t-lg border-b">
                    <h2 className="text-lg font-bold text-gray-800">Generar Documento Word</h2>
                </div>
                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                    {/* Secciones */}
                    <div>
                        <p className="text-sm text-gray-600 mb-2">Seleccione las secciones a incluir:</p>
                        <div className="space-y-2">
                            {Object.entries(selectedSections).map(([key, value]) => (
                                <label key={key} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={value}
                                        onChange={e =>
                                            onSelectedChange({ ...selectedSections, [key]: e.target.checked })
                                        }
                                        className="w-4 h-4 text-blue-600 rounded"
                                    />
                                    <span className="text-sm text-gray-700 capitalize">{key}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Imágenes */}
                    <div className="border-t border-gray-200 pt-3">
                        <p className="text-sm font-medium text-gray-700 mb-2">Imágenes para el documento:</p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Logo izquierdo (header)</label>
                                {proyecto?.plantilla_logo_izq_url ? (
                                    <div className="bg-emerald-50 text-emerald-700 px-3 py-2 rounded-md border border-emerald-100 text-sm flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        Usando imagen del proyecto
                                    </div>
                                ) : (
                                    <input type="file" id="logoFile" accept="image/*" className="w-full text-sm border border-gray-300 rounded-md p-1.5" />
                                )}
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Logo derecho / Escudo (header)</label>
                                {proyecto?.plantilla_logo_der_url ? (
                                    <div className="bg-emerald-50 text-emerald-700 px-3 py-2 rounded-md border border-emerald-100 text-sm flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        Usando imagen del proyecto
                                    </div>
                                ) : (
                                    <input type="file" id="escudoFile" accept="image/*" className="w-full text-sm border border-gray-300 rounded-md p-1.5" />
                                )}
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Imagen principal (portada)</label>
                                <input type="file" id="logoPrinFile" accept="image/*" className="w-full text-sm border border-gray-300 rounded-md p-1.5" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Firma (footer)</label>
                                {proyecto?.plantilla_firma_url ? (
                                    <div className="bg-emerald-50 text-emerald-700 px-3 py-2 rounded-md border border-emerald-100 text-sm flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        Usando firma del proyecto
                                    </div>
                                ) : (
                                    <input type="file" id="firmaFile" accept="image/*" className="w-full text-sm border border-gray-300 rounded-md p-1.5" />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-gray-100 px-6 py-4 rounded-b-lg flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                        Cancelar
                    </button>
                    <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className={`px-4 py-2 rounded-md text-sm font-medium ${generating
                                ? 'bg-gray-400 cursor-not-allowed text-white'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                    >
                        {generating ? 'Generando...' : 'Generar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EttpWordModal;
