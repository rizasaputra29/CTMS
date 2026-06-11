<?php

namespace App\Http\Controllers;

use App\Models\DigitalSignature;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class DigitalSignatureController extends Controller
{
    /**
     * Sign a document.
     */
    public function sign(Request $request)
    {
        $request->validate([
            'document_reference' => 'required|string|max:255',
            'document_type' => 'required|string|in:SURAT_TUGAS,BERITA_ACARA,SURAT_KEPUTUSAN,LAINNYA',
            'signature_data' => 'required|string', // base64 signature image
        ]);

        $user = $request->user();

        // Generate unique hash for verification
        $hash = hash('sha256', $user->id.$request->document_reference.now()->timestamp.Str::random(16));

        $signature = DigitalSignature::create([
            'user_id' => $user->id,
            'document_reference' => $request->document_reference,
            'document_type' => $request->document_type,
            'signature_data' => $request->signature_data,
            'hash' => $hash,
            'signed_at' => now(),
        ]);

        return response()->json([
            'message' => 'Document signed successfully',
            'signature' => $signature,
            'hash' => $hash,
        ], 201);
    }

    /**
     * Verify a signature by hash.
     */
    public function verify($hash)
    {
        $signature = DigitalSignature::with('user')
            ->where('hash', $hash)
            ->first();

        if (! $signature) {
            return response()->json([
                'valid' => false,
                'message' => 'Signature not found or invalid',
            ], 404);
        }

        return response()->json([
            'valid' => true,
            'signer' => $signature->user->name,
            'signed_at' => $signature->signed_at,
            'document' => $signature->document_reference,
            'type' => $signature->document_type,
        ]);
    }

    /**
     * List signatures by the current user (dosen).
     */
    public function mySignatures(Request $request)
    {
        $signatures = DigitalSignature::where('user_id', $request->user()->id)
            ->orderBy('signed_at', 'desc')
            ->get();

        return response()->json($signatures);
    }
}
