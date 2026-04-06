<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $query = User::with('roles');

        if ($request->has('role')) {
            $roleSlug = $request->role;
            $query->whereHas('roles', function ($q) use ($roleSlug) {
                $q->where('slug', $roleSlug);
            });
        }

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        return $query->orderBy('name')->paginate(100);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8',
            'roles' => 'required|array',
            'roles.*' => 'exists:roles,slug',
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            // Keep legacy role for compatibility for now
            'role' => $validated['roles'][0] ?? 'mahasiswa',
        ]);

        $roleIds = \App\Models\Role::whereIn('slug', $validated['roles'])->pluck('id');
        $user->roles()->sync($roleIds);

        return response()->json($user->load('roles'), 201);
    }

    public function update(Request $request, User $user)
    {
        if ($user->id === 1) {
            return response()->json(['message' => 'Super admin account cannot be modified.'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => ['sometimes', 'email', Rule::unique('users')->ignore($user->id)],
            'password' => 'nullable|string|min:8',
            'roles' => 'sometimes|array',
            'roles.*' => 'exists:roles,slug',
        ]);

        if (array_key_exists('password', $validated)) {
            if ($validated['password'] === null || $validated['password'] === '') {
                // Keep existing password when field is left blank on edit form.
                unset($validated['password']);
            } else {
                $validated['password'] = Hash::make($validated['password']);
            }
        }

        if (isset($validated['roles'])) {
            $roleIds = \App\Models\Role::whereIn('slug', $validated['roles'])->pluck('id');
            $user->roles()->sync($roleIds);
            
            // Sync legacy role column for compatibility
            $validated['role'] = $validated['roles'][0] ?? $user->role;
        }

        // Roles are stored in pivot table, so remove array payload before mass update.
        unset($validated['roles']);

        $user->update($validated);

        return response()->json($user->load('roles'));
    }

    public function destroy(User $user)
    {
        if ($user->id === 1) {
            return response()->json(['message' => 'Super admin account cannot be deleted.'], 403);
        }

        $user->delete();
        return response()->json(['message' => 'User deleted']);
    }
}
