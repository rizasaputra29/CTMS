import DashboardLayout from "@/components/layout/DashboardLayout"
import { PeriodSelectionProvider } from "@/context/PeriodSelectionContext"

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <PeriodSelectionProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </PeriodSelectionProvider>
  )
}
