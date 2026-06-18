<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class GradeCheckQueryRequest extends FormRequest
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
            'period_id' => ['nullable', 'exists:periods,id'],
            'evaluation_type' => ['nullable', 'string', 'in:SEMPRO,BIMBINGAN_SEMPRO,EXPO,MILESTONE,NILAI_DOSEN,PEER_REVIEW,SIDANG_TA,BIMBINGAN_TA'],
            'group_id' => ['nullable', 'exists:groups,id'],
            'student_id' => ['nullable', 'exists:users,id'],
            'per_page' => ['nullable', 'integer', 'min:10', 'max:500'],
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
            'period_id.exists' => 'The selected period does not exist.',
            'evaluation_type.string' => 'Evaluation type must be a string.',
            'evaluation_type.in' => 'The selected evaluation type is invalid.',
            'group_id.exists' => 'The selected group does not exist.',
            'student_id.exists' => 'The selected student does not exist.',
            'per_page.integer' => 'Per page must be an integer.',
            'per_page.min' => 'Per page must be at least 10.',
            'per_page.max' => 'Per page must not exceed 500.',
        ];
    }
}
