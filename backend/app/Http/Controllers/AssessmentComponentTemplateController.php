<?php

namespace App\Http\Controllers;

use App\Models\AssessmentComponentTemplate;
use Illuminate\Http\Request;

class AssessmentComponentTemplateController extends Controller
{
    use ApiResponseTrait;

    /**
     * List all assessment component templates (bank soal).
     */
    public function index()
    {
        $templates = AssessmentComponentTemplate::where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('code')
            ->get();

        return $this->successResponse($templates);
    }

    /**
     * Create a new assessment component template.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'code' => 'required|string|max:50|unique:assessment_component_templates',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'weight' => 'required|numeric|min:0|max:100',
            'sort_order' => 'nullable|integer',
        ]);

        $data['created_by'] = $request->user()->id;

        $template = AssessmentComponentTemplate::create($data);

        return $this->createdResponse($template);
    }

    /**
     * Get a single assessment component template.
     */
    public function show($id)
    {
        $template = AssessmentComponentTemplate::findOrFail($id);

        return $this->successResponse($template);
    }

    /**
     * Update an assessment component template.
     */
    public function update(Request $request, $id)
    {
        $template = AssessmentComponentTemplate::findOrFail($id);

        $data = $request->validate([
            'code' => 'sometimes|string|max:50|unique:assessment_component_templates,code,'.$id,
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'weight' => 'sometimes|numeric|min:0|max:100',
            'sort_order' => 'nullable|integer',
            'is_active' => 'sometimes|boolean',
        ]);

        $template->update($data);

        return $this->successResponse($template);
    }

    /**
     * Delete (soft delete by marking inactive) an assessment component template.
     */
    public function destroy($id)
    {
        $template = AssessmentComponentTemplate::findOrFail($id);

        // Check if template is used in any period
        $usageCount = $template->periodComponents()->count();
        if ($usageCount > 0) {
            // Soft delete by marking inactive
            $template->update(['is_active' => false]);

            return $this->successResponse(null, 'Template marked as inactive (has existing usage in '.$usageCount.' period configurations)');
        }

        $template->delete();

        return $this->successResponse(null, 'Template deleted');
    }

    /**
     * Check if evaluation setup (templates) exist for the period wizard.
     */
    public function check()
    {
        $count = AssessmentComponentTemplate::where('is_active', true)->count();

        return $this->successResponse([
            'hasTemplates' => $count > 0,
            'message' => $count > 0
                ? "Tersedia {$count} komponen asesment"
                : 'Belum ada komponen asesment. Silakan buat terlebih dahulu di Bank Soal.',
        ]);
    }
}
