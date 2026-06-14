<?php

namespace App\Http\Controllers;

use App\Concerns\RequiresActivePeriod;
use App\Models\ExpoEvent;
use App\Models\ExpoRegistration;
use App\Models\ExpoStudentDocument;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Location;
use App\Models\PeriodAssessmentComponent;
use App\Repositories\AssessmentScoreRepository;
use App\Services\ExpoService;
use App\Services\SchedulingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ExpoEventController extends Controller
{
    use ApiResponseTrait, RequiresActivePeriod;

    protected ExpoService $expoService;

    public function __construct(ExpoService $expoService)
    {
        $this->expoService = $expoService;
    }

    // ────────────────────────────────
    // Admin CRUD
    // ────────────────────────────────

    public function index(Request $request)
    {
        $query = ExpoEvent::with(['period', 'creator'])
            ->withCount('registrations');

        if ($request->has('period_id')) {
            $query->where('period_id', $request->period_id);
        }

        $events = $query->orderBy('date', 'desc')->get();

        return $this->successResponse($events, 'Expo events retrieved successfully');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'period_id' => 'required|exists:periods,id',
            'name' => 'required|string|max:255',
            'date' => 'required|date',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'room' => 'nullable|string|max:255',
            'location_id' => 'nullable|exists:locations,id',
            'capacity' => 'required|integer|min:1|max:200',
            'is_published' => 'boolean',
        ]);

        // Resolve room name from location if location_id is provided
        if ($request->location_id) {
            $location = Location::find($request->location_id);
            $validated['room'] = $location->name;
        }

        $validated['created_by'] = $request->user()->id;

        $this->ensurePeriodActiveById($request->period_id);

        $event = ExpoEvent::create($validated);

        return response()->json($event->load(['period', 'creator', 'location']), 201);
    }

    public function show(ExpoEvent $expoEvent)
    {
        return response()->json(
            $expoEvent->load(['period', 'creator', 'registrations.group.members.student'])
        );
    }

    public function update(Request $request, ExpoEvent $expoEvent)
    {
        $this->ensurePeriodActiveById($expoEvent->period_id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'date' => 'sometimes|date',
            'start_time' => 'sometimes|date_format:H:i',
            'end_time' => 'sometimes|date_format:H:i',
            'room' => 'nullable|string|max:255',
            'location_id' => 'nullable|exists:locations,id',
            'capacity' => 'sometimes|integer|min:1|max:200',
        ]);

        // Resolve room name from location if location_id is provided
        if ($request->location_id) {
            $location = Location::find($request->location_id);
            $validated['room'] = $location->name;
        }

        $expoEvent->update($validated);

        return response()->json($expoEvent->fresh()->load(['period', 'creator', 'location']));
    }

    public function destroy(ExpoEvent $expoEvent)
    {
        $this->ensurePeriodActiveById($expoEvent->period_id);

        if ($expoEvent->registrations()->exists()) {
            return response()->json(['message' => 'Cannot delete event with active registrations.'], 400);
        }

        $expoEvent->delete(); // soft delete

        return response()->json(['message' => 'Event deleted.']);
    }

    /**
     * Toggle published status.
     */
    public function publish(ExpoEvent $expoEvent)
    {
        $this->ensurePeriodActiveById($expoEvent->period_id);

        $expoEvent->update(['is_published' => ! $expoEvent->is_published]);

        return response()->json([
            'message' => $expoEvent->is_published ? 'Event published.' : 'Event unpublished.',
            'data' => $expoEvent->fresh(),
        ]);
    }

    // ────────────────────────────────
    // Mahasiswa: View + Register
    // ────────────────────────────────

    /**
     * List published expo events for the student's period.
     */
    public function studentEvents(Request $request)
    {
        $user = $request->user();
        $group = \App\Models\GroupMember::where('student_id', $user->id)
            ->first()?->group;

        if (! $group) {
            return response()->json([]);
        }

        $events = ExpoEvent::where('period_id', $group->period_id)
            ->where('is_published', true)
            ->withCount(['registrations' => function ($query) {
                $query->where('status', '!=', 'CANCELLED');
            }])
            ->orderBy('date')
            ->get();

        // Append registration status for this group
        $events->each(function ($event) use ($group) {
            $event->is_registered = $event->registrations()
                ->where('group_id', $group->id)
                ->where('status', '!=', 'CANCELLED')
                ->exists();
        });

        return response()->json($events);
    }

    /**
     * Register the student's group for an expo event.
     */
    public function register(Request $request, ExpoEvent $expoEvent)
    {
        $user = $request->user();
        $groupMember = \App\Models\GroupMember::where('student_id', $user->id)->first();

        if (! $groupMember) {
            return response()->json(['message' => 'You are not in a group.'], 400);
        }

        try {
            $registration = $this->expoService->registerGroupToEvent(
                $expoEvent->id,
                $groupMember->group_id,
                $user->id
            );

            return response()->json([
                'message' => 'Successfully registered for expo event.',
                'data' => $registration,
            ], 201);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }

    /**
     * Withdraw the student's group from an expo event.
     */
    public function withdraw(Request $request, ExpoEvent $expoEvent)
    {
        $user = $request->user();
        $groupMember = \App\Models\GroupMember::where('student_id', $user->id)->first();

        if (! $groupMember) {
            return response()->json(['message' => 'You are not in a group.'], 400);
        }

        try {
            $registration = $this->expoService->withdrawGroupFromEvent(
                $expoEvent->id,
                $groupMember->group_id,
                $user->id
            );

            return response()->json([
                'message' => 'Successfully withdrawn from expo event.',
                'data' => $registration,
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }

    // ────────────────────────────────
    // Mahasiswa: Expo Self-Evaluation
    // ────────────────────────────────

    /**
     * Get expo detail for the student — event info, group members with status, components, document status.
     */
    public function studentDetail(Request $request, ExpoEvent $expoEvent)
    {
        $user = $request->user();
        $groupMember = GroupMember::with('group')->where('student_id', $user->id)->first();

        if (! $groupMember) {
            return response()->json(['message' => 'You are not in a group.'], 400);
        }

        $group = $groupMember->group;

        $registration = ExpoRegistration::where('expo_event_id', $expoEvent->id)
            ->where('group_id', $group->id)
            ->where('status', '!=', 'CANCELLED')
            ->first();

        if (! $registration) {
            return response()->json(['message' => 'Your group is not registered for this expo event.'], 404);
        }

        // Get EXPO assessment components
        $components = PeriodAssessmentComponent::with('template')
            ->where('period_id', $group->period_id)
            ->where('type', 'EXPO')
            ->orderBy('sort_order')
            ->get()
            ->map(fn ($c) => [
                'id' => $c->id,
                'code' => $c->template->code,
                'name' => $c->template->name,
                'description' => $c->template->description,
                'weight' => $c->template->weight,
                'sort_order' => $c->sort_order,
            ]);

        // Get all group members with their evaluation & document status
        $members = GroupMember::with('student')->where('group_id', $group->id)->get()
            ->map(function ($member) use ($registration) {
                $studentId = $member->student_id;

                $hasEvaluation = AssessmentScoreRepository::forType('EXPO')
                    ->where('group_id', $member->group_id)
                    ->where('evaluator_id', $studentId)
                    ->where('student_id', $studentId)
                    ->exists();

                $document = ExpoStudentDocument::where('expo_registration_id', $registration->id)
                    ->where('student_id', $studentId)
                    ->first();

                return [
                    'id' => $studentId,
                    'name' => $member->student->name,
                    'nim' => $member->student->nim,
                    'is_leader' => $member->is_leader,
                    'has_submitted_evaluation' => $hasEvaluation,
                    'has_uploaded_document' => $document !== null,
                    'document_status' => $document?->status,
                ];
            });

        // Current user's existing scores
        $existingScores = AssessmentScoreRepository::forType('EXPO')
            ->where('group_id', $group->id)
            ->where('evaluator_id', $user->id)
            ->where('student_id', $user->id)
            ->get()
            ->keyBy('period_component_id');

        $myScores = $components->map(function ($comp) use ($existingScores) {
            $score = $existingScores->get($comp['id']);

            return [
                'period_component_id' => $comp['id'],
                'code' => $comp['code'],
                'name' => $comp['name'],
                'weight' => $comp['weight'],
                'score' => $score?->score,
                'notes' => $score?->notes,
            ];
        });

        // Current user's document
        $myDocument = ExpoStudentDocument::where('expo_registration_id', $registration->id)
            ->where('student_id', $user->id)
            ->first();

        return response()->json([
            'expo_event' => [
                'id' => $expoEvent->id,
                'name' => $expoEvent->name,
                'date' => $expoEvent->date,
                'start_time' => $expoEvent->start_time,
                'end_time' => $expoEvent->end_time,
                'room' => $expoEvent->room,
            ],
            'registration' => [
                'id' => $registration->id,
                'status' => $registration->status,
            ],
            'group' => [
                'id' => $group->id,
                'name' => $group->name,
                'code' => $group->code,
            ],
            'members' => $members,
            'components' => $components,
            'my_scores' => $myScores,
            'my_document' => $myDocument ? [
                'id' => $myDocument->id,
                'original_name' => $myDocument->original_name,
                'status' => $myDocument->status,
            ] : null,
        ]);
    }

    /**
     * Submit self-evaluation scores (EXPO type) for the current student.
     * Each student scores ONLY themselves.
     */
    public function submitEvaluation(Request $request, ExpoEvent $expoEvent)
    {
        $user = $request->user();
        $groupMember = GroupMember::where('student_id', $user->id)->first();

        if (! $groupMember) {
            return response()->json(['message' => 'You are not in a group.'], 400);
        }

        $registration = ExpoRegistration::where('expo_event_id', $expoEvent->id)
            ->where('group_id', $groupMember->group_id)
            ->where('status', '!=', 'CANCELLED')
            ->first();

        if (! $registration) {
            return response()->json(['message' => 'Your group is not registered for this expo event.'], 404);
        }

        $validated = $request->validate([
            'scores' => 'required|array|min:1',
            'scores.*.period_component_id' => 'required|integer|exists:period_assessment_components,id',
            'scores.*.score' => 'required|numeric|min:1|max:100',
            'scores.*.notes' => 'nullable|string|max:500',
        ]);

        $groupId = $groupMember->group_id;

        DB::beginTransaction();
        try {
            $upsertData = [];
            foreach ($validated['scores'] as $scoreData) {
                $upsertData[] = [
                    'period_component_id' => $scoreData['period_component_id'],
                    'evaluator_id' => $user->id,
                    'group_id' => $groupId,
                    'student_id' => $user->id,
                    'evaluation_type' => 'EXPO',
                    'score' => $scoreData['score'],
                    'notes' => $scoreData['notes'] ?? null,
                ];
            }

            AssessmentScoreRepository::upsert(
                'EXPO',
                $upsertData,
                ['period_component_id', 'evaluator_id', 'group_id', 'student_id'],
                ['score', 'notes']
            );

            DB::commit();

            // Check if EXPO_DONE transition is now possible
            $group = Group::find($groupId);
            if ($group) {
                $schedulingService = app(SchedulingService::class);
                $schedulingService->tryTransitionToExpoDone($group);
            }

            return response()->json([
                'message' => 'Self-evaluation submitted successfully.',
            ]);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json(['message' => 'Failed to submit evaluation: '.$e->getMessage()], 500);
        }
    }

    /**
     * Upload EXPO document for the current student.
     */
    public function uploadDocument(Request $request, ExpoEvent $expoEvent)
    {
        $user = $request->user();
        $groupMember = GroupMember::where('student_id', $user->id)->first();

        if (! $groupMember) {
            return response()->json(['message' => 'You are not in a group.'], 400);
        }

        $registration = ExpoRegistration::where('expo_event_id', $expoEvent->id)
            ->where('group_id', $groupMember->group_id)
            ->where('status', '!=', 'CANCELLED')
            ->first();

        if (! $registration) {
            return response()->json(['message' => 'Your group is not registered for this expo event.'], 404);
        }

        $validated = $request->validate([
            'file' => 'required|file|max:10240|mimes:pdf,doc,docx,ppt,pptx',
        ]);

        $file = $validated['file'];
        $fileName = 'expo_doc_'.$user->id.'_'.time().'.'.$file->getClientOriginalExtension();
        $filePath = $file->storeAs('expo-documents', $fileName, 'public');

        DB::beginTransaction();
        try {
            // Delete old document if exists
            $oldDocument = ExpoStudentDocument::where('expo_registration_id', $registration->id)
                ->where('student_id', $user->id)
                ->first();

            if ($oldDocument) {
                Storage::disk('public')->delete($oldDocument->file_path);
                $oldDocument->update([
                    'file_path' => $filePath,
                    'original_name' => $file->getClientOriginalName(),
                    'status' => 'SUBMITTED',
                ]);
                $document = $oldDocument;
            } else {
                $document = ExpoStudentDocument::create([
                    'expo_registration_id' => $registration->id,
                    'group_id' => $groupMember->group_id,
                    'student_id' => $user->id,
                    'file_path' => $filePath,
                    'original_name' => $file->getClientOriginalName(),
                    'status' => 'SUBMITTED',
                ]);
            }

            DB::commit();

            // Check if EXPO_DONE transition is now possible
            $group = Group::find($groupMember->group_id);
            if ($group) {
                $schedulingService = app(SchedulingService::class);
                $schedulingService->tryTransitionToExpoDone($group);
            }

            return response()->json([
                'message' => 'Document uploaded successfully.',
                'data' => [
                    'id' => $document->id,
                    'original_name' => $document->original_name,
                    'status' => $document->status,
                ],
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Storage::disk('public')->delete($filePath);

            return response()->json(['message' => 'Failed to upload document: '.$e->getMessage()], 500);
        }
    }
}
