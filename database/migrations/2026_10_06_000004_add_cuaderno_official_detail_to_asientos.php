<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Data read from the official detail page and the official PDF stored privately.
        Schema::table('cuaderno_asientos', function (Blueprint $table): void {
            $table->string('external_id', 36)->nullable()->index();
            $table->longText('descripcion')->nullable();
            $table->string('referencia', 500)->nullable();
            $table->string('latitud', 50)->nullable();
            $table->string('longitud', 50)->nullable();
            $table->timestamp('detalle_at')->nullable();
            $table->string('pdf_path')->nullable();
            $table->string('pdf_sha256', 64)->nullable();
            $table->unsignedBigInteger('pdf_bytes')->nullable();
            $table->timestamp('pdf_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('cuaderno_asientos', function (Blueprint $table): void {
            $table->dropIndex(['external_id']);
            $table->dropColumn([
                'external_id', 'descripcion', 'referencia', 'latitud', 'longitud', 'detalle_at',
                'pdf_path', 'pdf_sha256', 'pdf_bytes', 'pdf_at',
            ]);
        });
    }
};
