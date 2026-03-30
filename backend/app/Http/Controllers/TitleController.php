<?php

namespace App\Http\Controllers;

use App\Models\Title;
use App\Models\Group;
use App\Models\GroupMember;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class TitleController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        if ($user->role === 'dosen') {
            return Title::where('lecturer_id', $user->id)
                ->with('lecturer')
                ->withCount([
                    'groups as active_groups_count' => function ($query) {
                        $query->where('status', '!=', 'REJECTED');
                    }
                ])
                ->get();
        }

        if ($user->role === 'mahasiswa') {
            // Students see only LECTURER titles (exclude student-proposed titles)
            return Title::where('status', 'open')
                ->where('quota', '>', 0)
                ->where(function ($query) {
                    $query->where('title_source', 'LECTURER')
                        ->orWhereNull('title_source');
                })
                ->with('lecturer')
                ->withCount([
                    'groups as active_groups_count' => function ($query) {
                        $query->where('status', '!=', 'REJECTED');
                    }
                ])
                ->get()
                ->filter(function ($title) {
                    return $title->active_groups_count < $title->quota;
                })
                ->values();
        }

        return Title::with('lecturer')->get();
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'required|string',
            'problem_statement' => 'required|string',
            'scope' => 'required|string',
            'specializations' => 'required|array|min:1',
            'specializations.*' => 'string|in:Software,Embedded,Network,Multimedia,AI,Blockchain',
            'quota' => 'required|integer|min:1',
        ]);

        $title = Title::create([
            'lecturer_id' => $request->user()->id,
            'title' => $validated['title'],
            'description' => $validated['description'],
            'problem_statement' => $validated['problem_statement'],
            'scope' => $validated['scope'],
            'specializations' => $validated['specializations'],
            'quota' => $validated['quota'],
            'status' => 'open',
            'title_source' => 'LECTURER',
        ]);

        return response()->json($title, 201);
    }

    public function show(Title $title)
    {
        return $title->load([
            'lecturer',
            'groups' => function ($q) {
                $q->where('status', '!=', 'REJECTED')->with('members.student');
            }
        ]);
    }

    public function update(Request $request, Title $title)
    {
        if ($request->user()->id !== $title->lecturer_id && $request->user()->role !== 'admin') {
            abort(403, 'Unauthorized');
        }

        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'sometimes|string',
            'problem_statement' => 'sometimes|string',
            'scope' => 'sometimes|string',
            'specializations' => 'sometimes|array|min:1',
            'specializations.*' => 'string|in:Software,Embedded,Network,Multimedia,AI,Blockchain',
            'quota' => 'sometimes|integer|min:1',
            'status' => 'sometimes|in:open,closed',
        ]);

        $title->update($validated);

        return response()->json($title);
    }

    public function destroy(Request $request, Title $title)
    {
        if ($request->user()->id !== $title->lecturer_id && $request->user()->role !== 'admin') {
            abort(403, 'Unauthorized');
        }

        $title->delete();

        return response()->json(['message' => 'Title deleted']);
    }
}
