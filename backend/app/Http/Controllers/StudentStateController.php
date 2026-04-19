<?php

namespace App\Http\Controllers;

use App\Models\StudentPeerReviewStatus;
use App\Models\GroupMember;
use App\Models\PeerReview;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class StudentStateController extends Controller
{
    /**
     * Get TA status for a specific student
     */
    public function getStudentTAStatus(Request $request, int $studentId): JsonResponse
    {
        $status = StudentPeerReviewStatus::where('student_id', $studentId)
            ->where('period_id', $request->user()->period_id ?? $request->input('period_id'))
            ->first();

        if (!$status) {
            return response()->json([
                'student_id' => $studentId,
                'ta_status' => 'TA_BLOCKED',
                'has_completed_peer_review' => false,
                'message' => 'Student has not started peer review process'
            ]);
        }

        return response()->json([
            'student_id' => $studentId,
            'ta_status' => $status->ta_status,
            'has_completed_peer_review' => $status->has_completed_peer_review,
            'updated_at' => $status->updated_at
        ]);
    }

    /**
     * Update TA status for a specific student (admin or system use)
     */
    public function updateStudentTAStatus(Request $request, int $studentId): JsonResponse
    {
        $validated = $request->validate([
            'ta_status' => 'required|in:TA_BLOCKED,TA_ACTIVE,TA_DONE',
            'period_id' => 'required|exists:periods,id'
        ]);

        $status = StudentPeerReviewStatus::firstOrCreate(
            [
                'student_id' => $studentId,
                'period_id' => $validated['period_id']
            ],
            [
                'group_id' => GroupMember::where('student_id', $studentId)->first()?->group_id,
                'has_completed_peer_review' => false,
                'ta_status' => 'TA_BLOCKED'
            ]
        );

        $oldStatus = $status->ta_status;
        $status->update(['ta_status' => $validated['ta_status']]);

        return response()->json([
            'message' => 'TA status updated successfully',
            'student_id' => $studentId,
            'old_status' => $oldStatus,
            'new_status' => $validated['ta_status']
        ]);
    }

    /**
     * Bulk update TA status for all members of a group after peer review completion check
     */
    public function bulkUpdateAfterPeerReview(Request $request, int $groupId): JsonResponse
    {
        $members = GroupMember::where('group_id', $groupId)
            ->with('student')
            ->get();

        $updated = [];
        $errors = [];

        foreach ($members as $member) {
            try {
                $hasCompleted = $this->checkPeerReviewCompletion($member->student_id, $groupId);
                
                $status = StudentPeerReviewStatus::firstOrCreate(
                    [
                        'student_id' => $member->student_id,
                        'group_id' => $groupId,
                        'period_id' => $member->group->period_id
                    ],
                    [
                        'has_completed_peer_review' => false,
                        'ta_status' => 'TA_BLOCKED'
                    ]
                );

                if ($hasCompleted && $status->ta_status === 'TA_BLOCKED') {
                    $status->markActive();
                    $updated[] = [
                        'student_id' => $member->student_id,
                        'student_name' => $member->student->name,
                        'action' => 'activated'
                    ];
                }
            } catch (\Exception $e) {
                $errors[] = [
                    'student_id' => $member->student_id,
                    'error' => $e->getMessage()
                ];
            }
        }

        return response()->json([
            'message' => 'Bulk update completed',
            'group_id' => $groupId,
            'updated_count' => count($updated),
            'updated_students' => $updated,
            'errors' => $errors
        ]);
    }

    /**
     * Check if a student has completed all required peer reviews for their group
     */
    public function checkPeerReviewCompletion(int $studentId, int $groupId): bool
    {
        // Get all group members except the reviewer
        $groupMembers = GroupMember::where('group_id', $groupId)
            ->where('student_id', '!=', $studentId)
            ->pluck('student_id');

        if ($groupMembers->isEmpty()) {
            return true; // Single member group, auto-complete
        }

        // Count how many members this student has reviewed
        $reviewedCount = PeerReview::where('reviewer_id', $studentId)
            ->where('group_id', $groupId)
            ->whereIn('reviewee_id', $groupMembers)
            ->distinct('reviewee_id')
            ->count('reviewee_id');

        return $reviewedCount >= $groupMembers->count();
    }

    /**
     * Get all students with their TA status for a group (for admin view)
     */
    public function getGroupTAStatus(Request $request, int $groupId): JsonResponse
    {
        $members = GroupMember::where('group_id', $groupId)
            ->with(['student', 'group.period'])
            ->get();

        $students = $members->map(function ($member) {
            $status = StudentPeerReviewStatus::where('student_id', $member->student_id)
                ->where('group_id', $member->group_id)
                ->first();

            return [
                'student_id' => $member->student_id,
                'student_name' => $member->student->name,
                'nim' => $member->student->nim,
                'ta_status' => $status?->ta_status ?? 'TA_BLOCKED',
                'has_completed_peer_review' => $status?->has_completed_peer_review ?? false,
                'updated_at' => $status?->updated_at
            ];
        });

        return response()->json([
            'group_id' => $groupId,
            'group_name' => $members->first()?->group?->name,
            'students' => $students
        ]);
    }

    /**
     * Get current user's own TA status
     */
    public function getMyTAStatus(Request $request): JsonResponse
    {
        $user = Auth::user();
        
        $member = GroupMember::where('student_id', $user->id)
            ->with('group')
            ->first();

        if (!$member) {
            return response()->json([
                'ta_status' => 'TA_BLOCKED',
                'has_completed_peer_review' => false,
                'message' => 'You are not in any group'
            ], 403);
        }

        $status = StudentPeerReviewStatus::where('student_id', $user->id)
            ->where('group_id', $member->group_id)
            ->first();

        return response()->json([
            'student_id' => $user->id,
            'group_id' => $member->group_id,
            'ta_status' => $status?->ta_status ?? 'TA_BLOCKED',
            'has_completed_peer_review' => $status?->has_completed_peer_review ?? false,
            'can_access_ta' => $status?->ta_status === 'TA_ACTIVE' || $status?->ta_status === 'TA_DONE'
        ]);
    }
}
