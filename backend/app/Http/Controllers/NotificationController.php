<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use App\Services\NotificationService;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    use ApiResponseTrait;

    protected NotificationService $notificationService;

    public function __construct(NotificationService $notificationService)
    {
        $this->notificationService = $notificationService;
    }

    /**
     * List notifications for the authenticated user.
     */
    public function index(Request $request)
    {
        $notifications = Notification::where('user_id', $request->user()->id)
            ->orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', 20));

        $user = $request->user();

        foreach ($notifications as $notification) {
            $notification->action_url = $this->getActionUrl($notification, $user);

            if ($notification->type === 'GROUP_INVITATION' && $notification->related_id) {
                $invitation = \App\Models\GroupInvitation::find($notification->related_id);
                if ($invitation) {
                    $notification->invitation_status = $invitation->status;
                }
            }
        }

        return $this->paginatedResponse($notifications);
    }

    /**
     * Compute the frontend redirect URL for a notification based on type, related entity, and user role.
     */
    protected function getActionUrl($notification, $user): ?string
    {
        $type = $notification->type;
        $relType = $notification->related_type;
        $relId = $notification->related_id;

        $isAdmin = $user->hasRole('admin');
        $isDosen = $user->hasRole('dosen');
        $isMahasiswa = $user->hasRole('mahasiswa');

        $sub = fn ($url) => $relId ? str_replace('{id}', $relId, $url) : null;

        $routes = [
            // ── Group-related ──
            'SUPERVISOR_ASSIGNED' => [
                'admin' => $sub('/admin/groups/{id}'),
                'dosen' => '/dosen/supervised-groups',
                'mahasiswa' => '/mahasiswa/group',
            ],
            'FINALIZATION_ROLLBACK' => [
                'admin' => '/admin/finalization',
                'dosen' => '/dosen/supervised-groups',
                'mahasiswa' => '/mahasiswa/group',
            ],
            'GROUP_PROMOTED' => [
                'admin' => $sub('/admin/groups/{id}'),
                'mahasiswa' => '/mahasiswa/group',
            ],
            'LEADER_ASSIGNED' => [
                'mahasiswa' => '/mahasiswa/group',
            ],
            'BID_ACCEPTED' => [
                'dosen' => '/dosen/supervised-groups',
                'mahasiswa' => '/mahasiswa/group',
            ],
            'BID_TO_SOLO_TITLE' => [
                'mahasiswa' => '/mahasiswa/group',
            ],
            'group_finalization' => [
                'mahasiswa' => '/mahasiswa/group',
            ],
            'group_finalization_cancelled' => [
                'mahasiswa' => '/mahasiswa/group',
            ],
            'title_approval_withdrawn' => [
                'mahasiswa' => '/mahasiswa/group',
            ],
            'CANCEL_KELOMPOK_FINAL' => [
                'admin' => '/admin/finalization',
                'mahasiswa' => '/mahasiswa/group',
            ],

            // ── Registration / Period ──
            'PERIOD_REGISTRATION_REMOVED' => [
                'mahasiswa' => '/mahasiswa/registration',
            ],
            'REMOVED_FROM_GROUP' => [
                'mahasiswa' => '/mahasiswa/registration',
            ],
            'GROUP_DELETED_BY_ADMIN' => [
                'admin' => '/admin/groups',
                'mahasiswa' => '/mahasiswa/registration',
            ],

            // ── TA Defense ──
            'TA_DEFENSE_SCHEDULED' => [
                'admin' => '/admin/ta-defense',
                'mahasiswa' => '/mahasiswa/ta-defense',
            ],
            'TA_DEFENSE_EXAMINER_ASSIGNED' => [
                'admin' => '/admin/ta-defense',
                'dosen' => $sub('/dosen/ta-evaluation/{id}') ?? '/dosen/supervised-groups',
            ],
            'TA_DEFENSE_UPDATED' => [
                'admin' => '/admin/ta-defense',
                'dosen' => $sub('/dosen/ta-evaluation/{id}') ?? '/dosen/supervised-groups',
                'mahasiswa' => '/mahasiswa/ta-defense',
            ],
            'TA_DEFENSE_CANCELLED' => [
                'admin' => '/admin/ta-defense',
                'mahasiswa' => '/mahasiswa/ta-defense',
            ],

            // ── Proposals ──
            'PROPOSAL_SUBMITTED' => [
                'admin' => '/admin/titles',
                'dosen' => '/dosen/title-approvals',
            ],
            'PROPOSAL_RESUBMITTED' => [
                'admin' => '/admin/titles',
                'dosen' => '/dosen/title-approvals',
            ],
            'PROPOSAL_UPDATED' => [
                'admin' => '/admin/titles',
                'dosen' => '/dosen/title-approvals',
            ],

            // ── Bids ──
            'BID_AUTO_REJECTED' => [
                'dosen' => '/dosen/bids',
            ],
            'BID_REJECTED' => [
                'dosen' => '/dosen/bids',
                'mahasiswa' => '/mahasiswa/bidding',
            ],
            'INVITE_REJECTED' => [
                'dosen' => '/dosen/bids',
            ],

            // ── Schedule / SEMPRO / EXPO ──
            'SCHEDULE_APPROVED' => [
                'admin' => '/admin/sempro',
                'dosen' => $sub('/dosen/evaluation/{id}'),
                'mahasiswa' => '/mahasiswa/schedule',
            ],
            'SCHEDULE_REJECTED' => [
                'admin' => '/admin/sempro',
                'mahasiswa' => '/mahasiswa/schedule',
            ],
            'EVALUATION_DEADLINE_PASSED' => [
                'dosen' => $sub('/dosen/evaluation/{id}'),
            ],

            // ── Examiner evaluations ──
            'examiner_evaluation_scheduled' => [
                'dosen' => $sub('/dosen/evaluation/{id}'),
            ],

            // ── Supervisor evaluations (related_id is Schedule.id; route expects group_id) ──
            'supervisor_evaluation_scheduled' => [
                'dosen' => null, // resolved below
            ],

            // ── Join requests / Bursa Ide ──
            'JOIN_REQUEST' => [
                'mahasiswa' => '/mahasiswa/bursa-ide',
            ],
            'JOIN_REQUEST_REJECTED' => [
                'mahasiswa' => '/mahasiswa/bursa-ide', // student whose request was rejected
            ],
        ];

        // Handle FINALIZATION_COMPLETED based on related_type
        if ($type === 'FINALIZATION_COMPLETED') {
            if ($relType === 'Period' && $isAdmin) {
                return '/admin/finalization';
            }
            if ($relType === 'Group') {
                if ($isAdmin) {
                    return $sub('/admin/groups/{id}');
                }
                if ($isDosen) {
                    return '/dosen/supervised-groups';
                }
                if ($isMahasiswa) {
                    return '/mahasiswa/group';
                }
            }

            return null;
        }

        // Handle supervisor_evaluation_scheduled (route expects group_id, but related_id is Schedule.id)
        if ($type === 'supervisor_evaluation_scheduled' && $isDosen && $relId) {
            $schedule = \App\Models\Schedule::find($relId);
            if ($schedule?->group_id) {
                return "/dosen/supervisor-evaluation/{$schedule->group_id}";
            }

            return '/dosen/supervised-groups';
        }

        // SKIP redirect for GROUP_INVITATION — handled inline in frontend
        if ($type === 'GROUP_INVITATION') {
            return null;
        }

        // Generic lookup
        if (! isset($routes[$type])) {
            return null;
        }

        $roleUrls = $routes[$type];

        if ($isAdmin && isset($roleUrls['admin'])) {
            return $roleUrls['admin'];
        }
        if ($isDosen && isset($roleUrls['dosen'])) {
            return $roleUrls['dosen'];
        }
        if ($isMahasiswa && isset($roleUrls['mahasiswa'])) {
            return $roleUrls['mahasiswa'];
        }

        return null;
    }

    /**
     * Get unread count.
     */
    public function unreadCount(Request $request)
    {
        $count = $this->notificationService->unreadCount($request->user()->id);

        return $this->successResponse(['count' => $count]);
    }

    /**
     * Mark a single notification as read.
     */
    public function markAsRead(Request $request, int $id)
    {
        $notification = Notification::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $this->notificationService->markAsRead($notification->id);

        return $this->successResponse(null, 'Marked as read.');
    }

    /**
     * Mark all notifications as read.
     */
    public function markAllAsRead(Request $request)
    {
        $this->notificationService->markAllAsRead($request->user()->id);

        return $this->successResponse(null, 'All notifications marked as read.');
    }
}
