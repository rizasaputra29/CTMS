<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\TitleController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\GroupController;
use App\Http\Controllers\ScheduleController;
use App\Http\Controllers\EvaluationController;
use App\Http\Controllers\PeriodController;
use App\Http\Controllers\StudentProposalController;
use App\Http\Controllers\TitleApprovalController;

Route::post('/login', [AuthController::class, 'login']);
Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');

Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    Route::put('/profile', [ProfileController::class, 'update']);

    // Admin Routes
    Route::middleware(['role:admin'])->prefix('admin')->group(function () {
        Route::get('/dashboard', [DashboardController::class, 'admin']);
        Route::apiResource('periods', PeriodController::class);
        Route::apiResource('users', UserController::class);
    });

    // Dosen Routes
    Route::middleware(['role:dosen'])->prefix('dosen')->group(function () {
        Route::get('/dashboard', [DashboardController::class, 'dosen']);
        Route::apiResource('titles', TitleController::class);
        // Review documents (update status)
        Route::put('/documents/{id}', [DocumentController::class, 'update']);
        Route::get('/documents', [DocumentController::class, 'index']); // Get docs for specific group
        Route::get('/evaluations', [EvaluationController::class, 'index']);
        Route::post('/evaluations', [EvaluationController::class, 'store']);

        // Group Approval
        Route::get('/groups/pending', [GroupController::class, 'pendingGroups']);
        Route::get('/groups/supervised', [GroupController::class, 'supervisedGroups']);
        Route::put('/groups/{group}/approve', [GroupController::class, 'approve']);
        Route::put('/groups/{group}/reject', [GroupController::class, 'reject']);

        // Title Approvals (Student Proposals)
        Route::get('/title-approvals', [TitleApprovalController::class, 'index']);
        Route::get('/title-approvals/{id}', [TitleApprovalController::class, 'show']);
        Route::put('/title-approvals/{id}/approve', [TitleApprovalController::class, 'approve']);
        Route::put('/title-approvals/{id}/reject', [TitleApprovalController::class, 'reject']);
    });

    // Mahasiswa Routes
    Route::middleware(['role:mahasiswa'])->prefix('mahasiswa')->group(function () {
        Route::get('/dashboard', [DashboardController::class, 'mahasiswa']);
        Route::get('/titles', [TitleController::class, 'index']); // Students can view titles
        Route::get('/titles/{title}', [TitleController::class, 'show']); // Title detail

        Route::get('/group', [GroupController::class, 'index']); // Get my group
        Route::post('/group', [GroupController::class, 'store']); // Create group (no title)
        Route::post('/group/bid-title', [GroupController::class, 'bidTitle']); // Bid on a title
        Route::delete('/group', [GroupController::class, 'deleteGroup']); // Delete/disband group
        Route::post('/group/add-member', [GroupController::class, 'addMember']); // Add member by email
        Route::delete('/group/members/{memberId}', [GroupController::class, 'removeMember']); // Remove member

        Route::post('/documents', [DocumentController::class, 'store']); // Upload doc
        Route::get('/documents', [DocumentController::class, 'index']); // List my docs
        Route::get('/workflow', [DocumentController::class, 'workflow']); // Get workflow status

        Route::get('/schedules', [ScheduleController::class, 'index']); // View schedules

        // Student Proposals
        Route::get('/lecturers', [StudentProposalController::class, 'lecturers']); // List active lecturers
        Route::post('/propose-title', [StudentProposalController::class, 'store']);
        Route::get('/my-proposal', [StudentProposalController::class, 'myProposal']);
        Route::put('/my-proposal', [StudentProposalController::class, 'update']);
    });

    // Shared Routes (or specific)
    Route::middleware(['role:admin,dosen'])->group(function () {
        Route::apiResource('schedules', ScheduleController::class)->except(['index', 'show']); // Create/Update/Delete
    });
    // Allow index for admin/dosen too (using resource or manual)
    Route::middleware(['role:admin'])->prefix('admin')->group(function () {
        Route::get('/schedules', [ScheduleController::class, 'index']);
        Route::get('/groups', [GroupController::class, 'listGroups']);
    });
    Route::middleware(['role:dosen'])->prefix('dosen')->group(function () {
        Route::get('/schedules', [ScheduleController::class, 'index']);
        Route::get('/groups', [GroupController::class, 'listGroups']); // List groups for scheduling
    });
});
