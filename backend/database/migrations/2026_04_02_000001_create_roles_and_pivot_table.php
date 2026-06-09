<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Create roles table
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->timestamps();
        });

        // 2. Create pivot table role_user
        Schema::create('role_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('role_id')->constrained()->onDelete('cascade');
            $table->timestamps();
        });

        // 3. Seed default roles
        $roles = [
            ['name' => 'Admin', 'slug' => 'admin'],
            ['name' => 'Dosen', 'slug' => 'dosen'],
            ['name' => 'Mahasiswa', 'slug' => 'mahasiswa'],
        ];

        foreach ($roles as $role) {
            \App\Models\Role::firstOrCreate(['slug' => $role['slug']], ['name' => $role['name']]);
        }

        // 4. Migrate existing data from users.role to role_user
        $users = DB::table('users')->select('id', 'role')->get();
        $roleMap = DB::table('roles')->pluck('id', 'slug');

        foreach ($users as $user) {
            if ($user->role && isset($roleMap[$user->role])) {
                DB::table('role_user')->insert([
                    'user_id' => $user->id,
                    'role_id' => $roleMap[$user->role],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        // 5. We keep the 'role' column for now to avoid breaking existing legacy code
        // until Phase 2 is fully implemented.
        // Once Phase 2 (Backend Logic) is ready, we can drop it in a separate migration or later.
    }

    public function down(): void
    {
        Schema::dropIfExists('role_user');
        Schema::dropIfExists('roles');
    }
};
