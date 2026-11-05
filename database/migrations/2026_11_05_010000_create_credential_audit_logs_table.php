<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('credential_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('credential_id')->nullable()->constrained()->nullOnDelete();
            $table->string('event', 32);
            $table->ipAddress('ip')->nullable();
            $table->string('user_agent', 1000)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['user_id', 'event', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('credential_audit_logs');
    }
};
