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

        // Filter berdasarkan role tab
        $roleFilter = $request->input('role', 'all');
        if ($roleFilter !== 'all') {
            $query->whereHas('roles', function ($q) use ($roleFilter) {
                $q->where('slug', $roleFilter);
            });
        }

        // Load registeredPeriods untuk mahasiswa
        if ($roleFilter === 'mahasiswa' || $roleFilter === 'all') {
            $query->with(['registeredPeriods' => function ($q) {
                $q->select('periods.id', 'periods.name');
            }]);
        }

        // Filter pencarian (nama/email/nim/nip)
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('nim', 'like', "%{$search}%")
                    ->orWhere('nip', 'like', "%{$search}%");
            });
        }

        // Sorting
        $sortBy = $request->input('sort_by', 'name');
        $sortOrder = $request->input('sort_order', 'asc');
        $allowedSortFields = ['name', 'email', 'created_at', 'nim', 'nip'];

        if (in_array($sortBy, $allowedSortFields)) {
            $query->orderBy($sortBy, $sortOrder);
        }

        // Pagination: 20 item per halaman
        $users = $query->paginate(20);

        return response()->json($users);
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
