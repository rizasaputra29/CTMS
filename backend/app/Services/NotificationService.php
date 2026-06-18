<?php

namespace App\Services;

use App\Models\Notification;

class NotificationService
{
    /**
     * Send a notification to a user.
     */
    public function send(
        int $userId,
        string $type,
        string $title,
        string $message,
        ?string $relatedType = null,
        ?int $relatedId = null
    ): Notification {
        return Notification::create([
            'user_id' => $userId,
            'type' => $type,
            'title' => $title,
            'message' => $message,
            'related_type' => $relatedType,
            'related_id' => $relatedId,
        ]);
    }

    /**
     * Send notification to multiple users.
     */
    public function sendToMany(
        array $userIds,
        string $type,
        string $title,
        string $message,
        ?string $relatedType = null,
        ?int $relatedId = null
    ): void {
        foreach ($userIds as $userId) {
            $this->send($userId, $type, $title, $message, $relatedType, $relatedId);
        }
    }

    /**
     * Mark a single notification as read.
     */
    public function markAsRead(int $notificationId): void
    {
        Notification::where('id', $notificationId)->update(['is_read' => true]);
    }

    /**
     * Mark all notifications as read for a user.
     */
    public function markAllAsRead(int $userId): void
    {
        Notification::where('user_id', $userId)
            ->where('is_read', false)
            ->update(['is_read' => true]);
    }

    /**
     * Get unread count for a user.
     */
    public function unreadCount(int $userId): int
    {
        return Notification::where('user_id', $userId)
            ->where('is_read', false)
            ->count();
    }

    /**
     * Notify all group members about finalization.
     */
    public function notifyGroupMembersOfFinalization(\App\Models\Group $group): void
    {
        $members = $group->members;

        foreach ($members as $member) {
            $this->send(
                $member->student_id,
                'group_finalization',
                'Kelompok Siap Finalisasi',
                'Ketua kelompok telah menandai kelompok "{$group->title->title ?? $group->name}" siap untuk finalisasi. Tunggu admin untuk proses finalisasi.',
                'Group',
                $group->id
            );
        }
    }

    /**
     * Notify all group members about cancellation of finalization.
     */
    public function notifyGroupMembersOfCancellation(\App\Models\Group $group): void
    {
        $members = $group->members;

        foreach ($members as $member) {
            $this->send(
                $member->student_id,
                'group_finalization_cancelled',
                'Finalisasi Dibatalkan',
                'Ketua kelompok telah membatalkan finalisasi untuk kelompok "{$group->title->title ?? $group->name}". Kelompok kembali ke status siap bidding.',
                'Group',
                $group->id
            );
        }
    }

    /**
     * Notify all group members when lecturer withdraws approval.
     */
    public function notifyGroupOfWithdrawal(\App\Models\Group $group, \App\Models\Title $title, ?string $reason = null): void
    {
        $members = $group->members;
        $message = "Dosen telah menarik persetujuan untuk judul \"{$title->title}\".";

        if ($reason) {
            $message .= " Alasan: {$reason}";
        }

        $message .= ' Status kelompok kembali ke FORMING_SOLO. Silakan pilih judul lain.';

        foreach ($members as $member) {
            $this->send(
                $member->student_id,
                'title_approval_withdrawn',
                'Persetujuan Judul Ditarik',
                $message,
                'Title',
                $title->id
            );
        }
    }

    /**
     * Notify supervisors when a schedule is created for their supervised group.
     */
    public function notifySupervisorsOfSchedule(\App\Models\Group $group, \App\Models\Schedule $schedule, string $scheduleType): void
    {
        $supervisors = $group->supervisions;

        $typeLabels = [
            'SEMINAR' => 'Seminar Proposal (SEMPRO)',
            'TA_DEFENSE' => 'Sidang Tugas Akhir',
            'EXPO' => 'Expo',
        ];

        $typeLabel = $typeLabels[$scheduleType] ?? $scheduleType;
        $groupName = $group->title->title ?? $group->name ?? "Group #{$group->id}";

        foreach ($supervisors as $supervision) {
            $this->send(
                $supervision->supervisor_id,
                'supervisor_evaluation_scheduled',
                'Jadwal Penilaian Baru',
                "Anda perlu mengisi nilai {$typeLabel} untuk kelompok \"{$groupName}\". Jadwal: ".$schedule->date->format('d M Y H:i')." di {$schedule->room}.",
                'Schedule',
                $schedule->id
            );
        }
    }

    /**
     * Notify examiners when a schedule is created.
     */
    public function notifyExaminersOfSchedule(array $examinerIds, \App\Models\Group $group, \App\Models\Schedule $schedule, string $scheduleType): void
    {
        $typeLabels = [
            'SEMINAR' => 'Seminar Proposal (SEMPRO)',
            'TA_DEFENSE' => 'Sidang Tugas Akhir',
            'EXPO' => 'Expo',
        ];

        $typeLabel = $typeLabels[$scheduleType] ?? $scheduleType;
        $groupName = $group->title->title ?? $group->name ?? "Group #{$group->id}";

        foreach ($examinerIds as $examinerId) {
            $this->send(
                $examinerId,
                'examiner_evaluation_scheduled',
                'Jadwal Penilaian sebagai Examiner',
                "Anda ditugaskan sebagai examiner untuk {$typeLabel} kelompok \"{$groupName}\". Jadwal: ".$schedule->date->format('d M Y H:i')." di {$schedule->room}.",
                'Schedule',
                $schedule->id
            );
        }
    }
}
