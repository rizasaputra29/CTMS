<?php

namespace App\Http\Controllers;

use App\Models\GroupMember;
use App\Models\SeminarEvaluation;
use App\Models\SeminarSchedule;
use App\Models\Supervision;
use App\Models\TaDefenseEvaluation;
use App\Models\TaDefenseExaminer;
use App\Models\TaDefenseSchedule;
use Illuminate\Http\Request;

class SeminarDashboardController extends Controller
{
    /**
     * Student: my group's SEMPRO/Expo schedules + results.
     */
    public function studentSchedules(Request $request)
    {
        $user = $request->user();
        $membership = GroupMember::where('student_id', $user->id)->first();

        if (!$membership) {
            return response()->json(['data' => ['seminars' => [], 'ta_defense' => null]]);
        }

        $seminars = SeminarSchedule::with(['examiner1', 'examiner2', 'evaluations.examiner'])
            ->where('group_id', $membership->group_id)
            ->get();

        $taDefense = TaDefenseSchedule::with(['examiners.examiner', 'evaluations.examiner'])
            ->where('student_id', $user->id)
            ->first();

        return response()->json([
            'data' => [
                'seminars' => $seminars,
                'ta_defense' => $taDefense,
            ],
        ]);
    }

    /**
     * Dosen: schedules where I'm a supervisor (read-only view).
     */
    public function supervisorSchedules(Request $request)
    {
        $user = $request->user();

        // Groups I supervise
        $groupIds = Supervision::where('supervisor_id', $user->id)->pluck('group_id');

        $seminars = SeminarSchedule::with(['group.title', 'examiner1', 'examiner2', 'evaluations.examiner'])
            ->whereIn('group_id', $groupIds)
            ->orderByDesc('date')
            ->get();

        $taDefenses = TaDefenseSchedule::with(['student', 'group.title', 'examiners.examiner', 'evaluations.examiner'])
            ->whereIn('group_id', $groupIds)
            ->orderByDesc('date')
            ->get();

        return response()->json([
            'data' => [
                'seminars' => $seminars,
                'ta_defenses' => $taDefenses,
            ],
        ]);
    }

    /**
     * Dosen: schedules where I'm an examiner (can submit rubric).
     */
    public function examinerSchedules(Request $request)
    {
        $user = $request->user();

        // Seminar schedules where I'm examiner
        $seminarScheduleIds = SeminarEvaluation::where('examiner_id', $user->id)
            ->pluck('schedule_id');

        $seminars = SeminarSchedule::with([
            'group.title',
            'group.members.student',
            'examiner1',
            'examiner2',
            'evaluations' => function ($q) use ($user) {
                $q->where('examiner_id', $user->id);
            }
        ])
            ->whereIn('id', $seminarScheduleIds)
            ->orderByDesc('date')
            ->get();

        // TA defense schedules where I'm examiner
        $taScheduleIds = TaDefenseExaminer::where('examiner_id', $user->id)
            ->pluck('schedule_id');

        $taDefenses = TaDefenseSchedule::with([
            'student',
            'group.title',
            'group.members.student',
            'examiners.examiner',
            'evaluations' => function ($q) use ($user) {
                $q->where('examiner_id', $user->id);
            }
        ])
            ->whereIn('id', $taScheduleIds)
            ->orderByDesc('date')
            ->get();

        return response()->json([
            'data' => [
                'seminars' => $seminars,
                'ta_defenses' => $taDefenses,
            ],
        ]);
    }
}
