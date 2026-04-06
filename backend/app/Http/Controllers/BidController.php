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
     */
    public function store(Request $request)
    {
        $request->validate([
            'title_id' => 'required|exists:titles,id',
            'priority' => 'required|integer|min:1',
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
        $bidCount = Bid::where('group_id', $group->id)->count();
        $proposalCount = \App\Models\Title::where('proposed_by_group_id', $group->id)
            ->where('title_source', 'STUDENT')
            ->whereIn('supervisor_approval_status', ['PENDING', 'UNDER_REVIEW', 'APPROVED'])
            ->count();

        if (($bidCount + $proposalCount) >= 3) {
            return response()->json(['message' => 'Maksimal 3 judul diperbolehkan (bidding + proposal digabungkan).'], 400);
        }

        // DB unique constraints will enforce (group_id, priority) and (group_id, title_id)
        try {
            $bid = Bid::create([
                'group_id' => $group->id,
                'title_id' => $request->title_id,
                'priority' => $request->priority,
                'status' => 'PENDING',
                'proposed_supervisor_1_id' => $request->proposed_supervisor_1_id,
                'proposed_supervisor_2_id' => $request->proposed_supervisor_2_id,
            ]);

            return response()->json([
                'message' => 'Bid submitted successfully.',
                'data' => $bid->load(['title.lecturer', 'proposedSupervisor1', 'proposedSupervisor2']),
            ], 201);
        } catch (\Illuminate\Database\QueryException $e) {
            if (str_contains($e->getMessage(), 'UNIQUE constraint failed') || str_contains($e->getMessage(), 'Duplicate entry')) {
                return response()->json(['message' => 'Duplicate bid: you already have a bid with this priority or for this title.'], 400);
            }
            throw $e;
        }
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
     * Lecturer recommendation on a bid (ACCEPT/REJECT — advisory only).
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

        $bid->update(['lecturer_recommendation' => $request->recommendation]);

        return response()->json([
            'message' => 'Recommendation submitted.',
            'data' => $bid,
        ]);
    }
}
