<?php

namespace App\Http\Controllers;

use App\Http\Requests\Profile\UpdateProfileRequest;
use Illuminate\Support\Facades\Hash;

class ProfileController extends Controller
{
    use ApiResponseTrait;

    public function update(UpdateProfileRequest $request)
    {
        $user = $request->user();
        $validated = $request->validated();

        $user->name = $validated['name'];
        $user->email = $validated['email'];

        if ($request->filled('password')) {
            $user->password = Hash::make($validated['password']);
        }

        $user->save();

        return $this->successResponse([
            'message' => 'Profile updated successfully.',
            'user' => $user,
        ]);
    }
}
