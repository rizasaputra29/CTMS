<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use App\Models\Period;
use App\Models\Title;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Bid;
use App\Services\FinalizationService;
use Illuminate\Support\Facades\Auth;

class DashboardController extends Controller
{
    public function admin()
    {
        $currentPeriod = Period::getActive('period:active:latest');
        $readinessStats = $currentPeriod ? app(FinalizationService::class)->getReadinessStats($currentPeriod->id) : null;

        return response()->json([
            'total_users' => User::count(),
            'total_students' => User::where('role', 'mahasiswa')->count(),
            'total_lecturers' => User::where('role', 'dosen')->count(),
            'active_periods' => Period::getAllActive(),
            'registration_summary' => $readinessStats ? [
                'total' => $readinessStats['total_registered'],
                'assigned' => $readinessStats['total_assigned'],
                'unassigned' => $readinessStats['total_unassigned'],
            ] : null,
            'readiness_overview' => $readinessStats ? [
                'total_groups' => $readinessStats['total_groups'],
                'invalid_groups' => $readinessStats['total_invalid_groups'],
                'global_progress' => $readinessStats['global_progress'],
            ] : null,
            'unassigned_list' => $readinessStats ? $readinessStats['unassigned_students'] : [],
        ]);
    }

    public function dosen(Request $request)
    {
        $user = Auth::user();
        $periodId = $request->query('period_id');

        // Resolve current period if not provided (use cached version)
        if (!$periodId) {
            $currentPeriod = Period::getActive('period:active:latest');
            $periodId = $currentPeriod ? $currentPeriod->id : null;
        }

        $titlesQuery = Title::where('lecturer_id', $user->id);
        if ($periodId) {
            // Note: Lecturer titles are generally reused, but let's assume filtering 
            // is useful for seeing titles that were active or used in a period.
            // For now, we'll keep it simple: total titles for the lecturer.
        }
        $titles = $titlesQuery->get();
        $totalTitles = $titles->count();

        $groupsQuery = Group::whereIn('title_id', $titles->pluck('id'))
            ->where('status', 'APPROVED');
        if ($periodId) {
            $groupsQuery->where('period_id', $periodId);
        }
        $activeGroups = $groupsQuery->count();

        $pendingBimbingan = 0;

        // Count pending student proposals for this lecturer in this period
        $pendingProposalsQuery = Title::where('proposed_supervisor_id', $user->id)
            ->where('title_source', 'STUDENT')
            ->where('supervisor_approval_status', 'PENDING');
        if ($periodId) {
            $pendingProposalsQuery->whereHas('proposedByGroup', function($q) use ($periodId) {
                $q->where('period_id', $periodId);
            });
        }
        $pendingProposals = $pendingProposalsQuery->count();

        $availablePeriods = Period::orderBy('created_at', 'desc')->get(['id', 'name', 'is_active']);

        // New: Identify groups where this lecturer is recommended/proposed but not yet finalized
        $pendingAssignmentsCount = 0;
        if ($periodId) {
            $pendingAssignmentsCount = Bid::where('lecturer_recommendation', 'ACCEPT')
                ->where('status', 'PENDING')
                ->where(function($q) use ($user) {
                    $q->where('proposed_supervisor_1_id', $user->id)
                      ->orWhere('proposed_supervisor_2_id', $user->id);
                })
                ->whereHas('group', fn($q) => $q->where('period_id', $periodId))
                ->count();
        }

        return response()->json([
            'total_titles' => $totalTitles,
            'active_groups' => $activeGroups,
            'pending_bimbingan' => $pendingBimbingan, // Legacy field
            'pending_proposals' => $pendingProposals,
            'pending_assignments_count' => $pendingAssignmentsCount,
            'available_periods' => $availablePeriods,
            'selected_period_id' => $periodId,
        ]);
    }

    public function mahasiswa()
    {
        $user = Auth::user();
        
        // Get current active period (cached)
        $currentPeriod = Period::getActive('period:active:latest');
        
        // Find group where user is a member (exclude rejected groups) for current period only
        $groupMember = GroupMember::with(['group.title'])
            ->where('student_id', $user->id)
            ->where('period_id', $currentPeriod?->id)
            ->whereHas('group', function ($q) {
                $q->where('status', '!=', 'REJECTED');
            })
            ->first();
        $group = $groupMember ? $groupMember->group : null;
        if ($group) {
            $group->load('period');
        }

        $documents = $group ? \App\Models\Document::where('group_id', $group->id)->get() : collect([]);

        $phases = ['PDC1', 'SEMPRO', 'PDC2', 'TA', 'SIDANG', 'EXPO'];
        $steps = [];
        foreach ($phases as $phase) {
            $steps[$phase] = $documents->where('phase', $phase)->where('status', 'APPROVED')->isNotEmpty();
        }

        // Check graduation status - group is graduated when all phases completed
        // Use statusOrder to check if group has reached at least CLOSED state
        $isGraduated = false;
        if ($group) {
            $statusOrder = [
                'FORMING' => 0,
                'FORMING_SOLO' => 1,
                'SOFT_FORMING' => 2,
                'WAITING_SUPERVISOR_APPROVAL' => 3,
                'READY_FOR_BIDDING' => 4,
                'KELOMPOK_FINAL' => 5,
                'PDC1_ACTIVE' => 6,
                'READY_FOR_SEMPRO' => 7,
                'SEMPRO_DONE' => 8,
                'PDC2_ACTIVE' => 9,
                'PDC2_READY_FOR_EXPO' => 10,
                'EXPO_REGISTERED' => 11,
                'EXPO_DONE' => 12,
                'READY_FOR_TA_INDIVIDUAL' => 13,
                'CLOSED' => 14,
            ];
            $currentOrder = $statusOrder[$group->status] ?? 0;
            $isGraduated = $currentOrder >= 13 && collect($steps)->every(fn($v) => $v === true);
        }

        // Check for pending proposal
        $pendingProposal = null;
        if ($group) {
            $pendingProposal = Title::where('proposed_by_group_id', $group->id)
                ->where('title_source', 'STUDENT')
                ->whereIn('supervisor_approval_status', ['PENDING', 'REJECTED'])
                ->with('proposedSupervisor')
                ->latest()
                ->first();
        }

        return response()->json([
            'has_group' => $group ? true : false,
            'group_status' => $group ? $group->status : null,
            'readiness' => $group ? ($group->readiness_status ?? $group->calculateReadiness()) : null,
            'title' => $group && $group->title ? $group->title->title : null,
            'group_period' => $group ? $group->period : null,
            'active_periods' => Period::getAllActive(),
            'steps' => $steps,
            'is_graduated' => $isGraduated,
            'pending_proposal' => $pendingProposal,
        ]);
    }
}
