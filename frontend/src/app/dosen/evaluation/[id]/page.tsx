'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { EvaluationDetailFeature } from '@/features/dosen/evaluation-detail';

export default function DosenEvaluationDetailPage() {
    const params = useParams();
    const searchParams = useSearchParams();

    return (
        <EvaluationDetailFeature
            evaluationId={Number(params.id)}
            evaluationType={searchParams.get('type') || undefined}
            scheduleId={searchParams.get('schedule_id') ? Number(searchParams.get('schedule_id')) : undefined}
        />
    );
}
