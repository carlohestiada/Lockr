<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('credentials', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->foreignId('folder_id')
                ->nullable()
                ->constrained()
                ->nullOnDelete();

            $table->string('title', 150);
            $table->string('username')->nullable();

            // Store encrypted values here, not plaintext passwords.
            $table->text('password');
            $table->text('notes')->nullable();

            $table->string('website_url', 2048)->nullable();
            $table->boolean('is_favorite')->default(false);

            $table->timestamps();

            $table->index(['user_id', 'is_favorite']);
            $table->index(['user_id', 'folder_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('credentials');
    }
};
