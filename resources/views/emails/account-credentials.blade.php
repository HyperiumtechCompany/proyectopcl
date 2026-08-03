<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Tu cuenta en PCL está lista</title>
</head>
<body style="font-family: Arial, sans-serif; background:#f4f4f5; padding:24px; color:#111827;">
    <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:12px; padding:32px; border:1px solid #e5e7eb;">
        <h1 style="font-size:18px; margin:0 0 16px;">¡Bienvenido a PCL, {{ $user->name }}!</h1>

        <p style="font-size:14px; color:#374151;">
            Tu cuenta ya está activa. Estos son tus datos de acceso:
        </p>

        <table style="width:100%; border-collapse:collapse; font-size:14px; margin-top:12px;">
            <tr>
                <td style="padding:6px 0; color:#6b7280;">Correo</td>
                <td style="padding:6px 0; font-weight:600;">{{ $user->email }}</td>
            </tr>
            <tr>
                <td style="padding:6px 0; color:#6b7280;">Contraseña</td>
                <td style="padding:6px 0; font-weight:600; font-family: monospace;">{{ $plainPassword }}</td>
            </tr>
        </table>

        <p style="margin:20px 0 8px; font-size:13px; color:#6b7280;">
            Por seguridad, te recomendamos cambiar esta contraseña después de tu primer inicio de sesión.
        </p>

        <p style="margin:24px 0 0;">
            <a href="{{ $loginUrl }}" style="display:inline-block; background:#2563eb; color:#ffffff; padding:10px 18px; border-radius:8px; text-decoration:none; font-size:14px; font-weight:600;">
                Iniciar sesión
            </a>
        </p>
    </div>
</body>
</html>
