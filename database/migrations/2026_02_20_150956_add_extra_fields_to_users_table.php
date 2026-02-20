<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('phone', 20)->nullable()->after('email');
            $table->string('avatar')->nullable()->after('phone');
            $table->string('dni', 12)->nullable()->after('avatar');
            $table->string('position')->nullable()->after('dni');
            $table->enum('plan', ['free', 'mensual', 'anual', 'lifetime'])->default('free')->after('position');
            $table->timestamp('plan_expires_at')->nullable()->after('plan');
            $table->enum('status', ['active', 'inactive', 'blocked'])->default('active')->after('plan_expires_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['phone', 'avatar', 'dni', 'position', 'plan', 'plan_expires_at', 'status']);
        });
    }
};
