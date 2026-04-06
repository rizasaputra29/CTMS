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
        Notification::where('id', $notificationId)->update(['is_read' => \Illuminate\Support\Facades\DB::raw('true')]);
    }

    /**
     * Mark all notifications as read for a user.
     */
    public function markAllAsRead(int $userId): void
    {
        Notification::where('user_id', $userId)
            ->where('is_read', \Illuminate\Support\Facades\DB::raw('false'))
            ->update(['is_read' => \Illuminate\Support\Facades\DB::raw('true')]);
    }

    /**
     * Get unread count for a user.
     */
    public function unreadCount(int $userId): int
    {
        return Notification::where('user_id', $userId)
            ->where('is_read', \Illuminate\Support\Facades\DB::raw('false'))
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
        
        $message .= " Status kelompok kembali ke FORMING_SOLO. Silakan pilih judul lain.";
        
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
}
