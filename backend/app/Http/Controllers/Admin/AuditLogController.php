<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\ApiResponseTrait;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    use ApiResponseTrait;

    /**
     * Get paginated list of audit logs with filters.
     *
     * Available filters:
     * - action (string): Filter by action type
     * - target_type (string): Filter by target type
     * - user_id (int): Filter by user ID
     * - period_id (int): Filter by period_id in payload
     * - date_from (date): Filter by created_at >= date
     * - date_to (date): Filter by created_at <= date
     * - search (string): Text search in action and payload
     */
    public function index(Request $request): JsonResponse
    {
        $query = AuditLog::with('user');

        // Filter by action
        if ($request->filled('action')) {
            $query->where('action', $request->input('action'));
        }

        // Filter by target_type
        if ($request->filled('target_type')) {
            $query->where('target_type', $request->input('target_type'));
        }

        // Filter by user_id
        if ($request->filled('user_id')) {
            $query->where('user_id', $request->input('user_id'));
        }

        // Filter by period_id (in payload JSON)
        if ($request->filled('period_id')) {
            $query->whereJsonContains('payload->period_id', $request->input('period_id'));
        }

        // Filter by date range
        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->input('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->input('date_to'));
        }

        // Text search in action and payload
        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search): void {
                $q->where('action', 'like', "%{$search}%")
                    ->orWhere('target_type', 'like', "%{$search}%")
                    ->orWhereRaw("JSON_SEARCH(payload, 'one', ?) IS NOT NULL", ["%{$search}%"]);
            });
        }

        $perPage = $request->input('per_page', 10);
        $logs = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return $this->paginatedResponse($logs, 'Audit logs retrieved successfully');
    }

    /**
     * Get a single audit log with full payload.
     */
    public function show(int $id): JsonResponse
    {
        $log = AuditLog::with('user')->findOrFail($id);

        return $this->successResponse($log, 'Audit log retrieved successfully');
    }

    /**
     * Get distinct action types for filter dropdown.
     */
    public function actionTypes(): JsonResponse
    {
        $actionTypes = AuditLog::distinct()
            ->orderBy('action')
            ->pluck('action');

        return $this->successResponse($actionTypes, 'Action types retrieved successfully');
    }
}
