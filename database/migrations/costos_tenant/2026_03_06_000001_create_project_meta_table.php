<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Base migration for costos tenant databases.
 * This table stores metadata redundantly for quick access without
 * needing to query the main (landlord) database.
 */
return new class extends Migration
{
    protected $connection = 'costos_tenant';

    public function up(): void
    {
        Schema::connection($this->connection)->create('project_meta', function (Blueprint $table) {
            $table->id();
            $table->string('key');
            $table->text('value')->nullable();
            $table->timestamps();

            $table->unique('key');
        });
    }

    public function down(): void
    {
        Schema::connection($this->connection)->dropIfExists('project_meta');
    }
};
