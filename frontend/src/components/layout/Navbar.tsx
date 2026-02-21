"use client";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { MobileMenu } from "./MobileMenu";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);

  const menuItems = [
    { label: "Home", link: "/" },
    { label: "Capstone", link: "#capstone" },
    { label: "Tugas Akhir", link: "#ta" },
  ];

  const handleToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleCloseMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setIsScrolled(scrollY > 50);

      const sections = ["capstone", "ta"];

      if (scrollY < 100) {
        setActiveSection("/");
        return;
      }

      for (const sectionId of sections) {
        const element = document.getElementById(sectionId);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 200 && rect.bottom >= 200) {
            setActiveSection(`#${sectionId}`);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      {/* Mobile Header: Standard (NOT scrolled) */}
      <AnimatePresence>
        {!isScrolled && (
          <motion.header
            className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-6 md:hidden bg-white/80 backdrop-blur-md border-b border-black/5 dark:bg-black/80 dark:border-white/5"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Link href="/">
              <span className="font-sans text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
                CTMS
              </span>
            </Link>

            <button
              onClick={handleToggle}
              className="w-12 h-12 bg-gray-100 rounded-xl flex flex-col items-center justify-center gap-1.5 shadow-sm hover:bg-gray-200 transition-colors dark:bg-white/10 dark:hover:bg-white/20"
              aria-label="Toggle Menu"
            >
              <div className="w-5 h-[1.5px] bg-gray-900 dark:bg-white"></div>
              <div className="w-5 h-[1.5px] bg-gray-900 dark:bg-white"></div>
            </button>
          </motion.header>
        )}
      </AnimatePresence>

      {/* Mobile Header: Floating Pill (Scrolled) */}
      <AnimatePresence>
        {isScrolled && (
          <motion.header
            className="fixed top-4 left-0 right-0 z-50 flex justify-center md:hidden pointer-events-none"
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="pointer-events-auto bg-white/80 backdrop-blur-xl border border-gray-200/50 px-4 py-2.5 rounded-full shadow-lg flex items-center gap-4 dark:bg-black/80 dark:border-white/10">
              <Link href="/">
                <span className="font-sans text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                  CTMS
                </span>
              </Link>

              <div className="w-px h-5 bg-gray-300 dark:bg-white/20"></div>

              <button
                onClick={handleToggle}
                className="w-9 h-9 bg-gray-100 rounded-full flex flex-col items-center justify-center gap-1 hover:bg-gray-200 transition-colors dark:bg-white/10 dark:hover:bg-white/20"
                aria-label="Toggle Menu"
              >
                <div className="w-4 h-[1.5px] bg-gray-900 dark:bg-white"></div>
                <div className="w-4 h-[1.5px] bg-gray-900 dark:bg-white"></div>
              </button>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      {/* Desktop Header 1: Standard (Logo Left, Links Center, Button Right) - Visible when NOT scrolled */}
      <AnimatePresence>
        {!isScrolled && (
          <motion.header
            className="fixed top-0 left-0 right-0 z-40 hidden md:flex items-center justify-between px-12 md:px-24 lg:px-32 py-6 bg-white border-b border-black/5 dark:bg-black/90 dark:border-white/5"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Link href="/" className="font-sans text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
              CTMS
            </Link>

            <nav className="flex items-center gap-8">
              {menuItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.link}
                  className="text-sm font-medium text-gray-600 hover:text-black transition-colors dark:text-gray-400 dark:hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <Link
              href="/login"
            >
              <Button size="sm" className="rounded-full px-6 font-medium bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90">Login</Button>
            </Link>
          </motion.header>
        )}
      </AnimatePresence>

      {/* Desktop Header 2: Floating Pill - Visible when Scrolled */}
      <AnimatePresence>
        {isScrolled && (
          <motion.header
            className="fixed top-6 left-0 right-0 z-50 hidden md:flex justify-center pointer-events-none"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <nav className="pointer-events-auto bg-gray-100/80 backdrop-blur-xl border border-white/20 p-1.5 rounded-full shadow-sm flex items-center gap-1 dark:bg-black/80 dark:border-white/10">
              <Link href="/" className="flex items-center gap-2 pl-4 pr-4">
                <span className="font-semibold tracking-tight text-lg text-gray-900 dark:text-white">CTMS</span>
              </Link>
              
              <div className="w-px h-4 bg-gray-300 mx-2 dark:bg-white/20"></div>

              {menuItems.map((item) => {
                const isActive =
                  (item.link === "/" && activeSection === "/") ||
                  (item.link === activeSection);

                return (
                  <Link
                    key={item.label}
                    href={item.link}
                    className={cn(
                      "px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300",
                      isActive
                        ? "bg-white text-black shadow-sm dark:bg-zinc-800 dark:text-white"
                        : "text-gray-800 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}

              <div className="w-px h-4 bg-gray-300 mx-2 dark:bg-white/20"></div>

              <Link
                href="/login"
                className={cn(
                  "px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                )}
              >
                Login
              </Link>
            </nav>
          </motion.header>
        )}
      </AnimatePresence>

      {/* Mobile Menu */}
      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={handleCloseMobileMenu}
        menuItems={menuItems}
      />
    </>
  );
}
