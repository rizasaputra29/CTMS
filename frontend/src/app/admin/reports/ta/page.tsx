'use client';

import { use } from 'react';
import PhaseReportPage from '../components/PhaseReportPage';

export default function TaReportPage({
    searchParams,
}: {
    searchParams: Promise<{ period_id?: string }>;
}) {
    const params = use(searchParams);
    return <PhaseReportPage phase="ta" periodId={params.period_id} />;
}
