<?php

namespace App\Http\Controllers;

use App\Models\Group;
use App\Models\GroupInvitation;
use App\Models\GroupMember;
use App\Models\JoinRequest;
use App\Models\Notification;
use App\Models\Period;
use App\Models\PeriodRegistration;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
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

    /**
     * Admin: Kick a student from a specific period.
     *
     * This removes period registration, removes period-scoped group memberships,
     * invalidates pending invitations/join requests, and re-evaluates affected groups.
     */
    public function kickStudentFromPeriod(Request $request, Period $period, User $student)
    {
        $admin = $request->user();

        if (!$student->hasRole('mahasiswa')) {
            return response()->json(['message' => 'Target user harus mahasiswa.'], 400);
        }

        $registration = PeriodRegistration::where('user_id', $student->id)
            ->where('period_id', $period->id)
            ->first();

        if (!$registration) {
            return response()->json(['message' => 'Mahasiswa tidak terdaftar pada periode ini.'], 404);
        }

        DB::beginTransaction();
        try {
            $membershipRows = GroupMember::where('student_id', $student->id)
                ->where('period_id', $period->id)
                ->get(['id', 'group_id']);

            $affectedGroupIds = $membershipRows
                ->pluck('group_id')
                ->filter()
                ->unique()
                ->values();

            $removedGroupMemberships = GroupMember::where('student_id', $student->id)
                ->where('period_id', $period->id)
                ->delete();

            $removedRegistration = PeriodRegistration::where('user_id', $student->id)
                ->where('period_id', $period->id)
                ->delete();

            $invalidatedInvitations = GroupInvitation::where('student_id', $student->id)
                ->where('status', 'PENDING')
                ->whereHas('group', function ($q) use ($period) {
                    $q->where('period_id', $period->id);
                })
                ->update(['status' => 'REJECTED']);

            $invalidatedJoinRequests = JoinRequest::where('requester_id', $student->id)
                ->where('status', 'PENDING')
                ->whereHas('group', function ($q) use ($period) {
                    $q->where('period_id', $period->id);
                })
                ->update(['status' => 'INVALIDATED']);

            $groupService = app(\App\Services\GroupService::class);

            foreach ($affectedGroupIds as $groupId) {
                $group = Group::find($groupId);
                if (!$group) {
                    continue;
                }

                $remainingMembers = GroupMember::where('group_id', $groupId)->count();
                if ($remainingMembers === 0) {
                    $group->update(['status' => 'DISSOLVED']);
                    Log::info('group.lifecycle.dissolved', ['group_id' => $group->id]);
                    continue;
                }

                $groupService->evaluateGroupReadiness($group);
            }

            Notification::create([
                'user_id' => $student->id,
                'type' => 'PERIOD_REGISTRATION_REMOVED',
                'title' => 'Dikeluarkan dari Periode',
                'message' => "Admin telah mengeluarkan Anda dari periode {$period->name}.",
                'related_type' => 'Period',
                'related_id' => $period->id,
            ]);

            DB::commit();

            return response()->json([
                'message' => "Mahasiswa {$student->name} berhasil dikeluarkan dari periode {$period->name}.",
                'removed_registration' => $removedRegistration,
                'removed_group_memberships' => $removedGroupMemberships,
                'affected_groups' => $affectedGroupIds->values(),
                'invalidated_invitations' => $invalidatedInvitations,
                'invalidated_join_requests' => $invalidatedJoinRequests,
                'kicked_student' => [
                    'id' => $student->id,
                    'name' => $student->name,
                    'email' => $student->email,
                ],
                'period' => [
                    'id' => $period->id,
                    'name' => $period->name,
                ],
                'performed_by' => [
                    'id' => $admin->id,
                    'name' => $admin->name,
                ],
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('admin.period.kick_student.failed', [
                'period_id' => $period->id,
                'student_id' => $student->id,
                'admin_id' => $admin?->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Gagal mengeluarkan mahasiswa dari periode: ' . $e->getMessage(),
            ], 500);
        }
    }
}
