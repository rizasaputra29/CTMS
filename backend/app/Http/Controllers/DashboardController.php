<?php

namespace App\Http\Controllers;

use App\Models\Bid;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Period;
use App\Models\Schedule;
use App\Models\SeminarSchedule;
use App\Models\ExpoRegistration;
use App\Models\TaDefenseSchedule;
use App\Models\Document;
use App\Models\PhaseDocumentRequirement;
use App\Models\Title;
use App\Models\User;
use App\Services\FinalizationService;
use App\Services\WorkflowService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;

class DashboardController extends Controller
{
    protected WorkflowService $workflowService;

    public function __construct(WorkflowService $workflowService)
    {
        $this->workflowService = $workflowService;
    }
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

        if (! $periodId) {
            $currentPeriod = Period::getActive('period:active:latest');
            $periodId = $currentPeriod ? $currentPeriod->id : null;
        }

        $totalTitles = Title::where('lecturer_id', $user->id)->count();

        $activeGroups = Group::whereIn('title_id', function ($q) use ($user) {
            $q->select('id')->from('titles')->where('lecturer_id', $user->id);
        })
            ->where('status', 'APPROVED')
            ->when($periodId, fn ($q) => $q->where('period_id', $periodId))
            ->count();

        $pendingBimbingan = 0;

        $pendingProposals = Title::where('proposed_supervisor_id', $user->id)
            ->where('title_source', 'STUDENT')
            ->where('supervisor_approval_status', 'PENDING')
            ->when($periodId, fn ($q) => $q->whereHas('proposedByGroup',
                fn ($q2) => $q2->where('period_id', $periodId)))
            ->count();

        $availablePeriods = Period::orderBy('created_at', 'desc')->get(['id', 'name', 'is_active']);

        $pendingAssignmentsCount = 0;
        if ($periodId) {
            $pendingAssignmentsCount = Bid::where('lecturer_recommendation', 'ACCEPT')
                ->where('status', 'PENDING')
                ->where(function ($q) use ($user) {
                    $q->where('proposed_supervisor_1_id', $user->id)
                        ->orWhere('proposed_supervisor_2_id', $user->id);
                })
                ->whereHas('group', fn ($q) => $q->where('period_id', $periodId))
                ->count();
        }

        return response()->json([
            'total_titles' => $totalTitles,
            'active_groups' => $activeGroups,
            'pending_bimbingan' => $pendingBimbingan,
            'pending_proposals' => $pendingProposals,
            'pending_assignments_count' => $pendingAssignmentsCount,
            'available_periods' => $availablePeriods,
            'selected_period_id' => $periodId,
        ]);
    }

    public function mahasiswa()
    {
        $user = Auth::user();
        $currentPeriod = Period::getActive('period:active:latest');

        $groupMember = GroupMember::with(['group.period', 'group.title'])
            ->where('student_id', $user->id)
            ->where('period_id', $currentPeriod?->id)
            ->whereHas('group', fn ($q) => $q->where('status', '!=', 'REJECTED'))
            ->first();

        $group = $groupMember ? $groupMember->group : null;

        $documents = $group
            ? \App\Models\Document::where('group_id', $group->id)->get()
            : collect([]);

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
            $isGraduated = $currentOrder >= 13 && collect($steps)->every(fn ($v) => $v === true);
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

        // Fetch upcoming schedules for the student's group
        $upcomingSchedules = [];
        if ($group) {
            $now = Carbon::now();
            $groupId = $group->id;
            
            // 1. BIMBINGAN schedules
            $bimbinganSchedules = Schedule::where('group_id', $groupId)
                ->where('type', 'BIMBINGAN')
                ->where('date', '>', $now)
                ->orderBy('date', 'asc')
                ->get()
                ->map(function ($schedule) {
                    return [
                        'id' => $schedule->id,
                        'type' => 'BIMBINGAN',
                        'date' => $schedule->date,
                        'room' => $schedule->room,
                        'mode' => $schedule->mode,
                        'notes' => $schedule->notes,
                        'time_until' => Carbon::parse($schedule->date)->diffForHumans(),
                    ];
                });
            $upcomingSchedules = array_merge($upcomingSchedules, $bimbinganSchedules->toArray());
            
            // 2. SEMPRO schedules
            $semproSchedules = SeminarSchedule::where('group_id', $groupId)
                ->where('type', 'SEMPRO')
                ->whereRaw("CONCAT(date, ' ', start_time) > ?", [$now])
                ->orderBy('date', 'asc')
                ->orderBy('start_time', 'asc')
                ->get()
                ->map(function ($schedule) {
                    $dateTime = Carbon::parse($schedule->date->format('Y-m-d') . ' ' . $schedule->start_time);
                    return [
                        'id' => 'sempro_' . $schedule->id,
                        'type' => 'SEMPRO',
                        'date' => $dateTime->toDateTimeString(),
                        'room' => $schedule->room,
                        'mode' => null,
                        'notes' => null,
                        'time_until' => $dateTime->diffForHumans(),
                    ];
                });
            $upcomingSchedules = array_merge($upcomingSchedules, $semproSchedules->toArray());
            
            // 3. EXPO events
            $expoRegistrations = ExpoRegistration::where('group_id', $groupId)
                ->with(['expoEvent' => function ($query) use ($now) {
                    $query->whereRaw("CONCAT(date, ' ', start_time) > ?", [$now]);
                }])
                ->get();
                
            foreach ($expoRegistrations as $registration) {
                $event = $registration->expoEvent;
                if ($event) {
                    $dateTime = Carbon::parse($event->date->format('Y-m-d') . ' ' . $event->start_time);
                    $upcomingSchedules[] = [
                        'id' => 'expo_' . $event->id,
                        'type' => 'EXPO',
                        'date' => $dateTime->toDateTimeString(),
                        'room' => $event->room,
                        'mode' => null,
                        'notes' => $event->name,
                        'time_until' => $dateTime->diffForHumans(),
                    ];
                }
            }
            
            // 4. TA Defense schedules
            $taDefenseSchedules = TaDefenseSchedule::where('student_id', $user->id)
                ->whereIn('status', ['SCHEDULED', 'DONE'])
                ->whereRaw("CONCAT(date, ' ', start_time) > ?", [$now])
                ->orderBy('date', 'asc')
                ->orderBy('start_time', 'asc')
                ->get()
                ->map(function ($schedule) {
                    $dateTime = Carbon::parse($schedule->date->format('Y-m-d') . ' ' . $schedule->start_time);
                    return [
                        'id' => 'ta_defense_' . $schedule->id,
                        'type' => 'TA_DEFENSE',
                        'date' => $dateTime->toDateTimeString(),
                        'room' => $schedule->room,
                        'mode' => null,
                        'notes' => $schedule->notes,
                        'time_until' => $dateTime->diffForHumans(),
                    ];
                });
            $upcomingSchedules = array_merge($upcomingSchedules, $taDefenseSchedules->toArray());
            
            // Sort all schedules by date
            usort($upcomingSchedules, function ($a, $b) {
                return strtotime($a['date']) - strtotime($b['date']);
            });
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
            'upcoming_schedules' => $upcomingSchedules,
        ]);
    }

    /**
     * Get detailed workflow data for the dashboard (lazy loaded).
     */
    public function workflow()
    {
        $user = Auth::user();
        $currentPeriod = Period::getActive('period:active:latest');

        $groupMember = GroupMember::with(['group.period', 'group.title'])
            ->where('student_id', $user->id)
            ->where('period_id', $currentPeriod?->id)
            ->whereHas('group', fn ($q) => $q->where('status', '!=', 'REJECTED'))
            ->first();

        if (!$groupMember || !$groupMember->group) {
            return response()->json([
                'workflow' => null,
                'next_phase_requirements' => null,
                'final_ready_for_ta_individual' => null,
            ]);
        }

        $group = $groupMember->group;
        $periodId = $group->period_id;
        $allRequirements = PhaseDocumentRequirement::where('period_id', $periodId)->get();
        $documents = Document::where('group_id', $group->id)->get();

        $workflowData = $this->workflowService->getWorkflowData($group, $documents, $allRequirements);
        $nextPhaseRequirements = $this->workflowService->getNextPhaseRequirements(
            $group,
            $workflowData['phases'],
            $allRequirements,
            $documents
        );
        $finalReadyForTaIndividual = $this->workflowService->getFinalReadyForTaIndividual(
            $group,
            $allRequirements,
            $documents
        );

        return response()->json([
            'workflow' => $workflowData,
            'next_phase_requirements' => $nextPhaseRequirements,
            'final_ready_for_ta_individual' => $finalReadyForTaIndividual,
        ]);
    }
}
