<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Nueva solicitud de plan</title>
</head>
<body style="font-family: Arial, sans-serif; background:#f4f4f5; padding:24px; color:#111827;">
    <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:12px; padding:32px; border:1px solid #e5e7eb;">
        <h1 style="font-size:18px; margin:0 0 16px;">Nueva solicitud de plan</h1>

        <table style="width:100%; border-collapse:collapse; font-size:14px;">
            <tr>
                <td style="padding:6px 0; color:#6b7280;">Nombre</td>
                <td style="padding:6px 0; font-weight:600;">{{ $planRequest->nombre }}</td>
            </tr>
            <tr>
                <td style="padding:6px 0; color:#6b7280;">Correo</td>
                <td style="padding:6px 0; font-weight:600;">{{ $planRequest->email }}</td>
            </tr>
            <tr>
                <td style="padding:6px 0; color:#6b7280;">Plan solicitado</td>
                <td style="padding:6px 0; font-weight:600;">{{ ucfirst($planRequest->plan) }}</td>
            </tr>
            @if ($planRequest->empresa)
                <tr>
                    <td style="padding:6px 0; color:#6b7280;">Empresa</td>
                    <td style="padding:6px 0; font-weight:600;">{{ $planRequest->empresa }}</td>
                </tr>
            @endif
        </table>

        @if ($planRequest->isBusiness())
            <p style="margin:20px 0 8px; font-size:14px; color:#6b7280;">
                Plan de organización — coordina precio y condiciones directamente con el
                cliente. Al aprobar, crea la organización y el usuario desde el panel.
            </p>
        @elseif ($comprobanteUrl)
            <p style="margin:20px 0 8px; font-size:14px;">
                <a href="{{ $comprobanteUrl }}" style="color:#2563eb;">Ver comprobante de pago</a>
            </p>
        @else
            <p style="margin:20px 0 8px; font-size:14px; color:#6b7280;">
                Plan gratuito — no requiere comprobante de pago.
            </p>
        @endif

        <p style="margin:24px 0 0;">
            <a href="{{ route('plan-requests.index') }}" style="display:inline-block; background:#2563eb; color:#ffffff; padding:10px 18px; border-radius:8px; text-decoration:none; font-size:14px; font-weight:600;">
                Revisar solicitud
            </a>
        </p>
    </div>
</body>
</html>
