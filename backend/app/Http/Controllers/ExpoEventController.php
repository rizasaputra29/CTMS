<?php

namespace App\Http\Controllers;

use App\Concerns\RequiresActivePeriod;
use App\Models\ExpoEvent;
use App\Models\Location;
use App\Services\ExpoService;
use Illuminate\Http\Request;

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

        $expoEvent->update(['is_published' => !$expoEvent->is_published]);

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

        if (!$group) {
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

        if (!$groupMember) {
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

        if (!$groupMember) {
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
}
