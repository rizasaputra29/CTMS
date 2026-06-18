'use client';

import { useSearchParams } from 'next/navigation';
import PhaseReportPage from '../components/PhaseReportPage';

export default function TaReportPage() {
    const searchParams = useSearchParams();
    return <PhaseReportPage phase="ta" periodId={searchParams.get('period_id') || undefined} />;
}
