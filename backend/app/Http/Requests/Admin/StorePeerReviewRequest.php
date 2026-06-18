<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class StorePeerReviewRequest extends FormRequest
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
            'reviews' => ['required', 'array', 'min:1'],
            'reviews.*.reviewee_id' => ['required', 'exists:users,id'],
            'reviews.*.period_indicator_id' => ['required', 'exists:period_peer_review_indicators,id'],
            'reviews.*.score' => ['required', 'numeric', 'min:1', 'max:4'],
            'reviews.*.comment' => ['nullable', 'string'],
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
            'reviews.required' => 'At least one review is required.',
            'reviews.array' => 'Reviews must be an array.',
            'reviews.min' => 'At least one review is required.',
            'reviews.*.reviewee_id.required' => 'Reviewee is required for each review.',
            'reviews.*.reviewee_id.exists' => 'The selected reviewee does not exist.',
            'reviews.*.period_indicator_id.required' => 'Period indicator is required for each review.',
            'reviews.*.period_indicator_id.exists' => 'The selected period indicator does not exist.',
            'reviews.*.score.required' => 'Score is required for each review.',
            'reviews.*.score.numeric' => 'Score must be a number.',
            'reviews.*.score.min' => 'Score must be at least 1.',
            'reviews.*.score.max' => 'Score must not exceed 4.',
            'reviews.*.comment.string' => 'Comment must be a string.',
        ];
    }
}
