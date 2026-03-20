<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class MetradosController extends Controller
{
    /**
     * Muestra la página principal de metrados con accesos a cada disciplina.
     */
    public function index(): Response
    {
        return Inertia::render('costos/metrados/Index');
    }

    public function indexComunicacion(): Response
    {
        return Inertia::render('costos/metrados/Comunicacion/Index');
    }

    public function indexElectricas(): Response
    {
        return Inertia::render('costos/metrados/metrado_electricas/index');
    }

}

