<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class AssignExaminersRequest extends FormRequest
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
            'examiner_1_id' => ['required', 'exists:users,id'],
            'examiner_2_id' => ['required', 'exists:users,id', 'different:examiner_1_id'],
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
            'examiner_1_id.required' => 'Examiner 1 is required.',
            'examiner_1_id.exists' => 'The selected examiner 1 does not exist.',
            'examiner_2_id.required' => 'Examiner 2 is required.',
            'examiner_2_id.exists' => 'The selected examiner 2 does not exist.',
            'examiner_2_id.different' => 'Examiner 2 must be different from examiner 1.',
        ];
    }
}
