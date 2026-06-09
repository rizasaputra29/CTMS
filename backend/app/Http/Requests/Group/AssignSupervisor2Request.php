<?php

namespace App\Http\Requests\Group;

use Illuminate\Foundation\Http\FormRequest;

class AssignSupervisor2Request extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'supervisor_2_id' => ['required', 'exists:users,id'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'supervisor_2_id.required' => 'Supervisor 2 is required.',
            'supervisor_2_id.exists' => 'Selected supervisor does not exist.',
        ];
    }
}
