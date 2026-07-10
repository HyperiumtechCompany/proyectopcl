<?php

namespace App\Http\Controllers;

use App\Http\Requests\StorePlanRequestRequest;
use App\Mail\AccountCredentialsMail;
use App\Mail\PlanRequestReceived;
use App\Models\PlanRequest;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class PlanRequestController extends Controller
{
    /**
     * Recibe una solicitud de plan desde la landing pública. No requiere autenticación.
     */
    public function store(StorePlanRequestRequest $request): RedirectResponse
    {
        $data = $request->validated();

        if ($request->hasFile('comprobante')) {
            $data['comprobante_path'] = $request->file('comprobante')->store('comprobantes', 'public');
        }

        $planRequest = PlanRequest::create($data);

        Mail::to(env('ADMIN_NOTIFICATION_EMAIL', 'programdesing.rizabalasociados@gmail.com'))
            ->send(new PlanRequestReceived($planRequest));

        $message = $planRequest->isBusiness()
            ? 'Tu solicitud fue enviada. Nos pondremos en contacto para coordinar tu plan empresarial.'
            : 'Tu solicitud fue enviada. Te contactaremos pronto con tus datos de acceso.';

        return back()->with('success', $message);
    }

    public function index(Request $request): Response
    {
        $planRequests = PlanRequest::when(
            $request->status,
            fn ($q, $status) => $q->where('status', $status)
        )
            ->latest()
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('plan-requests/Index', [
            'planRequests' => $planRequests,
            'filters' => $request->only(['status']),
        ]);
    }

    public function approve(PlanRequest $planRequest): RedirectResponse
    {
        if ($planRequest->status !== 'pending') {
            return back()->with('error', 'Esta solicitud ya fue procesada.');
        }

        // Los planes de organización no se autoaprovisionan: requieren crear una
        // Organization (nombre, plan) y luego asignarle el usuario manualmente
        // desde /organizations y /users — aprobar aquí solo marca que ya se
        // atendió el contacto.
        if ($planRequest->isBusiness()) {
            $planRequest->update(['status' => 'approved']);

            return back()->with('success', 'Solicitud marcada como atendida. Crea la organización y el usuario desde el panel.');
        }

        $plainPassword = Str::password(16);

        $user = User::create([
            'name' => $planRequest->nombre,
            'email' => $planRequest->email,
            'password' => Hash::make($plainPassword),
            'plan' => $planRequest->plan,
            'plan_expires_at' => User::resolvePlanExpiration($planRequest->plan),
            'status' => 'active',
        ]);

        $user->syncRoles(['clientes']);

        $planRequest->update([
            'status' => 'approved',
            'user_id' => $user->id,
        ]);

        Mail::to($user->email)->send(new AccountCredentialsMail($user, $plainPassword));

        return back()->with('success', "Cuenta creada para {$user->email}. Se enviaron las credenciales por correo.");
    }

    public function reject(Request $request, PlanRequest $planRequest): RedirectResponse
    {
        if ($planRequest->status !== 'pending') {
            return back()->with('error', 'Esta solicitud ya fue procesada.');
        }

        $planRequest->update([
            'status' => 'rejected',
            'notas_admin' => $request->input('notas_admin'),
        ]);

        return back()->with('success', 'Solicitud rechazada.');
    }
}
