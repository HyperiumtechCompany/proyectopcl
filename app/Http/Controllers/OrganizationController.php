<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreOrganizationRequest;
use App\Http\Requests\UpdateOrganizationRequest;
use App\Models\Organization;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class OrganizationController extends Controller
{
    public function index(): Response
    {
        $organizations = Organization::withCount('users')
            ->orderBy('nombre')
            ->get();

        return Inertia::render('organizations/Index', [
            'organizations' => $organizations,
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('organizations/Create');
    }

    public function store(StoreOrganizationRequest $request): RedirectResponse
    {
        $organization = Organization::create($request->validated());

        return redirect()->route('organizations.index')
            ->with('success', "Organización '{$organization->nombre}' creada exitosamente.");
    }

    public function edit(Organization $organization): Response
    {
        $organization->loadCount('users');

        return Inertia::render('organizations/Edit', [
            'organization' => $organization,
        ]);
    }

    public function update(UpdateOrganizationRequest $request, Organization $organization): RedirectResponse
    {
        $organization->update($request->validated());

        return redirect()->route('organizations.index')
            ->with('success', "Organización '{$organization->nombre}' actualizada exitosamente.");
    }

    public function destroy(Organization $organization): RedirectResponse
    {
        if ($organization->users()->exists()) {
            return back()->with('error', 'No puedes eliminar una organización que todavía tiene miembros asignados.');
        }

        $organization->delete();

        return redirect()->route('organizations.index')
            ->with('success', 'Organización eliminada correctamente.');
    }
}
