<?php

namespace App\Http\Controllers;

use App\Http\Requests\Costos\JoinCostoProjectRequest;
use App\Http\Requests\Costos\ShareCostoProjectRequest;
use App\Http\Requests\Costos\TransferCostoProjectRequest;
use App\Models\CostoProject;
use App\Models\CostoProjectCollaborator;
use App\Models\CuadernoVinculo;
use App\Models\User;
use App\Services\ProjectQuotaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * Compartir proyectos de Costos (código del sistema o invitación por correo,
 * con rol editor/lector) y transferir un proyecto a la cuenta de otro usuario.
 * Los colaboradores no consumen cupo: el proyecto cuenta solo para su dueño.
 */
class CostoProjectShareController extends Controller
{
    public function __construct(private readonly ProjectQuotaService $quotaService) {}

    /**
     * Estado de compartir (solo dueño): códigos vigentes y colaboradores.
     */
    public function show(Request $request, CostoProject $costoProject): JsonResponse
    {
        abort_unless($costoProject->isOwnedBy($request->user()), 403, 'Solo el dueño puede compartir este proyecto.');

        return response()->json($this->sharePayload($request->user(), $costoProject));
    }

    /**
     * Genera (o regenera) el código de un rol, o invita directo por correo.
     */
    public function share(ShareCostoProjectRequest $request, CostoProject $costoProject): JsonResponse
    {
        $this->ensureCollaborationPlan($request->user());

        $role = $request->validated('role');
        $email = $request->validated('email');

        if ($email === null) {
            $costoProject->shareCodeFor($role, (bool) $request->validated('regenerate', false));

            return response()->json($this->sharePayload($request->user(), $costoProject));
        }

        $invitee = User::where('email', $email)->firstOrFail();

        if ($costoProject->isOwnedBy($invitee)) {
            throw ValidationException::withMessages(['email' => 'Ese correo es el del dueño del proyecto.']);
        }

        $costoProject->collaborators()->syncWithoutDetaching([
            $invitee->id => ['role' => $role, 'invited_by' => $request->user()->id, 'joined_at' => now()],
        ]);
        $costoProject->forgetAccessRoles();

        return response()->json([
            ...$this->sharePayload($request->user(), $costoProject),
            'message' => "{$invitee->name} ya puede ver el proyecto en su lista de Costos.",
        ]);
    }

    /**
     * Cambia el permiso de un colaborador (solo dueño).
     */
    public function updateRole(ShareCostoProjectRequest $request, CostoProject $costoProject, User $user): JsonResponse
    {
        abort_unless($costoProject->collaborators()->where('users.id', $user->id)->exists(), 404);

        $costoProject->collaborators()->updateExistingPivot($user->id, ['role' => $request->validated('role')]);
        $costoProject->forgetAccessRoles();

        return response()->json($this->sharePayload($request->user(), $costoProject));
    }

    /**
     * Quitar a un colaborador (dueño) o salir de un proyecto compartido (el propio colaborador).
     */
    public function remove(Request $request, CostoProject $costoProject, User $user): JsonResponse|RedirectResponse
    {
        $actor = $request->user();
        abort_unless($costoProject->isOwnedBy($actor) || $actor->id === $user->id, 403);

        $costoProject->collaborators()->detach($user->id);
        $costoProject->forgetAccessRoles();

        if ($actor->id === $user->id) {
            return redirect()->route('costos.index')->with('success', 'Saliste del proyecto compartido.');
        }

        return response()->json($this->sharePayload($actor, $costoProject));
    }

    /**
     * Unirse con un código (de cualquier proyecto del sistema).
     */
    public function join(JoinCostoProjectRequest $request): RedirectResponse
    {
        $code = $request->validated('code');
        $user = $request->user();

        $project = CostoProject::where('share_code_editor', $code)->orWhere('share_code_viewer', $code)->first();

        if ($project === null) {
            throw ValidationException::withMessages(['code' => 'El código no existe o fue cambiado por el dueño.']);
        }

        if ($project->isOwnedBy($user)) {
            throw ValidationException::withMessages(['code' => 'Este proyecto ya es tuyo.']);
        }

        $role = $project->share_code_editor === $code ? CostoProjectCollaborator::ROLE_EDITOR : CostoProjectCollaborator::ROLE_VIEWER;

        // Si ya era editor, un código de lector no le baja el permiso.
        $current = $project->accessRoleFor($user);
        if ($current === CostoProjectCollaborator::ROLE_EDITOR) {
            $role = CostoProjectCollaborator::ROLE_EDITOR;
        }

        $project->collaborators()->syncWithoutDetaching([
            $user->id => ['role' => $role, 'joined_at' => now()],
        ]);

        $label = $role === CostoProjectCollaborator::ROLE_EDITOR ? 'editor' : 'lector';

        return redirect()->route('costos.show', $project)
            ->with('success', "Te uniste a «{$project->nombre}» como {$label}.");
    }

    /**
     * Transferir el proyecto a la cuenta de otro usuario (root/gerencia).
     * El dueño anterior y los colaboradores pierden el acceso, los códigos se
     * invalidan y el Cuaderno se desconecta (su sesión OECE era del dueño anterior).
     */
    public function transfer(TransferCostoProjectRequest $request, CostoProject $costoProject): RedirectResponse
    {
        $receiver = User::where('email', $request->validated('email'))->firstOrFail();

        if ($costoProject->isOwnedBy($receiver)) {
            throw ValidationException::withMessages(['email' => 'El proyecto ya pertenece a esa cuenta.']);
        }

        $quota = $this->quotaService->quotaStatus($receiver, 'costos');
        if ($quota['limit'] !== null && $quota['remaining'] === 0) {
            throw ValidationException::withMessages([
                'email' => $quota['demo']
                    ? "{$receiver->name} está en plan gratuito y ya tiene su proyecto demo. Súbele de plan antes de transferir."
                    : "{$receiver->name} no tiene cupo ({$quota['used']} de {$quota['limit']}). Súbele de plan o que elimine un proyecto.",
            ]);
        }

        $previousOwnerId = $costoProject->user_id;

        DB::transaction(function () use ($costoProject, $receiver): void {
            $costoProject->forceFill([
                'user_id' => $receiver->id,
                'is_demo' => false,
                'demo_expires_at' => null,
                ...$this->quotaService->demoAttributesFor($receiver),
                'share_code_editor' => null,
                'share_code_viewer' => null,
            ])->save();

            $costoProject->collaborators()->detach();

            CuadernoVinculo::query()
                ->where('costo_project_id', $costoProject->id)
                ->update([
                    // Las tareas del conector van al PC de vinculo->user_id: pasa al nuevo dueño.
                    'user_id' => $receiver->id,
                    'session_key' => null,
                    'cuaderno_agente_id' => null,
                    'conexion_estado' => 'desconectada',
                    'conexion_mensaje' => null,
                ]);
        });
        $costoProject->forgetAccessRoles();

        Log::info('Costos project transferred', [
            'project_id' => $costoProject->id,
            'from_user_id' => $previousOwnerId,
            'to_user_id' => $receiver->id,
            'by_user_id' => $request->user()->id,
        ]);

        return redirect()->route('costos.index')
            ->with('success', "«{$costoProject->nombre}» se transfirió a {$receiver->name} ({$receiver->email}).");
    }

    private function ensureCollaborationPlan(User $user): void
    {
        if (! $this->quotaService->allowsCollaboration($user)) {
            throw ValidationException::withMessages(['quota' => 'Compartir proyectos requiere un plan de pago. Sube de plan para invitar colaboradores.']);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function sharePayload(User $owner, CostoProject $project): array
    {
        $project->refresh();

        return [
            'can_share' => $this->quotaService->allowsCollaboration($owner),
            'codes' => [
                'editor' => $project->share_code_editor,
                'viewer' => $project->share_code_viewer,
            ],
            'collaborators' => $project->collaborators()
                ->orderBy('name')
                ->get(['users.id', 'users.name', 'users.email'])
                ->map(fn (User $u) => [
                    'id' => $u->id,
                    'name' => $u->name,
                    'email' => $u->email,
                    'role' => $u->pivot->role,
                ])
                ->values(),
        ];
    }
}
