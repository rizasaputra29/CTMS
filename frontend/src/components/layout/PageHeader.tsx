import React from 'react';
import { cn } from '@/lib/utils';

/*
  ============================================
  SITKOM / SICATA PageHeader Component
  Design Spec: Section 7.6 Page Header Pattern
  ============================================
  Structure:
    1. Breadcrumb: "SICATA / Bank Asesmen" — 14px Regular, grey-400
    2. Page Title: "Bank Asesmen" — Heading 3 (32px Semibold), grey-600
    3. Page Description: "Kelola template..." — 14px Regular, grey-400
    4. Actions Row: right-aligned, same line as title
*/

interface PageHeaderProps {
  breadcrumb?: string[];
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  breadcrumb = [],
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6", className)}>
      {/* Breadcrumb */}
      {breadcrumb.length > 0 && (
        <nav aria-label="breadcrumb" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-grey-400">
            {breadcrumb.map((item, index) => (
              <li key={index} className="inline-flex items-center gap-1.5">
                {index > 0 && (
                  <span className="text-grey-200">/</span>
                )}
                {index === breadcrumb.length - 1 ? (
                  <span className="text-grey-600 font-medium">{item}</span>
                ) : (
                  <span className="text-grey-400">{item}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      {/* Title + Actions Row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-[32px] font-semibold text-grey-600 leading-tight">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-grey-400 max-w-2xl">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-3 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
