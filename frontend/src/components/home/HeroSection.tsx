"use client";

import Image from "next/image";

export function HeroSection() {
  return (
    <section className="relative min-h-screen bg-white text-black dark:bg-[#1a1a1a] dark:text-white flex flex-col">
      {/* Top Half: Static Image */}
      <div className="relative z-0 h-[60vh] md:h-[65vh] w-full overflow-hidden">
        <Image 
          src="/hero-bg.webp" 
          alt="Architecture" 
          fill 
          className="object-cover"
          priority
        />
      </div>

      {/* Bottom Half: Content - Static */}
      <div className="bg-white dark:bg-[#1a1a1a] flex-1 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 lg:gap-24 px-6 sm:px-12 w-full py-16">
        
        {/* Left: Title */}
        <div className="flex flex-col justify-center items-center md:items-start text-center md:text-left">
             <h1 className="text-5xl sm:text-7xl lg:text-8xl font-medium tracking-tighter leading-[0.9]">
                <div>Capstone & TA</div>
                <div>Management.</div>
             </h1>
        </div>

        {/* Right: details */}
        <div className="flex flex-col justify-center items-center md:items-end text-center md:text-right">
            {/* Description */}
            <div className="max-w-xl">
                <p className="text-lg sm:text-xl lg:text-2xl leading-relaxed text-muted-foreground font-light mb-4"> 
                    Memfasilitasi seluruh proses akademik mulai dari pendaftaran tim, bimbingan, hingga sidang akhir dalam satu ekosistem yang efisien.
                </p>
            </div>
        </div>
      </div>
    </section>
  );
}
