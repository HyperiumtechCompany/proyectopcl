import {
    Document,
    Paragraph,
    TextRun,
    ImageRun,
    Header,
    Footer,
    Table,
    TableRow,
    TableCell,
    AlignmentType,
    HeadingLevel,
    BorderStyle,
    WidthType,
    VerticalAlign,
    UnderlineType,
    LineRuleType,
    PageNumber,
    PageReference,
    Bookmark,
    TabStopType,
    TabStopPosition,
    SectionType,
    Packer,
} from 'docx';
import { saveAs } from 'file-saver';
import React, { useState } from 'react';

interface WordExportProps {
    isOpen: boolean;
    onClose: () => void;
    getData: () => any[];
    proyecto?: any;
    onGenerateStart?: () => void;
    onGenerateEnd?: () => void;
    showNotification?: (
        type: 'success' | 'error' | 'warning',
        message: string,
    ) => void;
}

// Función auxiliar para crear párrafos de detalle
const crearParrafoDetalle = (titulo: string, descripcion: string) =>
    new Paragraph({
        children: [
            new TextRun({
                text: `${titulo} `,
                bold: true,
                font: 'Arial',
                color: '#000000',
                size: 24,
            }),
            new TextRun({
                text: descripcion,
                font: 'Arial',
                color: '#000000',
                size: 24,
            }),
        ],
        spacing: { after: 100, line: 750, lineRule: LineRuleType.AUTO },
    });

const base64ToUint8Array = (base64: string): Uint8Array => {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
};

// Configuración de sin bordes
const sinBordes = () => ({
    top: { style: BorderStyle.NONE, size: 0, color: '000000' },
    bottom: { style: BorderStyle.NONE, size: 0, color: '000000' },
    left: { style: BorderStyle.NONE, size: 0, color: '000000' },
    right: { style: BorderStyle.NONE, size: 0, color: '000000' },
});

// Procesa contenido HTML a elementos docx de modo asíncrono soportando imágenes
const procesarContenido = async (contenido: string): Promise<Paragraph[]> => {
    if (!contenido || typeof contenido !== 'string') return [];

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = contenido;
    const elementos: Paragraph[] = [];

    const procesarBloque = async (nodoBloque: HTMLElement) => {
        const runs: any[] = [];

        const procesarInline = async (nodo: Node) => {
            if (nodo.nodeType === Node.TEXT_NODE) {
                if (nodo.textContent?.trim() !== '') {
                    runs.push(
                        new TextRun({
                            text: nodo.textContent?.replace(/\s+/g, ' ') || '',
                            font: 'Arial Narrow',
                            size: 24,
                            color: '#000000',
                        }),
                    );
                }
            } else if (nodo.nodeType === Node.ELEMENT_NODE) {
                const el = nodo as HTMLElement;
                if (el.tagName === 'IMG') {
                    const src = el.getAttribute('src');
                    if (src) {
                        let dataStr = '';
                        if (src.startsWith('data:image')) {
                            const partes = src.split(',');
                            if (partes.length > 1) dataStr = partes[1];
                        } else {
                            try {
                                let fetchSrc = src;
                                // Asegurar CORS redirigiendo IP local fija al dominio de la ventana actual
                                if (
                                    fetchSrc.includes('127.0.0.1:8000') ||
                                    fetchSrc.includes('localhost:8000')
                                ) {
                                    fetchSrc = fetchSrc.replace(
                                        /http(s)?:\/\/(127\.0\.0\.1|localhost):8000/,
                                        window.location.origin,
                                    );
                                }

                                const response = await fetch(fetchSrc);
                                const blob = await response.blob();
                                const base64Data = await new Promise<string>(
                                    (resolve, reject) => {
                                        const reader = new FileReader();
                                        reader.onloadend = () =>
                                            resolve(reader.result as string);
                                        reader.onerror = reject;
                                        reader.readAsDataURL(blob);
                                    },
                                );
                                const partesUrl = base64Data.split(',');
                                if (partesUrl.length > 1)
                                    dataStr = partesUrl[1];
                            } catch (err) {
                                console.error(
                                    'Error fetching image for docx:',
                                    err,
                                );
                            }
                        }
                        if (dataStr) {
                            runs.push(
                                new ImageRun({
                                    data: base64ToUint8Array(dataStr),
                                    transformation: { width: 300, height: 200 },
                                } as any),
                            );
                        }
                    }
                } else if (el.tagName === 'BR') {
                    // BR tags ignored since Word handles paragraphs naturally
                } else {
                    for (const child of Array.from(nodo.childNodes)) {
                        await procesarInline(child);
                    }
                }
            }
        };

        // Si el propio nivel raíz es una imagen, evitar buscar "hijos" de él mismo.
        if (nodoBloque.tagName === 'IMG') {
            await procesarInline(nodoBloque);
        } else {
            for (const child of Array.from(nodoBloque.childNodes)) {
                await procesarInline(child);
            }
        }

        if (runs.length > 0) {
            const tieneImagen = runs.some(
                (r) =>
                    r instanceof ImageRun ||
                    r.constructor.name === 'ImageRun' ||
                    (r.options && r.options.data),
            );
            elementos.push(
                new Paragraph({
                    alignment: tieneImagen
                        ? AlignmentType.CENTER
                        : AlignmentType.JUSTIFIED,
                    children: runs,
                    spacing: { after: 200, line: 480 },
                    indent: tieneImagen ? {} : { left: 720, firstLine: 0 },
                }),
            );
        }
    };

    for (const child of Array.from(tempDiv.childNodes)) {
        if (child.nodeType === Node.ELEMENT_NODE) {
            await procesarBloque(child as HTMLElement);
        } else if (
            child.nodeType === Node.TEXT_NODE &&
            child.textContent?.trim()
        ) {
            const fakeP = document.createElement('p');
            fakeP.textContent = child.textContent;
            await procesarBloque(fakeP);
        }
    }

    return elementos;
};

const addSectionsToWord = async (sections: any[], docSections: any[]) => {
    if (!sections || !Array.isArray(sections) || sections.length === 0) return;

    for (const section of sections) {
        if (!section) continue;

        const titulo = (
            section.titulo ||
            section.title ||
            'DETALLE'
        ).toUpperCase();
        const contenido = section.contenido || section.content || '';

        docSections.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: `${titulo}:`,
                        bold: true,
                        font: 'Arial Narrow',
                        size: 24,
                        color: '#000000',
                    }),
                ],
                spacing: { after: 200, line: 480 },
                indent: { left: 720, firstLine: 0 },
            }),
        );

        const procesado = await procesarContenido(contenido);
        if (procesado.length > 0) {
            docSections.push(...procesado);
        } else if (contenido && contenido.trim()) {
            const plainText = contenido.replace(/<[^>]*>/g, '');
            if (plainText.trim()) {
                docSections.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: plainText,
                                font: 'Arial Narrow',
                                size: 24,
                                color: '#000000',
                            }),
                        ],
                        spacing: { after: 200, line: 480 },
                        indent: { left: 720, firstLine: 0 },
                    }),
                );
            }
        }
    }
};

// Procesar items jerárquicos
const processHierarchicalItemsToWord = async (
    items: any[],
    sections: any[],
    level: number,
    tocEntries: { text: string; level: number; bookmarkId: string }[],
) => {
    if (!items || !Array.isArray(items) || items.length === 0) return;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item) continue;

        let headingLevel;
        switch (level) {
            case 1:
                headingLevel = HeadingLevel.HEADING_1;
                break;
            case 2:
                headingLevel = HeadingLevel.HEADING_2;
                break;
            default:
                headingLevel = HeadingLevel.HEADING_3;
                break;
        }

        // Título del item
        const titulo = `${item.item || ''} ${item.descripcion || ''}`.trim();
        const bookmarkId = `bookmark_${level}_${i}_${(item.item || item.descripcion || 'heading')
            .toString()
            .replace(/[^a-zA-Z0-9]/g, '_')}`;

        if (titulo) {
            sections.push(
                new Paragraph({
                    children: [
                        new Bookmark({
                            id: bookmarkId,
                            children: [
                                new TextRun({
                                    text: titulo,
                                    bold: true,
                                    font: 'Arial Narrow',
                                    color: '#000000',
                                    size: 24,
                                }),
                            ],
                        }),
                    ],
                    heading: headingLevel,
                    spacing: { before: 300, after: 100, line: 480 },
                }),
            );
            tocEntries.push({ text: titulo, level, bookmarkId });
        }

        // Unidad de medida
        if (item.unidad && item.unidad.trim()) {
            sections.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `(Unidad de medida: ${item.unidad})`,
                            font: 'Arial Narrow',
                            size: 22,
                            color: '#000000',
                        }),
                    ],
                    spacing: { after: 100, line: 480 },
                    indent: { left: 360, firstLine: 0 },
                }),
            );
        }

        // Metrado
        if (item.metrado) {
            sections.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `Metrado: ${item.metrado}`,
                            font: 'Arial Narrow',
                            size: 24,
                            color: '#000000',
                        }),
                    ],
                    spacing: { after: 200, line: 480 },
                    indent: { left: 720, firstLine: 0 },
                }),
            );
        }

        // Secciones (descripción técnica)
        if (
            item.secciones &&
            Array.isArray(item.secciones) &&
            item.secciones.length > 0
        ) {
            await addSectionsToWord(item.secciones, sections);
        }

        // Procesar hijos recursivamente
        if (
            item._children &&
            Array.isArray(item._children) &&
            item._children.length > 0
        ) {
            await processHierarchicalItemsToWord(item._children, sections, level + 1, tocEntries);
        }
    }
};

// Generar secciones del documento
const generateSectionsForWord = async (
    data: any[],
    sectionName: string,
): Promise<{
    sections: any[];
    tocEntries: { text: string; level: number; bookmarkId: string }[];
}> => {
    if (!data || !Array.isArray(data) || data.length === 0) {
        return {
            sections: [
                new Paragraph({
                    text: 'No se encontraron datos para esta sección.',
                    children: [
                        new TextRun({
                            text: 'No se encontraron datos para esta sección.',
                        }),
                    ],
                }),
            ],
            tocEntries: [],
        };
    }

    const sections: any[] = [];

    sections.push(
        new Paragraph({
            children: [
                new TextRun({
                    text: sectionName.toUpperCase(),
                    bold: true,
                    font: 'Arial',
                    size: 36,
                    color: '#000000',
                }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 200 },
        }),
    );

    const tocEntries: { text: string; level: number; bookmarkId: string }[] = [];
    await processHierarchicalItemsToWord(data, sections, 1, tocEntries);
    return { sections, tocEntries };
};

// Filtrar datos por sección
const filterTreeData = (data: any[], sectionName: string): any[] => {
    if (!data || !Array.isArray(data)) return [];

    const sectionKeywords: Record<string, string[]> = {
        ESTRUCTURAS: [
            'estructura',
            'concreto',
            'acero',
            'cimentación',
            'columna',
            'viga',
        ],
        ARQUITECTURA: [
            'arquitectura',
            'acabado',
            'piso',
            'cielorraso',
            'tabique',
            'revoque',
        ],
        'INSTALACIONES SANITARIAS': [
            'sanitaria',
            'agua',
            'desagüe',
            'tubería',
            'cisterna',
            'tanque',
        ],
        'INSTALACIONES ELECTRICAS': [
            'eléctrica',
            'eléctrico',
            'electricas',
            'alumbrado',
            'tomacorriente',
            'tablero',
        ],
        'INSTALACIONES DE COMUNICACIONES': [
            'comunicacion',
            'comunicaciones',
            'datos',
            'teléfono',
            'red',
        ],
        'INSTALACIONES DE GAS': ['gas', 'gasfitería', 'tubería de gas'],
    };

    const keywords = sectionKeywords[sectionName] || [];
    const filterItems = (items: any[]): any[] => {
        if (!items || !Array.isArray(items)) return [];

        return items.reduce((acc: any[], item: any) => {
            if (!item) return acc;

            const descripcion = (item.descripcion || '').toLowerCase();
            const itemCode = (item.item || '').toLowerCase();

            const matches = keywords.some(
                (keyword) =>
                    descripcion.includes(keyword.toLowerCase()) ||
                    itemCode.includes(keyword.toLowerCase()),
            );

            if (matches) {
                acc.push({ ...item });
            } else if (
                item._children &&
                Array.isArray(item._children) &&
                item._children.length > 0
            ) {
                const filteredChildren = filterItems(item._children);
                if (filteredChildren.length > 0) {
                    acc.push({
                        ...item,
                        _children: filteredChildren,
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
        console.error('Error loading image:', error);
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
    showNotification?: (
        type: 'success' | 'error' | 'warning',
        message: string,
    ) => void,
    proyecto?: any,
) => {
    // Obtener referencias a los inputs de archivo
    const logoFile = (document.getElementById('logoFile') as HTMLInputElement)
        ?.files?.[0];
    const escudoFile = (
        document.getElementById('escudoFile') as HTMLInputElement
    )?.files?.[0];
    const principalFile = (
        document.getElementById('logoPrinFile') as HTMLInputElement
    )?.files?.[0];
    const firmaFile = (document.getElementById('firmaFile') as HTMLInputElement)
        ?.files?.[0];

    let logoDataUrl = null;
    let escudoDataUrl = null;
    let principalDataUrl = null;
    let firmaDataUrl = null;

    try {
        // Prioridad: archivo manual > imagen del proyecto
        if (logoFile) logoDataUrl = await readFileAsDataURL(logoFile);
        else if (proyecto?.plantilla_logo_izq_url)
            logoDataUrl = await loadImageFromUrl(
                proyecto.plantilla_logo_izq_url,
            );

        if (escudoFile) escudoDataUrl = await readFileAsDataURL(escudoFile);
        else if (proyecto?.plantilla_logo_der_url)
            escudoDataUrl = await loadImageFromUrl(
                proyecto.plantilla_logo_der_url,
            );

        if (principalFile)
            principalDataUrl = await readFileAsDataURL(principalFile);
        else if (proyecto?.portada_logo_center_url)
            principalDataUrl = await loadImageFromUrl(
                proyecto.portada_logo_center_url,
            );

        if (firmaFile) firmaDataUrl = await readFileAsDataURL(firmaFile);
        else if (proyecto?.plantilla_firma_url)
            firmaDataUrl = await loadImageFromUrl(proyecto.plantilla_firma_url);
    } catch (error) {
        console.error('Error al procesar las imágenes:', error);
    }

    // Crear ImageRuns solo si hay datos
    const logoImageRun = logoDataUrl
        ? new ImageRun({
              data: base64ToUint8Array(
                  logoDataUrl.split(',').length > 1
                      ? logoDataUrl.split(',')[1]
                      : logoDataUrl,
              ),
              transformation: { width: 70, height: 70 },
          } as any)
        : null;

    const escudoImageRun = escudoDataUrl
        ? new ImageRun({
              data: base64ToUint8Array(
                  escudoDataUrl.split(',').length > 1
                      ? escudoDataUrl.split(',')[1]
                      : escudoDataUrl,
              ),
              transformation: { width: 70, height: 70 },
          } as any)
        : null;

    const principalImageRun = principalDataUrl
        ? new ImageRun({
              data: base64ToUint8Array(
                  principalDataUrl.split(',').length > 1
                      ? principalDataUrl.split(',')[1]
                      : principalDataUrl,
              ),
              transformation: { width: 300, height: 400 },
          } as any)
        : null;

    const firmaImageRun = firmaDataUrl
        ? new ImageRun({
              data: base64ToUint8Array(
                  firmaDataUrl.split(',').length > 1
                      ? firmaDataUrl.split(',')[1]
                      : firmaDataUrl,
              ),
              transformation: { width: 70, height: 70 },
          } as any)
        : null;

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
                                children: logoImageRun
                                    ? [
                                          new Paragraph({
                                              alignment: AlignmentType.LEFT,
                                              children: [logoImageRun],
                                          }),
                                      ]
                                    : [new Paragraph({ text: '' })],
                            }),
                            new TableCell({
                                width: { size: 70, type: WidthType.PERCENTAGE },
                                borders: sinBordes(),
                                children: [
                                    new Paragraph({
                                        alignment: AlignmentType.CENTER,
                                        children: [
                                            new TextRun({
                                                text: 'MEJORAMIENTO DE LOS SERVICIOS DE EDUCACION INICIAL DE LA IEI N° 358 CIUDAD DE CONTAMANA DEL DISTRITO DE CONTAMANA- PROVINCIA DE UCAYALI – DEPARTAMENTO DE LORETO',
                                                bold: true,
                                                size: 16,
                                                color: '#000000',
                                                font: 'Arial',
                                            }),
                                        ],
                                    }),
                                    new Paragraph({
                                        alignment: AlignmentType.CENTER,
                                        children: [
                                            new TextRun({
                                                text: 'CUI: 2484411; CÓDIGO MODULAR: 0651216; CÓDIGO LOCAL: 390867',
                                                bold: true,
                                                size: 16,
                                                color: '#000000',
                                                font: 'Arial',
                                            }),
                                        ],
                                    }),
                                    new Paragraph({
                                        alignment: AlignmentType.CENTER,
                                        children: [
                                            new TextRun({
                                                text: 'I.E.I:358; UNIDAD EJECUTORA: MUNICIPALIDAD PROVINCIAL DE UCAYALI',
                                                bold: true,
                                                size: 16,
                                                color: '#000000',
                                                font: 'Arial',
                                            }),
                                        ],
                                    }),
                                ],
                            }),
                            new TableCell({
                                width: { size: 15, type: WidthType.PERCENTAGE },
                                borders: sinBordes(),
                                children: escudoImageRun
                                    ? [
                                          new Paragraph({
                                              alignment: AlignmentType.RIGHT,
                                              children: [escudoImageRun],
                                          }),
                                      ]
                                    : [new Paragraph({ text: '' })],
                            }),
                        ],
                    }),
                ],
            }),
            new Paragraph({
                border: {
                    bottom: {
                        color: '#000000',
                        space: 1,
                        style: BorderStyle.SINGLE,
                        size: 1,
                    },
                },
                children: [new TextRun({ text: '' })],
            }),
        ],
    });

    // Footer
    const footer = new Footer({
        children: [
            firmaImageRun
                ? new Paragraph({
                      alignment: AlignmentType.LEFT,
                      children: [firmaImageRun],
                  })
                : new Paragraph({ text: '' }),
            new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                    new TextRun({
                        text: 'Página ',
                        bold: true,
                        color: '#000000',
                        font: 'Arial',
                        size: 20,
                    }),
                    new TextRun({
                        children: [PageNumber.CURRENT],
                        bold: true,
                        color: '#000000',
                        font: 'Arial',
                        size: 20,
                    }),
                    new TextRun({
                        text: ' | ',
                        bold: true,
                        color: '#000000',
                        font: 'Arial',
                        size: 20,
                    }),
                    new TextRun({
                        children: [PageNumber.TOTAL_PAGES],
                        bold: true,
                        color: '#000000',
                        font: 'Arial',
                        size: 20,
                    }),
                ],
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    new TextRun({
                        text: 'MUNICIPALIDAD PROVINCIAL DE UCAYALI',
                        bold: true,
                        color: '#000000',
                        font: 'Arial',
                        size: 20,
                    }),
                ],
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    new TextRun({
                        text: 'CENTRO POBLADO DE CONTAMANA',
                        color: '#000000',
                        font: 'Arial',
                        size: 18,
                    }),
                ],
            }),
        ],
    });

    // Página de portada
    const coverPage = [
        new Paragraph({
            children: [
                new TextRun({
                    text: `ESPECIFICACIONES TECNICAS-${nombreArchivoBase.toUpperCase()}`,
                    bold: true,
                    size: 44,
                    font: 'Arial',
                    color: '#000000',
                    underline: { type: UnderlineType.SINGLE },
                }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
        }),
        new Paragraph({
            text: '',
            border: {
                bottom: {
                    color: '#000000',
                    space: 1,
                    style: BorderStyle.SINGLE,
                    size: 1,
                },
            },
            spacing: { after: 400 },
        }),
        new Paragraph({
            children: [
                new TextRun({
                    text: 'PROYECTO:',
                    bold: true,
                    font: 'Arial',
                    size: 28,
                    color: '#000000',
                }),
                new TextRun({ text: '\t', font: 'Arial', size: 28 }),
                new TextRun({
                    text: 'MEJORAMIENTO DE LOS SERVICIOS DE EDUCACION INICIAL DE LA IEI N°558 CIUDAD DE CONTAMANA DEL DISTRITO DE CONTAMANA-PROVINCIA DE UCAYALI - DEPARTAMENTO DE LORETO',
                    font: 'Arial',
                    size: 28,
                    color: '#000000',
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
                                crearParrafoDetalle(
                                    'CÓDIGO UNIFICADO:',
                                    '2484411',
                                ),
                                crearParrafoDetalle(
                                    'CÓDIGO MODULAR:',
                                    '0561216',
                                ),
                                crearParrafoDetalle('I.E.I. N°:', '558'),
                                crearParrafoDetalle('CÓDIGO LOCAL:', '390867'),
                                crearParrafoDetalle('DEPARTAMENTO:', 'LORETO'),
                                crearParrafoDetalle('PROVINCIA:', 'UCAYALI'),
                                crearParrafoDetalle('DISTRITO:', 'CONTAMANA'),
                                crearParrafoDetalle('C.P.:', 'CONTAMANA'),
                            ],
                            borders: sinBordes(),
                        }),
                        new TableCell({
                            width: { size: 40, type: WidthType.PERCENTAGE },
                            verticalAlign: VerticalAlign.CENTER,
                            children: principalImageRun
                                ? [
                                      new Paragraph({
                                          alignment: AlignmentType.CENTER,
                                          children: [principalImageRun],
                                      }),
                                  ]
                                : [new Paragraph({ text: '' })],
                            borders: sinBordes(),
                        }),
                    ],
                }),
            ],
        }),
    ];

    // Tabla de contenido con numeración manual basada en bookmarks
    const { sections: contentSections, tocEntries } = await generateSectionsForWord(
        datosFiltrados,
        nombreArchivoBase,
    );

    const tableOfContents: any[] = [
        new Paragraph({
            children: [
                new TextRun({
                    text: 'ÍNDICE',
                    bold: true,
                    font: 'Arial',
                    size: 24,
                    color: '#000000',
                }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
        }),
        ...tocEntries.map((entry) =>
            new Paragraph({
                children: [
                    new TextRun({
                        text: entry.text,
                        font: 'Arial',
                        size: 24,
                        color: '#000000',
                    }),
                    new TextRun({ text: '\t' }),
                    new PageReference(entry.bookmarkId),
                ],
                tabStops: [
                    {
                        type: TabStopType.RIGHT,
                        position: TabStopPosition.MAX,
                    },
                ],
                spacing: { after: 150, line: 360 },
                indent: {
                    left: (entry.level - 1) * 360,
                    firstLine: 0,
                },
            }),
        ),
    ];


    const documentSections = [
        {
            properties: { type: SectionType.NEXT_PAGE },
            headers: { default: header },
            footers: { default: footer },
            children: coverPage,
        },
        {
            properties: { type: SectionType.NEXT_PAGE },
            headers: { default: header },
            footers: { default: footer },
            children: tableOfContents,
        },
        {
            properties: { type: SectionType.NEXT_PAGE },
            headers: { default: header },
            footers: { default: footer },
            children: contentSections,
        },
    ];

    const doc = new Document({
        features: {
            updateFields: true,
        },
        styles: {
            default: {
                document: {
                    run: { font: 'Arial', color: '#000000', size: 24 },
                    paragraph: { spacing: { line: 276 } },
                },
            },
            paragraphStyles: [
                {
                    id: 'Heading1',
                    name: 'Heading 1',
                    run: {
                        font: 'Arial',
                        size: 36,
                        bold: true,
                        color: '#000000',
                    },
                    paragraph: { spacing: { before: 240, after: 120 } },
                },
                {
                    id: 'Heading2',
                    name: 'Heading 2',
                    run: {
                        font: 'Arial',
                        size: 30,
                        bold: true,
                        color: '#000000',
                    },
                    paragraph: { spacing: { before: 240, after: 120 } },
                },
                {
                    id: 'Heading3',
                    name: 'Heading 3',
                    run: {
                        font: 'Arial',
                        size: 26,
                        bold: true,
                        color: '#000000',
                    },
                    paragraph: { spacing: { before: 240, after: 120 } },
                },
            ],
        },
        sections: documentSections,
    });

    try {
        const blob = await Packer.toBlob(doc);
        const safeName = nombreArchivoBase.replace(/[^a-z0-9]/gi, '_');
        saveAs(blob, `especificaciones_tecnicas_${safeName}.docx`);
        showNotification?.(
            'success',
            `Documento para ${nombreArchivoBase} generado con éxito`,
        );
    } catch (error) {
        console.error('Error al generar el documento:', error);
        showNotification?.('error', 'Error al generar el documento Word');
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
    showNotification,
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
        gas: 'INSTALACIONES DE GAS',
    };

    const handleGenerateWord = async () => {
        const data = getData();

        console.log('Datos en modal (primer nivel):', data);

        const selectedSecciones = Object.entries(selectedSections)
            .filter(([_, value]) => value)
            .map(([key]) => sectionLabels[key]);

        if (selectedSecciones.length === 0) {
            showNotification?.(
                'error',
                'Debe seleccionar al menos una sección',
            );
            return;
        }

        if (!data || data.length === 0) {
            showNotification?.(
                'warning',
                'No hay datos para generar el documento',
            );
            return;
        }

        setGeneratingWord(true);
        onGenerateStart?.();

        try {
            for (const seccion of selectedSecciones) {
                const datosFiltrados = filterTreeData(data, seccion);
                if (datosFiltrados.length > 0) {
                    await generarWordParaSeccion(
                        datosFiltrados,
                        seccion,
                        showNotification,
                        proyecto,
                    );
                } else {
                    showNotification?.(
                        'warning',
                        `No se encontraron datos para la sección ${seccion}`,
                    );
                }
            }
            onClose();
        } catch (error) {
            console.error('Error generando documentos:', error);
            showNotification?.('error', 'Error al generar los documentos');
        } finally {
            setGeneratingWord(false);
            onGenerateEnd?.();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-colors duration-200 dark:bg-black/70">
            <div
                className="mx-4 w-full max-w-md rounded-lg bg-white shadow-xl transition-colors duration-200 dark:bg-gray-800"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="rounded-t-lg border-b border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-600 dark:bg-gray-700/50">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                        Generar Documento Word
                    </h2>
                </div>

                <div className="max-h-[60vh] space-y-4 overflow-y-auto p-6">
                    <div>
                        <p className="mb-2 text-sm text-gray-600 dark:text-gray-300">
                            Seleccione las secciones a incluir:
                        </p>
                        <div className="space-y-2">
                            {Object.entries(selectedSections).map(
                                ([key, value]) => (
                                    <label
                                        key={key}
                                        className="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={value}
                                            onChange={(e) =>
                                                setSelectedSections((prev) => ({
                                                    ...prev,
                                                    [key]: e.target.checked,
                                                }))
                                            }
                                            className="h-4 w-4 rounded border-gray-300 bg-white text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-blue-500 dark:focus:ring-blue-400"
                                        />
                                        <span className="text-sm text-gray-700 capitalize dark:text-gray-200">
                                            {key}
                                        </span>
                                    </label>
                                ),
                            )}
                        </div>
                    </div>

                    <div className="border-t border-gray-200 pt-3 dark:border-gray-600">
                        <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                            Imágenes para el documento:
                        </p>
                        {proyecto?.plantilla_logo_izq_url ||
                        proyecto?.plantilla_logo_der_url ||
                        proyecto?.portada_logo_center_url ||
                        proyecto?.plantilla_firma_url ? (
                            <p className="mb-2 rounded-md bg-green-50 p-2 text-xs text-green-600 dark:bg-green-900/20 dark:text-green-400">
                                ✅ Se usarán las imágenes configuradas en el
                                proyecto. Suba archivos solo si desea
                                sobreescribirlas.
                            </p>
                        ) : null}

                        <div className="space-y-3">
                            <div>
                                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                                    Logo izquierdo (header)
                                    {proyecto?.plantilla_logo_izq_url && (
                                        <span className="ml-1 text-green-600 dark:text-green-400">
                                            ✅ Configurado
                                        </span>
                                    )}
                                </label>
                                <input
                                    type="file"
                                    id="logoFile"
                                    accept="image/*"
                                    className="w-full rounded-md border border-gray-300 bg-white p-1.5 text-sm text-gray-900 file:mr-2 file:rounded-md file:border-0 file:bg-gray-50 file:px-3 file:py-1 file:text-sm file:text-gray-700 hover:file:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:file:bg-gray-600 dark:file:text-gray-200 dark:hover:file:bg-gray-500 dark:focus:ring-blue-400"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                                    Logo derecho / Escudo (header)
                                    {proyecto?.plantilla_logo_der_url && (
                                        <span className="ml-1 text-green-600 dark:text-green-400">
                                            ✅ Configurado
                                        </span>
                                    )}
                                </label>
                                <input
                                    type="file"
                                    id="escudoFile"
                                    accept="image/*"
                                    className="w-full rounded-md border border-gray-300 bg-white p-1.5 text-sm text-gray-900 file:mr-2 file:rounded-md file:border-0 file:bg-gray-50 file:px-3 file:py-1 file:text-sm file:text-gray-700 hover:file:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:file:bg-gray-600 dark:file:text-gray-200 dark:hover:file:bg-gray-500 dark:focus:ring-blue-400"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                                    Imagen principal (portada)
                                    {proyecto?.portada_logo_center_url && (
                                        <span className="ml-1 text-green-600 dark:text-green-400">
                                            ✅ Configurado
                                        </span>
                                    )}
                                </label>
                                <input
                                    type="file"
                                    id="logoPrinFile"
                                    accept="image/*"
                                    className="w-full rounded-md border border-gray-300 bg-white p-1.5 text-sm text-gray-900 file:mr-2 file:rounded-md file:border-0 file:bg-gray-50 file:px-3 file:py-1 file:text-sm file:text-gray-700 hover:file:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:file:bg-gray-600 dark:file:text-gray-200 dark:hover:file:bg-gray-500 dark:focus:ring-blue-400"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                                    Firma (footer)
                                    {proyecto?.plantilla_firma_url && (
                                        <span className="ml-1 text-green-600 dark:text-green-400">
                                            ✅ Configurado
                                        </span>
                                    )}
                                </label>
                                <input
                                    type="file"
                                    id="firmaFile"
                                    accept="image/*"
                                    className="w-full rounded-md border border-gray-300 bg-white p-1.5 text-sm text-gray-900 file:mr-2 file:rounded-md file:border-0 file:bg-gray-50 file:px-3 file:py-1 file:text-sm file:text-gray-700 hover:file:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:file:bg-gray-600 dark:file:text-gray-200 dark:hover:file:bg-gray-500 dark:focus:ring-blue-400"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 rounded-b-lg border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-600 dark:bg-gray-700/50">
                    <button
                        onClick={onClose}
                        disabled={generatingWord}
                        className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-600 dark:hover:text-gray-100"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleGenerateWord}
                        disabled={generatingWord}
                        className={`rounded-md px-4 py-2 text-sm font-medium shadow-sm transition-all duration-150 ${
                            generatingWord
                                ? 'cursor-not-allowed bg-gray-400 text-white opacity-50 dark:bg-gray-600 dark:text-gray-200'
                                : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md dark:bg-blue-500 dark:hover:bg-blue-600'
                        }`}
                    >
                        {generatingWord ? (
                            <span className="flex items-center gap-2">
                                <svg
                                    className="h-4 w-4 animate-spin text-white"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    ></circle>
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    ></path>
                                </svg>
                                Generando...
                            </span>
                        ) : (
                            'Generar'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WordExportModal;
