<?php

namespace App\Http\Controllers;

use App\Http\Requests\Auth\LoginRequest;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    use ApiResponseTrait;

    public function login(LoginRequest $request)
    {
        if (! Auth::guard('web')->attempt($request->only('email', 'password'))) {
            throw ValidationException::withMessages([
                'email' => ['Invalid credentials.'],
            ]);
        }

        $user = User::where('email', $request->email)->with('roles')->firstOrFail();

        Auth::guard('web')->login($user);

        return $this->successResponse([
            'message' => 'Login success',
            'user' => $user,
            'roles' => $user->roleSlugs(),
        ]);
    }

    public function logout(Request $request)
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return $this->successResponse(null, 'Logged out successfully');
    }

    public function me(Request $request)
    {
        $user = $request->user()->load('roles:id,name,slug');
        $activeRole = null;

        if ($request->hasSession()) {
            $activeRole = $request->session()->get('active_role');
        }

        $roles = $user->roleSlugs();
        if (! $activeRole) {
            $activeRole = count($roles) > 0 ? $roles[0] : null;
        }

        return $this->successResponse([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'nip' => $user->nip,
            'nim' => $user->nim,
            'is_active' => $user->is_active,
            'roles' => $roles,
            'active_role' => $activeRole,
        ]);
    }
}
