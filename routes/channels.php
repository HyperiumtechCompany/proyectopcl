<?php

use App\Models\CaidaTensionSpreadsheet;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

/**
 * Canal privado por spreadsheet.
 * Acceso permitido al propietario y a colaboradores registrados.
 */
Broadcast::channel('spreadsheet.{id}', function ($user, $id) {
    $sheet = CaidaTensionSpreadsheet::find($id);
    if (!$sheet) return false;

    return $sheet->user_id === $user->id
        || $sheet->collaborators()->where('users.id', $user->id)->exists();
});

Broadcast::channel('agua-calculation.{id}', function ($user, $id) {
    $sheet = \App\Models\AguaCalculation::find($id);
    if (!$sheet) return false;

    return $sheet->user_id === $user->id
        || $sheet->collaborators()->where('users.id', $user->id)->exists();
});
