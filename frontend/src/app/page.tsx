'use client';

import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { HeroSection } from '@/components/home/HeroSection';
import { CapstoneSection } from '@/components/home/CapstoneSection';
import { TugasAkhirSection } from '@/components/home/TugasAkhirSection';
import { SiklusSection } from '@/components/home/SiklusSection';
import { CTASection } from '@/components/home/CTASection';
import { Footer } from '@/components/layout/Footer';
import CombinedDashboard from '@/components/dashboard/CombinedDashboard';

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // Redirect single-role users to their role dashboard
  useEffect(() => {
    if (isLoading) return;
    if (user) {
      const roles = user.roles || [user.role || 'mahasiswa'];
      const isAdmin = roles.includes('admin');
      const isDosen = roles.includes('dosen');

      if (!(isAdmin && isDosen)) {
        // Single role user - redirect to their dashboard
        const targetRole = roles[0] || 'mahasiswa';
        router.replace(`/${targetRole}/dashboard`);
      }
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Multi-role user (admin + dosen) → show combined dashboard
  if (user) {
    return <CombinedDashboard />;
  }

  // Unauthenticated → show landing page
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
