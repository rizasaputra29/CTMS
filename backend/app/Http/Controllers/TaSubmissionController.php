<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\TaSubmission;
use App\Models\Period;
use App\Services\GroupStateMachine;
use App\Exceptions\ConflictRuleException;
use App\Exceptions\DomainRuleException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Database\QueryException;

class TaSubmissionController extends Controller
{
    protected GroupStateMachine $stateMachine;

    public function __construct(GroupStateMachine $stateMachine)
    {
        $this->stateMachine = $stateMachine;
    }

    /**
     * Get my TA submission status.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $submission = TaSubmission::with(['group.title', 'reviewer'])
            ->where('student_id', $user->id)
            ->first();

        return response()->json(['data' => $submission]);
    }

    /**
     * Upload TA draft (student).
     */
    public function upload(Request $request)
    {
        $request->validate([
            'file_path' => 'required|string',
        ]);

        $user = $request->user();

        // Find student's group
        $membership = GroupMember::where('student_id', $user->id)->first();
        if (!$membership) {
            return response()->json(['message' => 'You are not in a group.'], 400);
        }

        $group = Group::findOrFail($membership->group_id);

        // Gate: group must be at least PDC2_ACTIVE
        if (!$this->stateMachine->isAtLeast($group, 'PDC2_ACTIVE')) {
            return response()->json(['message' => 'Group must be at least in PDC2_ACTIVE status.'], 400);
        }

        // Create or update TA submission
        $submission = TaSubmission::updateOrCreate(
            ['student_id' => $user->id, 'group_id' => $group->id],
            [
                'status' => 'TA_DRAFT',
                'file_path' => $request->file_path,
                'feedback' => null,
            ]
        );

        return response()->json([
            'message' => 'TA draft uploaded.',
            'data' => $submission,
        ]);
    }

    /**
     * Submit a revision (student).
     */
    public function revise(Request $request)
    {
        $request->validate([
            'file_path' => 'required|string',
        ]);

        $user = $request->user();

        $submission = TaSubmission::where('student_id', $user->id)->firstOrFail();

        $submission->update([
            'status' => 'TA_REVISED',
            'file_path' => $request->file_path,
            'feedback' => null,
        ]);

        return response()->json([
            'message' => 'TA revision submitted.',
            'data' => $submission->fresh(),
        ]);
    }

    /**
     * Register for TA defense (student).
     */
    public function register(Request $request)
    {
        $user = $request->user();

        // 1. Resolve Active Period (Cached)
        $activePeriod = Cache::remember('active_period', 3600, function () {
            return Period::where('is_active', true)
                ->where('is_finalized', false)
                ->orderBy('created_at', 'desc')
                ->first();
        });

        if (!$activePeriod) {
            throw new DomainRuleException("Tidak ada periode pendaftaran aktif saat ini.");
        }

        // 2. Check TA Registration Window
        $now = now();
        if (!$activePeriod->ta_start || !$activePeriod->ta_end || $now->lt($activePeriod->ta_start) || $now->gt($activePeriod->ta_end)) {
            throw new DomainRuleException("Pendaftaran sidang TA saat ini sedang ditutup.");
        }

        return DB::transaction(function () use ($user, $activePeriod) {
            // A. Row-Level Lock on Submission
            $submission = TaSubmission::where('student_id', $user->id)
                ->where('period_id', $activePeriod->id)
                ->lockForUpdate()
                ->first();

            if (!$submission) {
                throw new DomainRuleException("Data pendaftaran TA tidak ditemukan.");
            }

            // Idempotency
            if ($submission->status === 'TA_REGISTERED') {
                throw new ConflictRuleException("Anda sudah terdaftar untuk sidang TA.");
            }

            // B. Eligibility Check (Submission Status & Group Status)
            if ($submission->status !== 'TA_READY') {
                throw new DomainRuleException("Status TA Anda belum mencapai TA_READY.");
            }

            $group = Group::where('id', $submission->group_id)->lockForUpdate()->first();
            if (!in_array($group->status, ['PDC2_COMPLETED'])) {
                throw new DomainRuleException("Grup Anda belum menyelesaikan fase PDC2_COMPLETED.");
            }

            // C. Finalize Registration
            $submission->update(['status' => 'TA_REGISTERED']);

            // Audit
            AuditLog::create([
                'user_id' => $user->id,
                'action' => 'TA_REGISTER_DEFENSE',
                'target_type' => 'TaSubmission',
                'target_id' => $submission->id,
                'payload' => [
                    'request_id' => Log::getContext()['request_id'] ?? null,
                    'period_id' => $activePeriod->id
                ],
            ]);

            return response()->json([
                'message' => 'Pendaftaran sidang TA berhasil.',
                'data' => $submission->fresh(),
            ]);
        });
    }

    /**
     * Review TA submission (dosen).
     */
    public function review(Request $request, $id)
    {
        $request->validate([
            'result' => 'required|in:APPROVE,REVISE',
            'feedback' => 'nullable|string',
        ]);

        $user = $request->user();
        $submission = TaSubmission::findOrFail($id);

        if ($request->result === 'APPROVE') {
            $submission->update([
                'status' => 'TA_READY',
                'feedback' => $request->feedback,
                'reviewed_by' => $user->id,
            ]);
        } else {
            $submission->update([
                'feedback' => $request->feedback,
                'reviewed_by' => $user->id,
                // Status stays at current (student needs to revise)
            ]);
        }

        return response()->json([
            'message' => "TA review: {$request->result}",
            'data' => $submission->fresh(),
        ]);
    }

    /**
     * Mark TA as defended (dosen). If all group members defended → group CLOSED.
     */
    public function defended(Request $request, $id)
    {
        $user = $request->user();
        $submission = TaSubmission::findOrFail($id);

        if ($submission->status !== 'TA_REGISTERED') {
            return response()->json(['message' => 'TA must be in TA_REGISTERED status.'], 400);
        }

        return DB::transaction(function () use ($user, $submission) {
            $submission->update([
                'status' => 'TA_DEFENDED',
                'reviewed_by' => $user->id,
            ]);

            // Audit log
            AuditLog::create([
                'user_id' => $user->id,
                'action' => 'TA_DEFENDED',
                'target_type' => 'TaSubmission',
                'target_id' => $submission->id,
                'payload' => ['student_id' => $submission->student_id],
            ]);

            // Check if ALL active group members have defended
            $group = Group::findOrFail($submission->group_id);
            $activeMemberCount = GroupMember::where('group_id', $group->id)->count();
            $defendedCount = TaSubmission::where('group_id', $group->id)
                ->where('status', 'TA_DEFENDED')
                ->count();

            if ($activeMemberCount > 0 && $defendedCount >= $activeMemberCount) {
                $this->stateMachine->transition($group, 'CLOSED');
            }

            return response()->json([
                'message' => 'TA marked as defended.',
                'data' => $submission->fresh(),
                'group' => $group->fresh(),
            ]);
        });
    }
}
