'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Activity, Settings, Shield } from 'lucide-react';
import Link from 'next/link';
import { 
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip, 
    BarChart, Bar, XAxis, CartesianGrid 
} from 'recharts';

interface DashboardStats {
    total_users: number;
    total_students: number;
    total_lecturers: number;
    active_period: {
        name: string;
        is_active: boolean;
    } | null;
}

import { useAuth } from '@/context/AuthContext';

export default function AdminDashboard() {
    const { user } = useAuth();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await api.get('/admin/dashboard');
                setStats(response.data);
            } catch (error) {
                console.error('Failed to fetch dashboard stats', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (loading) {
         return <div className="p-4 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
    }

    if (!stats) {
        return <div className="p-4">Failed to load dashboard data.</div>;
    }

    const userData = [
        { name: 'Students', value: stats.total_students, fill: 'var(--chart-1)' },
        { name: 'Lecturers', value: stats.total_lecturers, fill: 'var(--chart-2)' },
    ];

    // Mock data for system activity if not available from API
    const activityData = [
        { name: 'Mon', logins: 120, actions: 240 },
        { name: 'Tue', logins: 150, actions: 300 },
        { name: 'Wed', logins: 180, actions: 320 },
        { name: 'Thu', logins: 200, actions: 450 },
        { name: 'Fri', logins: 250, actions: 500 },
    ];

    return (
        <div className="space-y-4 p-4 lg:p-8">
            <div className="text-2xl font-bold tracking-tight">
                Welcome to {user?.name || 'User'}&apos;s Dashboard
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                
                 {/* 1. System Health / Active Period (Tall) */}
                <div className="col-span-1 md:col-span-2 lg:col-span-1 row-span-2 flex flex-col justify-between relative overflow-hidden bg-zinc-900 text-white dark:bg-zinc-950 rounded-xl p-6 min-h-[300px]">
                    <div className="absolute top-0 right-0 p-6 opacity-10">
                        <Activity className="w-32 h-32 text-white" />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-zinc-400">System Status</div>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                            <span className="text-lg font-semibold tracking-tight">Operational</span>
                        </div>
                    </div>
                    <div className="space-y-6 z-10">
                        <div>
                             <div className="text-sm text-zinc-400 mb-1">Active Period</div>
                             <div className="text-3xl font-bold tracking-tight">
                                {stats.active_period ? stats.active_period.name : 'None'}
                             </div>
                        </div>
                        <Button variant="secondary" className="w-full text-zinc-900 font-medium" asChild>
                            <Link href="/admin/periods">
                                Manage Periods <Settings className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </div>
                </div>

                {/* 2. User Stats Overview + Chart - Combined */}
                <div className="col-span-1 md:col-span-1 row-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 flex flex-col min-h-[300px]">
                    <div className="flex flex-row items-center justify-between pb-2">
                        <h3 className="text-sm font-medium text-muted-foreground">User Distribution</h3>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-h-0 flex flex-col items-center justify-center relative">
                         <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={userData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {userData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ background: 'var(--background)', borderColor: 'var(--border)', borderRadius: 'var(--radius)' }}
                                    itemStyle={{ color: 'var(--foreground)' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-4 mt-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-chart-1" />
                            <span>Students ({stats.total_students})</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-chart-2" />
                            <span>Lecturers ({stats.total_lecturers})</span>
                        </div>
                    </div>
                </div>

                {/* 3. System Activity Chart (New) */}
                <div className="col-span-1 md:col-span-2 row-span-1 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl p-6 flex flex-col min-h-[300px]">
                     <div className="flex items-center gap-2 text-muted-foreground mb-4">
                        <Activity className="h-4 w-4" />
                        <span className="text-sm font-medium">System Activity (Past Period)</span>
                    </div>
                    <div className="flex-1 min-h-0 h-64 w-full">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={activityData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip 
                                    contentStyle={{ background: 'var(--background)', borderColor: 'var(--border)', borderRadius: 'var(--radius)' }}
                                    cursor={{ fill: 'var(--muted)', opacity: 0.2 }}
                                />
                                <Bar dataKey="actions" name="User Actions" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="logins" name="Logins" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 4. Quick Actions / Management (Wide) */}
                <Card className="col-span-1 md:col-span-2 lg:col-span-2 row-span-1 border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-center bg-white dark:bg-zinc-900">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Quick Management</CardTitle>
                    </CardHeader>
                     <CardContent className="grid grid-cols-2 gap-4 h-full">
                        <Link href="/admin/users" className="group flex flex-col gap-1 p-3 rounded-lg border border-zinc-100 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 transition-all justify-center">
                            <div className="flex items-center gap-2 font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                                <Shield className="h-4 w-4" />
                                User Access
                            </div>
                            <div className="text-xs text-muted-foreground">Manage roles and permissions</div>
                        </Link>
                         <Link href="/admin/settings" className="group flex flex-col gap-1 p-3 rounded-lg border border-zinc-100 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 transition-all justify-center">
                            <div className="flex items-center gap-2 font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                                <Settings className="h-4 w-4" />
                                System Settings
                            </div>
                            <div className="text-xs text-muted-foreground">Configure global period settings</div>
                        </Link>
                    </CardContent>
                </Card>
            
            </div>
        </div>
    );
}
