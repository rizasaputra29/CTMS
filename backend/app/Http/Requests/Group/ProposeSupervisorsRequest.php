<?php

namespace App\Http\Requests\Group;

use Illuminate\Foundation\Http\FormRequest;

class ProposeSupervisorsRequest extends FormRequest
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
            'proposed_supervisor_1_id' => ['required', 'exists:users,id'],
            'proposed_supervisor_2_id' => ['nullable', 'exists:users,id', 'different:proposed_supervisor_1_id'],
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
            'proposed_supervisor_1_id.required' => 'Primary supervisor is required.',
            'proposed_supervisor_1_id.exists' => 'Selected primary supervisor does not exist.',
            'proposed_supervisor_2_id.exists' => 'Selected secondary supervisor does not exist.',
            'proposed_supervisor_2_id.different' => 'Secondary supervisor must be different from primary supervisor.',
        ];
    }
}
