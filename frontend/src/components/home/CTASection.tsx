"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function CTASection() {
  return (
    <section id="cta" className="py-16 px-4 sm:px-8 bg-black text-white rounded-t-[3rem] dark:bg-white dark:text-black transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-5xl md:text-8xl font-light mb-12 tracking-tight leading-tight">
            Siap Memulai <br /> Perjalanan Capstone?
          </h2>
          <Link
            href="/login"
            className="group relative inline-flex items-center gap-4 px-12 py-6 rounded-full border-2 border-white/20 hover:bg-white hover:border-white transition-all duration-300 dark:border-black/20 dark:hover:bg-black dark:hover:border-black"
          >
            <span className="text-xl font-medium group-hover:text-black dark:group-hover:text-white tracking-wide transition-colors">
              Masuk ke Sistem
            </span>
            <ArrowRight className="group-hover:text-black dark:group-hover:text-white transition-colors" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
