<?php

namespace App\Http\Controllers;

use App\Models\PresupuestoProyecto;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PresupuestoProyectoController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $presupuesto = PresupuestoProyecto::latest()->first();

        return Inertia::render('PresupuestoProyecto/Index', [
            'presupuesto' => $presupuesto
        ]);
    }
    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        //
    }

    /**
     * Display the specified resource.
     */
    public function show(PresupuestoProyecto $presupuestoProyecto)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(PresupuestoProyecto $presupuestoProyecto)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, PresupuestoProyecto $presupuestoProyecto)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(PresupuestoProyecto $presupuestoProyecto)
    {
        //
    }
}
