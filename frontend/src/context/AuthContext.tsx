"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import api from "@/lib/api";
import { useRouter } from "next/navigation";
import { usePrefetchDashboards } from "@/hooks/use-prefetch-dashboards";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  roles: string[];
}

interface AuthContextType {
  user: User | null;
  activeRole: string | null;
  login: (userData: User, roles: string[]) => void;
  logout: () => void;
  switchRole: (role: string) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { prefetchAllDashboards } = usePrefetchDashboards();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const storedRole = localStorage.getItem("activeRole");
        const response = await api.get("/user");
        const userData = response.data?.data;
        if (!userData) {
          throw new Error("No user data in response");
        }
        setUser(userData);

        if (storedRole && userData.roles?.includes(storedRole)) {
          setActiveRole(storedRole);
        } else if (userData.roles && userData.roles.length > 0) {
          const isCombined =
            userData.roles.includes("admin") &&
            userData.roles.includes("dosen");
          if (isCombined) {
            setActiveRole("admin");
          } else {
            const defaultRole = userData.roles[0];
            setActiveRole(defaultRole);
            localStorage.setItem("activeRole", defaultRole);
          }
        }

        prefetchAllDashboards(userData.roles || []);
      } catch (error) {
        console.error("Auth check failed", error);
        // Defensive error checking
        const status = api.isAxiosError(error)
          ? (error.response?.status ?? 0)
          : 0;
        if ([401, 419].includes(status)) {
          localStorage.removeItem("activeRole");
          setUser(null);
          setActiveRole(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = (userData: User, roles: string[]) => {
    const userWithRoles = { ...userData, roles };
    setUser(userWithRoles);

    if (roles.includes("admin") && roles.includes("dosen")) {
      setActiveRole("admin");
      localStorage.setItem("activeRole", "admin");
      router.push("/");
    } else {
      const targetRole = roles[0] || userData.role || "mahasiswa";
      setActiveRole(targetRole);
      localStorage.setItem("activeRole", targetRole);
      router.push(`/${targetRole}/dashboard`);
    }
  };

  const switchRole = async (role: string) => {
    try {
      await api.post("/user/active-role", { role });
    } catch (error) {
      console.error("Failed to sync role with server", error);
    }
    setActiveRole(role);
    localStorage.setItem("activeRole", role);
    router.push(`/${role}/dashboard`);
  };

  const logout = async () => {
    try {
      await api.post("/logout");
    } catch (error) {
      console.error("Logout failed", error);
    } finally {
      localStorage.removeItem("activeRole");
      localStorage.removeItem("sidebar_sections");
      setUser(null);
      setActiveRole(null);
      router.push("/login");
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, activeRole, login, logout, switchRole, isLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
