'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';

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
    login: (token: string, userData: User, roles: string[]) => void;
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

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const token = localStorage.getItem('token');
                const storedRole = localStorage.getItem('activeRole');
                if (token) {
                    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                    const response = await api.get('/user');
                    const userData = response.data;
                    setUser(userData);
                    
                    if (storedRole && userData.roles?.includes(storedRole)) {
                        setActiveRole(storedRole);
                    } else if (userData.roles && userData.roles.length > 0) {
                        // For multi-role (admin+dosen), don't set a single activeRole
                        const isCombined = userData.roles.includes('admin') && userData.roles.includes('dosen');
                        if (isCombined) {
                            setActiveRole('admin'); // Default to admin for compatibility
                        } else {
                            const defaultRole = userData.roles[0];
                            setActiveRole(defaultRole);
                            localStorage.setItem('activeRole', defaultRole);
                        }
                    }
                }
            } catch (error) {
                console.error('Auth check failed', error);
                if (api.isAxiosError(error) && [401, 419].includes(error.response?.status ?? 0)) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('activeRole');
                    delete api.defaults.headers.common['Authorization'];
                    setUser(null);
                    setActiveRole(null);
                }
            } finally {
                setIsLoading(false);
            }
        };

        checkAuth();
    }, []);

    const login = (token: string, userData: User, roles: string[]) => {
        localStorage.setItem('token', token);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        const userWithRoles = { ...userData, roles };
        setUser(userWithRoles);

        // Multi-role (admin + dosen) → go to combined dashboard
        if (roles.includes('admin') && roles.includes('dosen')) {
            setActiveRole('admin');
            localStorage.setItem('activeRole', 'admin');
            router.push('/');
        } else {
            const targetRole = roles[0] || userData.role || 'mahasiswa';
            setActiveRole(targetRole);
            localStorage.setItem('activeRole', targetRole);
            router.push(`/${targetRole}/dashboard`);
        }
    };

    const switchRole = async (role: string) => {
        try {
            await api.post('/user/active-role', { role });
        } catch (error) {
            console.error('Failed to sync role with server', error);
        }
        setActiveRole(role);
        localStorage.setItem('activeRole', role);
        router.push(`/${role}/dashboard`);
    };

    const logout = async () => {
        try {
            await api.post('/logout');
        } catch (error) {
            console.error('Logout failed', error);
        } finally {
            localStorage.removeItem('token');
            localStorage.removeItem('activeRole');
            localStorage.removeItem('sidebar_sections');
            delete api.defaults.headers.common['Authorization'];
            setUser(null);
            setActiveRole(null);
            router.push('/login');
        }
    };

    return (
        <AuthContext.Provider value={{ user, activeRole, login, logout, switchRole, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
