"use client";

import Link from "next/link";
import { Github, Linkedin, Instagram, Mail } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-black text-white pt-8 pb-8 dark:bg-white dark:text-black transition-colors">
      <div className="max-w-7xl mx-auto px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="font-sans text-2xl font-semibold tracking-tight">
                CTMS
              </span>
            </div>
            <p className="text-zinc-400 dark:text-zinc-600 text-sm leading-relaxed max-w-xs">
              Platform manajemen Capstone & Tugas Akhir Terintegrasi. Membantu mahasiswa dan dosen dalam mengelola siklus akademik dengan efisien.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="font-medium text-lg mb-6">Navigation</h3>
            <ul className="space-y-4 text-zinc-400 dark:text-zinc-600 text-sm">
              <li><Link href="/" className="hover:text-white dark:hover:text-black transition-colors">Home</Link></li>
              <li><Link href="#capstone" className="hover:text-white dark:hover:text-black transition-colors">Alur Capstone</Link></li>
              <li><Link href="#ta" className="hover:text-white dark:hover:text-black transition-colors">Alur Tugas Akhir</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-medium text-lg mb-6">Resources</h3>
            <ul className="space-y-4 text-zinc-400 dark:text-zinc-600 text-sm">
              <li><Link href="/login" className="hover:text-white dark:hover:text-black transition-colors">Login</Link></li>
              <li><Link href="#" className="hover:text-white dark:hover:text-black transition-colors">Panduan Akademik</Link></li>
              <li><Link href="#" className="hover:text-white dark:hover:text-black transition-colors">Repository</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-medium text-lg mb-6">Contact</h3>
            <ul className="space-y-4 text-zinc-400 dark:text-zinc-600 text-sm">
              <li><a href="mailto:admin@ctms.ac.id" className="hover:text-white dark:hover:text-black transition-colors">admin@ctms.ac.id</a></li>
              <li>Semarang, Indonesia</li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-zinc-800 dark:border-zinc-200 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-zinc-500 text-sm">
            © {new Date().getFullYear()} CTMS. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white dark:hover:text-black transition-colors" aria-label="GitHub"><Github size={20} /></a>
            <a href="#" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white dark:hover:text-black transition-colors" aria-label="LinkedIn"><Linkedin size={20} /></a>
            <a href="#" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white dark:hover:text-black transition-colors" aria-label="Instagram"><Instagram size={20} /></a>
            <a href="mailto:admin@ctms.ac.id" className="text-zinc-400 hover:text-white dark:hover:text-black transition-colors" aria-label="Email"><Mail size={20} /></a>
          </div>
        </div>
      </div>
    </footer>
  );
}
