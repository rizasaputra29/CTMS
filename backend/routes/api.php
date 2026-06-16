<?php

use App\Http\Controllers\Admin\AuditLogController;
use App\Http\Controllers\Admin\PhaseDocumentRequirementController;
use App\Http\Controllers\Admin\StakeholderController;
use App\Http\Controllers\AssessmentComponentController;
use App\Http\Controllers\AssessmentComponentTemplateController;
use App\Http\Controllers\AssessmentScoreController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BidController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DigitalSignatureController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\DocumentTypeController;
use App\Http\Controllers\EvaluationController;
use App\Http\Controllers\ExpoController;
use App\Http\Controllers\ExpoEventController;
use App\Http\Controllers\FinalizationController;
use App\Http\Controllers\GradeConfigurationController;
use App\Http\Controllers\GradeConsistencyController;
use App\Http\Controllers\GroupController;
use App\Http\Controllers\LocationController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PeerReviewController;
use App\Http\Controllers\PeerReviewIndicatorTemplateController;
use App\Http\Controllers\PeriodAssessmentConfigController;
use App\Http\Controllers\PeriodController;
use App\Http\Controllers\PeriodPeerReviewConfigController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\RegistrationController;
use App\Http\Controllers\ReportDetailController;
use App\Http\Controllers\ReportExportController;
use App\Http\Controllers\ReportSummaryController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\ScheduleController;
use App\Http\Controllers\SeminarDashboardController;
use App\Http\Controllers\SemproController;
use App\Http\Controllers\StudentProposalController;
use App\Http\Controllers\StudentStateController;
use App\Http\Controllers\SupervisorEvaluationController;
use App\Http\Controllers\TaDefenseController;
use App\Http\Controllers\TaDefenseScheduleController;
use App\Http\Controllers\TaSubmissionController;
use App\Http\Controllers\TitleApprovalController;
use App\Http\Controllers\TitleController;
use App\Http\Controllers\UserController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);
Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');

Route::middleware(['auth:sanctum', 'add.token.cookie'])->group(function () {
    Route::get('/user', function (Request $request) {
        $user = $request->user()->load('roles:id,name,slug');
        $activeRole = null;

        if ($request->hasSession()) {
            $activeRole = $request->session()->get('active_role');
        }

        $roles = $user->roleSlugs();
        if (! $activeRole) {
            $activeRole = count($roles) > 0 ? $roles[0] : null;
        }

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'nip' => $user->nip,
            'nim' => $user->nim,
            'is_active' => $user->is_active,
            'roles' => $roles,
            'active_role' => $activeRole,
        ]);
    });

    Route::get('/user/roles', [RoleController::class, 'index']);
    Route::post('/user/active-role', [RoleController::class, 'setActiveRole']);
    Route::get('/user/current-role', [RoleController::class, 'currentRole']);

    Route::put('/profile', [ProfileController::class, 'update']);
    Route::get('/periods-list', [PeriodController::class, 'index']);

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
        Route::post('/users/import', [UserController::class, 'import']);
        Route::get('/users/import-template', [UserController::class, 'downloadImportTemplate']);
        Route::delete('/periods/{period}/students/{student}/registration', [UserController::class, 'kickStudentFromPeriod']);
        Route::get('/groups', [GroupController::class, 'listGroups']);
        Route::get('/groups/{group}', [GroupController::class, 'show']);
        Route::get('/schedules', [ScheduleController::class, 'index']);

        // Finalization
        Route::get('/finalization', [FinalizationController::class, 'index']);
        Route::get('/finalization/dosen-load', [FinalizationController::class, 'dosenLoad']);
        Route::post('/finalization/finalize-period', [FinalizationController::class, 'finalizePeriod']);
        Route::get('/finalization/simulate', [FinalizationController::class, 'simulate']);
        Route::post('/finalization/auto-fix', [FinalizationController::class, 'autoFix']);
        Route::post('/finalization/run-automatchmaker', [FinalizationController::class, 'runAutoMatchmaker']);
        Route::post('/finalization/force-ready', [FinalizationController::class, 'forceReady']);
        Route::post('/finalization/lock', [FinalizationController::class, 'lock']);
        Route::post('/finalization/unlock', [FinalizationController::class, 'unlock']);
        Route::post('/finalization/reopen', [FinalizationController::class, 'reopenPeriod']);

        // Admin Finalization Dashboard
        Route::get('/finalization/dashboard', [FinalizationController::class, 'adminDashboard']);
        Route::get('/finalization/lecturers', [FinalizationController::class, 'getAvailableLecturers']);
        Route::post('/finalization/set-supervisor', [FinalizationController::class, 'setSupervisor']);
        Route::post('/finalization/batch-set-supervisor', [FinalizationController::class, 'batchSetSupervisor']);
        Route::post('/finalization/execute', [FinalizationController::class, 'executeFinalization']);
        Route::post('/finalization/rollback', [FinalizationController::class, 'rollbackFinalization']);
        Route::post('/finalization/cancel-kelompok-final', [FinalizationController::class, 'cancelKelompokFinal']);
        Route::get('/finalization/export', [FinalizationController::class, 'export']);

        // Manual Grouping (Admin)
        Route::get('/finalization/available-groups', [FinalizationController::class, 'getAvailableGroupsForManualGrouping']);
        Route::post('/finalization/create-manual-group', [FinalizationController::class, 'createManualGroup']);
        Route::post('/finalization/add-to-existing-group', [FinalizationController::class, 'addToExistingGroup']);
        Route::get('/finalization/available-titles', [FinalizationController::class, 'getAvailableTitles']);
        Route::post('/finalization/assign-title', [FinalizationController::class, 'assignTitle']);
        Route::post('/finalization/promote-to-ready', [FinalizationController::class, 'promoteToReadyForFinalization']);

        // V4: Expo Event Management
        Route::apiResource('expo-events', ExpoEventController::class);
        Route::put('/expo-events/{expoEvent}/publish', [ExpoEventController::class, 'publish']);

        // SEMPRO scheduling
        Route::get('/sempro/schedules', [SemproController::class, 'index']);
        Route::post('/sempro/schedule', [SemproController::class, 'schedule']);
        Route::put('/sempro/schedules/{id}/approve', [SemproController::class, 'approve']);
        Route::put('/sempro/schedules/{id}/reject', [SemproController::class, 'reject']);
        Route::put('/sempro/schedules/{id}/cancel', [SemproController::class, 'cancel']);
        Route::put('/sempro/schedules/{id}', [SemproController::class, 'update']);
        Route::put('/sempro/schedules/{id}/assign-examiners', [SemproController::class, 'assignExaminers']);

        // Expo scheduling (legacy — kept for backward compat)
        Route::get('/expo/schedules', [ExpoController::class, 'index']);
        Route::put('/expo/schedules/{id}/approve', [ExpoController::class, 'approve']);
        Route::put('/expo/schedules/{id}/reject', [ExpoController::class, 'reject']);

        // TA Defense scheduling (individual)
        // Custom routes MUST come before apiResource to avoid route conflicts
        Route::get('/ta-defense-schedules/eligible-students', [TaDefenseScheduleController::class, 'eligibleStudents']);
        Route::put('/ta-defense-schedules/{id}/cancel', [TaDefenseScheduleController::class, 'cancel']);
        Route::put('/ta-defense-schedules/{id}/assign-examiners', [TaDefenseScheduleController::class, 'assignExaminers']);
        Route::apiResource('ta-defense-schedules', TaDefenseScheduleController::class);

        // Exception: approve member leave
        Route::post('/groups/{group}/approve-member-leave', [GroupController::class, 'approveMemberLeave']);

        // Admin: Force delete group
        Route::delete('/groups/{group}/force-delete', [GroupController::class, 'adminDeleteGroup']);

        // Assessment Component Templates (Bank Soal)
        Route::get('/assessment-templates', [AssessmentComponentTemplateController::class, 'index']);
        Route::post('/assessment-templates', [AssessmentComponentTemplateController::class, 'store']);
        Route::get('/assessment-templates/{id}', [AssessmentComponentTemplateController::class, 'show']);
        Route::put('/assessment-templates/{id}', [AssessmentComponentTemplateController::class, 'update']);
        Route::delete('/assessment-templates/{id}', [AssessmentComponentTemplateController::class, 'destroy']);

        // Period Assessment Configuration (pilih komponen dari bank soal)
        Route::get('/periods/{period}/assessment-config', [PeriodAssessmentConfigController::class, 'show']);
        Route::post('/periods/{period}/assessment-config', [PeriodAssessmentConfigController::class, 'store']);
        Route::post('/periods/{period}/assessment-config/copy', [PeriodAssessmentConfigController::class, 'copy']);

        // Assessment Components (dynamic CPMK/CPL) - now reads from period config
        Route::get('/assessment-components', [AssessmentComponentController::class, 'index']);
        Route::post('/assessment-components', [AssessmentComponentController::class, 'store']);
        Route::post('/assessment-components/bulk', [AssessmentComponentController::class, 'bulkStore']);
        Route::put('/assessment-components/{id}', [AssessmentComponentController::class, 'update']);
        Route::delete('/assessment-components/{id}', [AssessmentComponentController::class, 'destroy']);

        // Assessment Scores Summary (admin view)
        Route::get('/assessment-scores/summary', [AssessmentScoreController::class, 'summary']);

        // Supervisor Evaluation Summary (admin view)
        Route::get('/supervisor-evaluation/schedules/{scheduleId}/summary', [SupervisorEvaluationController::class, 'adminScheduleSummary']);
        Route::get('/supervisor-evaluation/schedules/{scheduleId}/export', [SupervisorEvaluationController::class, 'exportScheduleSummary']);
        Route::get('/supervisor-evaluation/schedules/{scheduleId}/grades', [SupervisorEvaluationController::class, 'getGradesForSchedule']);

        // Peer Review Indicator Templates - DEPRECATED
        // Use /assessment-templates instead. Peer review now uses Assessment Bank.
        // Route::get('/peer-review-templates', [PeerReviewIndicatorTemplateController::class, 'index']);
        // Route::post('/peer-review-templates', [PeerReviewIndicatorTemplateController::class, 'store']);
        // Route::put('/peer-review-templates/{id}', [PeerReviewIndicatorTemplateController::class, 'update']);
        // Route::delete('/peer-review-templates/{id}', [PeerReviewIndicatorTemplateController::class, 'destroy']);

        // Period Peer Review Configuration (pilih indikator dari bank soal)
        Route::get('/periods/{period}/peer-review-config', [PeriodPeerReviewConfigController::class, 'show']);
        Route::post('/periods/{period}/peer-review-config', [PeriodPeerReviewConfigController::class, 'store']);
        Route::post('/periods/{period}/peer-review-config/copy', [PeriodPeerReviewConfigController::class, 'copy']);

        // Peer Review Admin - View Scores
        Route::get('/peer-review/scores', [PeerReviewController::class, 'adminScores']);

        // Peer Review Indicators (admin) - deprecated, use config above
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

        // Phase Document Requirements (admin)
        Route::get('/document-requirements', [PhaseDocumentRequirementController::class, 'index']);
        Route::get('/document-requirements/period/{periodId}', [PhaseDocumentRequirementController::class, 'byPeriod']);
        Route::get('/document-requirements/period/{periodId}/summary', [PhaseDocumentRequirementController::class, 'summary']);
        Route::post('/document-requirements', [PhaseDocumentRequirementController::class, 'store']);
        Route::put('/document-requirements/bulk', [PhaseDocumentRequirementController::class, 'bulkUpdate']);
        Route::put('/document-requirements/{id}', [PhaseDocumentRequirementController::class, 'update']);
        Route::delete('/document-requirements/{id}', [PhaseDocumentRequirementController::class, 'destroy']);

        // Digital Signatures (admin)
        Route::post('/digital-signatures/sign', [DigitalSignatureController::class, 'sign']);
        Route::get('/digital-signatures/verify/{hash}', [DigitalSignatureController::class, 'verify']);

        // Report Export (admin)
        Route::get('/reports/{type}/export', [ReportExportController::class, 'export']);

        // Report Summary (admin)
        Route::get('/reports/summary', [ReportSummaryController::class, 'summary']);

        // Report Detail Pages (admin)
        Route::get('/reports/assessments', [ReportDetailController::class, 'assessments']);
        Route::get('/reports/peer-reviews', [ReportDetailController::class, 'peerReviews']);
        Route::get('/reports/final-grades', [ReportDetailController::class, 'finalGrades']);
        Route::get('/reports/grade-consistency', [ReportDetailController::class, 'gradeConsistency']);
        Route::get('/reports/groups', [ReportDetailController::class, 'groups']);

        // Student Evaluation Detail Pages (admin)
        Route::get('/reports/student-evaluations-summary', [ReportDetailController::class, 'studentEvaluationsSummary']);
        Route::get('/reports/student-evaluations/{studentId}/{evaluationType}', [ReportDetailController::class, 'studentEvaluationDetail']);
        Route::get('/reports/student-evaluations-summary/export', [ReportDetailController::class, 'exportStudentEvaluationsSummary']);

        // Assign Supervisor 2 (admin only)
        Route::post('/groups/{group}/assign-supervisor-2', [GroupController::class, 'assignSupervisor2']);

        // Stakeholders (admin)
        Route::get('/stakeholders', [StakeholderController::class, 'index']);
        Route::post('/stakeholders', [StakeholderController::class, 'store']);
        Route::put('/stakeholders/{stakeholder}', [StakeholderController::class, 'update']);
        Route::delete('/stakeholders/{stakeholder}', [StakeholderController::class, 'destroy']);
        Route::post('/titles/{title}/stakeholders', [StakeholderController::class, 'attachToTitle']);
        Route::delete('/titles/{title}/stakeholders/{stakeholder}', [StakeholderController::class, 'detachFromTitle']);

        // Grade Configuration (admin)
        Route::get('/grade-configuration/{periodId}', [GradeConfigurationController::class, 'getFullConfiguration']);
        Route::post('/grade-configuration/{periodId}', [GradeConfigurationController::class, 'updateWeights']);
        Route::post('/grade-configuration/{periodId}/reset', [GradeConfigurationController::class, 'resetToDefaults']);
        Route::get('/grade-configuration/{periodId}/pdc1', [GradeConfigurationController::class, 'getPDC1Weights']);
        Route::get('/grade-configuration/{periodId}/pdc2', [GradeConfigurationController::class, 'getPDC2Weights']);
        Route::get('/grade-configuration/{periodId}/ta', [GradeConfigurationController::class, 'getTAWeights']);
        Route::get('/grade-configuration/calculate/{groupId}', [GradeConfigurationController::class, 'calculateGroupGrades']);
        Route::get('/grade-configuration/calculate-ta/{studentId}', [GradeConfigurationController::class, 'calculateTAGrade']);

        // Analytics - Group Progress
        Route::get('/analytics/group-progress', [GroupController::class, 'progress']);
        Route::get('/student-grades/{studentId}', [GradeConfigurationController::class, 'getStudentGrades']);

        // Peer Review Dashboard (admin)
        Route::get('/peer-review-dashboard/groups', [PeerReviewController::class, 'adminGroupProgress']);
        Route::post('/peer-review-dashboard/send-reminder/{groupId}', [PeerReviewController::class, 'sendReminder']);

        // Student State (admin)
        Route::get('/student-state/{studentId}', [StudentStateController::class, 'getStudentTAStatus']);
        Route::post('/student-state/{studentId}/force-unlock', [StudentStateController::class, 'forceUnlockTA']);
        Route::get('/groups/{groupId}/ta-statuses', [StudentStateController::class, 'getGroupTAStatus']);

        // Audit Logs (admin)
        Route::get('/audit-logs', [AuditLogController::class, 'index']);
        Route::get('/audit-logs/action-types', [AuditLogController::class, 'actionTypes']);
        Route::get('/audit-logs/{id}', [AuditLogController::class, 'show']);
    });

    // ────────────────────────────────
    // Dosen Routes
    // ────────────────────────────────
    Route::middleware(['role:dosen'])->prefix('dosen')->group(function () {
        Route::get('/dashboard', [DashboardController::class, 'dosen']);
        Route::apiResource('titles', TitleController::class);

        // Title Approval Withdrawal & History
        Route::post('/titles/{title}/withdraw-approval', [TitleController::class, 'withdrawApproval']);
        Route::get('/titles/{title}/approval-history', [TitleController::class, 'getApprovalHistory']);

        // Title Deletion History
        Route::get('/titles/{title}/deletion-history', [TitleController::class, 'getDeletionHistory']);

        // Documents
        Route::put('/documents/{id}', [DocumentController::class, 'update']);
        Route::get('/documents', [DocumentController::class, 'index']);
        Route::get('/documents/{id}/download', [DocumentController::class, 'download']);

        // Evaluations (legacy)
        Route::get('/evaluations', [EvaluationController::class, 'index']);
        Route::post('/evaluations', [EvaluationController::class, 'store']);

        // Groups
        Route::get('/groups/pending', [GroupController::class, 'pendingGroups']);
        Route::get('/groups/supervised', [GroupController::class, 'supervisedGroups']);
        Route::get('/groups', [GroupController::class, 'listGroups']);
        Route::get('/schedules', [ScheduleController::class, 'index']);

        // All Schedules (aggregated: BIMBINGAN, SEMPRO/EXPO as examiner, TA Defense)
        Route::get('/all-schedules', [ScheduleController::class, 'dosenAllSchedules']);

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

        // TA Defense Schedule (individual TA scheduling)
        Route::get('/ta-defense-schedules/examiner', [TaDefenseScheduleController::class, 'examinerSchedules']);

        // Seminar dashboard (supervisor + examiner views)
        Route::get('/seminar-schedules/supervisor', [SeminarDashboardController::class, 'supervisorSchedules']);
        Route::get('/seminar-schedules/examiner', [SeminarDashboardController::class, 'examinerSchedules']);
        Route::get('/evaluation-context/{type}/{id}', [SeminarDashboardController::class, 'evaluationContext']);

        // Supervisor Evaluation (BIMBINGAN_SEMPRO, BIMBINGAN_EXPO, MILESTONE, BIMBINGAN_TA)
        Route::get('/supervisor-evaluation/groups', [SupervisorEvaluationController::class, 'groups']);
        Route::get('/supervisor-evaluation/schedules', [SupervisorEvaluationController::class, 'schedules']);
        Route::get('/supervisor-evaluation/pending-count', [SupervisorEvaluationController::class, 'pendingCount']);
        Route::get('/supervisor-evaluation/form/{groupId}', [SupervisorEvaluationController::class, 'form']);
        Route::post('/supervisor-evaluation', [SupervisorEvaluationController::class, 'store']);

        // Assessment Scores (dosen submits evaluations)
        Route::get('/assessment-scores', [AssessmentScoreController::class, 'index']);
        Route::post('/assessment-scores', [AssessmentScoreController::class, 'store']);

        // Peer Review (dosen views)
        Route::get('/peer-review', [PeerReviewController::class, 'groupReviews']);

        // Digital Signatures (dosen)
        Route::get('/digital-signatures', [DigitalSignatureController::class, 'mySignatures']);

        // Student Flagging (dosen)
        Route::post('/groups/{group}/flag-student', [GroupController::class, 'flagStudent']);
    });

    // ────────────────────────────────
    // Mahasiswa Routes
    // ────────────────────────────────

    // Group 1: Allowed BEFORE period finalization
    // Dashboard, Registration, Group & Titles
    Route::middleware(['role:mahasiswa'])->prefix('mahasiswa')->group(function () {
        Route::get('/dashboard', [DashboardController::class, 'mahasiswa']);
        Route::get('/dashboard/workflow', [DashboardController::class, 'workflow']);
        Route::get('/my-period', [RegistrationController::class, 'myPeriod']);
        Route::get('/titles', [TitleController::class, 'index']);
        Route::get('/titles/{title}', [TitleController::class, 'show']);

        // Group management
        Route::get('/group', [GroupController::class, 'index']);
        Route::get('/available-periods', [GroupController::class, 'availablePeriods']);
        Route::get('/registration-period', [PeriodController::class, 'registrationPeriod']);
        Route::post('/group', [GroupController::class, 'store']);
        Route::post('/group/store-solo', [GroupController::class, 'storeSolo']);
        Route::delete('/group', [GroupController::class, 'deleteGroup']);
        Route::post('/group/leave', [GroupController::class, 'leaveGroup']);
        Route::post('/group/leave-completely', [GroupController::class, 'leaveGroupCompletely']);
        Route::post('/group/add-member', [GroupController::class, 'addMember']);
        Route::delete('/group/members/{memberId}', [GroupController::class, 'removeMember']);
        Route::post('/group/propose-supervisors', [GroupController::class, 'proposeSupervisors']);
        Route::post('/group/mark-ready-for-finalization', [GroupController::class, 'markReadyForFinalization']);
        Route::post('/group/cancel-ready-for-finalization', [GroupController::class, 'cancelReadyForFinalization']);
        Route::post('/group-invitations/{id}/accept', [GroupController::class, 'acceptInvite']);
        Route::post('/group-invitations/{id}/reject', [GroupController::class, 'rejectInvite']);

        // Bidding
        Route::get('/bids', [BidController::class, 'index']);
        Route::post('/bids', [BidController::class, 'store']);
        Route::put('/bids/reorder', [BidController::class, 'reorder']);
        Route::delete('/bids/{id}', [BidController::class, 'destroy']);

        // Student Proposals
        Route::get('/lecturers', [StudentProposalController::class, 'lecturers']);
        Route::post('/propose-title', [StudentProposalController::class, 'store']);
        Route::get('/my-proposal', [StudentProposalController::class, 'myProposal']);
        Route::put('/my-proposal', [StudentProposalController::class, 'update']);
        Route::delete('/proposal/{id}', [StudentProposalController::class, 'destroy']);

        // Bursa Ide (Open Recruitment / Idea Magnet)
        Route::get('/bursa-ide', [\App\Http\Controllers\BursaIdeController::class, 'index']);
        Route::post('/bursa-ide/{groupId}/request-join', [\App\Http\Controllers\BursaIdeController::class, 'requestJoin']);
        Route::get('/join-requests', [\App\Http\Controllers\BursaIdeController::class, 'myRequests']);
        Route::post('/join-requests/{id}/accept', [\App\Http\Controllers\BursaIdeController::class, 'acceptRequest']);
        Route::post('/join-requests/{id}/reject', [\App\Http\Controllers\BursaIdeController::class, 'rejectRequest']);

        // Solo Title Bidding (Bid to join solo seeker's title)
        Route::get('/solo-titles', [\App\Http\Controllers\SoloTitleController::class, 'index']);
        Route::post('/solo-titles/{id}/bid', [\App\Http\Controllers\SoloTitleController::class, 'store']);
        Route::put('/solo-titles/{id}/accept', [\App\Http\Controllers\SoloTitleController::class, 'acceptBidder']);
        Route::put('/solo-titles/{id}/reject', [\App\Http\Controllers\SoloTitleController::class, 'rejectBidder']);

        // Period Registration
        Route::get('/periods/{periodId}/check-registration', [RegistrationController::class, 'check']);
        Route::post('/periods/register', [RegistrationController::class, 'register']);
    });

    // Group 2: Restricted — only AFTER period finalization
    // Documents, Schedules, Evaluations, TA, Expo, Grades, Peer Review
    Route::middleware(['role:mahasiswa', 'period.finalized'])->prefix('mahasiswa')->group(function () {
        // Documents
        Route::post('/documents', [DocumentController::class, 'store']);
        Route::get('/documents', [DocumentController::class, 'index']);
        Route::get('/documents/{id}/download', [DocumentController::class, 'download']);
        Route::get('/workflow', [DocumentController::class, 'workflow']);

        // Schedules (legacy)
        Route::get('/schedules', [ScheduleController::class, 'index']);

        // All Schedules (aggregated: BIMBINGAN, SEMPRO, EXPO, TA_DEFENSE)
        Route::get('/all-schedules', [ScheduleController::class, 'studentAllSchedules']);

        // Seminar + TA defense schedule dashboard
        Route::get('/seminar-schedules', [SeminarDashboardController::class, 'studentSchedules']);
        Route::get('/ta-defense', [TaDefenseController::class, 'myDefense']);
        Route::get('/ta-defense-schedules/my-schedule', [TaDefenseScheduleController::class, 'mySchedule']);

        // NOTE: Student schedule requests removed — Admin handles all scheduling

        // V4: Expo events (replaces schedule-request/expo)
        Route::get('/expo-events', [ExpoEventController::class, 'studentEvents']);
        Route::post('/expo-events/{expoEvent}/register', [ExpoEventController::class, 'register']);
        Route::post('/expo-events/{expoEvent}/withdraw', [ExpoEventController::class, 'withdraw']);
        Route::get('/expo-events/{expoEvent}/detail', [ExpoEventController::class, 'studentDetail']);
        Route::post('/expo-events/{expoEvent}/evaluation', [ExpoEventController::class, 'submitEvaluation']);
        Route::post('/expo-events/{expoEvent}/document', [ExpoEventController::class, 'uploadDocument']);

        // Peer Review (mahasiswa)
        Route::get('/peer-review', [PeerReviewController::class, 'index']);
        Route::get('/peer-review/status', [PeerReviewController::class, 'status']);
        Route::get('/peer-review/my-status', [PeerReviewController::class, 'myStatus']);
        Route::post('/peer-review', [PeerReviewController::class, 'store']);

        // Student Grades
        Route::get('/my-grades', [GradeConfigurationController::class, 'getMyGrades']);

        // TA Status & Access
        Route::get('/ta-status', [StudentStateController::class, 'getMyTAStatus']);

        // TA Submissions
        Route::get('/ta-submission', [TaSubmissionController::class, 'index']);
        Route::get('/ta-detailed-status', [TaSubmissionController::class, 'getDetailedStatus']);
        Route::post('/ta-submission/upload', [TaSubmissionController::class, 'upload']);
        Route::put('/ta-submission/revise', [TaSubmissionController::class, 'revise']);
        Route::post('/ta-submission/register', [TaSubmissionController::class, 'register']);

        // TA Document Management
        Route::get('/ta-documents', [TaSubmissionController::class, 'getTaDocuments']);
        Route::post('/ta-documents/upload', [TaSubmissionController::class, 'uploadTaDocument']);
        Route::post('/ta-documents/{id}/review', [TaSubmissionController::class, 'reviewTaDocument']);
    });

    // ────────────────────────────────
    // Shared Routes
    // ────────────────────────────────
    Route::middleware(['role:admin,dosen'])->group(function () {
        Route::apiResource('schedules', ScheduleController::class)->except(['index', 'show']);
    });

    // ────────────────────────────────
    // Locations (accessible by all authenticated users for dropdown)
    // ────────────────────────────────
    Route::get('/locations', [LocationController::class, 'active']);
    Route::get('/locations/physical', [LocationController::class, 'physical']);
    Route::get('/locations/online', [LocationController::class, 'online']);
    Route::get('/locations/all', [LocationController::class, 'index']);
    Route::get('/locations/available', [LocationController::class, 'available']);

    // Admin-only location management
    Route::middleware(['role:admin'])->group(function () {
        Route::apiResource('locations', LocationController::class)->except(['index']);
    });
});
