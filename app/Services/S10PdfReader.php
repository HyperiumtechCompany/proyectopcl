<?php

namespace App\Services;

use Illuminate\Support\Facades\Process;
use Illuminate\Validation\ValidationException;

class S10PdfReader
{
    public function read(string $bytes): array
    {
        $result = Process::path(base_path())->timeout(120)->input($bytes)->run([
            config('services.s10_pdf.python', 'python'),
            base_path('scripts/s10_import_pdf.py'),
            '--stdin',
        ]);
        if ($result->failed()) {
            throw ValidationException::withMessages(['pdf_bytes' => 'No se pudo leer el PDF. Comprueba Python/PyMuPDF en el entorno local.']);
        }
        try {
            $data = json_decode($result->output(), true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw ValidationException::withMessages(['pdf_bytes' => 'El lector devolvió una respuesta incompleta.']);
        }
        if (! is_array($data) || empty($data['analyses'])) {
            throw ValidationException::withMessages(['pdf_bytes' => 'No se encontraron ACU en el PDF.']);
        }

        return $data;
    }
}
