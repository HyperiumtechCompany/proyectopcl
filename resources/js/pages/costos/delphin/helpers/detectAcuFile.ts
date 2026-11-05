export type AcuFileKind = 'pdf' | 'excel';

export async function detectAcuFileKind(file: File): Promise<AcuFileKind> {
    if (file.size === 0)
        throw new Error(
            'El archivo está vacío. Selecciona el PDF o Excel original.',
        );
    const header = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
    // El contenido manda: Windows puede entregar un archivo sin extensión ni MIME.
    if (new TextDecoder('latin1').decode(header).includes('%PDF-'))
        return 'pdf';
    const name = file.name.toLowerCase();
    if (
        name.endsWith('.pdf') ||
        file.type.toLowerCase() === 'application/pdf'
    ) {
        throw new Error(
            'El archivo indica que es PDF, pero su contenido no tiene un encabezado PDF válido.',
        );
    }
    const ole = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    const isOle = ole.every((byte, index) => header[index] === byte);
    const isZip =
        header[0] === 0x50 &&
        header[1] === 0x4b &&
        header[2] === 0x03 &&
        header[3] === 0x04;
    if (
        isOle ||
        isZip ||
        /\.xlsx?$/.test(name) ||
        [
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ].includes(file.type.toLowerCase())
    )
        return 'excel';
    throw new Error(
        'No se reconoce el formato. Selecciona un reporte Excel o un PDF de ACU válido.',
    );
}

export function requireAcuRecords<T>(result: {
    acus: T[];
    warnings: string[];
}): void {
    if (result.acus.length === 0) {
        throw new Error(
            result.warnings.join(' ') ||
                'No se encontraron ACU en el archivo. Verifica que sea el reporte de análisis de costos unitarios.',
        );
    }
}
