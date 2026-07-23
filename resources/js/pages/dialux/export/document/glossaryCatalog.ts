import type { GlossaryEntry } from '../domain/types';

/**
 * Catálogo propio de términos del informe luminotécnico. Redactado para
 * este sistema — no es una transcripción del glosario de ningún software de
 * terceros (ver Riesgo 6 del plan maestro de réplica: no imitar marcas ni
 * presentar contenido ajeno como propio).
 *
 * Cada entrada declara cuándo corresponde incluirla: algunas aparecen en
 * cualquier informe (una tabla de resultados siempre muestra Ē/UGR/Uo), y
 * otras solo si el dato realmente existe en este proyecto (ver `isUsed`).
 */
export interface GlossaryUsageContext {
    hasCct: boolean;
    hasCri: boolean;
    hasIsolux: boolean;
    hasMultipleLevels: boolean;
}

interface GlossaryCatalogEntry {
    term: string;
    abbreviation?: string;
    definition: string;
    isUsed: (context: GlossaryUsageContext) => boolean;
}

const GLOSSARY_CATALOG: GlossaryCatalogEntry[] = [
    {
        term: 'Ambiente',
        definition:
            'Espacio interior con una función definida (aula, pasillo, servicio higiénico, etc.) sobre el cual se calculan y verifican los niveles de iluminación.',
        isUsed: () => true,
    },
    {
        term: 'CCT',
        abbreviation: 'CCT',
        definition:
            'Temperatura de color correlacionada, expresada en Kelvin. Describe si la luz emitida por una luminaria se percibe cálida, neutra o fría.',
        isUsed: (ctx) => ctx.hasCct,
    },
    {
        term: 'CRI / Ra',
        abbreviation: 'CRI',
        definition:
            'Índice de reproducción cromática. Mide qué tan fielmente una fuente de luz reproduce los colores reales de los objetos, comparado con una fuente de referencia.',
        isUsed: (ctx) => ctx.hasCri,
    },
    {
        term: 'Escala gráfica',
        definition:
            'Referencia visual incluida en los planos que permite estimar distancias reales directamente sobre el dibujo, sin depender de la escala numérica impresa.',
        isUsed: () => true,
    },
    {
        term: 'Factor de mantenimiento',
        definition:
            'Coeficiente que anticipa la pérdida de rendimiento lumínico de una instalación a lo largo del tiempo (suciedad, envejecimiento de lámparas, del local, etc.), usado para no subdimensionar la iluminación inicial.',
        isUsed: () => true,
    },
    {
        term: 'Flujo luminoso',
        abbreviation: 'Φ, lm',
        definition:
            'Cantidad total de luz emitida por una fuente en todas direcciones, medida en lúmenes. Es el dato base para estimar cuántas luminarias se necesitan para alcanzar la iluminancia objetivo.',
        isUsed: () => true,
    },
    {
        term: 'Iluminancia media',
        abbreviation: 'Ē, Em',
        definition:
            'Promedio de los valores de iluminancia (lux) calculados sobre el plano útil de un ambiente. Es el principal indicador de si un espacio recibe la cantidad de luz requerida por su actividad.',
        isUsed: () => true,
    },
    {
        term: 'Iluminancia mínima y máxima',
        abbreviation: 'Emin / Emax',
        definition:
            'Valores extremos calculados dentro de la grilla del plano útil. Identifican los puntos más oscuros y más iluminados de un ambiente.',
        isUsed: () => true,
    },
    {
        term: 'Isolux',
        definition:
            'Mapa de colores que representa gráficamente cómo se distribuye la iluminancia sobre un plano, agrupando zonas de nivel de lux similar.',
        isUsed: (ctx) => ctx.hasIsolux,
    },
    {
        term: 'Luminaria',
        definition:
            'Aparato de iluminación completo (cuerpo, óptica y fuente de luz) instalado en un ambiente. Se identifica por fabricante, modelo y número de artículo.',
        isUsed: () => true,
    },
    {
        term: 'Nivel',
        definition:
            'Cada piso o planta del proyecto (planta baja, primer nivel, etc.), agrupando los ambientes que lo componen.',
        isUsed: (ctx) => ctx.hasMultipleLevels,
    },
    {
        term: 'Plano útil',
        definition:
            'Superficie horizontal imaginaria, normalmente entre 0.75 m y 0.85 m sobre el piso, sobre la cual se evalúa si la iluminación cumple lo requerido para la actividad prevista.',
        isUsed: () => true,
    },
    {
        term: 'Potencia',
        abbreviation: 'P, W',
        definition:
            'Energía eléctrica consumida por una luminaria, medida en vatios. Junto al flujo luminoso permite calcular el rendimiento lumínico.',
        isUsed: () => true,
    },
    {
        term: 'Recinto',
        definition:
            'Envolvente física (módulo, edificación) que agrupa uno o varios ambientes dentro de un mismo nivel.',
        isUsed: () => true,
    },
    {
        term: 'Rendimiento lumínico',
        abbreviation: 'lm/W',
        definition:
            'Relación entre el flujo luminoso emitido y la potencia consumida por una luminaria. A mayor valor, mayor eficiencia energética.',
        isUsed: () => true,
    },
    {
        term: 'UGR',
        abbreviation: 'UGR',
        definition:
            'Unified Glare Rating: índice que estima la probabilidad de deslumbramiento molesto percibido por una persona en el ambiente. Valores menores indican menor riesgo de deslumbramiento.',
        isUsed: () => true,
    },
    {
        term: 'Uniformidad',
        abbreviation: 'Uo, g1',
        definition:
            'Relación entre la iluminancia mínima y la media (o máxima) de un plano útil. Indica si la luz se reparte de forma pareja o si existen zonas con caídas bruscas de iluminación.',
        isUsed: () => true,
    },
    {
        term: 'Zona marginal',
        definition:
            'Franja perimetral de un ambiente, medida desde sus límites físicos, que se excluye del plano útil por no ser representativa de las condiciones de iluminación del espacio de trabajo.',
        isUsed: () => true,
    },
];

/** Selecciona, ordena (reglas de idioma español) y agrupa por letra los términos que este informe realmente usa. */
export function selectGlossaryEntries(
    context: GlossaryUsageContext,
): GlossaryEntry[] {
    return GLOSSARY_CATALOG.filter((entry) => entry.isUsed(context))
        .sort((left, right) => left.term.localeCompare(right.term, 'es'))
        .map((entry) => ({
            letter: entry.term.charAt(0).toLocaleUpperCase('es'),
            term: entry.term,
            definition: entry.definition,
            abbreviation: entry.abbreviation ?? null,
        }));
}
