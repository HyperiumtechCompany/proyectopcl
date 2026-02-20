<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Role;

class UserController extends Controller
{
    public function index(Request $request): Response
    {
        $query = User::with('roles')
            ->when(
                $request->search,
                fn($q, $search) =>
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
            )
            ->when(
                $request->role,
                fn($q, $role) =>
                $q->whereHas('roles', fn($r) => $r->where('name', $role))
            )
            ->when(
                $request->plan,
                fn($q, $plan) =>
                $q->where('plan', $plan)
            )
            ->when(
                $request->status,
                fn($q, $status) =>
                $q->where('status', $status)
            )
            ->latest();

        $users = $query->paginate(15)->withQueryString();

        return Inertia::render('users/Index', [
            'users'   => $users,
            'roles'   => Role::orderBy('name')->get(['id', 'name']),
            'filters' => $request->only(['search', 'role', 'plan', 'status']),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('users/Create', [
            'roles' => Role::orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function store(StoreUserRequest $request): RedirectResponse
    {
        $data = $request->validated();

        // Handle avatar upload
        if ($request->hasFile('avatar')) {
            $data['avatar'] = $request->file('avatar')->store('avatars', 'public');
        }

        $data['password'] = Hash::make($data['password']);

        // Set plan expiration
        $data['plan_expires_at'] = $this->resolvePlanExpiration($data['plan']);

        $roleId = $data['role_id'] ?? null;
        unset($data['role_id'], $data['password_confirmation']);

        $user = User::create($data);

        if ($roleId) {
            $role = Role::findById($roleId);
            $user->syncRoles([$role->name]);
        }

        return redirect()->route('users.index')
            ->with('success', "Usuario '{$user->name}' creado exitosamente.");
    }

    public function show(User $user): Response
    {
        $user->load('roles', 'permissions');

        return Inertia::render('users/Show', [
            'user' => $user->append(['roles_list']),
        ]);
    }

    public function edit(User $user): Response
    {
        $user->load('roles');

        return Inertia::render('users/Edit', [
            'user'  => $user->append(['roles_list']),
            'roles' => Role::orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function update(UpdateUserRequest $request, User $user): RedirectResponse
    {
        $data = $request->validated();

        // Handle avatar upload
        if ($request->hasFile('avatar')) {
            // Delete old avatar
            if ($user->avatar) {
                Storage::disk('public')->delete($user->avatar);
            }
            $data['avatar'] = $request->file('avatar')->store('avatars', 'public');
        }

        // Update password only if provided
        if (!empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        // Update plan expiration if plan changed
        if (isset($data['plan']) && $data['plan'] !== $user->plan) {
            $data['plan_expires_at'] = $this->resolvePlanExpiration($data['plan']);
        }

        $roleId = $data['role_id'] ?? null;
        unset($data['role_id'], $data['password_confirmation']);

        $user->update($data);

        if ($roleId) {
            $role = Role::findById($roleId);
            $user->syncRoles([$role->name]);
        }

        return redirect()->route('users.index')
            ->with('success', "Usuario '{$user->name}' actualizado exitosamente.");
    }

    public function destroy(User $user): RedirectResponse
    {
        // Prevent self-deletion
        if ($user->id === auth()->id()) {
            return back()->with('error', 'No puedes eliminar tu propia cuenta.');
        }

        // Prevent deletion of root users
        if ($user->hasRole('root')) {
            return back()->with('error', 'No se puede eliminar un usuario con rol root.');
        }

        if ($user->avatar) {
            Storage::disk('public')->delete($user->avatar);
        }

        $user->delete();

        return redirect()->route('users.index')
            ->with('success', "Usuario eliminado correctamente.");
    }

    /**
     * Resolve plan expiration date based on plan type.
     */
    private function resolvePlanExpiration(string $plan): ?\Carbon\Carbon
    {
        return match ($plan) {
            'free'     => now()->addDays(5),
            'mensual'  => now()->addDays(30),
            'anual'    => now()->addDays(365),
            'lifetime' => null,
            default    => null,
        };
    }
}
