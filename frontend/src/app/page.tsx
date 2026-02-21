"use client";

import { Navbar } from "@/components/layout/Navbar";
import { HeroSection } from "@/components/home/HeroSection";
import { CapstoneSection } from "@/components/home/CapstoneSection";
import { TugasAkhirSection } from "@/components/home/TugasAkhirSection";
import { SiklusSection } from "@/components/home/SiklusSection";
import { CTASection } from "@/components/home/CTASection";
import { Footer } from "@/components/layout/Footer";

export default function Home() {
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






