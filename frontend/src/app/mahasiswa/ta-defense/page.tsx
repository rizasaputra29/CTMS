'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PeriodFinalizationGuard from '@/components/PeriodFinalizationGuard';

function TaDefenseRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/mahasiswa/ta-submission');
  }, [router]);

  return null;
}

export default function TaDefensePage() {
  return (
    <PeriodFinalizationGuard>
      <TaDefenseRedirect />
    </PeriodFinalizationGuard>
  );
}
