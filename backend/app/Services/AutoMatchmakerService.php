<?php

namespace App\Services;

use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Period;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class AutoMatchmakerService
{
    /**
     * Run the Auto-Matchmaker waterfall algorithm for a specific period.
     * 1. Match Ghost students to Incomplete Groups (FORMING).
     * 2. Merge Incomplete Groups together.
     * 3. Group remaining Ghosts into Blank Groups of 3.
     */
    public function executeMatchmaking(int $periodId, int $adminId): array
    {
        return DB::transaction(function () use ($periodId, $adminId) {
            $period = Period::findOrFail($periodId);
            $minSize = $period->min_group_size ?? 3;

            // 1. Get all Ghost students (students with no group in this period)
            // It's the set of all students minus students who have a GroupMember record for this period.
            $assignedStudentIds = GroupMember::where('period_id', $period->id)->pluck('student_id');
            $ghosts = User::where('role', 'mahasiswa')
                ->whereNotIn('id', $assignedStudentIds)
                ->get();

            // 2. Get all Incomplete Groups
            $incompleteGroups = Group::with('members')
                ->where('period_id', $period->id)
                ->whereIn('status', ['FORMING', 'FORMING_SOLO', 'WAITING_SUPERVISOR_APPROVAL'])
                ->get()
                ->filter(function ($g) use ($minSize) {
                    return $g->members->count() < $minSize;
                })
                ->values(); // Reset array keys

            $stats = [
                'ghosts_processed' => 0,
                'groups_filled' => 0,
                'groups_merged' => 0,
                'blank_groups_created' => 0,
            ];

            // Priority 1: Inject Ghosts into Incomplete Groups
            // Note: Simplistic distribution. We iterate through incomplete groups and pop ghosts.
            foreach ($incompleteGroups as $group) {
                /** @var \App\Models\Group $group */
                while ($group->members()->count() < $minSize && $ghosts->isNotEmpty()) {
                    $ghost = $ghosts->pop();
                    
                    GroupMember::create([
                        'group_id' => $group->id,
                        'student_id' => $ghost->id,
                        'is_leader' => false,
                        'period_id' => $period->id,
                    ]);

                    $stats['ghosts_processed']++;
                    
                    if ($group->members()->count() >= $minSize) {
                        // Let the group controller transition logic handle the status upgrade and title 
                        // by duplicating the checkAndTransitionToReady logic here for the matchmaker.
                        $this->promoteGroupToReady($group);
                        $stats['groups_filled']++;
                    }
                }
            }

            // Reload incomplete groups because some were filled
            $incompleteGroups = Group::with('members.student', 'title')
                ->where('period_id', $period->id)
                ->whereIn('status', ['FORMING', 'FORMING_SOLO', 'WAITING_SUPERVISOR_APPROVAL'])
                ->get()
                ->filter(function ($g) use ($minSize) {
                    return $g->members->count() < $minSize;
                })
                ->values();

            // Priority 2: Merge Incomplete Groups
            // We'll greedily merge the first group with the next available groups until it's full.
            $activeMergeGroup = null;

            foreach ($incompleteGroups as $group) {
                /** @var \App\Models\Group $group */
                if ($activeMergeGroup === null) {
                    $activeMergeGroup = $group;
                    continue;
                }

                // Move all members from $group to $activeMergeGroup
                $membersToMove = GroupMember::where('group_id', $group->id)->get();
                foreach ($membersToMove as $member) {
                    $member->update([
                        'group_id' => $activeMergeGroup->id,
                        'is_leader' => false, // Ensure only the activeMergeGroup original leader remains
                    ]);
                }

                // Cleanup the orphaned group
                \App\Models\Title::where('proposed_by_group_id', $group->id)->update([
                    'proposed_by_group_id' => null,
                    'supervisor_approval_status' => 'CANCELED',
                ]);
                $group->bids()->delete();
                $group->supervisorProposals()->delete();
                $group->delete();

                $stats['groups_merged']++;

                if ($activeMergeGroup->members()->count() >= $minSize) {
                    $this->promoteGroupToReady($activeMergeGroup);
                    $stats['groups_filled']++;
                    $activeMergeGroup = null; // Start over with the next one
                }
            }

            // Any remaining $activeMergeGroup is left as FORMING.
            // Admin's "Force Tolerance" will handle it later if needed.

            // Priority 3: Group remaining Ghosts into Blank Groups
            if ($ghosts->isNotEmpty()) {
                // Chunk into blocks of exactly $minSize
                $ghostChunks = $ghosts->chunk($minSize);
                
                foreach ($ghostChunks as $chunk) {
                    $newGroup = Group::create([
                        'title_id' => null,
                        'period_id' => $period->id,
                        'status' => $chunk->count() < $minSize ? 'SOFT_FORMING' : 'FORMING', 
                        'group_mode' => 'GROUP',
                        'has_existing_group' => false,
                    ]);

                    $isFirst = true;

                    foreach ($chunk as $ghost) {
                        GroupMember::create([
                            'group_id' => $newGroup->id,
                            'student_id' => $ghost->id,
                            'is_leader' => $isFirst,
                            'period_id' => $period->id,
                        ]);
                        $isFirst = false;
                        $stats['ghosts_processed']++;
                    }

                    if ($chunk->count() >= $minSize) {
                        $this->promoteGroupToReady($newGroup);
                        $stats['blank_groups_created']++;
                    } else {
                        $stats['incomplete_teams_created'] = ($stats['incomplete_teams_created'] ?? 0) + 1;
                    }
                }
            }

            // Audit
            \App\Models\AuditLog::create([
                'user_id' => $adminId,
                'action' => 'AUTO_MATCHMAKER_RUN',
                'target_type' => 'Period',
                'target_id' => $period->id,
                'payload' => $stats,
            ]);

            return $stats;
        });
    }

    /**
    * Promotes a group to READY_FOR_BIDDING and approves any UNDER_REVIEW title.
     * Identical logic to GroupController's transition.
     */
    private function promoteGroupToReady(Group $group): void
    {
        $stateMachine = app(GroupStateMachine::class);
        
        $preApprovedTitle = \App\Models\Title::where('proposed_by_group_id', $group->id)
            ->where('supervisor_approval_status', 'UNDER_REVIEW')
            ->first();
            
        if ($preApprovedTitle) {
            // Check Quota before auto-approving
            $lecturerId = $preApprovedTitle->proposed_supervisor_id;
            $maxLoad = $group->period->max_supervise_load ?? 8;
            
            $currentLoad = \App\Models\Supervision::where('supervisor_id', $lecturerId)
                ->whereHas('group', fn($q) => $q->where('period_id', $group->period_id))
                ->count();
                
            $approvedProposals = \App\Models\Title::where('proposed_supervisor_id', $lecturerId)
                ->where('supervisor_approval_status', 'APPROVED')
                ->whereHas('proposedByGroup', fn($q) => $q->where('period_id', $group->period_id))
                ->count();
                
            if (($currentLoad + $approvedProposals) < $maxLoad) {
                // We only formally approve it if quota allows. Else we cancel the privilege to be fair.
                $preApprovedTitle->update(['supervisor_approval_status' => 'APPROVED']);
                $group->update(['title_id' => $preApprovedTitle->id]);
            } else {
                $preApprovedTitle->update(['supervisor_approval_status' => 'CANCELED']);
            }
        }

        $stateMachine->transition($group, 'READY_FOR_BIDDING');
    }
}
