'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { HeroSection } from '@/components/home/HeroSection';
import { CapstoneSection } from '@/components/home/CapstoneSection';
import { TugasAkhirSection } from '@/components/home/TugasAkhirSection';
import { SiklusSection } from '@/components/home/SiklusSection';
import { CTASection } from '@/components/home/CTASection';
import { Footer } from '@/components/layout/Footer';

const CombinedDashboard = dynamic(() => import('@/components/dashboard/CombinedDashboard'), { ssr: false });

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const redirected = useRef(false);

  useEffect(() => {
    if (isLoading || redirected.current) return;
    if (user) {
      const roles = user.roles || [user.role || 'mahasiswa'];

      if (!(roles.includes('admin') && roles.includes('dosen'))) {
        const targetRole = roles[0] || 'mahasiswa';
        redirected.current = true;
        router.replace(`/${targetRole}/dashboard`);
      }
    }
  }, [user, isLoading, router]);

  // Multi-role user (admin + dosen) → show combined dashboard
  if (user) {
    return <CombinedDashboard />;
  }

  // Unauthenticated → render landing immediately (no loading spinner)
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black font-sans">
      <Navbar />
      <HeroSection />
      <main className="relative z-10 bg-white dark:bg-black flex flex-col">
        <CapstoneSection />
        <TugasAkhirSection />
        <SiklusSection />
        <CTASection />
        <Footer />
      </main>
    </div>
  );
}
