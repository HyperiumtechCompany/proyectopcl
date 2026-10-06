<?php

namespace App\Http\Requests\ValorizacionV2;

/**
 * Reglas del documento `datos` de una valorización v2 (crear y guardar).
 *
 * IMPORTANTE: Laravel excluye de validated() las claves de un array que tiene
 * reglas anidadas pero que no tienen regla propia. Toda sección de
 * ValorizacionInput (types/valorizacion.ts) DEBE figurar aquí o se pierde en
 * silencio al guardar (pasó con calendarios y metrados: la Curva S volvía a 0
 * al recargar). Las secciones sin reglas anidadas se conservan completas.
 */
trait ReglasDatosValorizacion
{
    /**
     * @return array<string, array<int, string>>
     */
    protected function reglasDatos(): array
    {
        return [
            'datos' => ['required', 'array'],
            'datos.periodo' => ['required', 'array'],
            'datos.periodo.numero' => ['required', 'integer', 'min:1'],
            'datos.periodo.mes' => ['required', 'date_format:Y-m-d'],
            'datos.fichaTecnica' => ['required', 'array'],
            'datos.parametros' => ['required', 'array'],
            'datos.presupuesto' => ['required', 'array'],
            'datos.presupuesto.fuente' => ['sometimes', 'string', 'max:50'],
            'datos.presupuesto.partidas' => ['present', 'array'],
            'datos.calendarios' => ['sometimes', 'array'],
            'datos.metrados' => ['sometimes', 'array'],
            'datos.control' => ['sometimes', 'array'],
            'datos.pagos' => ['sometimes', 'array'],
            'datos.personal' => ['sometimes', 'array'],
        ];
    }
}
