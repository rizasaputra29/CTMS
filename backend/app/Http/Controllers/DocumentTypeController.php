<?php

namespace App\Http\Controllers;

use App\Models\DocumentType;
use Illuminate\Http\Request;

class DocumentTypeController extends Controller
{
    public function index()
    {
        return response()->json(DocumentType::orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'phase' => 'nullable|string|in:PDC1,PDC2,TA',
            'is_active' => 'boolean',
        ]);

        $type = DocumentType::create($data);

        return response()->json($type, 201);
    }

    public function update(Request $request, $id)
    {
        $type = DocumentType::findOrFail($id);

        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'phase' => 'nullable|string|in:PDC1,PDC2,TA',
            'is_active' => 'boolean',
        ]);

        $type->update($data);

        return response()->json($type);
    }

    public function destroy($id)
    {
        $type = DocumentType::findOrFail($id);
        $type->delete();

        return response()->json(['message' => 'Document type deleted']);
    }
}
