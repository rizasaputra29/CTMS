<?php

namespace App\Http\Controllers;

use App\Models\AssessmentComponentTemplate;
use Illuminate\Http\Request;

class AssessmentComponentTemplateController extends Controller
{
    /**
     * List all assessment component templates (bank soal).
     */
    public function index()
    {
        $templates = AssessmentComponentTemplate::where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('code')
            ->get();

        return response()->json(['data' => $templates]);
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

        return response()->json($template, 201);
    }

    /**
     * Get a single assessment component template.
     */
    public function show($id)
    {
        $template = AssessmentComponentTemplate::findOrFail($id);

        return response()->json(['data' => $template]);
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

        return response()->json($template);
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

            return response()->json([
                'message' => 'Template marked as inactive (has existing usage in '.$usageCount.' period configurations)',
            ]);
        }

        $template->delete();

        return response()->json(['message' => 'Template deleted']);
    }
}
