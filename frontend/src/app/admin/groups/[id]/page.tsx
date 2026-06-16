'use client';

import dynamic from 'next/dynamic';

const GroupDetailClient = dynamic(() => import('./components/GroupDetailClient'), { ssr: false });

export default function GroupDetailPage() {
    return <GroupDetailClient />;
}
