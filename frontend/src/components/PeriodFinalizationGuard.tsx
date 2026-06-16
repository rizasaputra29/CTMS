'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Loading } from '@/components/ui/loading';
import { toast } from 'sonner';

interface RegisteredPeriod {
  id: number;
  name: string;
  is_active: boolean;
  is_finalized: boolean;
}

interface PeriodFinalizationGuardProps {
  children: React.ReactNode;
}

export default function PeriodFinalizationGuard({ children }: PeriodFinalizationGuardProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    const checkPeriodFinalization = async () => {
      try {
        const response = await api.get('/mahasiswa/my-period');
        const periodData: RegisteredPeriod | null = response.data?.period || null;

        if (!periodData || !periodData.is_finalized) {
          // Period not finalized or no registration - redirect to dashboard
          toast.error('Akses ditolak. Menu ini tersedia setelah periode di-finalisasi.');
          router.replace('/mahasiswa/dashboard');
          return;
        }

        setIsAllowed(true);
      } catch (error) {
        // On any error (401, 404, etc.), redirect to dashboard as safe fallback
        toast.error('Akses ditolak. Menu ini tersedia setelah periode di-finalisasi.');
        router.replace('/mahasiswa/dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    checkPeriodFinalization();
  }, [router]);

  if (isLoading) {
    return <Loading variant="section" />;
  }

  if (!isAllowed) {
    return null; // Will redirect, don't render anything
  }

  return <>{children}</>;
}
