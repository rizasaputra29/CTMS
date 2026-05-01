"use client"

import { useEffect, useState } from "react"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"

import { Toaster } from "@/components/ui/sonner"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { RoleSelector } from "@/components/auth/RoleSelector"

const GUARDED_ROLES = ['admin', 'dosen', 'mahasiswa'] as const;

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, activeRole, isLoading, switchRole } = useAuth();
    const roleFromPath = pathname.split('/').filter(Boolean)[0] || null;
    const [roleSelectorOpen, setRoleSelectorOpen] = useState(false);

    const isMultiRole = user?.roles?.includes('admin') && user?.roles?.includes('dosen');

    useEffect(() => {
        if (isLoading) {
            return;
        }

        if (!user) {
            router.replace('/login');
            return;
        }

        // Multi-role (admin + dosen) users can access any guard role's routes
        if (isMultiRole) {
            if (roleFromPath && GUARDED_ROLES.includes(roleFromPath as (typeof GUARDED_ROLES)[number])) {
                const userRoles = user.roles || [];
                if (!userRoles.includes(roleFromPath)) {
                    // User doesn't have this role - redirect to login
                    router.replace('/login');
                }
                // Don't switch roles - multi-role users see everything
                // Just sync activeRole for backwards compatibility
                if (activeRole !== roleFromPath) {
                    // Update activeRole without redirecting
                    localStorage.setItem('activeRole', roleFromPath);
                }
            }
            return;
        }

        // Single role users - existing behavior
        if (roleFromPath && GUARDED_ROLES.includes(roleFromPath as (typeof GUARDED_ROLES)[number])) {
            const userRoles = user?.roles || [user?.role || 'mahasiswa'];
            if (userRoles.includes(roleFromPath)) {
                if (activeRole !== roleFromPath) {
                    switchRole(roleFromPath);
                }
            } else {
                router.replace('/login');
            }
        }
    }, [isLoading, user, activeRole, roleFromPath, router, switchRole, isMultiRole]);

    const getPageTitle = (path: string) => {
        const segments = path.split('/').filter(Boolean);
        const lastSegment = segments[segments.length - 1];
        if (!lastSegment) return 'Dashboard';
        return lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1);
    };

    const pageTitle = getPageTitle(pathname);

    if (isLoading) {
        return <div className="p-6 text-sm text-muted-foreground">Loading dashboard...</div>;
    }

    if (!user) {
        return null;
    }

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
                    
                    {/* Role Selector - only for non-combined multi-role users on dashboard pages */}
                    {user?.roles && user.roles.length > 1 && !isMultiRole && pathname.endsWith('/dashboard') && (
                        <>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setRoleSelectorOpen(true)}
                                className="text-xs"
                            >
                                {activeRole && activeRole.charAt(0).toUpperCase() + activeRole.slice(1)}
                                <ChevronDown className="ml-1 h-3 w-3" />
                            </Button>
                            <RoleSelector 
                                open={roleSelectorOpen} 
                                onOpenChange={setRoleSelectorOpen}
                            />
                        </>
                    )}
                </header>
                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-muted/50">
                    {children}
                </div>
                <Toaster />
            </main>
        </SidebarProvider>
    )
}
