<?php

namespace App\Http\Controllers;

use App\Models\Title;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\TitleApprovalAudit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Services\NotificationService;

class TitleController extends Controller
{
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

        return response()->json($title, 201);
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
        if ($request->user()->id !== $title->lecturer_id && !$request->user()->hasRole('admin')) {
            abort(403, 'Unauthorized');
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
        ]);

        $title->update($validated);

        return response()->json($title);
    }

    public function destroy(Request $request, Title $title)
    {
        if ($request->user()->id !== $title->lecturer_id && !$request->user()->hasRole('admin')) {
            abort(403, 'Unauthorized');
        }

        $title->delete();

        return response()->json(['message' => 'Title deleted']);
    }

    /**
     * Lecturer withdraws approval from a title.
     * Works for both LECTURER and STUDENT PROPOSED titles.
     * Reverts affected groups to FORMING_SOLO and triggers notifications.
     */
    public function withdrawApproval(Request $request, Title $title, NotificationService $notificationService)
    {
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

        // 6. For each affected group: revert to FORMING_SOLO
        $reason = $request->input('reason');
        foreach ($affectedGroups as $group) {
            // Revert status
            $group->revertToFormingSolo();

            // Create audit log entry
            TitleApprovalAudit::create([
                'title_id' => $title->id,
                'lecturer_id' => $request->user()->id,
                'affected_group_id' => $group->id,
                'action' => 'WITHDRAW',
                'reason' => $reason,
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
}
