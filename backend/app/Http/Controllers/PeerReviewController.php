<?php

namespace App\Http\Controllers;

use App\Models\PeerReview;
use App\Models\PeriodPeerReviewIndicator;
use App\Models\GroupMember;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class PeerReviewController extends Controller
{
    /**
     * [Mahasiswa] Get peer review form: group members + indicators + existing reviews.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $member = GroupMember::where('student_id', $user->id)->first();

        if (!$member) {
            return response()->json(['message' => 'You are not in any group'], 404);
        }

        $group = $member->group()->with(['members.student', 'period'])->first();

        // Get indicators for the period from period_peer_review_indicators
        $periodIndicators = PeriodPeerReviewIndicator::with('template')
            ->where('period_id', $group->period_id)
            ->orderBy('sort_order')
            ->get();

        // Map to indicator format
        $indicators = $periodIndicators->map(fn($i) => [
            'id' => $i->id,
            'name' => $i->template->name,
            'description' => $i->template->description,
            'weight' => $i->template->weight,
            'sort_order' => $i->sort_order,
            'template_id' => $i->template_id,
        ]);

        // Get existing peer reviews by this user using period_indicator_id
        $existingReviews = PeerReview::where('group_id', $group->id)
            ->where('reviewer_id', $user->id)
            ->get();

        // Get other members (exclude self)
        $otherMembers = $group->members()
            ->where('student_id', '!=', $user->id)
            ->with('student')
            ->get();

        // Check if locked
        $stateMachine = new \App\Services\GroupStateMachine();
        $isLocked = !$stateMachine->isAtLeast($group, 'EXPO_REGISTERED');

        return response()->json([
            'group' => $group,
            'indicators' => $indicators,
            'members' => $otherMembers,
            'existing_reviews' => $existingReviews,
            'is_locked' => $isLocked,
        ]);
    }

    /**
     * [Mahasiswa] Check if peer review is active for the student's period.
     */
    public function status(Request $request)
    {
        $user = $request->user();
        $member = GroupMember::where('student_id', $user->id)->with('group')->first();

        if (!$member || !$member->group) {
            return response()->json(['active' => false]);
        }

        $active = PeriodPeerReviewIndicator::where('period_id', $member->group->period_id)->exists();

        return response()->json(['active' => $active]);
    }

    /**
     * [Mahasiswa] Submit peer reviews for all group members.
     */
    public function store(Request $request)
    {
        $request->validate([
            'reviews' => 'required|array|min:1',
            'reviews.*.reviewee_id' => 'required|exists:users,id',
            'reviews.*.period_indicator_id' => 'required|exists:period_peer_review_indicators,id',
            'reviews.*.score' => 'required|numeric|min:0|max:100',
            'reviews.*.comment' => 'nullable|string',
        ]);

        $user = $request->user();
        $member = GroupMember::with('group')->where('student_id', $user->id)->firstOrFail();

        $stateMachine = new \App\Services\GroupStateMachine();
        // Peer review unlocks AFTER EXPO completion (EXPO_DONE status)
        if (!$stateMachine->isAtLeast($member->group, 'EXPO_DONE')) {
            return response()->json(['message' => 'Peer review is locked until EXPO is completed.'], 403);
        }

        // Check if student has already completed peer review (final submission)
        $existingStatus = \App\Models\StudentPeerReviewStatus::where('student_id', $user->id)
            ->where('group_id', $member->group_id)
            ->first();
        
        if ($existingStatus && $existingStatus->has_completed_peer_review) {
            return response()->json(['message' => 'You have already completed peer review.'], 403);
        }

        $saved = [];

        foreach ($request->reviews as $review) {
            $saved[] = PeerReview::updateOrCreate(
                [
                    'group_id' => $member->group_id,
                    'reviewer_id' => $user->id,
                    'reviewee_id' => $review['reviewee_id'],
                    'period_indicator_id' => $review['period_indicator_id'],
                ],
                [
                    'score' => $review['score'],
                    'comment' => $review['comment'] ?? null,
                    'is_final_submission' => true,
                    'submitted_at' => now(),
                ]
            );
        }

        // Check if student has completed all required reviews
        $this->checkAndUpdateCompletionStatus($user->id, $member->group_id, $member->group->period_id);

        return response()->json(['message' => 'Peer review submitted', 'count' => count($saved)], 201);
    }

    /**
     * [Dosen] View peer review results for a supervised group.
     */
    public function groupReviews(Request $request)
    {
        $request->validate([
            'group_id' => 'required|exists:groups,id',
        ]);

        $reviews = PeerReview::with(['reviewer', 'reviewee', 'periodIndicator.template'])
            ->where('group_id', $request->group_id)
            ->get();

        // Group by reviewee
        $grouped = $reviews->groupBy('reviewee_id')->map(function ($revieweeReviews) {
            $totalWeighted = 0;
            $totalWeight = 0;

            foreach ($revieweeReviews as $r) {
                $weight = $r->periodIndicator->template->weight;
                $totalWeighted += $r->score * $weight;
                $totalWeight += $weight;
            }

            return [
                'reviewee' => $revieweeReviews->first()->reviewee,
                'reviews' => $revieweeReviews,
                'weighted_avg' => $totalWeight > 0 ? round($totalWeighted / $totalWeight, 2) : 0,
            ];
        });

        return response()->json($grouped);
    }

    /**
     * [Admin] List peer review indicators for a period.
     * Note: Deprecated - use PeriodPeerReviewConfigController instead.
     */
    public function indicators(Request $request)
    {
        $request->validate([
            'period_id' => 'required|exists:periods,id',
        ]);

        $periodIndicators = PeriodPeerReviewIndicator::with('template')
            ->where('period_id', $request->period_id)
            ->orderBy('sort_order')
            ->get();

        return response()->json($periodIndicators->map(fn($i) => [
            'id' => $i->id,
            'name' => $i->template->name,
            'description' => $i->template->description,
            'weight' => $i->template->weight,
            'sort_order' => $i->sort_order,
            'template_id' => $i->template_id,
        ]));
    }

    /**
     * [Admin] Create/update a peer review indicator.
     * Note: Deprecated - use PeriodPeerReviewConfigController instead.
     */
    public function storeIndicator(Request $request)
    {
        return response()->json([
            'message' => 'Use PeriodPeerReviewConfigController to configure peer review indicators for a period.'
        ], 400);
    }

    /**
     * [Admin] Update an indicator.
     * Note: Deprecated - use PeriodPeerReviewConfigController instead.
     */
    public function updateIndicator(Request $request, $id)
    {
        return response()->json([
            'message' => 'Use PeriodPeerReviewConfigController to configure peer review indicators for a period.'
        ], 400);
    }

    /**
     * [Admin] Delete an indicator.
     * Note: Deprecated - use PeriodPeerReviewConfigController instead.
     */
    public function destroyIndicator($id)
    {
        return response()->json([
            'message' => 'Use PeriodPeerReviewConfigController to configure peer review indicators for a period.'
        ], 400);
    }

    /**
     * Check if student has completed all required peer reviews and update status.
     */
    private function checkAndUpdateCompletionStatus(int $studentId, int $groupId, int $periodId): void
    {
        $group = \App\Models\Group::with('members')->findOrFail($groupId);
        $indicatorsCount = \App\Models\PeriodPeerReviewIndicator::where('period_id', $periodId)->count();
        $otherMembersCount = $group->members->where('student_id', '!=', $studentId)->count();
        $expectedReviews = $indicatorsCount * $otherMembersCount;

        $submittedReviews = PeerReview::where('reviewer_id', $studentId)
            ->where('group_id', $groupId)
            ->where('is_final_submission', true)
            ->count();

        $hasCompleted = $submittedReviews >= $expectedReviews;

        // Update or create student peer review status
        $status = \App\Models\StudentPeerReviewStatus::firstOrNew([
            'student_id' => $studentId,
            'group_id' => $groupId,
            'period_id' => $periodId,
        ]);

        $status->has_completed_peer_review = $hasCompleted;
        if ($hasCompleted) {
            $status->ta_status = 'TA_ACTIVE';
        }
        $status->save();

        // Check if all group members completed peer review
        if ($hasCompleted) {
            $this->checkGroupPeerReviewCompletion($groupId);
        }
    }

    /**
     * Check if all group members completed peer review and transition group status.
     */
    private function checkGroupPeerReviewCompletion(int $groupId): void
    {
        $group = \App\Models\Group::with('members')->find($groupId);
        if (!$group) return;

        $totalMembers = $group->members()->count();
        $completedCount = \App\Models\StudentPeerReviewStatus::where('group_id', $groupId)
            ->where('has_completed_peer_review', true)
            ->count();

        if ($completedCount === $totalMembers) {
            $stateMachine = new \App\Services\GroupStateMachine();
            try {
                // Transition to PDC2_COMPLETED first
                $stateMachine->transition($group, 'PDC2_COMPLETED');
                // Then auto-transition to TA_IN_PROGRESS
                $stateMachine->transition($group, 'TA_IN_PROGRESS');
            } catch (\Exception $e) {
                \Log::info("Could not transition group {$groupId}: " . $e->getMessage());
            }
        }
    }

    /**
     * [Mahasiswa] Get my peer review completion status.
     */
    public function myStatus(Request $request)
    {
        $user = $request->user();
        $member = GroupMember::with('group')->where('student_id', $user->id)->first();

        if (!$member || !$member->group) {
            return response()->json([
                'has_completed' => false,
                'ta_status' => null,
                'can_access_ta' => false,
            ]);
        }

        $status = \App\Models\StudentPeerReviewStatus::where('student_id', $user->id)
            ->where('group_id', $member->group_id)
            ->first();

        $stateMachine = new \App\Services\GroupStateMachine();
        $expoDone = $stateMachine->isAtLeast($member->group, 'EXPO_DONE');

        return response()->json([
            'has_completed' => $status?->has_completed_peer_review ?? false,
            'ta_status' => $status?->ta_status ?? 'TA_BLOCKED',
            'can_access_ta' => $status?->ta_status === 'TA_ACTIVE',
            'expo_done' => $expoDone,
            'peer_review_unlocked' => $expoDone,
        ]);
    }

    /**
     * [Admin] Get peer review completion progress for all groups.
     */
    public function adminGroupProgress(Request $request)
    {
        $request->validate([
            'period_id' => 'nullable|exists:periods,id',
        ]);

        $query = \App\Models\Group::with(['members.student', 'period'])
            ->whereHas('period', function ($q) {
                $q->where('is_active', true);
            });

        if ($request->period_id) {
            $query->where('period_id', $request->period_id);
        }

        $groups = $query->get()->map(function ($group) {
            $members = $group->members;
            $totalMembers = $members->count();

            $completedCount = \App\Models\StudentPeerReviewStatus::where('group_id', $group->id)
                ->where('has_completed_peer_review', true)
                ->count();

            $completionPercentage = $totalMembers > 0 ? round(($completedCount / $totalMembers) * 100, 2) : 0;

            return [
                'group_id' => $group->id,
                'group_name' => $group->name,
                'group_code' => $group->code,
                'period_name' => $group->period->name,
                'total_members' => $totalMembers,
                'completed_count' => $completedCount,
                'completion_percentage' => $completionPercentage,
                'members' => $members->map(function ($member) {
                    $status = \App\Models\StudentPeerReviewStatus::where('student_id', $member->student_id)
                        ->where('group_id', $member->group_id)
                        ->first();

                    return [
                        'student_id' => $member->student_id,
                        'student_name' => $member->student->name,
                        'student_nim' => $member->student->nim,
                        'has_completed' => $status?->has_completed_peer_review ?? false,
                        'ta_status' => $status?->ta_status ?? 'TA_BLOCKED',
                    ];
                }),
            ];
        });

        return response()->json($groups);
    }
}
