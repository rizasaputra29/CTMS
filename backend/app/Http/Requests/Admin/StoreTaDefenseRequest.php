<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Schema;

class StoreTaDefenseRequest extends FormRequest
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
            'group_id' => ['required', 'exists:groups,id'],
            'student_ids' => ['required', 'array', 'min:1'],
            'student_ids.*' => ['exists:users,id'],
            'period_id' => $this->hasPeriodColumn() ? ['required', 'exists:periods,id'] : ['nullable'],
            'examiner_1_id' => ['required', 'exists:users,id'],
            'examiner_2_id' => ['required', 'exists:users,id', 'different:examiner_1_id'],
            'date' => ['required', 'date', 'after_or_equal:today'],
            'start_time' => ['required', 'date_format:H:i,H:i:s'],
            'end_time' => ['required', 'date_format:H:i,H:i:s', 'after:start_time'],
            'room' => ['nullable', 'string', 'max:100'],
            'location_id' => ['nullable', 'exists:locations,id'],
            'notes' => ['nullable', 'string', 'max:1000'],
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
            'group_id.required' => 'Group is required.',
            'group_id.exists' => 'The selected group does not exist.',
            'student_ids.required' => 'At least one student must be selected.',
            'student_ids.array' => 'Student IDs must be an array.',
            'student_ids.min' => 'At least one student must be selected.',
            'student_ids.*.exists' => 'The selected student does not exist.',
            'period_id.required' => 'Period is required.',
            'period_id.exists' => 'The selected period does not exist.',
            'examiner_1_id.required' => 'Examiner 1 is required.',
            'examiner_1_id.exists' => 'The selected examiner 1 does not exist.',
            'examiner_2_id.required' => 'Examiner 2 is required.',
            'examiner_2_id.exists' => 'The selected examiner 2 does not exist.',
            'examiner_2_id.different' => 'Examiner 2 must be different from examiner 1.',
            'date.required' => 'Date is required.',
            'date.date' => 'Please enter a valid date.',
            'date.after_or_equal' => 'Date must be today or later.',
            'start_time.required' => 'Start time is required.',
            'start_time.date_format' => 'Start time must be in HH:MM or HH:MM:SS format.',
            'end_time.required' => 'End time is required.',
            'end_time.date_format' => 'End time must be in HH:MM or HH:MM:SS format.',
            'end_time.after' => 'End time must be after start time.',
            'room.string' => 'Room must be a string.',
            'room.max' => 'Room must not exceed 100 characters.',
            'location_id.exists' => 'The selected location does not exist.',
            'notes.string' => 'Notes must be a string.',
            'notes.max' => 'Notes must not exceed 1000 characters.',
        ];
    }

    /**
     * Check if the ta_defense_schedules table has a period_id column.
     */
    private function hasPeriodColumn(): bool
    {
        return Schema::hasColumn('ta_defense_schedules', 'period_id');
    }
}
