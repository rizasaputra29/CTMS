"use client"

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"

import { Toaster } from "@/components/ui/sonner"
import { usePathname } from "next/navigation"

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const pathname = usePathname();

    // Derive page title from pathname
    // e.g. /mahasiswa/dashboard -> Dashboard
    // e.g. /mahasiswa/titles -> Titles
    const getPageTitle = (path: string) => {
        const segments = path.split('/').filter(Boolean);
        const lastSegment = segments[segments.length - 1];
        if (!lastSegment) return 'Dashboard';
        return lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1);
    };

    const pageTitle = getPageTitle(pathname);

    return (
        <SidebarProvider>
            <AppSidebar />
            <main className="w-full flex flex-col h-screen overflow-hidden">
                <header className="flex items-center justify-between gap-2 border-b px-4 py-3 shrink-0 bg-background z-10">
                    <div className="flex items-center gap-2">
                        <SidebarTrigger className="-ml-1" />
                        <Separator orientation="vertical" className="mr-2 h-4" />
                        <Breadcrumb>
                            <BreadcrumbList>
                                <BreadcrumbItem>
                                    <BreadcrumbPage className="font-semibold">{pageTitle}</BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                    
                </header>
                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-muted/50">
                    {children}
                </div>
                <Toaster />
            </main>
        </SidebarProvider>
    )
}
