'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TaDefenseRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/mahasiswa/ta-submission');
  }, [router]);

  return null;
}
