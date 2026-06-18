'use client';

import { use } from 'react';
import PhaseReportPage from '../components/PhaseReportPage';

export default function Pdc2ReportPage({
    searchParams,
}: {
    searchParams: Promise<{ period_id?: string }>;
}) {
    const params = use(searchParams);
    return <PhaseReportPage phase="pdc2" periodId={params.period_id} />;
}
