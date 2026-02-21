<?php

namespace App\Http\Controllers;

use App\Models\Schedule;
use App\Models\Group;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ScheduleController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $user = Auth::user();

        // Admin can only see SEMPRO, SIDANG, EXPO schedules
        if ($user->role === 'admin') {
            return response()->json([
                'data' => Schedule::with('group.title.lecturer', 'group.members.student')
                    ->whereIn('type', ['SEMPRO', 'SIDANG', 'EXPO'])
                    ->orderBy('date', 'asc')->get()
            ]);
        }

        // Dosen can only see BIMBINGAN schedules for their own groups
        if ($user->role === 'dosen') {
            $groupIds = Group::whereHas('title', function ($q) use ($user) {
                $q->where('lecturer_id', $user->id);
            })->pluck('id');

            return response()->json([
                'data' => Schedule::whereIn('group_id', $groupIds)
                    ->where('type', 'BIMBINGAN')
                    ->with('group.title.lecturer', 'group.members.student')
                    ->orderBy('date', 'asc')->get()
            ]);
        }

        // Mahasiswa can only see their own group's schedule (exclude rejected groups)
        if ($user->role === 'mahasiswa') {
            $groupMember = \App\Models\GroupMember::where('student_id', $user->id)
                ->whereHas('group', function ($q) {
                    $q->where('status', '!=', 'REJECTED');
                })
                ->first();
            if (!$groupMember) {
                return response()->json(['data' => []]);
            }
            return response()->json([
                'data' => Schedule::where('group_id', $groupMember->group_id)
                    ->with('group.title.lecturer', 'group.members.student')
                    ->orderBy('date', 'asc')->get()
            ]);
        }

        return response()->json(['data' => []]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $user = Auth::user();

        if ($user->role === 'mahasiswa') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Dosen can only create BIMBINGAN, Admin can only create SEMPRO/SIDANG/EXPO
        $allowedTypes = $user->role === 'dosen'
            ? ['BIMBINGAN']
            : ['SEMPRO', 'SIDANG', 'EXPO'];

        $request->validate([
            'group_id' => 'required|exists:groups,id',
            'type' => ['required', 'string', 'in:' . implode(',', $allowedTypes)],
            'date' => 'required|date',
            'room' => 'required|string',
            'mode' => 'nullable|string|in:online,offline',
            'notes' => 'nullable|string|max:1000',
        ]);

        $schedule = Schedule::create($request->all());

        return response()->json(['message' => 'Schedule created successfully', 'data' => $schedule], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        $user = Auth::user();

        if ($user->role === 'mahasiswa') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $allowedTypes = $user->role === 'dosen'
            ? ['BIMBINGAN']
            : ['SEMPRO', 'SIDANG', 'EXPO'];

        $request->validate([
            'group_id' => 'exists:groups,id',
            'type' => ['string', 'in:' . implode(',', $allowedTypes)],
            'date' => 'date',
            'room' => 'string',
            'mode' => 'nullable|string|in:online,offline',
            'notes' => 'nullable|string|max:1000',
        ]);

        $schedule = Schedule::findOrFail($id);
        $schedule->update($request->all());

        return response()->json(['message' => 'Schedule updated successfully', 'data' => $schedule]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        if (Auth::user()->role === 'mahasiswa') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        Schedule::destroy($id);
        return response()->json(['message' => 'Schedule deleted successfully']);
    }
}
