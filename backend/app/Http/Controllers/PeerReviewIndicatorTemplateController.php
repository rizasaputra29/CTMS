<?php

namespace App\Http\Controllers;

use App\Models\PeerReviewIndicatorTemplate;
use Illuminate\Http\Request;

class PeerReviewIndicatorTemplateController extends Controller
{
    use ApiResponseTrait;

    /**
     * List all peer review indicator templates (bank soal).
     */
    public function index()
    {
        $templates = PeerReviewIndicatorTemplate::where('is_active', true)
            ->orderBy('sort_order')
            ->get();

        return $this->successResponse($templates);
    }

    /**
     * Create a new peer review indicator template.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'weight' => 'required|numeric|min:0|max:100',
            'sort_order' => 'nullable|integer',
        ]);

        $data['created_by'] = $request->user()->id;

        $template = PeerReviewIndicatorTemplate::create($data);

        return $this->createdResponse($template);
    }

    /**
     * Update a peer review indicator template.
     */
    public function update(Request $request, $id)
    {
        $template = PeerReviewIndicatorTemplate::findOrFail($id);

        $data = $request->validate([
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
     * Delete (soft delete by marking inactive) a peer review indicator template.
     */
    public function destroy($id)
    {
        $template = PeerReviewIndicatorTemplate::findOrFail($id);

        // Check if template is used in any period
        $usageCount = $template->periodIndicators()->count();
        if ($usageCount > 0) {
            // Soft delete by marking inactive
            $template->update(['is_active' => false]);

            return $this->successResponse(null, 'Template marked as inactive (has existing usage in '.$usageCount.' period configurations)');
        }

        $template->delete();

        return $this->successResponse(null, 'Template deleted');
    }
}
