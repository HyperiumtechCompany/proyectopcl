<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Límites de proyectos por plan
    |--------------------------------------------------------------------------
    |
    | 'costos', 'dialux' y 'gestor_proyectos' tienen su propio cupo; cualquier
    | otro módulo (agua, caida_tension, ac, pararrayos, desague) cae en 'resto'.
    | 'free' no usa números: solo permite un proyecto demo por módulo grande,
    | con vencimiento a los 'demo_days' días. Si un plan no trae la clave
    | 'resto', ese módulo queda sin límite para ese plan (así se define
    | "ilimitado" en 'negocios'/'empresarial').
    |
    | 'negocios' y 'empresarial' son planes de Organización (cuenta de
    | equipo): el cupo se cuenta sobre todos los miembros de la organización,
    | no por usuario — ver App\Services\ProjectQuotaService::ownerIdsFor().
    |
    */

    'free' => [
        'demo' => true,
        'demo_days' => 5,
    ],

    'mensual' => [
        'costos' => 10,
        'dialux' => 10,
        'gestor_proyectos' => 10,
        'resto' => 50,
    ],

    'anual' => [
        'costos' => 10,
        'dialux' => 10,
        'gestor_proyectos' => 10,
        'resto' => 50,
    ],

    'lifetime' => [
        'costos' => 10,
        'dialux' => 10,
        'gestor_proyectos' => 10,
        'resto' => 50,
    ],

    'negocios' => [
        'costos' => 5,
        'dialux' => 5,
        'gestor_proyectos' => 5,
    ],

    'empresarial' => [
        'costos' => 10,
        'dialux' => 10,
        'gestor_proyectos' => 10,
    ],

];
