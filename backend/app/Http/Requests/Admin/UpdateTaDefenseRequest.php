<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class UpdateTaDefenseRequest extends FormRequest
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
            'date' => ['sometimes', 'date', 'after_or_equal:today'],
            'start_time' => ['sometimes', 'date_format:H:i,H:i:s'],
            'end_time' => ['sometimes', 'date_format:H:i,H:i:s', 'after:start_time'],
            'room' => ['sometimes', 'string', 'max:100'],
            'location_id' => ['nullable', 'exists:locations,id'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'status' => ['sometimes', 'in:SCHEDULED,CANCELLED'],
            'student_ids' => ['sometimes', 'array', 'min:1'],
            'student_ids.*' => ['exists:users,id'],
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
            'date.date' => 'Please enter a valid date.',
            'date.after_or_equal' => 'Date must be today or later.',
            'start_time.date_format' => 'Start time must be in HH:MM or HH:MM:SS format.',
            'end_time.date_format' => 'End time must be in HH:MM or HH:MM:SS format.',
            'end_time.after' => 'End time must be after start time.',
            'room.string' => 'Room must be a string.',
            'room.max' => 'Room must not exceed 100 characters.',
            'location_id.exists' => 'The selected location does not exist.',
            'notes.string' => 'Notes must be a string.',
            'notes.max' => 'Notes must not exceed 1000 characters.',
            'status.in' => 'Status must be either SCHEDULED or CANCELLED.',
            'student_ids.array' => 'Student IDs must be an array.',
            'student_ids.min' => 'At least one student must be selected.',
            'student_ids.*.exists' => 'The selected student does not exist.',
        ];
    }
}
