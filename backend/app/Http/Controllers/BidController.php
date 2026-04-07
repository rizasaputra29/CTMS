<?php

namespace App\Http\Controllers;

use App\Models\Bid;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\User;
use App\Services\BiddingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class BidController extends Controller
{
    protected BiddingService $biddingService;

    public function __construct(BiddingService $biddingService)
    {
        $this->biddingService = $biddingService;
    }

    /**
     * List bids for the current student's group.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        
        // Get active period
        $activePeriod = \App\Models\Period::where('is_active', true)->first();
        
        $membership = GroupMember::where('student_id', $user->id)
            ->where('period_id', $activePeriod?->id)
            ->first();

        if (!$membership) {
            return response()->json(['data' => []]);
        }

        $bids = Bid::with(['title.lecturer', 'proposedSupervisor1', 'proposedSupervisor2'])
            ->where('group_id', $membership->group_id)
            ->orderBy('priority')
            ->get();

        return response()->json(['data' => $bids]);
    }

    /**
     * Submit a bid on a title (group leader only).
     * Priority is auto-assigned (max existing priority + 1).
     */
    public function store(Request $request)
    {
        $request->validate([
            'title_id' => 'required|exists:titles,id',
            // Priority removed - will be auto-assigned
            'proposed_supervisor_1_id' => 'required|exists:users,id',
            'proposed_supervisor_2_id' => 'nullable|exists:users,id|different:proposed_supervisor_1_id',
        ]);

        $user = $request->user();

        // Get active period
        $activePeriod = \App\Models\Period::where('is_active', true)->first();
        
        $membership = GroupMember::where('student_id', $user->id)
            ->where('period_id', $activePeriod?->id)
            ->first();

        if (!$membership || !$membership->is_leader) {
            return response()->json(['message' => 'Hanya ketua kelompok yang dapat mengajukan bidding.'], 403);
        }

        // Validate supervisors are dosen
        $sup1 = User::find($request->proposed_supervisor_1_id);
        if (!$sup1 || !$sup1->hasRole('dosen')) {
            return response()->json(['message' => 'Pembimbing 1 harus berupa dosen.'], 400);
        }
        if ($request->proposed_supervisor_2_id) {
            $sup2 = User::find($request->proposed_supervisor_2_id);
            if (!$sup2 || !$sup2->hasRole('dosen')) {
                return response()->json(['message' => 'Pembimbing 2 harus berupa dosen.'], 400);
            }
        }

        $group = Group::with(['period', 'members'])->find($membership->group_id);

        // Member count check first - if enough members, allow bidding
        $minSize = $group->period->min_group_size ?? 3;
        if ($group->members->count() < $minSize) {
            return response()->json([
                'message' => 'Kelompok Anda memiliki ' . $group->members->count() . ' anggota. Minimal ' . $minSize . ' anggota diperlukan untuk melakukan bidding pada judul Dosen.',
            ], 403);
        }

        // Status check - FORMING_SOLO can only propose their own title, cannot bid on lecturer titles
        if ($group->status === 'FORMING_SOLO') {
            return response()->json([
                'message' => 'Anda belum bisa bidding karena belum memiliki judul sendiri. Ajukan proposal judul terlebih dahulu.',
            ], 403);
        }

        // Allow bidding if group has enough members and is in valid status
        // FORMING with 3+ members, READY_FOR_BIDDING, or WAITING_SUPERVISOR_APPROVAL can all bid
        $validStatuses = ['FORMING', 'READY_FOR_BIDDING', 'WAITING_SUPERVISOR_APPROVAL'];
        if (!in_array($group->status, $validStatuses)) {
            return response()->json(['message' => 'Kelompok belum siap untuk bidding.'], 400);
        }

        // Mutual Exclusive: Block bidding if group has active proposal (normal groups only)
        if (!$group->is_solo) {
            $hasActiveProposal = \App\Models\Title::where('proposed_by_group_id', $group->id)
                ->where('title_source', 'STUDENT')
                ->whereIn('supervisor_approval_status', ['PENDING', 'UNDER_REVIEW', 'APPROVED'])
                ->exists();
            
            if ($hasActiveProposal) {
                return response()->json([
                    'message' => 'Tidak dapat mengajukan bid karena kelompok sudah memiliki proposal yang sedang diproses atau disetujui.'
                ], 400);
            }
        }

        // Window check
        if ($group->period->is_finalized) {
            return response()->json(['message' => 'Pendaftaran untuk periode ini sudah ditutup.'], 400);
        }

        if ($this->biddingService->isBiddingLocked($group->period)) {
            return response()->json(['message' => 'Bidding ditutup untuk periode ini.'], 400);
        }

        if (!$this->biddingService->isWindowOpen($group->period)) {
            return response()->json(['message' => 'Waktu bidding belum dibuka.'], 400);
        }

        // Combined limit: bids + student proposals <= 3
        // Since rejected bids are deleted, all existing bids are active
        $bidCount = Bid::where('group_id', $group->id)->count();
        $proposalCount = \App\Models\Title::where('proposed_by_group_id', $group->id)
            ->where('title_source', 'STUDENT')
            ->whereIn('supervisor_approval_status', ['PENDING', 'UNDER_REVIEW', 'APPROVED'])
            ->count();

        if (($bidCount + $proposalCount) >= 3) {
            return response()->json(['message' => 'Maksimal 3 judul diperbolehkan (bidding + proposal digabungkan).'], 400);
        }

        // Check if already bidding on this title
        $existingBid = Bid::where('group_id', $group->id)
            ->where('title_id', $request->title_id)
            ->exists();
        
        if ($existingBid) {
            return response()->json(['message' => 'Anda sudah mengajukan bid untuk judul ini.'], 400);
        }

        // Auto-assign priority: max existing priority + 1
        $maxPriority = Bid::where('group_id', $group->id)->max('priority') ?? 0;
        $nextPriority = $maxPriority + 1;

        $bid = Bid::create([
            'group_id' => $group->id,
            'title_id' => $request->title_id,
            'priority' => $nextPriority,
            'status' => 'PENDING',
            'proposed_supervisor_1_id' => $request->proposed_supervisor_1_id,
            'proposed_supervisor_2_id' => $request->proposed_supervisor_2_id,
        ]);

        return response()->json([
            'message' => 'Bid submitted successfully.',
            'data' => $bid->load(['title.lecturer', 'proposedSupervisor1', 'proposedSupervisor2']),
        ], 201);
    }

    /**
     * Delete a bid (group leader only, before lock).
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();

        $membership = GroupMember::where('student_id', $user->id)
            ->first();

        if (!$membership || !$membership->is_leader) {
            return response()->json(['message' => 'Hanya ketua kelompok yang dapat menghapus bidding.'], 403);
        }

        $bid = Bid::where('id', $id)
            ->where('group_id', $membership->group_id)
            ->firstOrFail();

        $group = Group::with('period')->find($membership->group_id);

        if ($this->biddingService->isBiddingLocked($group->period)) {
            return response()->json(['message' => 'Bidding ditutup. Tidak dapat menghapus bidding.'], 400);
        }

        $bid->delete();
        return response()->json(['message' => 'Bid deleted successfully.']);
    }

    /**
     * Reorder bid priorities.
     */
    public function reorder(Request $request)
    {
        $request->validate([
            'bids' => 'required|array',
            'bids.*.id' => 'required|exists:bids,id',
            'bids.*.priority' => 'required|integer|min:1',
        ]);

        $user = $request->user();

        $membership = GroupMember::where('student_id', $user->id)
            ->first();

        if (!$membership || !$membership->is_leader) {
            return response()->json(['message' => 'Hanya ketua kelompok yang dapat mengubah urutan bidding.'], 403);
        }

        $group = Group::with('period')->find($membership->group_id);

        if ($this->biddingService->isBiddingLocked($group->period)) {
            return response()->json(['message' => 'Bidding ditutup. Tidak dapat mengubah urutan.'], 400);
        }

        DB::beginTransaction();
        try {
            foreach ($request->bids as $bidData) {
                Bid::where('id', $bidData['id'])
                    ->where('group_id', $membership->group_id)
                    ->update(['priority' => $bidData['priority']]);
            }
            DB::commit();
            return response()->json(['message' => 'Urutan prioritas berhasil disimpan.']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Gagal menyimpan urutan: ' . $e->getMessage()], 500);
        }
    }

    /**
     * List bids on the lecturer's titles.
     */
    public function lecturerBids(Request $request)
    {
        $user = $request->user();

        $query = Bid::with(['group.members.student', 'group.period', 'title', 'proposedSupervisor1', 'proposedSupervisor2'])
            ->whereHas('title', function ($q) use ($user) {
                $q->where('lecturer_id', $user->id);
            });

        if ($request->has('period_id')) {
            $query->whereHas('group', function ($q) use ($request) {
                $q->where('period_id', $request->period_id);
            });
        }

        $bids = $query->orderBy('title_id')
            ->orderBy('priority')
            ->get();

        return response()->json(['data' => $bids]);
    }

    /**
     * Lecturer recommendation on a bid (ACCEPT/REJECT).
     * REJECT = immediate deletion from bids table.
     */
    public function recommend(Request $request, $id)
    {
        $request->validate([
            'recommendation' => 'required|in:ACCEPT,REJECT',
        ]);

        $user = $request->user();

        $bid = Bid::with('title')->findOrFail($id);

        // Verify lecturer owns the title
        if ($bid->title->lecturer_id !== $user->id) {
            return response()->json(['message' => 'Anda tidak memiliki akses.'], 403);
        }

        // Check lock
        $group = Group::with('period')->find($bid->group_id);
        if ($this->biddingService->isBiddingLocked($group->period)) {
            return response()->json(['message' => 'Bidding ditutup. Tidak dapat mengubah rekomendasi.'], 400);
        }

        // Store title info before potential deletion
        $titleInfo = $bid->title->title;

        // ACCEPT Logic
        if ($request->recommendation === 'ACCEPT') {
            // Validation: Only one ACCEPT per title (check if different bid already accepted)
            $existingAcceptedBid = Bid::where('title_id', $bid->title_id)
                ->where('id', '!=', $bid->id)
                ->where('lecturer_recommendation', 'ACCEPT')
                ->first();
            
            if ($existingAcceptedBid) {
                return response()->json([
                    'message' => 'Anda sudah menerima kelompok lain untuk judul ini. Hanya satu kelompok yang dapat diterima per judul.'
                ], 400);
            }

            // Update this bid to ACCEPT
            $bid->update(['lecturer_recommendation' => 'ACCEPT']);

            // Transition group to TITLE_APPROVED
            $group->title_id = $bid->title_id;
            $group->status = 'TITLE_APPROVED';
            $group->save();
            
            // Notify accepted group members - OPTIMIZED: Batch insert
            $members = $group->members()->with('student')->get();
            $notifications = [];
            $now = now();
            
            foreach ($members as $member) {
                $notifications[] = [
                    'user_id' => $member->student_id,
                    'type' => 'BID_ACCEPTED',
                    'title' => 'Bid Diterima',
                    'message' => "Bid Anda untuk judul \"{$titleInfo}\" telah diterima. Silakan klik 'Siap Finalisasi' jika sudah siap.",
                    'related_type' => 'Bid',
                    'related_id' => $bid->id,
                    'is_read' => false,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
            
            if (!empty($notifications)) {
                \App\Models\Notification::insert($notifications);
            }

            // Auto-reject (DELETE) all other pending bids on this title
            $otherBids = Bid::with('group.members.student')
                ->where('title_id', $bid->title_id)
                ->where('id', '!=', $bid->id)
                ->whereNull('lecturer_recommendation') // Only pending bids
                ->get();
            
            // OPTIMIZED: Batch collect notifications and delete bids
            $rejectedNotifications = [];
            $rejectedBidIds = [];
            $now = now();
            
            foreach ($otherBids as $otherBid) {
                // Collect notifications for batch insert
                foreach ($otherBid->group->members as $member) {
                    $rejectedNotifications[] = [
                        'user_id' => $member->student_id,
                        'type' => 'BID_REJECTED',
                        'title' => 'Bid Ditolak',
                        'message' => "Bid Anda untuk judul \"{$titleInfo}\" telah ditolak karena dosen sudah menerima kelompok lain. Anda dapat mengajukan bid untuk judul lain.",
                        'related_type' => 'Group',
                        'related_id' => $otherBid->group_id,
                        'is_read' => false,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
                
                $rejectedBidIds[] = $otherBid->id;
            }
            
            // Batch insert all rejected notifications
            if (!empty($rejectedNotifications)) {
                \App\Models\Notification::insert($rejectedNotifications);
            }
            
            // Batch delete all rejected bids
            if (!empty($rejectedBidIds)) {
                Bid::whereIn('id', $rejectedBidIds)->delete();
            }
            
            // NEW: Auto-delete all other bids from the same group to other titles
            $otherGroupBids = Bid::with(['title.lecturer', 'group.members'])
                ->where('group_id', $group->id)
                ->where('id', '!=', $bid->id)
                ->whereNull('lecturer_recommendation') // Only pending bids
                ->get();
            
            foreach ($otherGroupBids as $otherBid) {
                // Notify the lecturer before deleting
                if ($otherBid->title && $otherBid->title->lecturer) {
                    \App\Models\Notification::create([
                        'user_id' => $otherBid->title->lecturer_id,
                        'type' => 'BID_AUTO_REJECTED',
                        'title' => 'Bid Ditolak Otomatis',
                        'message' => "Bid dari kelompok #{$group->id} untuk judul \"{$otherBid->title->title}\" ditolak otomatis karena kelompok tersebut sudah mendapat judul lain yang disetujui.",
                        'related_type' => 'Bid',
                        'related_id' => $otherBid->id,
                    ]);
                }
                
                // Notify group members before deleting
                foreach ($otherBid->group->members as $member) {
                    \App\Models\Notification::create([
                        'user_id' => $member->student_id,
                        'type' => 'BID_REJECTED',
                        'title' => 'Bid Ditolak',
                        'message' => "Bid Anda untuk judul \"{$otherBid->title->title}\" ditolak karena kelompok sudah mendapat judul \"{$titleInfo}\" yang disetujui.",
                        'related_type' => 'Bid',
                        'related_id' => $otherBid->id,
                    ]);
                }
                
                // DELETE the bid immediately
                $otherBid->delete();
            }
            
            return response()->json([
                'message' => 'Bid diterima. Semua bid lain dari kelompok ini otomatis dihapus.',
                'data' => $bid->fresh(),
            ]);
        }
        
        // REJECT Logic - DELETE the bid immediately
        if ($request->recommendation === 'REJECT') {
            $previousRecommendation = $bid->lecturer_recommendation;
            
            // If this bid was previously ACCEPTED, revert group status
            if ($previousRecommendation === 'ACCEPT') {
                $group->title_id = null;
                $group->status = 'READY_FOR_BIDDING';
                $group->save();
            }
            
            // OPTIMIZED: Batch insert notifications for rejection
            $members = $group->members()->with('student')->get();
            $rejectedNotifications = [];
            $now = now();
            
            foreach ($members as $member) {
                $rejectedNotifications[] = [
                    'user_id' => $member->student_id,
                    'type' => 'BID_REJECTED',
                    'title' => 'Bid Ditolak',
                    'message' => "Bid Anda untuk judul \"{$titleInfo}\" telah ditolak. Anda dapat mengajukan bid untuk judul lain.",
                    'related_type' => 'Group',
                    'related_id' => $group->id,
                    'is_read' => false,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
            
            if (!empty($rejectedNotifications)) {
                \App\Models\Notification::insert($rejectedNotifications);
            }
            
            // DELETE the bid immediately
            $bid->delete();
            
            return response()->json([
                'message' => 'Bid ditolak dan dihapus.',
            ]);
        }

        return response()->json([
            'message' => 'Recommendation submitted.',
        ]);
    }
}
