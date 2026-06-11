<?php

namespace App\Http\Controllers;

use App\Http\Requests\Auth\SetActiveRoleRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $roles = $user->roleSlugs();

        return response()->json([
            'roles' => $roles,
        ]);
    }

    public function setActiveRole(SetActiveRoleRequest $request): JsonResponse
    {
        $user = $request->user();
        $availableRoles = $user->roleSlugs();
        $requestedRole = $request->input('role');

        if (! in_array($requestedRole, $availableRoles, true)) {
            return response()->json([
                'message' => 'Invalid role. You do not have this role.',
            ], 422);
        }

        if ($request->hasSession()) {
            $request->session()->put('active_role', $requestedRole);
        }

        return response()->json([
            'message' => 'Active role updated successfully.',
            'active_role' => $requestedRole,
        ]);
    }

    public function currentRole(Request $request): JsonResponse
    {
        $activeRole = null;

        if ($request->hasSession()) {
            $activeRole = $request->session()->get('active_role');
        }

        return response()->json([
            'active_role' => $activeRole,
        ]);
    }
}
