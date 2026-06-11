import type { ReactNode } from 'react';

interface DashboardClientProps {
  children: ReactNode;
}

export function DashboardClient({ children }: DashboardClientProps) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}
