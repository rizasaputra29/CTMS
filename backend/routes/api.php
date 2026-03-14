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
use App\Http\Controllers\BidController;
use App\Http\Controllers\FinalizationController;
use App\Http\Controllers\SemproController;
use App\Http\Controllers\ExpoController;
use App\Http\Controllers\TaSubmissionController;
use App\Http\Controllers\TaDefenseController;
use App\Http\Controllers\SeminarDashboardController;
use App\Http\Controllers\ScheduleRequestController;
use App\Http\Controllers\ExpoEventController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\AssessmentComponentController;
use App\Http\Controllers\AssessmentScoreController;
use App\Http\Controllers\PeerReviewController;
use App\Http\Controllers\GradeConsistencyController;
use App\Http\Controllers\DocumentTypeController;
use App\Http\Controllers\DigitalSignatureController;
use App\Http\Controllers\ReportExportController;

Route::post('/login', [AuthController::class, 'login']);
Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');

Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    Route::put('/profile', [ProfileController::class, 'update']);

    // ────────────────────────────────
    // Shared: Notifications (all roles)
    // ────────────────────────────────
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::put('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
    Route::put('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);

    // ────────────────────────────────
    // Admin Routes
    // ────────────────────────────────
    Route::middleware(['role:admin'])->prefix('admin')->group(function () {
        Route::get('/dashboard', [DashboardController::class, 'admin']);
        Route::apiResource('periods', PeriodController::class);
        Route::apiResource('users', UserController::class);
        Route::get('/groups', [GroupController::class, 'listGroups']);
        Route::get('/schedules', [ScheduleController::class, 'index']);

        // Finalization
        Route::get('/finalization', [FinalizationController::class, 'index']);
        Route::get('/finalization/dosen-load', [FinalizationController::class, 'dosenLoad']);
        Route::post('/finalization/allocate', [FinalizationController::class, 'allocate']);
        Route::post('/finalization/allocate-student-proposed', [FinalizationController::class, 'allocateStudentProposed']);
        Route::post('/finalization/finalize-period', [FinalizationController::class, 'finalizePeriod']);
        Route::post('/finalization/lock', [FinalizationController::class, 'lock']);

        // V4: Expo Event Management
        Route::apiResource('expo-events', ExpoEventController::class);
        Route::put('/expo-events/{expoEvent}/publish', [ExpoEventController::class, 'publish']);

        // SEMPRO scheduling
        Route::get('/sempro/schedules', [SemproController::class, 'index']);
        Route::post('/sempro/schedule', [SemproController::class, 'schedule']);
        Route::put('/sempro/schedules/{id}/approve', [SemproController::class, 'approve']);
        Route::put('/sempro/schedules/{id}/reject', [SemproController::class, 'reject']);

        // Expo scheduling (legacy — kept for backward compat)
        Route::get('/expo/schedules', [ExpoController::class, 'index']);
        Route::put('/expo/schedules/{id}/approve', [ExpoController::class, 'approve']);
        Route::put('/expo/schedules/{id}/reject', [ExpoController::class, 'reject']);

        // TA Defense scheduling
        Route::get('/ta-defense/schedules', [TaDefenseController::class, 'index']);
        Route::post('/ta-defense/schedule', [TaDefenseController::class, 'schedule']);
        Route::put('/ta-defense/schedules/{id}/approve', [TaDefenseController::class, 'approve']);
        Route::put('/ta-defense/schedules/{id}/reject', [TaDefenseController::class, 'reject']);

        // Exception: approve member leave
        Route::post('/groups/{group}/approve-member-leave', [GroupController::class, 'approveMemberLeave']);

        // Assessment Components (dynamic CPMK/CPL)
        Route::get('/assessment-components', [AssessmentComponentController::class, 'index']);
        Route::post('/assessment-components', [AssessmentComponentController::class, 'store']);
        Route::post('/assessment-components/bulk', [AssessmentComponentController::class, 'bulkStore']);
        Route::put('/assessment-components/{id}', [AssessmentComponentController::class, 'update']);
        Route::delete('/assessment-components/{id}', [AssessmentComponentController::class, 'destroy']);

        // Assessment Scores Summary (admin view)
        Route::get('/assessment-scores/summary', [AssessmentScoreController::class, 'summary']);

        // Peer Review Indicators (admin)
        Route::get('/peer-review/indicators', [PeerReviewController::class, 'indicators']);
        Route::post('/peer-review/indicators', [PeerReviewController::class, 'storeIndicator']);
        Route::put('/peer-review/indicators/{id}', [PeerReviewController::class, 'updateIndicator']);
        Route::delete('/peer-review/indicators/{id}', [PeerReviewController::class, 'destroyIndicator']);

        // Grade Consistency (admin)
        Route::get('/grade-consistency', [GradeConsistencyController::class, 'index']);
        Route::post('/grade-consistency/generate', [GradeConsistencyController::class, 'generate']);
        Route::put('/grade-consistency/{id}', [GradeConsistencyController::class, 'update']);

        // Document Types (admin)
        Route::apiResource('document-types', DocumentTypeController::class);

        // Digital Signatures (admin)
        Route::post('/digital-signatures/sign', [DigitalSignatureController::class, 'sign']);
        Route::get('/digital-signatures/verify/{hash}', [DigitalSignatureController::class, 'verify']);

        // Report Export (admin)
        Route::get('/reports/{type}/export', [ReportExportController::class, 'export']);

        // Assign Supervisor 2 (admin only)
        Route::post('/groups/{group}/assign-supervisor-2', [GroupController::class, 'assignSupervisor2']);
    });

    // ────────────────────────────────
    // Dosen Routes
    // ────────────────────────────────
    Route::middleware(['role:dosen'])->prefix('dosen')->group(function () {
        Route::get('/dashboard', [DashboardController::class, 'dosen']);
        Route::apiResource('titles', TitleController::class);

        // Documents
        Route::put('/documents/{id}', [DocumentController::class, 'update']);
        Route::get('/documents', [DocumentController::class, 'index']);

        // Evaluations (legacy)
        Route::get('/evaluations', [EvaluationController::class, 'index']);
        Route::post('/evaluations', [EvaluationController::class, 'store']);

        // Groups
        Route::get('/groups/pending', [GroupController::class, 'pendingGroups']);
        Route::get('/groups/supervised', [GroupController::class, 'supervisedGroups']);
        Route::get('/groups', [GroupController::class, 'listGroups']);
        Route::get('/schedules', [ScheduleController::class, 'index']);

        // Title Approvals
        Route::get('/title-approvals', [TitleApprovalController::class, 'index']);
        Route::get('/title-approvals/{id}', [TitleApprovalController::class, 'show']);
        Route::put('/title-approvals/{id}/approve', [TitleApprovalController::class, 'approve']);
        Route::put('/title-approvals/{id}/reject', [TitleApprovalController::class, 'reject']);

        // Bidding: lecturer recommendation
        Route::get('/bids', [BidController::class, 'lecturerBids']);
        Route::put('/bids/{id}/recommend', [BidController::class, 'recommend']);

        // SEMPRO evaluation (per-examiner)
        Route::post('/sempro/{schedule}/evaluate', [SemproController::class, 'evaluate']);

        // Expo evaluation (per-examiner)
        Route::post('/expo/{schedule}/evaluate', [ExpoController::class, 'evaluate']);

        // TA review (submission review)
        Route::put('/ta/{id}/review', [TaSubmissionController::class, 'review']);
        Route::put('/ta/{id}/defended', [TaSubmissionController::class, 'defended']);

        // TA Defense evaluation (per-examiner)
        Route::post('/ta-defense/{schedule}/evaluate', [TaDefenseController::class, 'evaluate']);

        // Seminar dashboard (supervisor + examiner views)
        Route::get('/seminar-schedules/supervisor', [SeminarDashboardController::class, 'supervisorSchedules']);
        Route::get('/seminar-schedules/examiner', [SeminarDashboardController::class, 'examinerSchedules']);

        // Assessment Scores (dosen submits evaluations)
        Route::get('/assessment-scores', [AssessmentScoreController::class, 'index']);
        Route::post('/assessment-scores', [AssessmentScoreController::class, 'store']);

        // Peer Review (dosen views)
        Route::get('/peer-review', [PeerReviewController::class, 'groupReviews']);

        // Digital Signatures (dosen)
        Route::get('/digital-signatures', [DigitalSignatureController::class, 'mySignatures']);
    });

    // ────────────────────────────────
    // Mahasiswa Routes
    // ────────────────────────────────
    Route::middleware(['role:mahasiswa'])->prefix('mahasiswa')->group(function () {
        Route::get('/dashboard', [DashboardController::class, 'mahasiswa']);
        Route::get('/titles', [TitleController::class, 'index']);
        Route::get('/titles/{title}', [TitleController::class, 'show']);

        // Group management
        Route::get('/group', [GroupController::class, 'index']);
        Route::post('/group', [GroupController::class, 'store']);
        Route::delete('/group', [GroupController::class, 'deleteGroup']);
        Route::post('/group/leave', [GroupController::class, 'leaveGroup']);
        Route::post('/group/add-member', [GroupController::class, 'addMember']);
        Route::delete('/group/members/{memberId}', [GroupController::class, 'removeMember']);
        Route::post('/group/propose-supervisors', [GroupController::class, 'proposeSupervisors']);
        Route::post('/group-invitations/{id}/accept', [GroupController::class, 'acceptInvite']);
        Route::post('/group-invitations/{id}/reject', [GroupController::class, 'rejectInvite']);

        // Bidding
        Route::get('/bids', [BidController::class, 'index']);
        Route::post('/bids', [BidController::class, 'store']);
        Route::delete('/bids/{id}', [BidController::class, 'destroy']);

        // Documents
        Route::post('/documents', [DocumentController::class, 'store']);
        Route::get('/documents', [DocumentController::class, 'index']);
        Route::get('/workflow', [DocumentController::class, 'workflow']);

        // Schedules (legacy)
        Route::get('/schedules', [ScheduleController::class, 'index']);

        // Seminar + TA defense schedule dashboard
        Route::get('/seminar-schedules', [SeminarDashboardController::class, 'studentSchedules']);
        Route::get('/ta-defense', [TaDefenseController::class, 'myDefense']);

        // NOTE: Student schedule requests removed — Admin handles all scheduling

        // V4: Expo events (replaces schedule-request/expo)
        Route::get('/expo-events', [ExpoEventController::class, 'studentEvents']);
        Route::post('/expo-events/{expoEvent}/register', [ExpoEventController::class, 'register']);

        // Student Proposals
        Route::get('/lecturers', [StudentProposalController::class, 'lecturers']);
        Route::post('/propose-title', [StudentProposalController::class, 'store']);
        Route::get('/my-proposal', [StudentProposalController::class, 'myProposal']);
        Route::put('/my-proposal', [StudentProposalController::class, 'update']);

        // Peer Review (mahasiswa)
        Route::get('/peer-review', [PeerReviewController::class, 'index']);
        Route::get('/peer-review/status', [PeerReviewController::class, 'status']);
        Route::post('/peer-review', [PeerReviewController::class, 'store']);

        // TA Submissions
        Route::get('/ta', [TaSubmissionController::class, 'index']);
        Route::post('/ta/upload', [TaSubmissionController::class, 'upload']);
        Route::put('/ta/revise', [TaSubmissionController::class, 'revise']);
        Route::post('/ta/register', [TaSubmissionController::class, 'register']);
    });

    // ────────────────────────────────
    // Shared Routes
    // ────────────────────────────────
    Route::middleware(['role:admin,dosen'])->group(function () {
        Route::apiResource('schedules', ScheduleController::class)->except(['index', 'show']);
    });
});
