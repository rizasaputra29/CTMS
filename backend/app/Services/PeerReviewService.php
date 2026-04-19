<?php

namespace App\Services;

use App\Models\Group;
use App\Models\GroupMember;
use App\Models\PeerReview;
use App\Models\PeriodPeerReviewIndicator;
use App\Models\StudentPeerReviewStatus;
use Illuminate\Support\Facades\DB;

class PeerReviewService
{
    /**
     * Unlock peer review for a group after EXPO completion.
     * Called when group reaches EXPO_DONE status.
     */
    public function unlockPeerReview(int $groupId): void
    {
        $group = Group::with('members')->findOrFail($groupId);
        
        // Initialize peer review status for all group members
        foreach ($group->members as $member) {
            StudentPeerReviewStatus::firstOrCreate([
                'student_id' => $member->student_id,
                'group_id' => $groupId,
                'period_id' => $group->period_id,
            ], [
                'has_completed_peer_review' => false,
                'ta_status' => 'TA_BLOCKED',
            ]);
        }
    }

    /**
     * Check if a student has completed all required peer reviews.
     */
    public function checkCompletion(int $studentId, int $groupId): bool
    {
        $group = Group::with('members')->findOrFail($groupId);
        $periodId = $group->period_id;
        
        $indicatorsCount = PeriodPeerReviewIndicator::where('period_id', $periodId)->count();
        $otherMembersCount = $group->members->where('student_id', '!=', $studentId)->count();
        $expectedReviews = $indicatorsCount * $otherMembersCount;

        if ($expectedReviews === 0) {
            return true;
        }

        $submittedReviews = PeerReview::where('reviewer_id', $studentId)
            ->where('group_id', $groupId)
            ->where('is_final_submission', true)
            ->count();

        return $submittedReviews >= $expectedReviews;
    }

    /**
     * Get peer review completion progress for a group.
     * Returns percentage and detailed member status.
     */
    public function getGroupProgress(int $groupId): array
    {
        $group = Group::with('members.student')->findOrFail($groupId);
        $totalMembers = $group->members->count();

        if ($totalMembers === 0) {
            return [
                'total_members' => 0,
                'completed_count' => 0,
                'completion_percentage' => 0,
                'members' => [],
            ];
        }

        $completedCount = StudentPeerReviewStatus::where('group_id', $groupId)
            ->where('has_completed_peer_review', true)
            ->count();

        $members = $group->members->map(function ($member) {
            $status = StudentPeerReviewStatus::where('student_id', $member->student_id)
                ->where('group_id', $member->group_id)
                ->first();

            return [
                'student_id' => $member->student_id,
                'student_name' => $member->student->name,
                'student_nim' => $member->student->nim,
                'has_completed' => $status?->has_completed_peer_review ?? false,
                'ta_status' => $status?->ta_status ?? 'TA_BLOCKED',
            ];
        });

        return [
            'total_members' => $totalMembers,
            'completed_count' => $completedCount,
            'completion_percentage' => round(($completedCount / $totalMembers) * 100, 2),
            'members' => $members,
        ];
    }

    /**
     * Block TA access for a student.
     */
    public function blockTAAccess(int $studentId, int $groupId, int $periodId): void
    {
        $status = StudentPeerReviewStatus::firstOrNew([
            'student_id' => $studentId,
            'group_id' => $groupId,
            'period_id' => $periodId,
        ]);

        $status->ta_status = 'TA_BLOCKED';
        $status->save();
    }

    /**
     * Grant TA access to a student after peer review completion.
     */
    public function grantTAAccess(int $studentId, int $groupId, int $periodId): void
    {
        $status = StudentPeerReviewStatus::firstOrNew([
            'student_id' => $studentId,
            'group_id' => $groupId,
            'period_id' => $periodId,
        ]);

        $status->has_completed_peer_review = true;
        $status->ta_status = 'TA_ACTIVE';
        $status->save();
    }

    /**
     * Send reminder to students who haven't completed peer review.
     * Returns count of reminders sent.
     */
    public function sendReminders(int $groupId): int
    {
        $group = Group::with('members.student')->findOrFail($groupId);
        $reminderCount = 0;

        foreach ($group->members as $member) {
            $status = StudentPeerReviewStatus::where('student_id', $member->student_id)
                ->where('group_id', $groupId)
                ->first();

            if (!$status || !$status->has_completed_peer_review) {
                // TODO: Implement notification/email sending
                // Notification::send($member->student, new PeerReviewReminder($group));
                $reminderCount++;
            }
        }

        return $reminderCount;
    }

    /**
     * Check if all group members have completed peer review.
     */
    public function isGroupCompletionFull(int $groupId): bool
    {
        $group = Group::with('members')->findOrFail($groupId);
        $totalMembers = $group->members->count();

        if ($totalMembers === 0) {
            return true;
        }

        $completedCount = StudentPeerReviewStatus::where('group_id', $groupId)
            ->where('has_completed_peer_review', true)
            ->count();

        return $completedCount === $totalMembers;
    }

    /**
     * Get students who have not completed peer review.
     */
    public function getIncompleteStudents(int $groupId): array
    {
        $group = Group::with('members.student')->findOrFail($groupId);
        $incompleteStudents = [];

        foreach ($group->members as $member) {
            $status = StudentPeerReviewStatus::where('student_id', $member->student_id)
                ->where('group_id', $groupId)
                ->first();

            if (!$status || !$status->has_completed_peer_review) {
                $incompleteStudents[] = [
                    'student_id' => $member->student_id,
                    'student_name' => $member->student->name,
                    'student_nim' => $member->student->nim,
                ];
            }
        }

        return $incompleteStudents;
    }
}
