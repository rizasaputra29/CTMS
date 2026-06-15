'use client';

import { EvaluationSummaryFeature } from '@/features/admin/evaluation-summary';
import { useStringParam } from '@/hooks/use-params';

export default function EvaluationSummaryPage() {
    const scheduleId = useStringParam('scheduleId');
    return <EvaluationSummaryFeature scheduleId={scheduleId || ''} />;
}
