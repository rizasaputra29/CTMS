"use client";

import { useEffect, useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { TopBar } from "@/components/layout/TopBar";
import { Toaster } from "@/components/ui/sonner";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { RoleSelector } from "@/components/auth/RoleSelector";

const GUARDED_ROLES = ["admin", "dosen", "mahasiswa"] as const;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, activeRole, isLoading, switchRole } = useAuth();
  const roleFromPath = pathname.split("/").filter(Boolean)[0] || null;
  const [roleSelectorOpen, setRoleSelectorOpen] = useState(false);

  const isMultiRole =
    user?.roles?.includes("admin") && user?.roles?.includes("dosen");

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    // Multi-role (admin + dosen) users can access any guard role's routes
    if (isMultiRole) {
      if (
        roleFromPath &&
        GUARDED_ROLES.includes(roleFromPath as (typeof GUARDED_ROLES)[number])
      ) {
        const userRoles = user.roles || [];
        if (!userRoles.includes(roleFromPath)) {
          // User doesn't have this role - redirect to login
          router.replace("/login");
        }
        // Don't switch roles - multi-role users see everything
        // Just sync activeRole for backwards compatibility
        if (activeRole !== roleFromPath) {
          // Update activeRole without redirecting
          localStorage.setItem("activeRole", roleFromPath);
        }
      }
      return;
    }

    // Single role users - existing behavior
    if (
      roleFromPath &&
      GUARDED_ROLES.includes(roleFromPath as (typeof GUARDED_ROLES)[number])
    ) {
      const userRoles = user?.roles || [user?.role || "mahasiswa"];
      if (userRoles.includes(roleFromPath)) {
        if (activeRole !== roleFromPath) {
          switchRole(roleFromPath);
        }
      } else {
        router.replace("/login");
      }
    }
  }, [
    isLoading,
    user,
    activeRole,
    roleFromPath,
    router,
    switchRole,
    isMultiRole,
  ]);

  const isReady = !isLoading && user;

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="bg-background flex h-screen w-full flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4">
          <div className="bg-background border-grey-100 shadow-small min-h-full overflow-hidden rounded-xl border">
            <TopBar />
            <div className="px-6 pt-6 pb-6">
              {!isReady ? (
                <div className="flex items-center justify-center py-20">
                  <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
                </div>
              ) : (
                children
              )}
            </div>
          </div>
        </div>
        <Toaster />
        {/* Role Selector Dialog - only for non-combined multi-role users */}
        {user?.roles && user.roles.length > 1 && !isMultiRole && (
          <RoleSelector
            open={roleSelectorOpen}
            onOpenChange={setRoleSelectorOpen}
          />
        )}
      </main>
    </SidebarProvider>
  );
}
