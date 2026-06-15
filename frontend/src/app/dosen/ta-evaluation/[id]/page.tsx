'use client';

import { useParams } from 'next/navigation';
import { TaEvaluationFeature } from '@/features/dosen/ta-evaluation/components/TaEvaluationFeature';

export default function TaEvaluationPage() {
    const { id } = useParams<{ id: string }>();

    return <TaEvaluationFeature scheduleId={id} />;
}
