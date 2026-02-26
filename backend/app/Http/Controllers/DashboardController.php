<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use App\Models\Period;
use App\Models\Title;
use App\Models\Group;
use App\Models\GroupMember;
use Illuminate\Support\Facades\Auth;

class DashboardController extends Controller
{
    public function admin()
    {
        return response()->json([
            'total_users' => User::count(),
            'total_students' => User::where('role', 'mahasiswa')->count(),
            'total_lecturers' => User::where('role', 'dosen')->count(),
            'active_periods' => Period::where('is_active', 'true')->get(),
        ]);
    }

    public function dosen()
    {
        $user = Auth::user();
        $titles = Title::where('lecturer_id', $user->id)->get();
        $totalTitles = $titles->count();

        $activeGroups = Group::whereIn('title_id', $titles->pluck('id'))
            ->where('status', 'APPROVED')
            ->count();

        $pendingBimbingan = 0;

        // Count pending student proposals for this lecturer
        $pendingProposals = Title::where('proposed_supervisor_id', $user->id)
            ->where('title_source', 'STUDENT')
            ->where('supervisor_approval_status', 'PENDING')
            ->count();

        return response()->json([
            'total_titles' => $totalTitles,
            'active_groups' => $activeGroups,
            'pending_bimbingan' => $pendingBimbingan,
            'pending_proposals' => $pendingProposals,
        ]);
    }

    public function mahasiswa()
    {
        $user = Auth::user();
        // Find group where user is a member (exclude rejected groups)
        $groupMember = GroupMember::with(['group.title'])
            ->where('student_id', $user->id)
            ->whereHas('group', function ($q) {
                $q->where('status', '!=', 'REJECTED');
            })
            ->first();
        $group = $groupMember ? $groupMember->group : null;
        if ($group) {
            $group->load('period');
        }

        $documents = $group ? \App\Models\Document::where('group_id', $group->id)->get() : collect([]);

        $phases = ['PDC1', 'SEMPRO', 'PDC2', 'TA', 'SIDANG', 'EXPO'];
        $steps = [];
        foreach ($phases as $phase) {
            $steps[$phase] = $documents->where('phase', $phase)->where('status', 'APPROVED')->isNotEmpty();
        }

        $isGraduated = $group && $group->status === 'APPROVED' && collect($steps)->every(fn($v) => $v === true);

        // Check for pending proposal
        $pendingProposal = null;
        if ($group) {
            $pendingProposal = Title::where('proposed_by_group_id', $group->id)
                ->where('title_source', 'STUDENT')
                ->whereIn('supervisor_approval_status', ['PENDING', 'REJECTED'])
                ->with('proposedSupervisor')
                ->latest()
                ->first();
        }

        return response()->json([
            'has_group' => $group ? true : false,
            'group_status' => $group ? $group->status : null,
            'title' => $group && $group->title ? $group->title->title : null,
            'group_period' => $group ? $group->period : null,
            'active_periods' => Period::where('is_active', 'true')->get(),
            'steps' => $steps,
            'is_graduated' => $isGraduated,
            'pending_proposal' => $pendingProposal,
        ]);
    }
}
