<?php

namespace App\Domain\Mantenimiento\Wbs;

class PartidaClassifier
{
    /**
     * Clasifica una fila de `presupuesto_general` dentro del árbol de Mantenimiento.
     *
     * - `ie`     : encabezado de Institución Educativa (descripción "INSTITUCIÓN EDUCATIVA …").
     * - `bloque` : título/partida padre con descendientes; se pinta naranja y solo acumula.
     * - `partida`: partida hoja con seguimiento de ejecución.
     */
    public function classify(array $partida, bool $hasChildren): string
    {
        $descripcion = (string) ($partida['descripcion'] ?? '');

        if (preg_match('/instituc\w*\s+educativ/iu', $descripcion) === 1) {
            return 'ie';
        }

        return $hasChildren ? 'bloque' : 'partida';
    }
}
