'use client';

import dynamic from 'next/dynamic';

const ReportsDashboard = dynamic(() => import('./components/ReportsDashboard'), { ssr: false });

export default function AdminReportsPage() {
    return <ReportsDashboard />;
}
