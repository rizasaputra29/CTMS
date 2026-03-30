"use client";

export function SiklusSection() {
  return (
    <section className="container mx-auto pt-24 pb-36 px-4 sm:px-6 lg:px-8">
      <div className="mb-16 max-w-2xl">
        <h2 className="text-4xl font-medium tracking-tight sm:text-7xl">
          Siklus Pelaksanaan
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        {/* Cycle 1 */}
        <div className="flex flex-col p-8 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
          <h3 className="text-xl font-semibold text-black dark:text-white mb-2">
            Siklus 1
          </h3>
          <p className="text-muted-foreground mb-8 text-base">
            Semester Ganjil ke Genap
          </p>
          
          <div className="mt-auto">
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-bold tracking-tight text-black dark:text-white">
                Nov
              </span>
              <span className="text-lg text-muted-foreground font-medium">
                / Mulai
              </span>
            </div>
            <div className="mt-4 flex gap-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
               <span className="bg-white dark:bg-zinc-800 px-3 py-1 rounded border border-zinc-200 dark:border-zinc-700">Sem 1: PDC</span>
               <span>→</span>
               <span className="bg-white dark:bg-zinc-800 px-3 py-1 rounded border border-zinc-200 dark:border-zinc-700">Sem 2: TA</span>
            </div>
          </div>
        </div>

        {/* Cycle 2 */}
        <div className="flex flex-col p-8 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
          <h3 className="text-xl font-semibold text-black dark:text-white mb-2">
            Siklus 2
          </h3>
          <p className="text-muted-foreground mb-8 text-base">
            Semester Genap ke Ganjil
          </p>
          
          <div className="mt-auto">
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-bold tracking-tight text-black dark:text-white">
                Mei
              </span>
              <span className="text-lg text-muted-foreground font-medium">
                / Mulai
              </span>
            </div>
            <div className="mt-4 flex gap-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
               <span className="bg-white dark:bg-zinc-800 px-3 py-1 rounded border border-zinc-200 dark:border-zinc-700">Sem 1: PDC</span>
               <span>→</span>
               <span className="bg-white dark:bg-zinc-800 px-3 py-1 rounded border border-zinc-200 dark:border-zinc-700">Sem 2: TA</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
