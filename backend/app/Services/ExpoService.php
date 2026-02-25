<?php

namespace App\Services;

use App\Models\ExpoEvent;
use App\Models\ExpoRegistration;
use App\Models\Group;
use App\Models\SeminarSchedule;
use App\Models\AuditLog;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class ExpoService
{
    protected GroupStateMachine $stateMachine;

    public function __construct(GroupStateMachine $stateMachine)
    {
        $this->stateMachine = $stateMachine;
    }

    /**
     * Register a group to an expo event.
     * Uses lockForUpdate to prevent capacity race condition.
     */
    public function registerGroupToEvent(int $eventId, int $groupId, int $userId): ExpoRegistration
    {
        return DB::transaction(function () use ($eventId, $groupId, $userId) {
            // ⚠ Row lock: prevent capacity race condition
            $event = ExpoEvent::lockForUpdate()->findOrFail($eventId);

            // Guard: event must be published
            if (!$event->is_published) {
                throw new InvalidArgumentException('This expo event is not open for registration.');
            }

            // Guard: capacity check (concurrency-safe with lockForUpdate)
            $currentCount = $event->registrations()->count();
            if ($currentCount >= $event->capacity) {
                throw new InvalidArgumentException('This expo event is full. No remaining capacity.');
            }

            // Guard: group must exist and be in correct state
            $group = Group::findOrFail($groupId);

            // ⚠ Validate state machine transition BEFORE attempting
            if (!$this->stateMachine->canTransition($group->status, 'EXPO_REGISTERED')) {
                throw new InvalidArgumentException(
                    "Group is not eligible for expo registration. Current status: {$group->status}. " .
                    "Required: PDC2_READY_FOR_EXPO."
                );
            }

            // Guard: group must belong to same period as event
            if ($group->period_id !== $event->period_id) {
                throw new InvalidArgumentException('Group does not belong to the same period as this event.');
            }

            // Guard: Must have at least one TA Draft submitted
            $taDraftsCount = \App\Models\TaSubmission::where('group_id', $group->id)->count();
            if ($taDraftsCount < 1) {
                throw new InvalidArgumentException(
                    "Group is not eligible for expo registration. At least 1 member must have submitted a TA draft."
                );
            }

            // Create registration
            $registration = ExpoRegistration::create([
                'expo_event_id' => $event->id,
                'group_id' => $group->id,
                'registered_at' => now(),
                'status' => 'REGISTERED',
            ]);

            // Auto-create seminar schedule for expo
            SeminarSchedule::create([
                'group_id' => $group->id,
                'type' => 'EXPO',
                'scheduled_date' => $event->date,
                'start_time' => $event->start_time,
                'end_time' => $event->end_time,
                'room' => $event->room,
                'status' => 'APPROVED',
            ]);

            // Transition state
            $this->stateMachine->transition($group, 'EXPO_REGISTERED');

            // Audit
            AuditLog::create([
                'user_id' => $userId,
                'action' => 'EXPO_REGISTRATION',
                'target_type' => 'ExpoRegistration',
                'target_id' => $registration->id,
                'payload' => [
                    'event_id' => $event->id,
                    'group_id' => $group->id,
                    'event_name' => $event->name,
                ],
            ]);

            return $registration->load(['expoEvent', 'group']);
        });
    }
}
