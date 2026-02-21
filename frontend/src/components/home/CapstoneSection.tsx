"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const capstoneSteps = [
  {
    id: "01",
    code: "REG",
    title: "Pendaftaran & Pembentukan Kelompok",
    description: "Mahasiswa yang memenuhi syarat (min. 110 SKS) mendaftar dan membentuk kelompok beranggotakan 3 orang.",
    details: [
      "Syarat: Lulus Matkul Wajib Tahun 1-2",
      "Bentuk Tim 3 Orang",
      "Registrasi Awal"
    ]
  },
  {
    id: "02",
    code: "TOPIC",
    title: "Penentuan Topik & Judul",
    description: "Kelompok memilih topik sesuai roadmap penelitian (Smart System, IoT, dll) untuk menyelesaikan masalah nyata.",
    details: [
      "Pilih Topik Roadmap",
      "Rumuskan Judul",
      "Solusi Masalah Nyata"
    ]
  },
  {
    id: "03",
    code: "C100",
    title: "Penyusunan Proposal",
    description: "Menyusun dokumen C100 berisi latar belakang, rumusan masalah, analisis solusi, dan aspek ekonomi/sustainabilitas.",
    details: [
      "Latar Belakang & Masalah",
      "Analisis Solusi",
      "Skenario Pengguna"
    ]
  },
  {
    id: "04",
    code: "SEMINAR",
    title: "Sidang Proposal TA",
    description: "Proposal diuji oleh dosen penguji. Dokumen C100 final disahkan jika lulus, atau revisi/ulang jika belum.",
    details: [
      "Presentasi Proposal",
      "Revisi Dokumen",
      "Pengesahan C100"
    ]
  },
  {
    id: "05",
    code: "C200",
    title: "Spesifikasi Produk",
    description: "Mendefinisikan kebutuhan fungsional & non-fungsional, use-case, ERD, dan gambaran sistem yang dikembangkan.",
    details: [
      "Functional Requirements",
      "Use-Case & ERD",
      "System Overview"
    ]
  },
  {
    id: "06",
    code: "C300",
    title: "Perancangan Sistem",
    description: "Merancang arsitektur sistem, class/sequence diagram, API, komunikasi sistem, dan timeline implementasi.",
    details: [
      "System Architecture",
      "UML Diagrams",
      "Implementation Plan"
    ]
  },
  {
    id: "07",
    code: "C400",
    title: "Implementasi",
    description: "Realisasi sistem melalui pengembangan software/hardware, prototyping, dan penyiapan demo produk.",
    details: [
      "Software/Hardware Dev",
      "Prototyping",
      "Product Demo"
    ]
  },
  {
    id: "08",
    code: "C500",
    title: "Pengujian",
    description: "Melakukan testing (black-box/white-box), pengujian performa, dan evaluasi kesesuaian spesifikasi.",
    details: [
      "Black-box/White-box",
      "Performance Test",
      "Spec Evaluation"
    ]
  },
  {
    id: "09",
    code: "EXPO",
    title: "Expo Capstone",
    description: "Presentasi produk final, poster ilmiah, video demo, dan makalah di hadapan publik dan penguji.",
    details: [
      "Pameran Produk",
      "Poster & Video",
      "Submit Jurnal"
    ]
  }
];

function CapstoneStep({ step, isOpen, onToggle }: { step: { id: string; code: string; title: string; description: string; details: string[] }, isOpen: boolean, onToggle: () => void }) {
  return (
    <div className="border-b border-black/10 dark:border-white/10">
      <button 
        onClick={onToggle}
        className="flex w-full items-center justify-between py-8 text-left"
      >
        <div className="flex items-center gap-8 md:gap-16">
          <span className="text-xl pl-2 font-medium text-muted-foreground w-8">{step.id}</span>
          <h3 className="text-2xl font-semibold md:text-3xl">{step.title}</h3>
        </div>
        <div className="pr-4">
           {isOpen ? <ChevronUp className="h-6 w-6" /> : <ChevronDown className="h-6 w-6" />}
        </div>
      </button>
      
      <div 
        className={`grid overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? "grid-rows-[1fr] opacity-100 pb-8" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0">
           <div className="grid gap-8 md:grid-cols-2 ml-16 md:ml-24 pr-4">
              {/* Left functionality - Placeholder for image/visual */}
              <div className="aspect-video w-full rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <span className="text-4xl font-bold text-muted-foreground/20">{step.code}</span>
              </div>
              
              {/* Right User Content */}
              <div className="flex flex-col justify-center">
                 <h4 className="text-xl font-medium mb-4">{step.title}</h4>
                 <p className="text-muted-foreground mb-6 leading-relaxed">
                   {step.description}
                 </p>
                 <div className="flex flex-wrap gap-2">
                    {step.details.map((tag: string, i: number) => (
                      <span key={i} className="rounded-full border px-3 py-1 text-sm font-medium">
                        {tag}
                      </span>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

export function CapstoneSection() {
  const [openStep, setOpenStep] = useState<string | null>("01");

  return (
    <section id="capstone" className="container mx-auto py-16 px-4 sm:px-6 lg:px-8">
      <div className="mb-16">
        <h2 className="text-4xl font-medium tracking-tight sm:text-7xl">Alur Capstone.</h2>
      </div>
      
      <div className="flex flex-col border-t border-black/10 dark:border-white/10">
        {capstoneSteps.map((step) => (
          <CapstoneStep 
            key={step.id} 
            step={step} 
            isOpen={openStep === step.id} 
            onToggle={() => setOpenStep(openStep === step.id ? null : step.id)}
          />
        ))}
      </div>
    </section>
  );
}
