<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Controllers\ApiResponseTrait;
use App\Models\PhaseDocumentRequirement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class PhaseDocumentRequirementController extends Controller
{
    use ApiResponseTrait;

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

        return $this->successResponse($requirements, 'Document requirements retrieved successfully');
    }

    public function byPeriod($periodId)
    {
        $requirements = PhaseDocumentRequirement::where('period_id', $periodId)
            ->orderBy('phase')
            ->orderBy('name')
            ->get();

        return $this->successResponse($requirements, 'Document requirements retrieved successfully');
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
            return $this->validationErrorResponse($validator->errors());
        }

        $requirement = PhaseDocumentRequirement::create($request->all());

        return $this->createdResponse($requirement, 'Document requirement created successfully');
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
            return $this->validationErrorResponse($validator->errors());
        }

        $requirement->update($request->all());

        return $this->successResponse($requirement, 'Document requirement updated successfully');
    }

    public function destroy(string $id)
    {
        $requirement = PhaseDocumentRequirement::findOrFail($id);
        $requirement->delete();

        return $this->successResponse(null, 'Document requirement deleted successfully');
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
            return $this->validationErrorResponse($validator->errors());
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

        return $this->successResponse($created, 'Document requirements updated successfully');
    }
}
