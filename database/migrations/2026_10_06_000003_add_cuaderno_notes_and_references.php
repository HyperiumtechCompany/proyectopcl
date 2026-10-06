<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A link may start from the connector; entity, work and role come from the official notebook.
        Schema::table('cuaderno_vinculos', function (Blueprint $table): void {
            $table->string('entidad')->nullable()->change();
            $table->text('obra')->nullable()->change();
            $table->string('rol', 100)->nullable()->change();
        });
        Schema::table('cuaderno_asientos', function (Blueprint $table): void {
            $table->text('nota_local')->nullable();
        });
        // Local references between seats of the same link; they are never sent to OECE.
        Schema::create('cuaderno_referencias', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('origen_asiento_id')->constrained('cuaderno_asientos')->cascadeOnDelete();
            $table->foreignId('destino_asiento_id')->constrained('cuaderno_asientos')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['origen_asiento_id', 'destino_asiento_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cuaderno_referencias');
        Schema::table('cuaderno_asientos', function (Blueprint $table): void {
            $table->dropColumn('nota_local');
        });
        Schema::table('cuaderno_vinculos', function (Blueprint $table): void {
            $table->string('entidad')->nullable(false)->change();
            $table->text('obra')->nullable(false)->change();
            $table->string('rol', 100)->nullable(false)->change();
        });
    }
};
