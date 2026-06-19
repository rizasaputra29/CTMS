<?php
namespace App\Http\Controllers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
class FileController extends Controller
{
    /**
     * Upload a file
     */
    public function upload(Request $request)
    {
        $request->validate([
            'file' => 'required|file|max:10240', // Max 10MB
        ]);
        $file = $request->file('file');
        $userId = auth()->id() ?? 'guest';
        
        // Create user-specific folder
        $path = "uploads/{$userId}/" . Str::random(20) . '_' . $file->getClientOriginalName();
        
        // Store in MinIO
        Storage::disk('s3')->put($path, file_get_contents($file));
        
        return response()->json([
            'success' => true,
            'path' => $path,
            'url' => Storage::disk('s3')->url($path),
            'message' => 'File uploaded successfully'
        ]);
    }
    /**
     * Download a file (secure - checks ownership)
     */
    public function download($path)
    {
        // Check if user owns this file
        $userId = auth()->id();
        if (!str_starts_with($path, "uploads/{$userId}/")) {
            abort(403, 'Unauthorized');
        }
        if (!Storage::disk('s3')->exists($path)) {
            abort(404, 'File not found');
        }
        return Storage::disk('s3')->download($path);
    }
    /**
     * Get file for display (images, etc.)
     */
    public function show($path)
    {
        $userId = auth()->id();
        if (!str_starts_with($path, "uploads/{$userId}/")) {
            abort(403);
        }
        if (!Storage::disk('s3')->exists($path)) {
            abort(404);
        }
        $file = Storage::disk('s3')->get($path);
        $mimeType = Storage::disk('s3')->mimeType($path);
        return response($file, 200)->header('Content-Type', $mimeType);
    }
    /**
     * List user's files
     */
    public function list()
    {
        $userId = auth()->id();
        $files = Storage::disk('s3')->files("uploads/{$userId}");
        
        $fileList = collect($files)->map(function ($file) {
            return [
                'path' => $file,
                'name' => basename($file),
                'size' => Storage::disk('s3')->size($file),
                'url' => Storage::disk('s3')->url($file),
                'last_modified' => Storage::disk('s3')->lastModified($file),
            ];
        });
        return response()->json($fileList);
    }
    /**
     * Delete a file
     */
    public function delete($path)
    {
        $userId = auth()->id();
        if (!str_starts_with($path, "uploads/{$userId}/")) {
            abort(403);
        }
        if (Storage::disk('s3')->delete($path)) {
            return response()->json(['message' => 'File deleted']);
        }
        return response()->json(['message' => 'Failed to delete'], 500);
    }
}