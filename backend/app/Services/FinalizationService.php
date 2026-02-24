<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Bid;
use App\Models\Group;
use App\Models\Supervision;
use App\Models\Title;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class FinalizationService
{
    protected GroupStateMachine $stateMachine;

    public function __construct(GroupStateMachine $stateMachine)
    {
        $this->stateMachine = $stateMachine;
    }

    /**
     * Allocate a group to a title via bidding resolution.
     * Single atomic transaction: quota lock, bid resolution, supervisor assignment, state transitions.
     *
     * @param int $bidId The winning bid to accept
     * @param int $supervisor1Id Supervisor 1 user ID
     * @param int|null $supervisor2Id Supervisor 2 user ID (optional)
     * @param int $adminId The admin performing the allocation
     */
    public function allocateGroup(int $bidId, int $supervisor1Id, ?int $supervisor2Id, int $adminId): array
    {
        return DB::transaction(function () use ($bidId, $supervisor1Id, $supervisor2Id, $adminId) {
            // 1. Load the bid with group
            $bid = Bid::with('group.period')->findOrFail($bidId);
            $group = $bid->group;
            $titleId = $bid->title_id;

            // 2. Row lock on title for quota concurrency safety
            $title = Title::where('id', $titleId)->lockForUpdate()->first();
            if (!$title) {
                throw new InvalidArgumentException('Title not found.');
            }

            // GOVERNANCE: If title is student-proposed, it must be approved by supervisor
            if ($title->title_source === 'STUDENT' && $title->supervisor_approval_status !== 'APPROVED') {
                throw new InvalidArgumentException('Cannot finalize: title has not been approved by the supervisor.');
            }

            // GOVERNANCE: Strict 2-level — bid must be recommended ACCEPT by lecturer
            if ($bid->lecturer_recommendation !== 'ACCEPT') {
                throw new InvalidArgumentException('Bid must be recommended ACCEPT by lecturer before admin can allocate.');
            }

            // 3. Validate quota not exceeded
            $currentAllocations = Group::where('title_id', $titleId)
                ->whereNotIn('status', ['FORMING', 'READY_FOR_BIDDING', 'CLOSED'])
                ->count();

            if ($currentAllocations >= $title->quota) {
                throw new InvalidArgumentException('Title quota is full.');
            }

            // 4. Accept winning bid, reject all others for this title
            $bid->update(['status' => 'ACCEPTED']);

            Bid::where('title_id', $titleId)
                ->where('id', '!=', $bidId)
                ->update(['status' => 'REJECTED']);

            // 5. Reject other bids from this group (for other titles)
            Bid::where('group_id', $group->id)
                ->where('id', '!=', $bidId)
                ->update(['status' => 'REJECTED']);

            // 6. Assign title to group (via explicit method — title_id not in $fillable)
            $group->assignTitleFromFinalization($titleId);
            $group->assignTypeFromFinalization('BIDDING');
            $group->save();

            // 7. Transition to KELOMPOK_FINAL
            $this->stateMachine->transition($group, 'KELOMPOK_FINAL');

            // 8. Create supervision records (source of truth)
            Supervision::create([
                'group_id' => $group->id,
                'supervisor_id' => $supervisor1Id,
                'role' => 'SUPERVISOR_1',
                'assigned_by' => $adminId,
            ]);

            // 9. Update group cache fields
            $group->supervisor_1_id = $supervisor1Id;

            if ($supervisor2Id) {
                Supervision::create([
                    'group_id' => $group->id,
                    'supervisor_id' => $supervisor2Id,
                    'role' => 'SUPERVISOR_2',
                    'assigned_by' => $adminId,
                ]);
                $group->supervisor_2_id = $supervisor2Id;
            }
            $group->save();

            // 10. Transition to PDC1_ACTIVE
            $this->stateMachine->transition($group, 'PDC1_ACTIVE');

            // 11. Audit log
            AuditLog::create([
                'user_id' => $adminId,
                'action' => 'FINALIZATION_ALLOCATE',
                'target_type' => 'Group',
                'target_id' => $group->id,
                'payload' => [
                    'bid_id' => $bidId,
                    'title_id' => $titleId,
                    'supervisor_1_id' => $supervisor1Id,
                    'supervisor_2_id' => $supervisor2Id,
                ],
            ]);

            return [
                'group' => $group->fresh()->load(['title', 'members.student', 'supervisions.supervisor']),
                'bid' => $bid->fresh(),
            ];
        });
    }

    /**
     * Allocate a group with a student-proposed title (same transactional pattern).
     */
    public function allocateStudentProposed(int $groupId, int $titleId, int $supervisor1Id, ?int $supervisor2Id, int $adminId): array
    {
        return DB::transaction(function () use ($groupId, $titleId, $supervisor1Id, $supervisor2Id, $adminId) {
            $group = Group::findOrFail($groupId);

            // GOVERNANCE: Ensure title is approved by supervisor before admin finalization
            $title = Title::findOrFail($titleId);
            if ($title->title_source === 'STUDENT' && $title->supervisor_approval_status !== 'APPROVED') {
                throw new InvalidArgumentException('Cannot finalize: title has not been approved by the supervisor.');
            }

            // Assign title (via explicit method — title_id not in $fillable)
            $group->assignTitleFromFinalization($titleId);
            $group->assignTypeFromFinalization('STUDENT_PROPOSED');
            $group->save();

            // Transition
            $this->stateMachine->transition($group, 'KELOMPOK_FINAL');

            // Create supervisions
            Supervision::create([
                'group_id' => $group->id,
                'supervisor_id' => $supervisor1Id,
                'role' => 'SUPERVISOR_1',
                'assigned_by' => $adminId,
            ]);
            $group->supervisor_1_id = $supervisor1Id;

            if ($supervisor2Id) {
                Supervision::create([
                    'group_id' => $group->id,
                    'supervisor_id' => $supervisor2Id,
                    'role' => 'SUPERVISOR_2',
                    'assigned_by' => $adminId,
                ]);
                $group->supervisor_2_id = $supervisor2Id;
            }
            $group->save();

            // Transition to PDC1_ACTIVE
            $this->stateMachine->transition($group, 'PDC1_ACTIVE');

            // Audit
            AuditLog::create([
                'user_id' => $adminId,
                'action' => 'FINALIZATION_ALLOCATE_STUDENT_PROPOSED',
                'target_type' => 'Group',
                'target_id' => $group->id,
                'payload' => [
                    'title_id' => $titleId,
                    'supervisor_1_id' => $supervisor1Id,
                    'supervisor_2_id' => $supervisor2Id,
                ],
            ]);

            return [
                'group' => $group->fresh()->load(['title', 'members.student', 'supervisions.supervisor']),
            ];
        });
    }

    /**
     * Get supervisor load dashboard data for a period.
     */
    public function getSupervisorLoad(int $periodId, int $maxLoad): array
    {
        $lecturers = User::where('role', 'dosen')->get();

        $loadData = [];
        foreach ($lecturers as $lecturer) {
            $currentLoad = $lecturer->supervisionLoadInPeriod($periodId);
            $loadData[] = [
                'lecturer' => $lecturer,
                'current_load' => $currentLoad,
                'max_load' => $maxLoad,
                'is_overloaded' => $currentLoad >= $maxLoad,
            ];
        }

        return $loadData;
    }
}
