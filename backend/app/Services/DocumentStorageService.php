<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class DocumentStorageService
{
    /**
     * Store file in MinIO (new uploads)
     */
    public function store($file, string $folder, string $prefix = ''): string
    {
        $filename = time() . '_' . $file->getClientOriginalName();
        $path = $prefix
            ? "{$folder}/{$prefix}/{$filename}"
            : "{$folder}/{$filename}";

        Storage::disk('s3')->put($path, file_get_contents($file));

        return $path;
    }

    /**
     * Get file for download - supports both old (local) and new (MinIO)
     */
    public function get(string $path): ?array
    {
        // Check MinIO first (new files)
        if (Storage::disk('s3')->exists($path)) {
            return [
                'disk' => 's3',
                'content' => Storage::disk('s3')->get($path),
                'mime_type' => Storage::disk('s3')->mimeType($path),
            ];
        }

        // Fallback to local (old files)
        if (Storage::disk('public')->exists($path)) {
            return [
                'disk' => 'public',
                'path' => Storage::disk('public')->path($path),
            ];
        }

        return null;
    }

    /**
     * Delete file from both storages
     */
    public function delete(string $path): void
    {
        if (Storage::disk('s3')->exists($path)) {
            Storage::disk('s3')->delete($path);
        }
        if (Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
        }
    }

    /**
     * Migrate single file from local to MinIO
     */
    public function migrateToS3(string $path): bool
    {
        if (! Storage::disk('public')->exists($path)) {
            Log::warning("File not found for migration: {$path}");

            return false;
        }

        try {
            $content = Storage::disk('public')->get($path);
            Storage::disk('s3')->put($path, $content);

            return Storage::disk('s3')->exists($path);
        } catch (\Exception $e) {
            Log::error("Migration failed for {$path}: ".$e->getMessage());

            return false;
        }
    }
}
