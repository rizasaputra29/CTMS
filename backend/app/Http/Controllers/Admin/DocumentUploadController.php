<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\ApiResponseTrait;
use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\ExpoStudentDocument;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\TaSubmission;
use App\Services\DocumentStorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DocumentUploadController extends Controller
{
    use ApiResponseTrait;

    protected DocumentStorageService $documentStorage;

    public function __construct(DocumentStorageService $documentStorage)
    {
        $this->documentStorage = $documentStorage;
    }

    /**
     * Get all uploaded documents grouped by group with filters and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $page = $request->input('page', 1);
        $perPage = $request->input('per_page', 10);

        $documents = collect();

        $sourceFilter = $request->input('source');

        if (! $sourceFilter || $sourceFilter === 'phase_documents') {
            $documents = $documents->merge($this->getPhaseDocuments($request));
        }

        if (! $sourceFilter || $sourceFilter === 'expo_documents') {
            $documents = $documents->merge($this->getExpoDocuments($request));
        }

        if (! $sourceFilter || $sourceFilter === 'ta_documents') {
            $documents = $documents->merge($this->getTaDocuments($request));
        }

        $documents = $documents->sortByDesc('uploaded_at')->values();

        // Group documents by group_id
        $grouped = $documents->groupBy('group.id')->map(function ($docs, $groupId) {
            $firstDoc = $docs->first();
            $members = $this->getGroupMembers((int) $groupId);

            $phaseCount = $docs->where('source', 'phase_documents')->count();
            $expoCount = $docs->where('source', 'expo_documents')->count();
            $taCount = $docs->where('source', 'ta_documents')->count();

            return [
                'group_id' => (int) $groupId,
                'group_code' => $firstDoc['group']['code'] ?? 'Unknown',
                'period' => $firstDoc['period'] ?? null,
                'members' => $members,
                'total_documents' => $docs->count(),
                'phase_documents_count' => $phaseCount,
                'expo_documents_count' => $expoCount,
                'ta_documents_count' => $taCount,
                'latest_upload_at' => $docs->first()['uploaded_at'] ?? null,
                'documents' => $docs->values()->toArray(),
            ];
        })->values();

        // Sort by latest_upload_at desc
        $grouped = $grouped->sortByDesc('latest_upload_at')->values();

        // Group-level search: filter by group code or member names
        if ($request->filled('search')) {
            $search = strtolower($request->input('search'));
            $grouped = $grouped->filter(function ($group) use ($search) {
                if (str_contains(strtolower($group['group_code']), $search)) {
                    return true;
                }

                return collect($group['members'])->contains(function ($member) use ($search) {
                    return str_contains(strtolower($member['name']), $search);
                });
            })->values();
        }

        // Manual pagination
        $total = $grouped->count();
        $lastPage = (int) ceil($total / $perPage);
        $currentPage = min(max($page, 1), $lastPage ?: 1);
        $offset = ($currentPage - 1) * $perPage;

        $paginatedGroups = $grouped->slice($offset, $perPage)->values();

        return $this->successResponse([
            'data' => $paginatedGroups,
            'pagination' => [
                'current_page' => $currentPage,
                'last_page' => $lastPage,
                'per_page' => (int) $perPage,
                'total' => $total,
            ],
        ], 'Documents retrieved successfully');
    }

    /**
     * Get summary statistics for document uploads.
     */
    public function summary(Request $request): JsonResponse
    {
        $periodId = $request->input('period_id');

        $phaseQuery = Document::query();
        $expoQuery = ExpoStudentDocument::query();
        $taQuery = TaSubmission::query();

        if ($periodId) {
            $phaseQuery->whereHas('group', fn ($q) => $q->where('period_id', $periodId));
            $expoQuery->whereHas('group', fn ($q) => $q->where('period_id', $periodId));
            $taQuery->whereHas('group', fn ($q) => $q->where('period_id', $periodId));
        }

        $phaseCount = $phaseQuery->count();
        $expoCount = $expoQuery->count();

        $taCount = (clone $taQuery)->whereNotNull('file_path')->count()
            + (clone $taQuery)->whereNotNull('draft_report_path')->count()
            + (clone $taQuery)->whereNotNull('paper_path')->count();

        $groupsWithPhaseDocs = (clone $phaseQuery)->distinct('group_id')->pluck('group_id');
        $groupsWithExpoDocs = (clone $expoQuery)->distinct('group_id')->pluck('group_id');
        $groupsWithTaDocs = (clone $taQuery)->whereNotNull('file_path')->distinct('group_id')->pluck('group_id');

        $groupsWithUploads = $groupsWithPhaseDocs
            ->merge($groupsWithExpoDocs)
            ->merge($groupsWithTaDocs)
            ->unique()
            ->count();

        $studentsWithPhaseDocs = (clone $phaseQuery)->distinct('student_id')->pluck('student_id');
        $studentsWithExpoDocs = (clone $expoQuery)->distinct('student_id')->pluck('student_id');
        $studentsWithTaDocs = (clone $taQuery)->whereNotNull('file_path')->distinct('student_id')->pluck('student_id');

        $studentsWithUploads = $studentsWithPhaseDocs
            ->merge($studentsWithExpoDocs)
            ->merge($studentsWithTaDocs)
            ->unique()
            ->count();

        return $this->successResponse([
            'groups_with_uploads' => $groupsWithUploads,
            'students_with_uploads' => $studentsWithUploads,
            'phase_documents' => $phaseCount,
            'expo_documents' => $expoCount,
            'ta_documents' => $taCount,
            'total_documents' => $phaseCount + $expoCount + $taCount,
        ], 'Summary retrieved successfully');
    }

    /**
     * Download a document.
     */
    public function download(Request $request, int $id)
    {
        $source = $request->input('source');

        if (! $source || ! in_array($source, ['phase_documents', 'expo_documents', 'ta_documents'])) {
            return $this->errorResponse('Invalid or missing source parameter', 400);
        }

        $document = null;
        $filePath = null;
        $originalName = null;

        switch ($source) {
            case 'phase_documents':
                $document = Document::with(['group', 'student'])->find($id);
                if ($document) {
                    $filePath = $document->file_path;
                    $originalName = basename($filePath);
                }
                break;

            case 'expo_documents':
                $document = ExpoStudentDocument::with(['group', 'student', 'expoRegistration'])->find($id);
                if ($document) {
                    $filePath = $document->file_path;
                    $originalName = $document->original_name ?? basename($filePath);
                }
                break;

            case 'ta_documents':
                $taSubmission = TaSubmission::with(['group', 'student'])->find($id);
                if ($taSubmission) {
                    $document = $taSubmission;
                    $filePath = $taSubmission->file_path;
                    $originalName = basename($filePath);
                }
                break;
        }

        if (! $document || ! $filePath) {
            return $this->notFoundResponse('Document not found');
        }

        $fileData = $this->documentStorage->get($filePath);

        if (! $fileData) {
            return $this->notFoundResponse('File not found in storage');
        }

        return response($fileData['content'], 200, [
            'Content-Type' => $fileData['mime_type'],
            'Content-Disposition' => 'attachment; filename="'.$originalName.'"',
        ]);
    }

    /**
     * Get members for a group.
     */
    private function getGroupMembers(int $groupId): array
    {
        return GroupMember::with(['student'])
            ->where('group_id', $groupId)
            ->whereNull('deleted_at')
            ->get()
            ->map(fn (GroupMember $member) => [
                'id' => $member->student->id ?? null,
                'name' => $member->student->name ?? 'Unknown',
                'nim' => $member->student->nim ?? null,
                'email' => $member->student->email ?? null,
                'is_leader' => $member->is_leader,
            ])
            ->toArray();
    }

    /**
     * Get phase documents with filters.
     */
    private function getPhaseDocuments(Request $request): array
    {
        $query = Document::with(['student', 'group.period', 'reviewer']);

        if ($request->filled('period_id')) {
            $query->whereHas('group', fn ($q) => $q->where('period_id', $request->input('period_id')));
        }

        if ($request->filled('group_id')) {
            $query->where('group_id', $request->input('group_id'));
        }

        if ($request->filled('student_id')) {
            $query->where('student_id', $request->input('student_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->input('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->input('date_to'));
        }

        return $query->get()->map(function ($doc) {
            return [
                'id' => $doc->id,
                'source' => 'phase_documents',
                'source_label' => 'Phase Documents',
                'file_path' => $doc->file_path,
                'original_name' => basename($doc->file_path),
                'document_type' => $doc->document_type ?? $doc->phase,
                'phase' => $doc->phase,
                'status' => $doc->status,
                'feedback' => $doc->feedback,
                'uploaded_at' => $doc->created_at->toIso8601String(),
                'student' => $doc->student ? [
                    'id' => $doc->student->id,
                    'name' => $doc->student->name,
                    'nim' => $doc->student->nim ?? null,
                    'email' => $doc->student->email,
                ] : null,
                'group' => $doc->group ? [
                    'id' => $doc->group->id,
                    'code' => $doc->group->code,
                ] : null,
                'period' => $doc->group?->period ? [
                    'id' => $doc->group->period->id,
                    'name' => $doc->group->period->name,
                ] : null,
                'reviewer' => $doc->reviewer ? [
                    'id' => $doc->reviewer->id,
                    'name' => $doc->reviewer->name,
                ] : null,
            ];
        })->toArray();
    }

    /**
     * Get expo documents with filters.
     */
    private function getExpoDocuments(Request $request): array
    {
        $query = ExpoStudentDocument::with(['student', 'group.period', 'expoRegistration.expoEvent']);

        if ($request->filled('period_id')) {
            $query->whereHas('group', fn ($q) => $q->where('period_id', $request->input('period_id')));
        }

        if ($request->filled('group_id')) {
            $query->where('group_id', $request->input('group_id'));
        }

        if ($request->filled('student_id')) {
            $query->where('student_id', $request->input('student_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->input('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->input('date_to'));
        }

        return $query->get()->map(function ($doc) {
            return [
                'id' => $doc->id,
                'source' => 'expo_documents',
                'source_label' => 'Expo Documents',
                'file_path' => $doc->file_path,
                'original_name' => $doc->original_name,
                'document_type' => 'Expo Document',
                'phase' => 'EXPO',
                'status' => $doc->status,
                'feedback' => null,
                'uploaded_at' => $doc->created_at->toIso8601String(),
                'student' => $doc->student ? [
                    'id' => $doc->student->id,
                    'name' => $doc->student->name,
                    'nim' => $doc->student->nim ?? null,
                    'email' => $doc->student->email,
                ] : null,
                'group' => $doc->group ? [
                    'id' => $doc->group->id,
                    'code' => $doc->group->code,
                ] : null,
                'period' => $doc->group?->period ? [
                    'id' => $doc->group->period->id,
                    'name' => $doc->group->period->name,
                ] : null,
                'expo_event' => $doc->expoRegistration?->expoEvent ? [
                    'id' => $doc->expoRegistration->expoEvent->id,
                    'name' => $doc->expoRegistration->expoEvent->name,
                ] : null,
                'reviewer' => null,
            ];
        })->toArray();
    }

    /**
     * Get TA documents with filters.
     */
    private function getTaDocuments(Request $request): array
    {
        $query = TaSubmission::with(['student', 'group.period', 'reviewer']);

        if ($request->filled('period_id')) {
            $query->whereHas('group', fn ($q) => $q->where('period_id', $request->input('period_id')));
        }

        if ($request->filled('group_id')) {
            $query->where('group_id', $request->input('group_id'));
        }

        if ($request->filled('student_id')) {
            $query->where('student_id', $request->input('student_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->input('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->input('date_to'));
        }

        $query->where(function ($q) {
            $q->whereNotNull('file_path')
                ->orWhereNotNull('draft_report_path')
                ->orWhereNotNull('paper_path');
        });

        $documents = [];
        $submissions = $query->get();

        foreach ($submissions as $submission) {
            if ($submission->file_path) {
                $documents[] = $this->formatTaDocument($submission, 'file_path', 'TA File');
            }
            if ($submission->draft_report_path) {
                $documents[] = $this->formatTaDocument($submission, 'draft_report_path', 'Draft Report');
            }
            if ($submission->paper_path) {
                $documents[] = $this->formatTaDocument($submission, 'paper_path', 'Paper');
            }
        }

        return $documents;
    }

    /**
     * Format TA submission as document.
     */
    private function formatTaDocument(TaSubmission $submission, string $field, string $documentType): array
    {
        $filePath = $submission->{$field};

        return [
            'id' => $submission->id,
            'source' => 'ta_documents',
            'source_label' => 'TA Documents',
            'file_path' => $filePath,
            'original_name' => basename($filePath),
            'document_type' => $documentType,
            'phase' => 'TA',
            'status' => $submission->status,
            'feedback' => $submission->feedback,
            'uploaded_at' => $submission->created_at->toIso8601String(),
            'student' => $submission->student ? [
                'id' => $submission->student->id,
                'name' => $submission->student->name,
                'nim' => $submission->student->nim ?? null,
                'email' => $submission->student->email,
            ] : null,
            'group' => $submission->group ? [
                'id' => $submission->group->id,
                'code' => $submission->group->code,
            ] : null,
            'period' => $submission->group?->period ? [
                'id' => $submission->group->period->id,
                'name' => $submission->group->period->name,
            ] : null,
            'reviewer' => $submission->reviewer ? [
                'id' => $submission->reviewer->id,
                'name' => $submission->reviewer->name,
            ] : null,
        ];
    }
}
