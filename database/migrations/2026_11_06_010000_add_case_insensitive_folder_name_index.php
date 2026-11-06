<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('CREATE UNIQUE INDEX folders_user_id_lower_name_unique ON folders (user_id, LOWER(name))');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX folders_user_id_lower_name_unique');
    }
};
