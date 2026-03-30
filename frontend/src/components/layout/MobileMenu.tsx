"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  menuItems: { label: string; link: string }[];
}

export function MobileMenu({ isOpen, onClose, menuItems }: MobileMenuProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-60 bg-black/50 backdrop-blur-sm md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
          />

          {/* Menu Panel */}
          <motion.div
            className="fixed top-0 right-0 z-70 h-full w-[85%] max-w-sm bg-white shadow-2xl md:hidden dark:bg-zinc-900"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-white/10">
              <span className="font-sans text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
                Menu
              </span>
              <button
                onClick={onClose}
                className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors dark:bg-white/10 dark:hover:bg-white/20"
                aria-label="Close Menu"
              >
                <X size={20} className="text-gray-900 dark:text-white" />
              </button>
            </div>

            {/* Navigation Links */}
            <nav className="p-6">
              <ul className="space-y-1">
                {menuItems.map((item, index) => (
                  <motion.li
                    key={item.label}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 + 0.1 }}
                  >
                    <Link
                      href={item.link}
                      onClick={onClose}
                      className="block py-4 text-2xl font-medium text-gray-900 hover:text-gray-600 transition-colors border-b border-gray-100 dark:text-white dark:hover:text-gray-300 dark:border-white/10"
                    >
                      {item.label}
                    </Link>
                  </motion.li>
                ))}
              </ul>

              {/* CTA Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: menuItems.length * 0.05 + 0.2 }}
                className="mt-8"
              >
                <Link
                  href="/login"
                  onClick={onClose}
                >
                  <Button className="w-full py-6 text-lg rounded-full">Login</Button>
                </Link>
              </motion.div>
            </nav>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-gray-100 dark:border-white/10">
              <p className="text-sm text-gray-400 text-center">
                © 2024 CTMS Undip
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
