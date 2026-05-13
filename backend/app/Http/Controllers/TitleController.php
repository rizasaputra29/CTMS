<?php

namespace App\Http\Controllers;

use App\Concerns\RequiresActivePeriod;
use App\Models\Title;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\TitleApprovalAudit;
use App\Models\TitleDeletionAudit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use App\Services\NotificationService;

class TitleController extends Controller
{
    use RequiresActivePeriod;

    public function index(Request $request)
    {
        $user = $request->user();
        $periodId = $request->query('period_id');

        $query = Title::query()->with('lecturer');

        if ($periodId) {
            $query->where('period_id', $periodId);
        } else {
            // Default to current active period if no period_id provided
            $query->whereHas('period', function($q) {
                $q->where('is_active', true);
            });
        }

        if ($user->hasRole('dosen')) {
            return $query->where('lecturer_id', $user->id)
                ->withCount([
                    'groups as active_groups_count' => function ($query) {
                        $query->where('status', '!=', 'REJECTED');
                    }
                ])
                ->get();
        }

        if ($user->hasRole('mahasiswa')) {
            // Students see LECTURER titles AND approved STUDENT titles
            return $query->where('status', 'open')
                ->where('is_reserved', false)
                ->where(function ($query) {
                    // Include LECTURER titles with quota > 0
                    $query->where(function ($q) {
                        $q->where('title_source', 'LECTURER')
                            ->orWhereNull('title_source');
                    })
                    ->where('quota', '>', 0);
                })
                ->orWhere(function ($query) use ($periodId) {
                    // Include STUDENT titles that are APPROVED (for marketplace)
                    // ONLY from solo seekers - they need to recruit members
                    $query->where('title_source', 'STUDENT')
                        ->where('supervisor_approval_status', 'APPROVED')
                        ->where('status', 'open')
                        ->where('is_reserved', false)
                        ->whereHas('proposedByGroup', fn($q) => $q->where('is_solo', true));
                    
                    if ($periodId) {
                        $query->where('period_id', $periodId);
                    } else {
                        $query->whereHas('period', function($q) {
                            $q->where('is_active', true);
                        });
                    }
                })
                ->with(['lecturer', 'proposedByGroup.members.student', 'proposedSupervisor'])
                ->withCount([
                    'groups as active_groups_count' => function ($query) {
                        $query->where('status', '!=', 'REJECTED');
                    }
                ])
                ->get()
                ->filter(function ($title) {
                    // For LECTURER titles, check quota
                    if ($title->title_source === 'LECTURER' || $title->title_source === null) {
                        return $title->active_groups_count < $title->quota;
                    }
                    // For STUDENT titles, always show (no quota limit)
                    return true;
                })
                ->values();
        }

        return $query->get();
    }

    public function store(Request $request)
    {
        if ($request->input('pre_assigned_group_id') === '') {
            $request->merge(['pre_assigned_group_id' => null]);
        }

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'required|string',
            'problem_statement' => 'required|string',
            'scope' => 'required|string',
            'specializations' => 'required|array|min:1',
            'specializations.*' => 'string|in:Software,Embedded,Network,Multimedia,AI,Blockchain',
            'quota' => 'required|integer|min:1',
            'period_id' => 'required|exists:periods,id',
            'pre_assigned_group_id' => 'nullable|exists:groups,id',
        ]);

        // Validate that selected period is active
        $selectedPeriod = \App\Models\Period::findOrFail($validated['period_id']);
        if (!$selectedPeriod->is_active) {
            return response()->json(['message' => 'Selected period is not active.'], 422);
        }

        // Set is_reserved if pre_assigned_group_id is provided
        $isReserved = !empty($validated['pre_assigned_group_id']);
        $preAssignedGroup = null;
        if ($isReserved) {
            $preAssignedGroup = Group::with(['members', 'period'])
                ->findOrFail($validated['pre_assigned_group_id']);

            if ((int) $preAssignedGroup->period_id !== (int) $validated['period_id']) {
                return response()->json(['message' => 'Kelompok harus berada dalam periode yang sama.'], 422);
            }

            if ($preAssignedGroup->status !== 'READY_FOR_BIDDING') {
                return response()->json(['message' => 'Kelompok harus berstatus READY_FOR_BIDDING untuk assign judul.'], 422);
            }

            if ($preAssignedGroup->title_id) {
                return response()->json(['message' => 'Kelompok sudah memiliki judul.'], 422);
            }

            $minSize = $preAssignedGroup->period?->min_group_size ?? 3;
            $maxSize = $preAssignedGroup->period?->max_group_size ?? 4;
            $memberCount = $preAssignedGroup->members->count();

            if ($memberCount < $minSize || $memberCount > $maxSize) {
                return response()->json([
                    'message' => "Jumlah anggota kelompok ({$memberCount}) harus antara {$minSize} dan {$maxSize}.",
                ], 422);
            }
        }

        DB::beginTransaction();
        try {
            $title = Title::create([
                'lecturer_id' => $request->user()->id,
                'title' => $validated['title'],
                'description' => $validated['description'],
                'problem_statement' => $validated['problem_statement'],
                'scope' => $validated['scope'],
                'specializations' => $validated['specializations'],
                'quota' => $validated['quota'],
                'status' => 'open',
                'title_source' => 'LECTURER',
                'period_id' => $validated['period_id'],
                'pre_assigned_group_id' => $validated['pre_assigned_group_id'] ?? null,
                'is_reserved' => $isReserved,
            ]);

            if ($preAssignedGroup) {
                $oldStatus = $preAssignedGroup->status;
                $preAssignedGroup->update([
                    'title_id' => $title->id,
                    'status' => $oldStatus === 'READY_FOR_BIDDING' ? 'TITLE_APPROVED' : $oldStatus,
                ]);

                \App\Models\FinalizationAudit::create([
                    'period_id' => $preAssignedGroup->period_id,
                    'group_id' => $preAssignedGroup->id,
                    'user_id' => $request->user()->id,
                    'action' => 'TITLE_ASSIGNED_BY_LECTURER',
                    'old_values' => [
                        'title_id' => null,
                        'status' => $oldStatus,
                    ],
                    'new_values' => [
                        'title_id' => $title->id,
                        'status' => $preAssignedGroup->fresh()->status,
                    ],
                ]);
            }

            DB::commit();

            return response()->json($title->fresh(), 201);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to create title: ' . $e->getMessage()], 500);
        }
    }

    public function show(Title $title)
    {
        return $title->load([
            'lecturer',
            'groups' => function ($q) {
                $q->where('status', '!=', 'REJECTED')->with('members.student');
            }
        ]);
    }

    public function update(Request $request, Title $title)
    {
        $this->ensureModelPeriodActive($title);

        if ($request->user()->id !== $title->lecturer_id && !$request->user()->hasRole('admin')) {
            abort(403, 'Unauthorized');
        }

        // Convert empty string to null for pre_assigned_group_id
        if ($request->input('pre_assigned_group_id') === '') {
            $request->merge(['pre_assigned_group_id' => null]);
        }

        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'sometimes|string',
            'problem_statement' => 'sometimes|string',
            'scope' => 'sometimes|string',
            'specializations' => 'sometimes|array|min:1',
            'specializations.*' => 'string|in:Software,Embedded,Network,Multimedia,AI,Blockchain',
            'quota' => 'sometimes|integer|min:1',
            'status' => 'sometimes|in:open,closed',
            'pre_assigned_group_id' => 'nullable|exists:groups,id',
        ]);

        $oldPreAssignedGroupId = $title->pre_assigned_group_id;
        $newPreAssignedGroupId = $validated['pre_assigned_group_id'] ?? null;

        DB::beginTransaction();
        try {
            // Update title fields
            $title->update([
                ...$validated,
                'is_reserved' => !empty($newPreAssignedGroupId),
            ]);

            // Handle group assignment changes
            if ($oldPreAssignedGroupId != $newPreAssignedGroupId) {
                // Case 1: Unassign old group (if there was one)
                if ($oldPreAssignedGroupId) {
                    $oldGroup = Group::find($oldPreAssignedGroupId);
                    if ($oldGroup && $oldGroup->title_id === $title->id) {
                        $oldGroup->update(['title_id' => null]);
                        // Status will be automatically recalculated or remain as-is
                        
                        \App\Models\FinalizationAudit::create([
                            'period_id' => $oldGroup->period_id,
                            'group_id' => $oldGroup->id,
                            'user_id' => $request->user()->id,
                            'action' => 'TITLE_UNASSIGNED_BY_LECTURER',
                            'old_values' => [
                                'title_id' => $title->id,
                                'status' => $oldGroup->status,
                            ],
                            'new_values' => [
                                'title_id' => null,
                                'status' => $oldGroup->status,
                            ],
                        ]);
                    }
                }

                // Case 2: Assign new group (if there is one)
                if ($newPreAssignedGroupId) {
                    $newGroup = Group::with(['members', 'period'])->findOrFail($newPreAssignedGroupId);

                    // Validate group is in same period
                    if ((int) $newGroup->period_id !== (int) $title->period_id) {
                        DB::rollBack();
                        return response()->json(['message' => 'Kelompok harus berada dalam periode yang sama.'], 422);
                    }

                    // Validate group status
                    if ($newGroup->status !== 'READY_FOR_BIDDING') {
                        DB::rollBack();
                        return response()->json(['message' => 'Kelompok harus berstatus READY_FOR_BIDDING untuk assign judul.'], 422);
                    }

                    // Validate group doesn't already have a title
                    if ($newGroup->title_id && $newGroup->title_id !== $title->id) {
                        DB::rollBack();
                        return response()->json(['message' => 'Kelompok sudah memiliki judul.'], 422);
                    }

                    // Validate member count
                    $minSize = $newGroup->period?->min_group_size ?? 3;
                    $maxSize = $newGroup->period?->max_group_size ?? 4;
                    $memberCount = $newGroup->members->count();

                    if ($memberCount < $minSize || $memberCount > $maxSize) {
                        DB::rollBack();
                        return response()->json([
                            'message' => "Jumlah anggota kelompok ({$memberCount}) harus antara {$minSize} dan {$maxSize}.",
                        ], 422);
                    }

                    // Assign group to title
                    $oldGroupStatus = $newGroup->status;
                    $newGroup->update([
                        'title_id' => $title->id,
                        'status' => 'TITLE_APPROVED',
                    ]);

                    \App\Models\FinalizationAudit::create([
                        'period_id' => $newGroup->period_id,
                        'group_id' => $newGroup->id,
                        'user_id' => $request->user()->id,
                        'action' => 'TITLE_ASSIGNED_BY_LECTURER',
                        'old_values' => [
                            'title_id' => null,
                            'status' => $oldGroupStatus,
                        ],
                        'new_values' => [
                            'title_id' => $title->id,
                            'status' => 'TITLE_APPROVED',
                        ],
                    ]);
                }
            }

            DB::commit();

            return response()->json($title->fresh());
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to update title: ' . $e->getMessage()], 500);
        }
    }

    public function destroy(Request $request, Title $title)
    {
        $this->ensureModelPeriodActive($title);

        if ($request->user()->id !== $title->lecturer_id && !$request->user()->hasRole('admin')) {
            abort(403, 'Unauthorized');
        }

        // Get affected groups before deletion
        $affectedGroups = Group::where('title_id', $title->id)
            ->where('status', '!=', 'READY_FOR_FINALIZATION')
            ->get();
        
        $period = $title->period;
        $minSize = $period->min_group_size ?? 3;
        
        // Revert each group and collect info for audit
        $revertedGroups = [];
        foreach ($affectedGroups as $group) {
            $oldStatus = $group->status;
            // Revert with 'delete' action - always go to base status
            $newStatus = $group->revertAfterTitleLoss($minSize, 'delete');
            $revertedGroups[] = [
                'group_id' => $group->id,
                'old_status' => $oldStatus,
                'new_status' => $newStatus,
            ];
        }

        // Delete all bids for this title (per requirement: delete removes bids)
        \App\Models\Bid::where('title_id', $title->id)->delete();

        // Create audit log before deletion if there were affected groups
        if (!empty($revertedGroups)) {
            TitleDeletionAudit::create([
                'title_id' => $title->id,
                'title_name' => $title->title,
                'lecturer_id' => $title->lecturer_id,
                'period_id' => $title->period_id,
                'affected_groups' => $revertedGroups,
                'deleted_by' => $request->user()->id,
            ]);
        }

        $title->delete();

        return response()->json([
            'message' => 'Title deleted',
            'affected_groups' => $revertedGroups,
        ]);
    }

    /**
     * Lecturer withdraws approval from a title.
     * Works for both LECTURER and STUDENT PROPOSED titles.
     * Reverts affected groups to FORMING_SOLO and triggers notifications.
     */
    public function withdrawApproval(Request $request, Title $title, NotificationService $notificationService)
    {
        $this->ensureModelPeriodActive($title);

        // 1. Authorization: User is the lecturer who created this title
        if ($request->user()->id !== $title->lecturer_id) {
            abort(403, 'Only the lecturer can withdraw approval from this title');
        }

        // 2. Validation: Title must be approved
        // For LECTURER titles: status = 'APPROVED'
        // For STUDENT PROPOSED titles: supervisor_approval_status = 'APPROVED'
        $isLecturerTitle = ($title->title_source === 'LECTURER' || empty($title->title_source));
        $isStudentProposedTitle = ($title->title_source === 'STUDENT');
        $isApproved = false;

        if ($isLecturerTitle && $title->status === 'APPROVED') {
            $isApproved = true;
        } elseif ($isStudentProposedTitle && $title->supervisor_approval_status === 'APPROVED') {
            $isApproved = true;
        }

        if (!$isApproved) {
            return response()->json(['message' => 'Title is not approved'], 422);
        }

        // 3. Find affected groups bidding on this title (exclude those already at READY_FOR_FINALIZATION)
        $affectedGroups = Group::where('title_id', $title->id)
            ->where('status', '!=', 'READY_FOR_FINALIZATION')
            ->get();

        // 4. If no groups affected, title might not be actively bidded on
        if ($affectedGroups->isEmpty()) {
            return response()->json(['message' => 'No groups to affect or all groups already finalized'], 422);
        }

        // 5. Update title status based on title source
        if ($isStudentProposedTitle) {
            // STUDENT PROPOSED: revert to UNDER_REVIEW (pre-approval)
            // This will make the title visible in the marketplace again
            $title->update(['supervisor_approval_status' => 'UNDER_REVIEW']);
        } else {
            // LECTURER titles: revert to PENDING
            $title->update(['status' => 'PENDING']);
        }

        // NOTE: Bids are kept on withdrawal (groups can re-bid if needed)
        // Bids are only deleted when title is permanently deleted

        // 6. For each affected group: revert to appropriate status based on member count
        $period = $title->period;
        $minSize = $period->min_group_size ?? 3;
        $reason = $request->input('reason');
        
        foreach ($affectedGroups as $group) {
            $oldStatus = $group->status;
            // Revert with 'withdraw' action - approved groups go to WAITING_SUPERVISOR_APPROVAL
            $newStatus = $group->revertAfterTitleLoss($minSize, 'withdraw');

            // Create audit log entry with status change info
            TitleApprovalAudit::create([
                'title_id' => $title->id,
                'lecturer_id' => $request->user()->id,
                'affected_group_id' => $group->id,
                'action' => 'WITHDRAW',
                'reason' => $reason,
                'metadata' => json_encode([
                    'old_group_status' => $oldStatus,
                    'new_group_status' => $newStatus,
                ]),
            ]);

            // Notify all group members
            $notificationService->notifyGroupOfWithdrawal($group, $title, $reason);
        }

        return response()->json([
            'message' => 'Approval withdrawn successfully',
            'affected_groups_count' => $affectedGroups->count(),
        ]);
    }

    /**
     * Get approval history for a title (visible to lecturer and affected groups).
     */
    public function getApprovalHistory(Request $request, Title $title)
    {
        // Authorization: Lecturer who created this title, or admin
        if ($request->user()->id !== $title->lecturer_id && !$request->user()->hasRole('admin')) {
            abort(403, 'Unauthorized');
        }

        $audits = $title->approvalAudits()
            ->with(['lecturer', 'affectedGroup'])
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($audit) {
                return [
                    'id' => $audit->id,
                    'action' => $audit->action,
                    'reason' => $audit->reason,
                    'lecturer' => [
                        'id' => $audit->lecturer->id,
                        'name' => $audit->lecturer->name,
                        'email' => $audit->lecturer->email,
                    ],
                    'affected_group' => $audit->affectedGroup ? [
                        'id' => $audit->affectedGroup->id,
                        'name' => $audit->affectedGroup->name,
                    ] : null,
                    'created_at' => $audit->created_at,
                ];
            });

        return response()->json($audits);
    }

    /**
     * Get deletion history for a title (visible to lecturer and affected groups).
     */
    public function getDeletionHistory(Request $request, Title $title)
    {
        // Authorization: Lecturer who created this title, or admin
        if ($request->user()->id !== $title->lecturer_id && !$request->user()->hasRole('admin')) {
            abort(403, 'Unauthorized');
        }

        $audits = $title->deletionAudits()
            ->with(['lecturer'])
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($audit) {
                return [
                    'id' => $audit->id,
                    'action' => $audit->action,
                    'reason' => $audit->reason,
                    'lecturer' => [
                        'id' => $audit->lecturer->id,
                        'name' => $audit->lecturer->name,
                        'email' => $audit->lecturer->email,
                    ],
                    'affected_groups_count' => $audit->affected_groups_count,
                    'reverted_group_ids' => json_decode($audit->reverted_group_ids, true),
                    'created_at' => $audit->created_at,
                ];
            });

        return response()->json($audits);
    }
}
