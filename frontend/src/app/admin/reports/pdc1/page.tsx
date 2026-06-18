'use client';

import { useSearchParams } from 'next/navigation';
import PhaseReportPage from '../components/PhaseReportPage';

export default function Pdc1ReportPage() {
    const searchParams = useSearchParams();
    return <PhaseReportPage phase="pdc1" periodId={searchParams.get('period_id') || undefined} />;
}
