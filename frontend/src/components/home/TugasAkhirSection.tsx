"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const finalProjectSteps = [
  {
    phase: "01",
    title: "Pengerjaan TA Individu",
    desc: "Setiap mahasiswa menulis laporan TA individu berdasarkan kontribusi spesifik dalam proyek Capstone.",
    badge: "Individu"
  },
  {
    phase: "02",
    title: "Penyusunan Laporan TA",
    desc: "Menulis laporan sesuai format: Pendahuluan, Tinjauan Pustaka, Metodologi, Implementasi, Pengujian, Kesimpulan.",
    badge: "Dokumen"
  },
  {
    phase: "03",
    title: "Submit Artikel Ilmiah",
    desc: "Wajib mensubmit artikel ilmiah ke jurnal (JTK atau lainnya) dengan mencantumkan dosen pembimbing.",
    badge: "Publikasi"
  },
  {
    phase: "04",
    title: "Pendaftaran Sidang TA",
    desc: "Mendaftar sidang setelah lulus Expo, dokumen lengkap, dan mendapatkan persetujuan pembimbing.",
    badge: "Admin"
  },
  {
    phase: "05",
    title: "Sidang TA (Defense)",
    desc: "Ujian lisan individu untuk mempertahankan metodologi, analisis, dan hasil penelitian di hadapan penguji.",
    badge: "Ujian"
  },
  {
    phase: "06",
    title: "Kelulusan",
    desc: "Pemberian nilai akhir. Mahasiswa dinyatakan lulus Capstone & Tugas Akhir jika memenuhi semua kriteria.",
    badge: "Selesai"
  }
];

export function TugasAkhirSection() {
  return (
    <section id="ta" className="container mx-auto py-16 px-4 sm:px-6 lg:px-8">
      <div className="mb-12">
        <h2 className="text-4xl font-medium tracking-tight sm:text-7xl">Alur Tugas Akhir.</h2>
      </div>

      <div className="relative mx-auto max-w-4xl">
        <Separator
          orientation="vertical"
          className="absolute top-4 left-2 bg-zinc-200 dark:bg-zinc-800 h-full"
        />
        {finalProjectSteps.map((step, index) => (
          <div key={index} className="relative mb-10 pl-8">
            <div className="absolute top-3.5 left-0 flex size-4 items-center justify-center rounded-full bg-black dark:bg-white" />
            
            <h4 className="rounded-xl py-2 text-xl font-bold tracking-tight xl:mb-4 xl:px-3">
              {step.title}
            </h4>

            <h5 className="text-base font-bold tracking-tight text-muted-foreground mt-2 xl:mt-0 xl:absolute xl:top-3 xl:-left-48 xl:text-right xl:w-40 xl:pr-4">
              Step {step.phase}
            </h5>
            
            <Card className="my-5 border-none shadow-none bg-transparent">
              <CardContent className="px-0">
                <div className="prose text-foreground dark:prose-invert max-w-none">
                    <div className="mb-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                            {step.badge}
                        </span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                        {step.desc}
                    </p>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </section>
  );
}
