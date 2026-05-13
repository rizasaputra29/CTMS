<?php

// @formatter:off
// phpcs:ignoreFile
/**
 * A helper file for your Eloquent Models
 * Copy the phpDocs from this file to the correct Model,
 * And remove them from this file, to prevent double declarations.
 *
 * @author Barry vd. Heuvel <barryvdh@gmail.com>
 */


namespace App\Models{
/**
 * @property int $id
 * @property int $period_id
 * @property string $type
 * @property string $code
 * @property string $name
 * @property string|null $description
 * @property numeric $weight
 * @property int $sort_order
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Period|null $period
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\AssessmentScore> $scores
 * @property-read int|null $scores_count
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentComponent newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentComponent newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentComponent query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentComponent whereCode($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentComponent whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentComponent whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentComponent whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentComponent whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentComponent wherePeriodId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentComponent whereSortOrder($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentComponent whereType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentComponent whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentComponent whereWeight($value)
 */
	class AssessmentComponent extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property string $code
 * @property string $name
 * @property string|null $description
 * @property numeric $weight
 * @property bool $is_active
 * @property int|null $created_by
 * @property int $sort_order
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User|null $creator
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\PeriodAssessmentComponent> $periodComponents
 * @property-read int|null $period_components_count
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentComponentTemplate newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentComponentTemplate newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentComponentTemplate query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentComponentTemplate whereCode($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentComponentTemplate whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentComponentTemplate whereCreatedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentComponentTemplate whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentComponentTemplate whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentComponentTemplate whereIsActive($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentComponentTemplate whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentComponentTemplate whereSortOrder($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentComponentTemplate whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentComponentTemplate whereWeight($value)
 */
	class AssessmentComponentTemplate extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property int|null $component_id
 * @property int $evaluator_id
 * @property int $group_id
 * @property int|null $student_id
 * @property numeric $score
 * @property string|null $notes
 * @property string $evaluation_type
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property int|null $period_component_id
 * @property-read \App\Models\AssessmentComponent|null $component
 * @property-read \App\Models\User $evaluator
 * @property-read \App\Models\Group $group
 * @property-read \App\Models\PeriodAssessmentComponent|null $periodComponent
 * @property-read \App\Models\User|null $student
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentScore newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentScore newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentScore query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentScore whereComponentId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentScore whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentScore whereEvaluationType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentScore whereEvaluatorId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentScore whereGroupId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentScore whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentScore whereNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentScore wherePeriodComponentId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentScore whereScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentScore whereStudentId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AssessmentScore whereUpdatedAt($value)
 */
	class AssessmentScore extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property int|null $user_id
 * @property string $action
 * @property string $target_type
 * @property int $target_id
 * @property array<array-key, mixed>|null $payload
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User|null $user
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AuditLog newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AuditLog newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AuditLog query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AuditLog whereAction($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AuditLog whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AuditLog whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AuditLog wherePayload($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AuditLog whereTargetId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AuditLog whereTargetType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AuditLog whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AuditLog whereUserId($value)
 */
	class AuditLog extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property int $group_id
 * @property int $title_id
 * @property int $priority
 * @property string $status
 * @property string|null $lecturer_recommendation
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property int|null $proposed_supervisor_1_id
 * @property int|null $proposed_supervisor_2_id
 * @property-read \App\Models\Group $group
 * @property-read \App\Models\User|null $proposedSupervisor1
 * @property-read \App\Models\User|null $proposedSupervisor2
 * @property-read \App\Models\Title $title
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Bid newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Bid newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Bid query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Bid whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Bid whereGroupId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Bid whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Bid whereLecturerRecommendation($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Bid wherePriority($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Bid whereProposedSupervisor1Id($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Bid whereProposedSupervisor2Id($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Bid whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Bid whereTitleId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Bid whereUpdatedAt($value)
 */
	class Bid extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property int $user_id
 * @property string $document_reference
 * @property string $document_type
 * @property string $signature_data
 * @property string $hash
 * @property \Illuminate\Support\Carbon $signed_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $user
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DigitalSignature newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DigitalSignature newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DigitalSignature query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DigitalSignature whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DigitalSignature whereDocumentReference($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DigitalSignature whereDocumentType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DigitalSignature whereHash($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DigitalSignature whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DigitalSignature whereSignatureData($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DigitalSignature whereSignedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DigitalSignature whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DigitalSignature whereUserId($value)
 */
	class DigitalSignature extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property int $group_id
 * @property int|null $student_id
 * @property string $phase
 * @property string $file_path
 * @property int $version
 * @property string $status
 * @property string|null $feedback
 * @property int|null $reviewed_by
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property string $document_type
 * @property-read \App\Models\Group $group
 * @property-read \App\Models\User|null $reviewer
 * @property-read \App\Models\User|null $student
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Document newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Document newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Document query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Document whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Document whereDocumentType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Document whereFeedback($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Document whereFilePath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Document whereGroupId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Document whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Document wherePhase($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Document whereReviewedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Document whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Document whereStudentId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Document whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Document whereVersion($value)
 */
	class Document extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property string $name
 * @property string|null $description
 * @property string|null $phase
 * @property bool $is_active
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DocumentType newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DocumentType newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DocumentType query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DocumentType whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DocumentType whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DocumentType whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DocumentType whereIsActive($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DocumentType whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DocumentType wherePhase($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DocumentType whereUpdatedAt($value)
 */
	class DocumentType extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property int $evaluator_id
 * @property int $group_id
 * @property int|null $student_id
 * @property string $type
 * @property numeric $score
 * @property string|null $feedback
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $evaluator
 * @property-read \App\Models\Group $group
 * @property-read \App\Models\User|null $student
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Evaluation newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Evaluation newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Evaluation query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Evaluation whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Evaluation whereEvaluatorId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Evaluation whereFeedback($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Evaluation whereGroupId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Evaluation whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Evaluation whereScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Evaluation whereStudentId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Evaluation whereType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Evaluation whereUpdatedAt($value)
 */
	class Evaluation extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property int $period_id
 * @property string $name
 * @property \Illuminate\Support\Carbon $date
 * @property string $start_time
 * @property string $end_time
 * @property string $room
 * @property int $capacity
 * @property bool $is_published
 * @property int $created_by
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $creator
 * @property-read int $registered_count
 * @property-read \App\Models\Period|null $period
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\ExpoRegistration> $registrations
 * @property-read int|null $registrations_count
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExpoEvent newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExpoEvent newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExpoEvent onlyTrashed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExpoEvent query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExpoEvent whereCapacity($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExpoEvent whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExpoEvent whereCreatedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExpoEvent whereDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExpoEvent whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExpoEvent whereEndTime($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExpoEvent whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExpoEvent whereIsPublished($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExpoEvent whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExpoEvent wherePeriodId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExpoEvent whereRoom($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExpoEvent whereStartTime($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExpoEvent whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExpoEvent withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExpoEvent withoutTrashed()
 */
	class ExpoEvent extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property int $expo_event_id
 * @property int $group_id
 * @property \Illuminate\Support\Carbon $registered_at
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\ExpoEvent|null $expoEvent
 * @property-read \App\Models\Group $group
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExpoRegistration newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExpoRegistration newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExpoRegistration query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExpoRegistration whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExpoRegistration whereExpoEventId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExpoRegistration whereGroupId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExpoRegistration whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExpoRegistration whereRegisteredAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExpoRegistration whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExpoRegistration whereUpdatedAt($value)
 */
	class ExpoRegistration extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property int $period_id
 * @property int $group_id
 * @property int $user_id
 * @property string $action
 * @property array<array-key, mixed>|null $old_values
 * @property array<array-key, mixed>|null $new_values
 * @property string|null $notes
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Group $group
 * @property-read \App\Models\Period|null $period
 * @property-read \App\Models\User $user
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinalizationAudit newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinalizationAudit newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinalizationAudit query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinalizationAudit whereAction($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinalizationAudit whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinalizationAudit whereGroupId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinalizationAudit whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinalizationAudit whereNewValues($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinalizationAudit whereNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinalizationAudit whereOldValues($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinalizationAudit wherePeriodId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinalizationAudit whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinalizationAudit whereUserId($value)
 */
	class FinalizationAudit extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property int $group_id
 * @property int|null $student_id
 * @property numeric|null $pdc1_score
 * @property numeric|null $pdc2_score
 * @property numeric|null $deviation
 * @property string $status
 * @property string|null $notes
 * @property int|null $checked_by
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User|null $checker
 * @property-read \App\Models\Group $group
 * @property-read \App\Models\User|null $student
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GradeConsistencyCheck newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GradeConsistencyCheck newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GradeConsistencyCheck query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GradeConsistencyCheck whereCheckedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GradeConsistencyCheck whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GradeConsistencyCheck whereDeviation($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GradeConsistencyCheck whereGroupId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GradeConsistencyCheck whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GradeConsistencyCheck whereNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GradeConsistencyCheck wherePdc1Score($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GradeConsistencyCheck wherePdc2Score($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GradeConsistencyCheck whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GradeConsistencyCheck whereStudentId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GradeConsistencyCheck whereUpdatedAt($value)
 */
	class GradeConsistencyCheck extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property int $period_id
 * @property string $status
 * @property string $group_mode
 * @property int|null $title_id
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property string|null $assignment_type
 * @property int|null $supervisor_1_id
 * @property int|null $supervisor_2_id
 * @property bool $has_existing_group
 * @property array<array-key, mixed>|null $readiness_status
 * @property bool $has_active_proposal
 * @property bool $is_solo
 * @property string|null $finalization_notes
 * @property string|null $finalized_at
 * @property int|null $finalized_by
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\GroupMember> $activeMembers
 * @property-read int|null $active_members_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\TitleApprovalAudit> $approvalAudits
 * @property-read int|null $approval_audits_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Bid> $bids
 * @property-read int|null $bids_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Document> $documents
 * @property-read int|null $documents_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Evaluation> $evaluations
 * @property-read int|null $evaluations_count
 * @property-read \App\Models\User|null $finalizedBy
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\GroupMember> $members
 * @property-read int|null $members_count
 * @property-read \App\Models\Period|null $period
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Schedule> $schedules
 * @property-read int|null $schedules_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SeminarSchedule> $seminarSchedules
 * @property-read int|null $seminar_schedules_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\User> $students
 * @property-read int|null $students_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Supervision> $supervisions
 * @property-read int|null $supervisions_count
 * @property-read \App\Models\User|null $supervisor1
 * @property-read \App\Models\User|null $supervisor2
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\GroupSupervisorProposal> $supervisorProposals
 * @property-read int|null $supervisor_proposals_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\User> $supervisors
 * @property-read int|null $supervisors_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\TaDefenseSchedule> $taDefenseSchedules
 * @property-read int|null $ta_defense_schedules_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\TaSubmission> $taSubmissions
 * @property-read int|null $ta_submissions_count
 * @property-read \App\Models\Title|null $title
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Group finalized()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Group kelompokFinal()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Group newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Group newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Group query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Group readyForFinalization()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Group whereAssignmentType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Group whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Group whereFinalizationNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Group whereFinalizedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Group whereFinalizedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Group whereGroupMode($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Group whereHasActiveProposal($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Group whereHasExistingGroup($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Group whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Group whereIsSolo($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Group wherePeriodId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Group whereReadinessStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Group whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Group whereSupervisor1Id($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Group whereSupervisor2Id($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Group whereTitleId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Group whereUpdatedAt($value)
 */
	class Group extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property int $group_id
 * @property int $student_id
 * @property int $inviter_id
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Group $group
 * @property-read \App\Models\User $inviter
 * @property-read \App\Models\User $student
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupInvitation newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupInvitation newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupInvitation query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupInvitation whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupInvitation whereGroupId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupInvitation whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupInvitation whereInviterId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupInvitation whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupInvitation whereStudentId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupInvitation whereUpdatedAt($value)
 */
	class GroupInvitation extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property int $group_id
 * @property int $student_id
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property bool $is_leader
 * @property int|null $period_id
 * @property-read \App\Models\Group $group
 * @property-read \App\Models\User $student
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupMember newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupMember newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupMember query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupMember whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupMember whereGroupId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupMember whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupMember whereIsLeader($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupMember wherePeriodId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupMember whereStudentId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupMember whereUpdatedAt($value)
 */
	class GroupMember extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property int $group_id
 * @property int $proposed_supervisor_1_id
 * @property int|null $proposed_supervisor_2_id
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Group $group
 * @property-read \App\Models\User $supervisor1
 * @property-read \App\Models\User|null $supervisor2
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupSupervisorProposal newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupSupervisorProposal newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupSupervisorProposal query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupSupervisorProposal whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupSupervisorProposal whereGroupId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupSupervisorProposal whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupSupervisorProposal whereProposedSupervisor1Id($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupSupervisorProposal whereProposedSupervisor2Id($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupSupervisorProposal whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupSupervisorProposal whereUpdatedAt($value)
 */
	class GroupSupervisorProposal extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property int $group_id
 * @property int $requester_id
 * @property string $status
 * @property string|null $message
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Group $group
 * @property-read \App\Models\User $requester
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JoinRequest newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JoinRequest newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JoinRequest query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JoinRequest whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JoinRequest whereGroupId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JoinRequest whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JoinRequest whereMessage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JoinRequest whereRequesterId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JoinRequest whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JoinRequest whereUpdatedAt($value)
 */
	class JoinRequest extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property int $user_id
 * @property string $type
 * @property string $title
 * @property string $message
 * @property string|null $related_type
 * @property int|null $related_id
 * @property bool $is_read
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $user
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Notification newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Notification newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Notification query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Notification unread()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Notification whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Notification whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Notification whereIsRead($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Notification whereMessage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Notification whereRelatedId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Notification whereRelatedType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Notification whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Notification whereType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Notification whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Notification whereUserId($value)
 */
	class Notification extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property int $group_id
 * @property int $reviewer_id
 * @property int $reviewee_id
 * @property int|null $indicator_id
 * @property numeric $score
 * @property string|null $comment
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property int|null $period_indicator_id
 * @property bool $is_final_submission
 * @property string|null $submitted_at
 * @property int|null $raw_score
 * @property-read \App\Models\Group $group
 * @property-read \App\Models\PeerReviewIndicator|null $indicator
 * @property-read \App\Models\PeriodPeerReviewIndicator|null $periodIndicator
 * @property-read \App\Models\User $reviewee
 * @property-read \App\Models\User $reviewer
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReview newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReview newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReview query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReview whereComment($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReview whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReview whereGroupId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReview whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReview whereIndicatorId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReview whereIsFinalSubmission($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReview wherePeriodIndicatorId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReview whereRawScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReview whereRevieweeId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReview whereReviewerId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReview whereScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReview whereSubmittedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReview whereUpdatedAt($value)
 */
	class PeerReview extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property int $period_id
 * @property string $name
 * @property string|null $description
 * @property numeric $weight
 * @property int $sort_order
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Period|null $period
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\PeerReview> $reviews
 * @property-read int|null $reviews_count
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReviewIndicator newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReviewIndicator newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReviewIndicator query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReviewIndicator whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReviewIndicator whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReviewIndicator whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReviewIndicator whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReviewIndicator wherePeriodId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReviewIndicator whereSortOrder($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReviewIndicator whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReviewIndicator whereWeight($value)
 */
	class PeerReviewIndicator extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property string $name
 * @property string|null $description
 * @property numeric $weight
 * @property bool $is_active
 * @property int|null $created_by
 * @property int $sort_order
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User|null $creator
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\PeriodPeerReviewIndicator> $periodIndicators
 * @property-read int|null $period_indicators_count
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReviewIndicatorTemplate newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReviewIndicatorTemplate newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReviewIndicatorTemplate query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReviewIndicatorTemplate whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReviewIndicatorTemplate whereCreatedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReviewIndicatorTemplate whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReviewIndicatorTemplate whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReviewIndicatorTemplate whereIsActive($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReviewIndicatorTemplate whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReviewIndicatorTemplate whereSortOrder($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReviewIndicatorTemplate whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeerReviewIndicatorTemplate whereWeight($value)
 */
	class PeerReviewIndicatorTemplate extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property string $name
 * @property \Illuminate\Support\Carbon $start_date
 * @property \Illuminate\Support\Carbon $end_date
 * @property array<array-key, mixed>|null $phase_dates
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property bool $is_active
 * @property \Illuminate\Support\Carbon|null $bidding_start
 * @property \Illuminate\Support\Carbon|null $bidding_end
 * @property \Illuminate\Support\Carbon|null $pdc1_start
 * @property \Illuminate\Support\Carbon|null $pdc1_end
 * @property \Illuminate\Support\Carbon|null $pdc2_start
 * @property \Illuminate\Support\Carbon|null $pdc2_end
 * @property \Illuminate\Support\Carbon|null $expo_date
 * @property \Illuminate\Support\Carbon|null $ta_start
 * @property \Illuminate\Support\Carbon|null $ta_end
 * @property int $min_group_size
 * @property int $max_group_size
 * @property int $max_supervise_load
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property bool $is_finalized
 * @property bool $require_all_students_grouped
 * @property bool $allow_solo
 * @property int|null $max_supervisor_load
 * @property \Illuminate\Support\Carbon|null $bidding_reminder_at
 * @property \Illuminate\Support\Carbon|null $pdc1_reminder_at
 * @property \Illuminate\Support\Carbon|null $pdc2_reminder_at
 * @property \Illuminate\Support\Carbon|null $expo_reminder_at
 * @property \Illuminate\Support\Carbon|null $ta_reminder_at
 * @property array<array-key, mixed>|null $grade_configuration
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\PeriodAssessmentComponent> $assessmentComponents
 * @property-read int|null $assessment_components_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Group> $groups
 * @property-read int|null $groups_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\PeriodPeerReviewIndicator> $peerReviewIndicators
 * @property-read int|null $peer_review_indicators_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\User> $registeredStudents
 * @property-read int|null $registered_students_count
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period onlyTrashed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period whereAllowSolo($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period whereBiddingEnd($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period whereBiddingReminderAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period whereBiddingStart($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period whereEndDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period whereExpoDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period whereExpoReminderAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period whereGradeConfiguration($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period whereIsActive($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period whereIsFinalized($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period whereMaxGroupSize($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period whereMaxSuperviseLoad($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period whereMaxSupervisorLoad($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period whereMinGroupSize($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period wherePdc1End($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period wherePdc1ReminderAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period wherePdc1Start($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period wherePdc2End($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period wherePdc2ReminderAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period wherePdc2Start($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period wherePhaseDates($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period whereRequireAllStudentsGrouped($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period whereStartDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period whereTaEnd($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period whereTaReminderAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period whereTaStart($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Period withoutTrashed()
 */
	class Period extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property int $period_id
 * @property int $template_id
 * @property string $type
 * @property int $sort_order
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read mixed $full_component
 * @property-read \App\Models\Period|null $period
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\AssessmentScore> $scores
 * @property-read int|null $scores_count
 * @property-read \App\Models\AssessmentComponentTemplate $template
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeriodAssessmentComponent newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeriodAssessmentComponent newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeriodAssessmentComponent query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeriodAssessmentComponent whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeriodAssessmentComponent whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeriodAssessmentComponent wherePeriodId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeriodAssessmentComponent whereSortOrder($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeriodAssessmentComponent whereTemplateId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeriodAssessmentComponent whereType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeriodAssessmentComponent whereUpdatedAt($value)
 */
	class PeriodAssessmentComponent extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property int $period_id
 * @property int $sort_order
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property int|null $template_id
 * @property-read mixed $full_indicator
 * @property-read \App\Models\Period|null $period
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\PeerReview> $reviews
 * @property-read int|null $reviews_count
 * @property-read \App\Models\AssessmentComponentTemplate|null $template
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeriodPeerReviewIndicator newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeriodPeerReviewIndicator newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeriodPeerReviewIndicator query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeriodPeerReviewIndicator whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeriodPeerReviewIndicator whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeriodPeerReviewIndicator wherePeriodId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeriodPeerReviewIndicator whereSortOrder($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeriodPeerReviewIndicator whereTemplateId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeriodPeerReviewIndicator whereUpdatedAt($value)
 */
	class PeriodPeerReviewIndicator extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property int $user_id
 * @property int $period_id
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Period|null $period
 * @property-read \App\Models\User $user
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeriodRegistration newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeriodRegistration newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeriodRegistration query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeriodRegistration whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeriodRegistration whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeriodRegistration wherePeriodId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeriodRegistration whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PeriodRegistration whereUserId($value)
 */
	class PeriodRegistration extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property int $period_id
 * @property string $phase
 * @property string $name
 * @property string|null $description
 * @property bool $is_required
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Period|null $period
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PhaseDocumentRequirement newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PhaseDocumentRequirement newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PhaseDocumentRequirement query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PhaseDocumentRequirement whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PhaseDocumentRequirement whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PhaseDocumentRequirement whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PhaseDocumentRequirement whereIsRequired($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PhaseDocumentRequirement whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PhaseDocumentRequirement wherePeriodId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PhaseDocumentRequirement wherePhase($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PhaseDocumentRequirement whereUpdatedAt($value)
 */
	class PhaseDocumentRequirement extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property string $name
 * @property string $slug
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\User> $users
 * @property-read int|null $users_count
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Role newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Role newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Role query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Role whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Role whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Role whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Role whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Role whereUpdatedAt($value)
 */
	class Role extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property int $group_id
 * @property string $type
 * @property \Illuminate\Support\Carbon $date
 * @property string $room
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property string|null $mode
 * @property string|null $notes
 * @property string|null $evaluation_deadline Deadline untuk pengisian nilai oleh examiner/dosbing
 * @property-read \App\Models\Group $group
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Schedule newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Schedule newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Schedule query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Schedule whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Schedule whereDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Schedule whereEvaluationDeadline($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Schedule whereGroupId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Schedule whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Schedule whereMode($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Schedule whereNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Schedule whereRoom($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Schedule whereType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Schedule whereUpdatedAt($value)
 */
	class Schedule extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property int $schedule_id
 * @property int $examiner_id
 * @property array<array-key, mixed>|null $rubric_json
 * @property numeric|null $score
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $examiner
 * @property-read \App\Models\SeminarSchedule $schedule
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SeminarEvaluation newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SeminarEvaluation newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SeminarEvaluation query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SeminarEvaluation whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SeminarEvaluation whereExaminerId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SeminarEvaluation whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SeminarEvaluation whereRubricJson($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SeminarEvaluation whereScheduleId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SeminarEvaluation whereScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SeminarEvaluation whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SeminarEvaluation whereUpdatedAt($value)
 */
	class SeminarEvaluation extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property int $group_id
 * @property string $type
 * @property \Illuminate\Support\Carbon $date
 * @property string $start_time
 * @property string $end_time
 * @property string|null $room
 * @property int|null $examiner_1_id
 * @property int|null $examiner_2_id
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property int|null $requested_by
 * @property string|null $rejection_reason
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SeminarEvaluation> $evaluations
 * @property-read int|null $evaluations_count
 * @property-read \App\Models\User|null $examiner1
 * @property-read \App\Models\User|null $examiner2
 * @property-read \App\Models\Group $group
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SeminarSchedule newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SeminarSchedule newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SeminarSchedule query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SeminarSchedule whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SeminarSchedule whereDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SeminarSchedule whereEndTime($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SeminarSchedule whereExaminer1Id($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SeminarSchedule whereExaminer2Id($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SeminarSchedule whereGroupId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SeminarSchedule whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SeminarSchedule whereRejectionReason($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SeminarSchedule whereRequestedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SeminarSchedule whereRoom($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SeminarSchedule whereStartTime($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SeminarSchedule whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SeminarSchedule whereType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SeminarSchedule whereUpdatedAt($value)
 */
	class SeminarSchedule extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property string $name
 * @property string|null $organization
 * @property string|null $email
 * @property string|null $phone
 * @property string $type
 * @property string|null $notes
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Title> $titles
 * @property-read int|null $titles_count
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Stakeholder newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Stakeholder newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Stakeholder query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Stakeholder whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Stakeholder whereEmail($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Stakeholder whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Stakeholder whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Stakeholder whereNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Stakeholder whereOrganization($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Stakeholder wherePhone($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Stakeholder whereType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Stakeholder whereUpdatedAt($value)
 */
	class Stakeholder extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property int $student_id
 * @property int $group_id
 * @property int $period_id
 * @property bool $has_completed_peer_review
 * @property string $ta_status
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Group $group
 * @property-read \App\Models\Period|null $period
 * @property-read \App\Models\User $student
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentPeerReviewStatus active()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentPeerReviewStatus blocked()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentPeerReviewStatus completed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentPeerReviewStatus newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentPeerReviewStatus newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentPeerReviewStatus query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentPeerReviewStatus whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentPeerReviewStatus whereGroupId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentPeerReviewStatus whereHasCompletedPeerReview($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentPeerReviewStatus whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentPeerReviewStatus wherePeriodId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentPeerReviewStatus whereStudentId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentPeerReviewStatus whereTaStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentPeerReviewStatus whereUpdatedAt($value)
 */
	class StudentPeerReviewStatus extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property int $group_id
 * @property int $supervisor_id
 * @property string $role
 * @property int $assigned_by
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $assignedBy
 * @property-read \App\Models\Group $group
 * @property-read \App\Models\User $supervisor
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Supervision newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Supervision newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Supervision query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Supervision whereAssignedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Supervision whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Supervision whereGroupId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Supervision whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Supervision whereRole($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Supervision whereSupervisorId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Supervision whereUpdatedAt($value)
 */
	class Supervision extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property int $schedule_id
 * @property int $examiner_id
 * @property array<array-key, mixed>|null $rubric_json
 * @property numeric|null $score
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property int $student_id
 * @property-read \App\Models\User $examiner
 * @property-read \App\Models\TaDefenseSchedule $schedule
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseEvaluation newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseEvaluation newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseEvaluation query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseEvaluation whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseEvaluation whereExaminerId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseEvaluation whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseEvaluation whereRubricJson($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseEvaluation whereScheduleId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseEvaluation whereScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseEvaluation whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseEvaluation whereStudentId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseEvaluation whereUpdatedAt($value)
 */
	class TaDefenseEvaluation extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property int $schedule_id
 * @property int $examiner_id
 * @property string $role
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $examiner
 * @property-read \App\Models\TaDefenseSchedule $schedule
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseExaminer newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseExaminer newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseExaminer query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseExaminer whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseExaminer whereExaminerId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseExaminer whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseExaminer whereRole($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseExaminer whereScheduleId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseExaminer whereUpdatedAt($value)
 */
	class TaDefenseExaminer extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property int $student_id
 * @property int $group_id
 * @property \Illuminate\Support\Carbon $date
 * @property string $start_time
 * @property string $end_time
 * @property string|null $room
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property int|null $requested_by
 * @property string|null $rejection_reason
 * @property int $period_id
 * @property int $examiner_1_id
 * @property int $examiner_2_id
 * @property \Illuminate\Support\Carbon|null $evaluation_deadline
 * @property string|null $notes
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\TaDefenseEvaluation> $evaluations
 * @property-read int|null $evaluations_count
 * @property-read \App\Models\User $examiner1
 * @property-read \App\Models\User $examiner2
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\TaDefenseExaminer> $examiners
 * @property-read int|null $examiners_count
 * @property-read \App\Models\Group $group
 * @property-read \App\Models\Period|null $period
 * @property-read \App\Models\User $student
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseSchedule done()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseSchedule newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseSchedule newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseSchedule query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseSchedule scheduled()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseSchedule whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseSchedule whereDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseSchedule whereEndTime($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseSchedule whereEvaluationDeadline($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseSchedule whereExaminer1Id($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseSchedule whereExaminer2Id($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseSchedule whereGroupId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseSchedule whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseSchedule whereNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseSchedule wherePeriodId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseSchedule whereRejectionReason($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseSchedule whereRequestedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseSchedule whereRoom($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseSchedule whereStartTime($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseSchedule whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseSchedule whereStudentId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaDefenseSchedule whereUpdatedAt($value)
 */
	class TaDefenseSchedule extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property int $student_id
 * @property int $group_id
 * @property string $status
 * @property string|null $file_path
 * @property string|null $feedback
 * @property int|null $reviewed_by
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property string|null $draft_report_path
 * @property string|null $paper_path
 * @property string|null $publication_link
 * @property int $period_id
 * @property-read \App\Models\Group $group
 * @property-read \App\Models\User|null $reviewer
 * @property-read \App\Models\User $student
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaSubmission newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaSubmission newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaSubmission query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaSubmission whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaSubmission whereDraftReportPath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaSubmission whereFeedback($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaSubmission whereFilePath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaSubmission whereGroupId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaSubmission whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaSubmission wherePaperPath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaSubmission wherePeriodId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaSubmission wherePublicationLink($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaSubmission whereReviewedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaSubmission whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaSubmission whereStudentId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaSubmission whereUpdatedAt($value)
 */
	class TaSubmission extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property string $supervisor_approval_status
 * @property int|null $proposed_supervisor_id
 * @property int $lecturer_id
 * @property string $title
 * @property int $quota
 * @property string $status
 * @property bool $approved_by_admin
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property string|null $description
 * @property string $title_source
 * @property int|null $proposed_by_group_id
 * @property string|null $rejection_reason
 * @property string|null $problem_statement
 * @property string|null $scope
 * @property array<array-key, mixed>|null $specializations
 * @property int|null $period_id
 * @property int|null $pre_assigned_group_id
 * @property bool $is_reserved
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\TitleApprovalAudit> $approvalAudits
 * @property-read int|null $approval_audits_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Bid> $bids
 * @property-read int|null $bids_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Group> $groups
 * @property-read int|null $groups_count
 * @property-read \App\Models\User $lecturer
 * @property-read \App\Models\Period|null $period
 * @property-read \App\Models\Group|null $proposedByGroup
 * @property-read \App\Models\User|null $proposedSupervisor
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Stakeholder> $stakeholders
 * @property-read int|null $stakeholders_count
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Title newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Title newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Title query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Title whereApprovedByAdmin($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Title whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Title whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Title whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Title whereIsReserved($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Title whereLecturerId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Title wherePeriodId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Title wherePreAssignedGroupId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Title whereProblemStatement($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Title whereProposedByGroupId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Title whereProposedSupervisorId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Title whereQuota($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Title whereRejectionReason($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Title whereScope($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Title whereSpecializations($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Title whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Title whereSupervisorApprovalStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Title whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Title whereTitleSource($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Title whereUpdatedAt($value)
 */
	class Title extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property int $title_id
 * @property int $lecturer_id
 * @property int|null $affected_group_id
 * @property string $action
 * @property string|null $reason
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Group|null $affectedGroup
 * @property-read \App\Models\User $lecturer
 * @property-read \App\Models\Title $title
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TitleApprovalAudit newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TitleApprovalAudit newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TitleApprovalAudit query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TitleApprovalAudit whereAction($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TitleApprovalAudit whereAffectedGroupId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TitleApprovalAudit whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TitleApprovalAudit whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TitleApprovalAudit whereLecturerId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TitleApprovalAudit whereReason($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TitleApprovalAudit whereTitleId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TitleApprovalAudit whereUpdatedAt($value)
 */
	class TitleApprovalAudit extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property string $role
 * @property string $name
 * @property string $email
 * @property \Illuminate\Support\Carbon|null $email_verified_at
 * @property string $password
 * @property string|null $remember_token
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property string|null $nip
 * @property string|null $nim
 * @property bool $is_active
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\GroupMember> $groupMemberships
 * @property-read int|null $group_memberships_count
 * @property-read \Illuminate\Notifications\DatabaseNotificationCollection<int, \Illuminate\Notifications\DatabaseNotification> $notifications
 * @property-read int|null $notifications_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Period> $registeredPeriods
 * @property-read int|null $registered_periods_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Role> $roles
 * @property-read int|null $roles_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Group> $supervisedGroups
 * @property-read int|null $supervised_groups_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Supervision> $supervisions
 * @property-read int|null $supervisions_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\TaSubmission> $taSubmissions
 * @property-read int|null $ta_submissions_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \Laravel\Sanctum\PersonalAccessToken> $tokens
 * @property-read int|null $tokens_count
 * @method static \Database\Factories\UserFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereEmail($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereEmailVerifiedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereIsActive($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereNim($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereNip($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User wherePassword($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereRememberToken($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereRole($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereUpdatedAt($value)
 */
	class User extends \Eloquent {}
}

