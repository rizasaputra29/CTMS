<?php

namespace App\Services;

use App\Models\Group;
use App\Models\StudentPeerReviewStatus;
use App\Models\User;
use App\Concerns\RequiresActivePeriod;
use Illuminate\Support\Facades\Log;

class IndividualStateService
{
    use RequiresActivePeriod;
    /**
     * Transition student to TA phase after peer review completion.
     * This is the main method called when a student completes peer review.
     */
    public function transitionToTA(int $studentId, int $groupId): bool
    {
        try {
            $group = Group::findOrFail($groupId);

            $this->ensurePeriodIsActive($group);

            // Verify student has completed peer review
            $peerReviewService = new PeerReviewService();
            $hasCompleted = $peerReviewService->checkCompletion($studentId, $groupId);

            if (!$hasCompleted) {
                Log::info("Student {$studentId} has not completed peer review yet");
                return false;
            }

            // Update student status to TA_ACTIVE
            $status = StudentPeerReviewStatus::firstOrNew([
                'student_id' => $studentId,
                'group_id' => $groupId,
                'period_id' => $group->period_id,
            ]);

            $status->has_completed_peer_review = true;
            $status->ta_status = 'TA_ACTIVE';
            $status->save();

            Log::info("Student {$studentId} transitioned to TA_ACTIVE");
            
            // TODO: Send notification to student
            // Notification::send($status->student, new TAPhaseUnlocked());

            return true;
        } catch (\Exception $e) {
            Log::error("Failed to transition student {$studentId} to TA: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Get TA access status and available documents for a student.
     */
    public function getTAAccessStatus(int $studentId): array
    {
        $status = StudentPeerReviewStatus::with(['group', 'period'])
            ->where('student_id', $studentId)
            ->latest()
            ->first();

        if (!$status) {
            return [
                'can_access' => false,
                'status' => null,
                'message' => 'No TA status found',
                'available_documents' => [],
            ];
        }

        $canAccess = $status->ta_status === 'TA_ACTIVE' || $status->ta_status === 'TA_DONE';

        return [
            'can_access' => $canAccess,
            'status' => $status->ta_status,
            'message' => $this->getStatusMessage($status->ta_status),
            'group_id' => $status->group_id,
            'period_id' => $status->period_id,
            'available_documents' => $canAccess ? $this->getAvailableDocuments() : [],
        ];
    }

    /**
     * Validate if student can access TA features.
     * Throws exception if not allowed.
     */
    public function validateTAAccess(int $studentId, int $groupId): void
    {
        $status = StudentPeerReviewStatus::where('student_id', $studentId)
            ->where('group_id', $groupId)
            ->first();

        if (!$status) {
            throw new \Exception('TA status not found. Please complete peer review first.', 403);
        }

        if ($status->ta_status === 'TA_BLOCKED') {
            throw new \Exception('TA access blocked. Please complete peer review to unlock.', 403);
        }

        if ($status->ta_status !== 'TA_ACTIVE' && $status->ta_status !== 'TA_DONE') {
            throw new \Exception('Invalid TA status.', 403);
        }
    }

    /**
     * Check if student can upload TA documents.
     */
    public function canUploadDocuments(int $studentId, int $groupId): bool
    {
        $status = StudentPeerReviewStatus::where('student_id', $studentId)
            ->where('group_id', $groupId)
            ->first();

        return $status && ($status->ta_status === 'TA_ACTIVE' || $status->ta_status === 'TA_DONE');
    }

    /**
     * Check if student can schedule TA defense.
     */
    public function canScheduleDefense(int $studentId, int $groupId): bool
    {
        $status = StudentPeerReviewStatus::where('student_id', $studentId)
            ->where('group_id', $groupId)
            ->first();

        // Can schedule if TA_ACTIVE (not yet done)
        return $status && $status->ta_status === 'TA_ACTIVE';
    }

    /**
     * Mark TA as done for a student.
     */
    public function markTADone(int $studentId, int $groupId): bool
    {
        try {
            $group = Group::findOrFail($groupId);
            $this->ensurePeriodIsActive($group);

            $status = StudentPeerReviewStatus::where('student_id', $studentId)
                ->where('group_id', $groupId)
                ->first();

            if (!$status) {
                Log::error("No TA status found for student {$studentId}");
                return false;
            }

            if ($status->ta_status !== 'TA_ACTIVE') {
                Log::warning("Cannot mark TA done for student {$studentId}. Current status: {$status->ta_status}");
                return false;
            }

            $status->ta_status = 'TA_DONE';
            $status->save();

            Log::info("Student {$studentId} marked as TA_DONE");
            
            return true;
        } catch (\Exception $e) {
            Log::error("Failed to mark TA done for student {$studentId}: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Force unlock TA for a student (admin override).
     */
    public function forceUnlockTA(int $studentId, int $groupId, int $adminId): bool
    {
        try {
            $group = Group::findOrFail($groupId);
            $this->ensurePeriodIsActive($group);
            
            $status = StudentPeerReviewStatus::firstOrNew([
                'student_id' => $studentId,
                'group_id' => $groupId,
                'period_id' => $group->period_id,
            ]);

            $status->ta_status = 'TA_ACTIVE';
            $status->save();

            Log::info("Admin {$adminId} force unlocked TA for student {$studentId}");
            
            return true;
        } catch (\Exception $e) {
            Log::error("Failed to force unlock TA for student {$studentId}: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Get all TA statuses for a group (for admin view).
     */
    public function getGroupTAStatuses(int $groupId): array
    {
        $group = Group::with('members.student')->findOrFail($groupId);
        $statuses = [];

        foreach ($group->members as $member) {
            $status = StudentPeerReviewStatus::where('student_id', $member->student_id)
                ->where('group_id', $groupId)
                ->first();

            $statuses[] = [
                'student_id' => $member->student_id,
                'student_name' => $member->student->name,
                'student_nim' => $member->student->nim,
                'ta_status' => $status?->ta_status ?? 'TA_BLOCKED',
                'has_completed_peer_review' => $status?->has_completed_peer_review ?? false,
                'can_access_ta' => $status?->ta_status === 'TA_ACTIVE' || $status?->ta_status === 'TA_DONE',
            ];
        }

        return $statuses;
    }

    /**
     * Get status message based on TA status.
     */
    private function getStatusMessage(?string $status): string
    {
        return match ($status) {
            'TA_BLOCKED' => 'TA access is blocked. Please complete peer review first.',
            'TA_ACTIVE' => 'TA phase is active. You can now upload documents and schedule defense.',
            'TA_DONE' => 'TA phase completed.',
            default => 'Unknown status.',
        };
    }

    /**
     * Get list of available TA documents/actions.
     */
    private function getAvailableDocuments(): array
    {
        return [
            ['type' => 'ta_proposal', 'name' => 'TA Proposal', 'required' => true],
            ['type' => 'ta_draft', 'name' => 'TA Draft', 'required' => true],
            ['type' => 'final_document', 'name' => 'Final Document', 'required' => true],
            ['type' => 'schedule_defense', 'name' => 'Schedule Defense', 'required' => true],
        ];
    }
}
