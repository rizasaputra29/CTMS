<?php

namespace App\Http\Controllers;

use App\Models\Location;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class LocationController extends Controller
{
    use ApiResponseTrait;

    /**
     * Display a listing of all locations.
     */
    public function index()
    {
        $locations = Location::orderBy('name')->get();

        return $this->successResponse($locations);
    }

    /**
     * Display active locations only.
     */
    public function active()
    {
        $locations = Location::active()->orderBy('name')->get();

        return $this->successResponse($locations);
    }

    /**
     * Display offline locations only.
     */
    public function offline()
    {
        $locations = Location::offline()->active()->orderBy('name')->get();

        return $this->successResponse($locations);
    }

    /**
     * Display online/virtual locations only.
     */
    public function online()
    {
        $locations = Location::online()->active()->orderBy('name')->get();

        return $this->successResponse($locations);
    }

    /**
     * Store a newly created location (admin only).
     */
    public function store(Request $request)
    {
        if (! Auth::user()->hasRole('admin')) {
            return $this->unauthorizedResponse('Unauthorized');
        }

        $request->validate([
            'name' => 'required|string|max:255|unique:locations',
            'capacity' => 'nullable|integer|min:1',
            'type' => 'required|string|in:offline,online',
            'description' => 'nullable|string|max:1000',
        ]);

        $location = Location::create([
            'name' => $request->name,
            'capacity' => $request->capacity,
            'type' => $request->type,
            'description' => $request->description,
            'is_active' => true,
        ]);

        return $this->createdResponse([
            'message' => 'Location created successfully',
            'data' => $location,
        ]);
    }

    /**
     * Display the specified location.
     */
    public function show($id)
    {
        $location = Location::findOrFail($id);

        return $this->successResponse($location);
    }

    /**
     * Update the specified location (admin only).
     */
    public function update(Request $request, $id)
    {
        if (! Auth::user()->hasRole('admin')) {
            return $this->unauthorizedResponse('Unauthorized');
        }

        $location = Location::findOrFail($id);

        $request->validate([
            'name' => 'sometimes|string|max:255|unique:locations,name,'.$id,
            'capacity' => 'nullable|integer|min:1',
            'type' => 'sometimes|string|in:offline,online',
            'description' => 'nullable|string|max:1000',
            'is_active' => 'sometimes|boolean',
        ]);

        $location->update($request->all());

        return $this->successResponse($location, 'Location updated successfully');
    }

    /**
     * Remove the specified location (admin only).
     * Constraint: Location must be inactive before deletion.
     */
    public function destroy($id)
    {
        if (! Auth::user()->hasRole('admin')) {
            return $this->unauthorizedResponse('Unauthorized');
        }

        $location = Location::findOrFail($id);

        // Constraint: Must be inactive first
        if ($location->is_active) {
            return $this->errorResponse('Location must be deactivated before it can be deleted. Please set is_active to false first.', 422);
        }

        $location->delete();

        return $this->successResponse(null, 'Location deleted successfully');
    }

    /**
     * Get available locations for a specific date/time range.
     * Checks against existing schedules to find available rooms.
     */
    public function available(Request $request)
    {
        $request->validate([
            'date' => 'required|date',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'exclude_schedule_id' => 'nullable|integer',
            'exclude_seminar_id' => 'nullable|integer',
            'exclude_ta_defense_id' => 'nullable|integer',
        ]);

        $date = $request->date;
        $startTime = $request->start_time;
        $endTime = $request->end_time;

        // Get all active offline locations
        $allLocations = Location::offline()->active()->orderBy('name')->get();

        // Get busy locations from schedules table (BIMBINGAN)
        $busyFromSchedules = \App\Models\Schedule::where('type', 'BIMBINGAN')
            ->whereRaw('DATE(date) = ?', [$date])
            ->whereRaw('start_time < ?', [$endTime])
            ->whereRaw('end_time > ?', [$startTime])
            ->when($request->exclude_schedule_id, fn ($q) => $q->where('id', '!=', $request->exclude_schedule_id))
            ->pluck('room')
            ->toArray();

        // Get busy locations from seminar_schedules (SEMPRO, EXPO)
        $busyFromSeminars = \App\Models\SeminarSchedule::where('date', $date)
            ->where('status', '!=', 'CANCELLED')
            ->where('start_time', '<', $endTime)
            ->where('end_time', '>', $startTime)
            ->when($request->exclude_seminar_id, fn ($q) => $q->where('id', '!=', $request->exclude_seminar_id))
            ->pluck('room')
            ->toArray();

        // Get busy locations from ta_defense_schedules
        $busyFromTaDefense = \App\Models\TaDefenseSchedule::where('date', $date)
            ->where('status', '!=', 'CANCELLED')
            ->where('start_time', '<', $endTime)
            ->where('end_time', '>', $startTime)
            ->when($request->exclude_ta_defense_id, fn ($q) => $q->where('id', '!=', $request->exclude_ta_defense_id))
            ->pluck('room')
            ->toArray();

        // Combine all busy locations
        $busyLocations = array_unique(array_merge($busyFromSchedules, $busyFromSeminars, $busyFromTaDefense));

        // Filter out busy locations
        $availableLocations = $allLocations->filter(function ($location) use ($busyLocations) {
            return ! in_array($location->name, $busyLocations);
        })->values();

        return $this->envelopeResponse($availableLocations, [
            'busy_locations' => $busyLocations,
        ]);
    }
}
