<?php

namespace App\Http\Controllers;

use App\Http\Requests\Auth\SetActiveRoleRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoleController extends Controller
{
    use ApiResponseTrait;

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $roles = $user->roleSlugs();

        return $this->successResponse(['roles' => $roles]);
    }

    public function setActiveRole(SetActiveRoleRequest $request): JsonResponse
    {
        $user = $request->user();
        $availableRoles = $user->roleSlugs();
        $requestedRole = $request->input('role');

        if (! in_array($requestedRole, $availableRoles, true)) {
            return $this->errorResponse('Invalid role. You do not have this role.', 422);
        }

        if ($request->hasSession()) {
            $request->session()->put('active_role', $requestedRole);
        }

        return $this->successResponse([
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

        return $this->successResponse(['active_role' => $activeRole]);
    }
}
