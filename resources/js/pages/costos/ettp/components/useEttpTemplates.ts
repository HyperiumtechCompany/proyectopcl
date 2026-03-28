import { useRef, useEffect } from 'react';
import { CAMPOS_EXCLUIDOS_TEMPLATE, FIELD_MAPPING } from './types';
import type { Section } from './types';

/**
 * Hook para cargar y buscar templates desde el JSON local.
 * Usa useRef para evitar closure stale en callbacks de Tabulator.
 */
export function useEttpTemplates() {
    const templatesRef = useRef<any[]>([]);
    const loadedRef = useRef(false);

    useEffect(() => {
        if (loadedRef.current) return;

        import('./data/descriptivos-templates.json')
            .then(module => {
                const data = module.default || module;
                console.log(`[Templates] Cargados: ${data.length} registros`);
                templatesRef.current = data;
                loadedRef.current = true;
            })
            .catch(err => console.error('[Templates] Error cargando:', err));
    }, []);

    /**
     * Búsqueda recursiva en el árbol de templates.
     * Estrategia: exacta por código → parcial como fallback.
     */
    const buscarTemplate = (codigoABuscar: string): any => {
        if (!templatesRef.current?.length) return null;

        const codigoNorm = codigoABuscar.toString().trim().toLowerCase();

        const buscarEnNivel = (items: any[]): any => {
            if (!items?.length) return null;

            // 1. Búsqueda exacta
            for (const item of items) {
                const codigoItem = item.codigo?.toString().trim().toLowerCase();
                const codigoCompleto = item.codigo_completo?.toString().trim().toLowerCase();

                if (codigoItem === codigoNorm || codigoCompleto === codigoNorm) {
                    return item;
                }

                if (item.subpartidas?.length) {
                    const encontrado = buscarEnNivel(item.subpartidas);
                    if (encontrado) return encontrado;
                }
            }

            // 2. Búsqueda parcial
            for (const item of items) {
                const codigoItem = item.codigo?.toString().trim().toLowerCase();
                const codigoCompleto = item.codigo_completo?.toString().trim().toLowerCase();

                if (codigoItem?.includes(codigoNorm) || codigoCompleto?.includes(codigoNorm)) {
                    return item;
                }

                if (item.subpartidas?.length) {
                    const encontrado = buscarEnNivel(item.subpartidas);
                    if (encontrado) return encontrado;
                }
            }

            return null;
        };

        let resultado = buscarEnNivel(templatesRef.current);

        // Intentar solo parte numérica si tiene espacios
        if (!resultado && codigoABuscar.includes(' ')) {
            const codigoNumerico = codigoABuscar.split(' ')[0];
            resultado = buscarEnNivel([{ codigo: codigoNumerico }]);
        }

        return resultado;
    };

    /**
     * Extrae detallesTecnicos del template encontrado (sin campos de metadata).
     */
    const extraerDetalles = (template: any): Record<string, any> => {
        const detalles: Record<string, any> = {};
        Object.keys(template).forEach(campo => {
            if (!CAMPOS_EXCLUIDOS_TEMPLATE.includes(campo)) {
                detalles[campo] = template[campo];
            }
        });
        return detalles;
    };

    /**
     * Convierte detallesTecnicos en array de secciones editables.
     */
    const buildSections = (detallesTecnicos: Record<string, any>): Section[] => {
        if (!detallesTecnicos || Object.keys(detallesTecnicos).length === 0) {
            return [
                { title: 'Descripción', content: '' },
                { title: 'Materiales y Herramientas', content: '' },
                { title: 'Método de Ejecución', content: '' },
                { title: 'Método de Medición', content: '' },
                { title: 'Condiciones de Pago', content: '' },
            ];
        }

        const sections: Section[] = [];

        // Campos mapeados primero
        for (const { jsonKey, title } of FIELD_MAPPING) {
            if (detallesTecnicos[jsonKey]) {
                sections.push({ title, content: detallesTecnicos[jsonKey] });
            }
        }

        // Otros campos no mapeados
        Object.entries(detallesTecnicos).forEach(([key, value]) => {
            const isMapped = FIELD_MAPPING.some(m => m.jsonKey === key);
            if (!isMapped && value && typeof value === 'string') {
                sections.push({
                    title: key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                    content: value,
                });
            }
        });

        return sections;
    };

    return {
        templatesRef,
        buscarTemplate,
        extraerDetalles,
        buildSections,
        isLoaded: () => loadedRef.current,
        templatesCount: () => templatesRef.current.length,
    };
}
