<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'costos_tenant';

    public function up(): void
    {
        Schema::connection($this->connection)->create('mantenimiento_operaciones', function (Blueprint $table) {
            $table->id();
            $table->uuid('operation_id')->unique();
            $table->foreignId('documento_id')->constrained('mantenimiento_documentos')->cascadeOnDelete();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->unsignedBigInteger('base_revision');
            $table->unsignedBigInteger('applied_revision');
            $table->string('type', 40);
            $table->json('payload');
            $table->json('result')->nullable();
            $table->timestamps();
            $table->index(['documento_id', 'applied_revision'], 'mant_ops_documento_revision_idx');
        });

        Schema::connection($this->connection)->create('mantenimiento_snapshots', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->foreignId('documento_id')->constrained('mantenimiento_documentos')->cascadeOnDelete();
            $table->unsignedBigInteger('revision');
            $table->string('reason', 40);
            $table->unsignedBigInteger('user_id')->nullable();
            $table->longText('payload');
            $table->timestamp('created_at')->useCurrent();
            $table->index(['documento_id', 'revision'], 'mant_snap_documento_revision_idx');
        });
    }

    public function down(): void
    {
        Schema::connection($this->connection)->dropIfExists('mantenimiento_snapshots');
        Schema::connection($this->connection)->dropIfExists('mantenimiento_operaciones');
    }
};
