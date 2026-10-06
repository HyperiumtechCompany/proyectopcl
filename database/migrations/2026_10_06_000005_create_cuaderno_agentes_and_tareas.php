<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Connectors installed on the holders' computers (OECE blocks datacenter IPs).
        Schema::create('cuaderno_agentes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('nombre', 120);
            // "extension": browser add-on using the holder's own OECE tab; "pc": desktop connector.
            $table->string('tipo', 20)->default('pc');
            $table->string('plataforma', 120)->nullable();
            $table->string('version', 40)->nullable();
            // Only the SHA-256 of the token is stored.
            $table->string('token_hash', 64)->unique();
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();
        });
        // Work items the connector takes over HTTPS and answers.
        Schema::create('cuaderno_tareas', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('cuaderno_vinculo_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('cuaderno_agente_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('action', 20);
            $table->text('payload')->nullable();
            $table->text('sesion')->nullable();
            $table->string('status', 20)->default('pendiente');
            $table->longText('result')->nullable();
            $table->string('error', 60)->nullable();
            $table->timestamp('taken_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamp('expires_at');
            $table->timestamps();
            $table->index(['user_id', 'status']);
        });
        Schema::table('cuaderno_vinculos', function (Blueprint $table): void {
            $table->foreignId('cuaderno_agente_id')->nullable()->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('cuaderno_vinculos', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('cuaderno_agente_id');
        });
        Schema::dropIfExists('cuaderno_tareas');
        Schema::dropIfExists('cuaderno_agentes');
    }
};
