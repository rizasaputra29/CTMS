'use client';

import dynamic from 'next/dynamic';

const FinalizationFeature = dynamic(
    () => import('@/features/admin/finalization').then((m) => ({ default: m.FinalizationFeature })),
    { ssr: false }
);

export default function FinalizationPage() {
    return <FinalizationFeature />;
}
