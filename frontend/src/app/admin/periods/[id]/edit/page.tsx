'use client';

import dynamic from 'next/dynamic';

const EditPeriodClient = dynamic(() => import('./components/EditPeriodClient'), { ssr: false });

export default function EditPeriodPage() {
    return <EditPeriodClient />;
}
