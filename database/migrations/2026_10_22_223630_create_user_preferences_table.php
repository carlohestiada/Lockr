<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_preferences', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')
                ->unique()
                ->constrained()
                ->cascadeOnDelete();

            $table->string('theme', 20)->default('system');
            $table->string('accent_color', 20)->default('#2563eb');
            $table->string('font_size', 20)->default('medium');

            $table->boolean('show_website_icons')->default(true);
            $table->unsignedSmallInteger('auto_lock_minutes')->default(15);

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_preferences');
    }
};
