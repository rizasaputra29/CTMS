<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Group;
use App\Models\GroupInvitation;
use App\Models\GroupMember;
use App\Models\JoinRequest;
use App\Models\Notification;
use App\Models\Period;
use App\Models\PeriodRegistration;
use App\Models\User;
use App\Services\StudentFlagService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

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

        $this->ensureMahasiswaRoleIsExclusive($validated['roles']);

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

        if (isset($validated['roles'])) {
            $this->ensureMahasiswaRoleIsExclusive($validated['roles']);
        }

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

    private function ensureMahasiswaRoleIsExclusive(array $roles): void
    {
        $uniqueRoles = array_values(array_unique($roles));

        if (in_array('mahasiswa', $uniqueRoles, true) && count($uniqueRoles) > 1) {
            throw ValidationException::withMessages([
                'roles' => ['Mahasiswa tidak boleh digabung dengan role admin/dosen.'],
            ]);
        }
    }

    public function destroy(User $user)
    {
        if ($user->id === 1) {
            return response()->json(['message' => 'Super admin account cannot be deleted.'], 403);
        }

        DB::beginTransaction();
        try {
            // If user is a student, handle group cleanup
            if ($user->hasRole('mahasiswa')) {
                $this->cleanupStudentGroups($user);
            }

            $user->delete();
            DB::commit();

            return response()->json(['message' => 'User deleted']);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('user.delete.failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);

            return response()->json(['message' => 'Failed to delete user: '.$e->getMessage()], 500);
        }
    }

    /**
     * Cleanup student groups when student is deleted.
     * - Solo group: Delete entire group and related data
     * - Multi-member group: Remove student and auto-assign new leader if leader deleted
     */
    private function cleanupStudentGroups(User $student): void
    {
        $memberships = GroupMember::where('student_id', $student->id)->get();

        foreach ($memberships as $membership) {
            $group = Group::with(['members', 'period'])->find($membership->group_id);
            if (! $group) {
                continue;
            }

            $memberCount = $group->members->count();
            $isSoloGroup = $group->is_solo;
            $isLeader = $membership->is_leader;

            if ($isSoloGroup) {
                // Solo group: Delete entire group and all related data
                $this->deleteGroupCompletely($group);
            } else {
                // Multi-member group
                if ($memberCount <= 1) {
                    // Last member leaving: delete group
                    $this->deleteGroupCompletely($group);
                } else {
                    // Multiple members: remove student and handle leadership
                    if ($isLeader) {
                        // Auto-assign new leader (oldest member)
                        $newLeader = GroupMember::where('group_id', $group->id)
                            ->where('student_id', '!=', $student->id)
                            ->orderBy('created_at', 'asc')
                            ->first();

                        if ($newLeader) {
                            $newLeader->update(['is_leader' => true]);

                            // Notify new leader
                            Notification::create([
                                'user_id' => $newLeader->student_id,
                                'type' => 'LEADER_ASSIGNED',
                                'title' => 'Anda Menjadi Ketua Kelompok',
                                'message' => "Anda otomatis ditunjuk sebagai ketua kelompok {$group->id} karena ketua sebelumnya telah dihapus.",
                                'related_type' => 'Group',
                                'related_id' => $group->id,
                            ]);
                        }
                    }

                    // Delete the membership
                    $membership->delete();
                }
            }
        }
    }

    /**
     * Completely delete a group and all its related data.
     */
    private function deleteGroupCompletely(Group $group): void
    {
        $groupId = $group->id;

        // Delete related data in order
        // Documents
        \App\Models\Document::where('group_id', $groupId)->delete();

        // Bids
        \App\Models\Bid::where('group_id', $groupId)->delete();

        // Student proposals (titles)
        \App\Models\Title::where('proposed_by_group_id', $groupId)->delete();

        // Group memberships
        GroupMember::where('group_id', $groupId)->delete();

        // Supervisions
        \App\Models\Supervision::where('group_id', $groupId)->delete();

        // Schedules
        \App\Models\Schedule::where('group_id', $groupId)->delete();

        // Seminar schedules
        \App\Models\SeminarSchedule::where('group_id', $groupId)->delete();

        // TA defense schedules
        \App\Models\TaDefenseSchedule::where('group_id', $groupId)->delete();

        // TA submissions
        \App\Models\TaSubmission::where('group_id', $groupId)->delete();

        // Evaluations
        \App\Models\Evaluation::where('group_id', $groupId)->delete();

        // Join requests
        \App\Models\JoinRequest::where('group_id', $groupId)->delete();

        // Group invitations
        \App\Models\GroupInvitation::where('group_id', $groupId)->delete();

        // Notifications related to group
        \App\Models\Notification::where('related_type', 'Group')
            ->where('related_id', $groupId)
            ->delete();

        // Finally delete the group
        $group->delete();

        Log::info('group.deleted.completely', ['group_id' => $groupId]);
    }

    /**
     * Admin: Kick a student from a specific period.
     *
     * This flags the student from the period, which soft-removes them from groups
     * while preserving their scores, invalidates pending invitations/join requests,
     * and re-evaluates affected groups.
     */
    public function kickStudentFromPeriod(Request $request, Period $period, User $student)
    {
        $admin = $request->user();

        if (! $student->hasRole('mahasiswa')) {
            return response()->json(['message' => 'Target user harus mahasiswa.'], 400);
        }

        $registration = PeriodRegistration::where('user_id', $student->id)
            ->where('period_id', $period->id)
            ->first();

        if (! $registration) {
            return response()->json(['message' => 'Mahasiswa tidak terdaftar pada periode ini.'], 404);
        }

        // Get group memberships for affected groups tracking
        $membershipRows = GroupMember::where('student_id', $student->id)
            ->where('period_id', $period->id)
            ->get(['id', 'group_id']);

        $affectedGroupIds = $membershipRows
            ->pluck('group_id')
            ->filter()
            ->unique()
            ->values();

        // Count pending invitations and join requests before flagging
        $invalidatedInvitationsCount = GroupInvitation::where('student_id', $student->id)
            ->where('status', 'PENDING')
            ->whereHas('group', function ($q) use ($period) {
                $q->where('period_id', $period->id);
            })
            ->count();

        $invalidatedJoinRequestsCount = JoinRequest::where('requester_id', $student->id)
            ->where('status', 'PENDING')
            ->whereHas('group', function ($q) use ($period) {
                $q->where('period_id', $period->id);
            })
            ->count();

        try {
            $flagService = app(StudentFlagService::class);

            $flagService->flagStudent(
                $period,
                $student,
                $admin,
                'Kicked from period by admin'
            );

            // Log MEMBER_KICKED action (StudentFlagService already logs STUDENT_FLAGGED)
            AuditLog::create([
                'user_id' => $admin->id,
                'action' => 'MEMBER_KICKED',
                'target_type' => User::class,
                'target_id' => $student->id,
                'payload' => [
                    'period_id' => $period->id,
                    'reason' => 'Admin kicked student from period',
                    'memberships_count' => $membershipRows->count(),
                    'affected_groups' => $affectedGroupIds->toArray(),
                    'invalidated_invitations' => $invalidatedInvitationsCount,
                    'invalidated_join_requests' => $invalidatedJoinRequestsCount,
                ],
            ]);

            // Send notification to student
            Notification::create([
                'user_id' => $student->id,
                'type' => 'PERIOD_REGISTRATION_REMOVED',
                'title' => 'Dikeluarkan dari Periode',
                'message' => "Admin telah mengeluarkan Anda dari periode {$period->name}.",
                'related_type' => 'Period',
                'related_id' => $period->id,
            ]);

            return response()->json([
                'message' => "Mahasiswa {$student->name} berhasil dikeluarkan dari periode {$period->name}.",
                'removed_group_memberships' => $membershipRows->count(),
                'affected_groups' => $affectedGroupIds->values(),
                'invalidated_invitations' => $invalidatedInvitationsCount,
                'invalidated_join_requests' => $invalidatedJoinRequestsCount,
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
        } catch (\DomainException $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 400);
        } catch (\Exception $e) {
            Log::error('admin.period.kick_student.failed', [
                'period_id' => $period->id,
                'student_id' => $student->id,
                'admin_id' => $admin?->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Gagal mengeluarkan mahasiswa dari periode: '.$e->getMessage(),
            ], 500);
        }
    }
}
