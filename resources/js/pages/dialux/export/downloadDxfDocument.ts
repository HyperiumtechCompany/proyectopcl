/**
 * Descarga de archivo DXF vía Blob + object URL (Fase 9, sección 15:
 * "conservar nombre de archivo seguro" + "descarga y liberación del object
 * URL"). Función pura sin React, para poder probarla sin necesitar un DOM
 * completo — el entorno de test de este proyecto corre en Node, no jsdom.
 */

/** Nombre de archivo ASCII seguro a partir del nombre del proyecto. Nunca vacío. */
export function buildSafeDxfFilename(projectName: string): string {
    const safe = (projectName || 'plano').replace(/[^a-zA-Z0-9_\-]/g, '_');
    return `${safe}_planos_electricos.dxf`;
}

/** Crea el Blob, dispara la descarga vía un `<a download>` temporal y libera el object URL. */
export function downloadDxfDocument(dxfText: string, filename: string): void {
    const blob = new Blob([dxfText], { type: 'application/dxf;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
