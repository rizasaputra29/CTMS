'use client';

import { useSearchParams } from 'next/navigation';
import PhaseReportPage from '../components/PhaseReportPage';

export default function Pdc2ReportPage() {
    const searchParams = useSearchParams();
    return <PhaseReportPage phase="pdc2" periodId={searchParams.get('period_id') || undefined} />;
}
