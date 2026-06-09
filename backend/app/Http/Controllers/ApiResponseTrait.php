<?php

namespace App\Http\Controllers;

trait ApiResponseTrait
{
    /**
     * Success response format
     *
     * @param  mixed  $data
     * @return \Illuminate\Http\JsonResponse
     */
    protected function successResponse($data, string $message = 'Success', int $code = 200)
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data,
        ], $code);
    }

    /**
     * Error response format
     *
     * @param  mixed  $errors
     * @return \Illuminate\Http\JsonResponse
     */
    protected function errorResponse(string $message, int $code = 400, $errors = null)
    {
        $response = [
            'success' => false,
            'message' => $message,
        ];

        if ($errors !== null) {
            $response['errors'] = $errors;
        }

        return response()->json($response, $code);
    }

    /**
     * Paginated response format
     *
     * @param  mixed  $data
     * @return \Illuminate\Http\JsonResponse
     */
    protected function paginatedResponse($data, string $message = 'Success')
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data->items(),
            'pagination' => [
                'current_page' => $data->currentPage(),
                'last_page' => $data->lastPage(),
                'per_page' => $data->perPage(),
                'total' => $data->total(),
            ],
        ]);
    }

    /**
     * Created response format (201)
     *
     * @param  mixed  $data
     * @return \Illuminate\Http\JsonResponse
     */
    protected function createdResponse($data, string $message = 'Resource created successfully')
    {
        return $this->successResponse($data, $message, 201);
    }

    /**
     * No content response (204)
     *
     * @return \Illuminate\Http\JsonResponse
     */
    protected function noContentResponse()
    {
        return response()->json(null, 204);
    }

    /**
     * Validation error response (422)
     *
     * @param  mixed  $errors
     * @return \Illuminate\Http\JsonResponse
     */
    protected function validationErrorResponse($errors, string $message = 'Validation failed')
    {
        return $this->errorResponse($message, 422, $errors);
    }

    /**
     * Not found response (404)
     *
     * @return \Illuminate\Http\JsonResponse
     */
    protected function notFoundResponse(string $message = 'Resource not found')
    {
        return $this->errorResponse($message, 404);
    }

    /**
     * Unauthorized response (403)
     *
     * @return \Illuminate\Http\JsonResponse
     */
    protected function unauthorizedResponse(string $message = 'Unauthorized')
    {
        return $this->errorResponse($message, 403);
    }
}
