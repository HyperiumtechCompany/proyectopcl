<?php

namespace App\Http\Middleware;

use App\Models\CuadernoAgente;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Identifies the connector by its bearer token (only its SHA-256 is stored). */
class AuthenticateCuadernoAgente
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = (string) $request->bearerToken();
        $agente = strlen($token) >= 40
            ? CuadernoAgente::query()->active()->where('token_hash', hash('sha256', $token))->first()
            : null;
        if (! $agente) {
            return response()->json(['message' => 'Conector no enlazado o revocado.'], 401);
        }
        $agente->forceFill([
            'last_seen_at' => now(),
            'version' => substr((string) $request->header('X-Agente-Version', $agente->version), 0, 40),
        ])->saveQuietly();
        $request->attributes->set('cuadernoAgente', $agente);

        return $next($request);
    }
}
