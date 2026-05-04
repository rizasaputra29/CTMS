<?php

namespace App\Http\Controllers;

use App\Models\GradeConsistencyCheck;
use App\Models\AssessmentScore;
use App\Models\Group;
use Illuminate\Http\Request;

class GradeConsistencyController extends Controller
{
    /**
     * List grade consistency checks for a period.
     */
    public function index(Request $request)
    {
        $request->validate([
            'period_id' => 'required|exists:periods,id',
        ]);

        $checks = GradeConsistencyCheck::with(['group.title', 'student', 'checker'])
            ->whereHas('group', fn($q) => $q->where('period_id', $request->period_id))
            ->orderBy('deviation', 'desc')
            ->get();

        return response()->json($checks);
    }

    /**
     * Auto-generate consistency checks from assessment scores.
     */
    public function generate(Request $request)
    {
        $request->validate([
            'period_id' => 'required|exists:periods,id',
        ]);

        $groups = Group::where('period_id', $request->period_id)
            ->whereIn('status', [
                'PDC1_ACTIVE',
                'PDC2_ACTIVE',
                'READY_FOR_TA_INDIVIDUAL',
                'SEMPRO_DONE',
                'EXPO_DONE',
                'TITLE_APPROVED',
                'KELOMPOK_FINAL',
                'READY_FOR_SEMPRO',
                'PDC2_READY_FOR_EXPO',
                'EXPO_REGISTERED'
            ])
            ->with('members')
            ->get();

        $generated = 0;

        foreach ($groups as $group) {
            foreach ($group->members as $member) {
                // Get PDC1 (SEMPRO) average score
                $pdc1 = AssessmentScore::where('group_id', $group->id)
                    ->where('student_id', $member->student_id)
                    ->where('evaluation_type', 'SEMPRO')
                    ->avg('score');

                // Get PDC2 (SIDANG_TA) average score
                $pdc2 = AssessmentScore::where('group_id', $group->id)
                    ->where('student_id', $member->student_id)
                    ->where('evaluation_type', 'SIDANG_TA')
                    ->avg('score');

                if ($pdc1 !== null || $pdc2 !== null) {
                    $deviation = ($pdc1 !== null && $pdc2 !== null)
                        ? abs($pdc1 - $pdc2)
                        : null;

                    $status = 'UNCHECKED';
                    if ($deviation !== null) {
                        $status = $deviation <= 15 ? 'CONSISTENT' : 'INCONSISTENT';
                    }

                    GradeConsistencyCheck::updateOrCreate(
                        [
                            'group_id' => $group->id,
                            'student_id' => $member->student_id,
                        ],
                        [
                            'pdc1_score' => $pdc1 ? round($pdc1, 2) : null,
                            'pdc2_score' => $pdc2 ? round($pdc2, 2) : null,
                            'deviation' => $deviation !== null ? round($deviation, 2) : null,
                            'status' => $status,
                        ]
                    );

                    $generated++;
                }
            }
        }

        return response()->json(['message' => "Generated $generated consistency checks"]);
    }

    /**
     * Update notes/status for a check.
     */
    public function update(Request $request, $id)
    {
        $check = GradeConsistencyCheck::findOrFail($id);

        $data = $request->validate([
            'status' => 'sometimes|string|in:UNCHECKED,CONSISTENT,INCONSISTENT',
            'notes' => 'nullable|string',
        ]);

        $data['checked_by'] = $request->user()->id;
        $check->update($data);

        return response()->json($check);
    }
}
