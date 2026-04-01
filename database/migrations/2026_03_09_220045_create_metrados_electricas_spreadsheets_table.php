```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('metrados_electricas', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->string('name')->default('Sin nombre');
            $table->string('project_name')->nullable();

            // Datos de Luckysheet
            $table->json('sheet_data')->nullable();

            // Colaboración
            $table->boolean('is_collaborative')->default(false);
            $table->string('collab_code', 16)->nullable()->unique();

            $table->timestamps();
            $table->softDeletes();
        });


        Schema::create('metrados_electricas_collaborators', function (Blueprint $table) {

            $table->id();

            // ID de la hoja de cálculo
            $table->unsignedBigInteger('metrado_electricas_spreadsheet_id');

            // Foreign key con nombre corto (evita error de MySQL)
            $table->foreign(
                'metrado_electricas_spreadsheet_id',
                'fk_metrado_electricas_sheet'
            )->references('id')
             ->on('metrados_electricas')
             ->cascadeOnDelete();

            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->enum('role', ['viewer', 'editor'])->default('editor');

            $table->timestamp('joined_at')->nullable();

            $table->timestamps();

            // Evita duplicar colaboradores
            $table->unique([
                'metrado_electricas_spreadsheet_id',
                'user_id'
            ], 'uniq_metrado_elec_user');
        });
    }


    public function down(): void
    {
        Schema::dropIfExists('metrados_electricas_collaborators');
        Schema::dropIfExists('metrados_electricas');
    }
};