<?php

namespace App\Services\Cuaderno;

use App\Models\CuadernoAgente;
use App\Models\CuadernoTarea;
use App\Models\CuadernoVinculo;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Production transport: OECE/RENIEC block datacenter IPs, so each operation becomes a task
 * that the connector on the holder's own computer takes over HTTPS, runs and answers.
 */
class CuadernoAgentBridge
{
    /** @return array{0: int, 1: array<string, mixed>} HTTP-like status and body, as the local runner answers. */
    public function dispatch(CuadernoVinculo $vinculo, string $action, array $payload): array
    {
        $agente = $this->agentFor($vinculo, $action);
        if (! $agente) {
            // Nothing runs on a computer that is off; the session simply ends.
            return [200, ['state' => 'disconnected']];
        }
        $tarea = new CuadernoTarea([]);
        $tarea->forceFill([
            'user_id' => $vinculo->user_id,
            'cuaderno_vinculo_id' => $vinculo->id,
            'cuaderno_agente_id' => $agente->id,
            'action' => $action,
            'payload' => $payload,
            'sesion' => $payload['session'] ?? null,
            'status' => 'pendiente',
            'expires_at' => now()->addSeconds($this->timeout() + 15),
        ])->save();

        $deadline = microtime(true) + $this->timeout();
        while (microtime(true) < $deadline) {
            $this->pause();
            $tarea->refresh();
            if (in_array($tarea->status, ['completada', 'fallida'], true)) {
                $answer = $tarea->status === 'completada'
                    ? [200, is_array($tarea->result) ? $tarea->result : []]
                    : [422, ['error' => $tarea->error ?? 'connector_failed']];
                $tarea->delete();

                return $answer;
            }
        }
        $tarea->forceFill(['status' => 'vencida', 'payload' => null])->save();

        throw ValidationException::withMessages(['conexion' => 'El conector de «'.$agente->nombre.'» no respondió a tiempo. Revisa que la PC esté encendida y con internet.']);
    }

    public function onlineAgent(User|int $user): ?CuadernoAgente
    {
        return CuadernoAgente::query()->online()
            ->where('user_id', $user instanceof User ? $user->id : $user)
            ->latest('last_seen_at')->first();
    }

    /**
     * A new connection takes the holder's computer that is online; every later step must
     * run on that same computer, where its private browser profile lives.
     */
    private function agentFor(CuadernoVinculo $vinculo, string $action): ?CuadernoAgente
    {
        if ($action === 'connect') {
            $agente = $this->onlineAgent($vinculo->user_id);
            if (! $agente) {
                throw ValidationException::withMessages(['conexion' => 'Tu conector no está encendido. Instálalo o enciende la PC donde lo instalaste.']);
            }
            $vinculo->forceFill(['cuaderno_agente_id' => $agente->id])->saveQuietly();

            return $agente;
        }
        $agente = $vinculo->cuaderno_agente_id ? CuadernoAgente::query()->active()->find($vinculo->cuaderno_agente_id) : null;
        if ($action === 'disconnect' && ! $agente?->en_linea) {
            return null;
        }
        if (! $agente) {
            throw ValidationException::withMessages(['conexion' => 'La PC de esta conexión ya no está enlazada. Vuelve a conectar tu cuenta.']);
        }
        if (! $agente->en_linea) {
            throw ValidationException::withMessages(['conexion' => 'La PC «'.$agente->nombre.'» está apagada o sin conector. Enciéndela, o vuelve a conectar desde otra PC.']);
        }

        return $agente;
    }

    protected function timeout(): int
    {
        return (int) config('cuaderno.agent_timeout', 45);
    }

    protected function pause(): void
    {
        usleep(300_000);
    }
}
