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
}
