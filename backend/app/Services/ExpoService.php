<?php

namespace App\Services;

use App\Models\ExpoEvent;
use App\Models\ExpoRegistration;
use App\Models\Group;
use App\Models\SeminarSchedule;
use App\Models\AuditLog;
use App\Models\ExpoScore;
use App\Models\MilestoneScore;
use App\Models\NilaiDosenScore;
use Illuminate\Support\Facades\Log;
use App\Concerns\RequiresActivePeriod;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class ExpoService
{
    use RequiresActivePeriod;

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
            $currentCount = $event->registrations()
                ->where('status', '!=', 'CANCELLED')
                ->count();
            if ($currentCount >= $event->capacity) {
                throw new InvalidArgumentException('This expo event is full. No remaining capacity.');
            }

            // Guard: group must exist and be in correct state
            $group = Group::findOrFail($groupId);

            $this->ensurePeriodIsActive($group);

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

            // Guard: Must have at least one approved TA_DRAFT document
            $hasTaDraft = \App\Models\Document::where('group_id', $group->id)
                ->where('phase', 'TA_DRAFT')
                ->where('status', 'APPROVED')
                ->exists();
            if (!$hasTaDraft) {
                throw new InvalidArgumentException(
                    "Group is not eligible for expo registration. TA Draft document must be approved."
                );
            }

            $registration = ExpoRegistration::where('expo_event_id', $event->id)
                ->where('group_id', $group->id)
                ->first();

            if ($registration && $registration->status !== 'CANCELLED') {
                throw new InvalidArgumentException('Group is already registered for this expo event.');
            }

            if ($registration) {
                $registration->update([
                    'registered_at' => now(),
                    'status' => 'REGISTERED',
                ]);
            } else {
                $registration = ExpoRegistration::create([
                    'expo_event_id' => $event->id,
                    'group_id' => $group->id,
                    'registered_at' => now(),
                    'status' => 'REGISTERED',
                ]);
            }

            $expoSchedule = SeminarSchedule::where('group_id', $group->id)
                ->where('type', 'EXPO')
                ->first();

            if ($expoSchedule && $expoSchedule->status !== 'CANCELLED') {
                throw new InvalidArgumentException('Expo schedule already exists for this group.');
            }

            $schedulePayload = [
                'date' => $event->date,
                'start_time' => $event->start_time,
                'end_time' => $event->end_time,
                'room' => $event->room,
                'status' => 'APPROVED',
            ];

            if ($expoSchedule) {
                $expoSchedule->update($schedulePayload);
            } else {
                SeminarSchedule::create([
                    'group_id' => $group->id,
                    'type' => 'EXPO',
                    ...$schedulePayload,
                ]);
            }

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

    /**
     * Withdraw a group from an expo event.
     */
    public function withdrawGroupFromEvent(int $eventId, int $groupId, int $userId): ExpoRegistration
    {
        return DB::transaction(function () use ($eventId, $groupId, $userId) {
            $event = ExpoEvent::lockForUpdate()->findOrFail($eventId);
            $group = Group::findOrFail($groupId);

            $this->ensurePeriodIsActive($group);

            if (!$event->is_published) {
                throw new InvalidArgumentException('This expo event is not open for withdrawal.');
            }

            if ($group->period_id !== $event->period_id) {
                throw new InvalidArgumentException('Group does not belong to the same period as this event.');
            }

            $registration = ExpoRegistration::where('expo_event_id', $event->id)
                ->where('group_id', $group->id)
                ->first();

            if (!$registration) {
                throw new InvalidArgumentException('No active expo registration found for this group.');
            }

            if ($registration->status === 'CANCELLED') {
                throw new InvalidArgumentException('Expo registration already cancelled.');
            }

            if ($registration->status === 'DONE') {
                throw new InvalidArgumentException('Cannot withdraw from a completed expo registration.');
            }

            if ($group->status !== 'EXPO_REGISTERED') {
                throw new InvalidArgumentException('Group is not in EXPO_REGISTERED status.');
            }

            $expoScores = ExpoScore::where('group_id', $group->id)->exists();
            $milestoneScores = MilestoneScore::where('group_id', $group->id)->exists();
            $nilaiDosenScores = NilaiDosenScore::where('group_id', $group->id)->exists();

            if ($expoScores || $milestoneScores || $nilaiDosenScores) {
                throw new InvalidArgumentException('Cannot withdraw. Supervisor evaluation has already been submitted.');
            }

            $expoSchedule = SeminarSchedule::where('group_id', $group->id)
                ->where('type', 'EXPO')
                ->where('status', '!=', 'CANCELLED')
                ->orderByDesc('id')
                ->first();

            if ($expoSchedule && $expoSchedule->status === 'COMPLETED') {
                throw new InvalidArgumentException('Cannot withdraw from a completed EXPO schedule.');
            }

            $registration->update(['status' => 'CANCELLED']);

            if ($expoSchedule) {
                $expoSchedule->update(['status' => 'CANCELLED']);
            }

            $auditPayload = [
                'event_id' => $event->id,
                'group_id' => $group->id,
                'event_name' => $event->name,
            ];

            if ($expoSchedule) {
                $auditPayload['schedule_id'] = $expoSchedule->id;
                $auditPayload['schedule_status'] = $expoSchedule->status;
            }

            if ($group->status === 'PDC2_READY_FOR_EXPO') {
                return $registration->refresh()->load(['expoEvent', 'group']);
            }

            if ($group->status !== 'EXPO_REGISTERED') {
                throw new InvalidArgumentException(
                    "Group is not in EXPO_REGISTERED status. Current status: {$group->status}."
                );
            }

            if (!$this->stateMachine->canTransition($group->status, 'PDC2_READY_FOR_EXPO')) {
                throw new InvalidArgumentException(
                    'Failed to transition group after expo withdrawal.'
                );
            }

            $this->stateMachine->transition($group, 'PDC2_READY_FOR_EXPO');

            AuditLog::create([
                'user_id' => $userId,
                'action' => 'EXPO_WITHDRAWAL',
                'target_type' => 'ExpoRegistration',
                'target_id' => $registration->id,
                'payload' => $auditPayload,
            ]);

            return $registration->fresh()->load(['expoEvent', 'group']);
        });
    }
}
