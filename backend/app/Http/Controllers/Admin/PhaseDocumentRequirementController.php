<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PhaseDocumentRequirement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class PhaseDocumentRequirementController extends Controller
{
    const PHASES = ['PDC1', 'SEMPRO', 'PDC2', 'EXPO', 'TA', 'SIDANG'];

    public function index(Request $request)
    {
        $query = PhaseDocumentRequirement::query();

        if ($request->has('period_id')) {
            $query->where('period_id', $request->period_id);
        }

        if ($request->has('phase')) {
            $query->where('phase', $request->phase);
        }

        $requirements = $query->orderBy('phase')->orderBy('name')->get();

        return response()->json(['data' => $requirements]);
    }

    public function byPeriod($periodId)
    {
        $requirements = PhaseDocumentRequirement::where('period_id', $periodId)
            ->orderBy('phase')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $requirements]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'period_id' => 'required|exists:periods,id',
            'phase' => 'required|string|in:' . implode(',', self::PHASES),
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'is_required' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $requirement = PhaseDocumentRequirement::create($request->all());

        return response()->json([
            'message' => 'Document requirement created successfully',
            'data' => $requirement
        ], 201);
    }

    public function update(Request $request, string $id)
    {
        $requirement = PhaseDocumentRequirement::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'phase' => 'sometimes|string|in:' . implode(',', self::PHASES),
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'is_required' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $requirement->update($request->all());

        return response()->json([
            'message' => 'Document requirement updated successfully',
            'data' => $requirement
        ]);
    }

    public function destroy(string $id)
    {
        $requirement = PhaseDocumentRequirement::findOrFail($id);
        $requirement->delete();

        return response()->json(['message' => 'Document requirement deleted successfully']);
    }

    public function bulkUpdate(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'period_id' => 'required|exists:periods,id',
            'requirements' => 'required|array',
            'requirements.*.phase' => 'required|string|in:' . implode(',', self::PHASES),
            'requirements.*.name' => 'required|string|max:255',
            'requirements.*.description' => 'nullable|string',
            'requirements.*.is_required' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $periodId = $request->period_id;
        $phases = $request->requirements;

        PhaseDocumentRequirement::where('period_id', $periodId)->delete();

        $created = [];
        foreach ($phases as $req) {
            $created[] = PhaseDocumentRequirement::create([
                'period_id' => $periodId,
                'phase' => $req['phase'],
                'name' => $req['name'],
                'description' => $req['description'] ?? null,
                'is_required' => $req['is_required'] ?? false,
            ]);
        }

        return response()->json([
            'message' => 'Document requirements updated successfully',
            'data' => $created
        ]);
    }
}
