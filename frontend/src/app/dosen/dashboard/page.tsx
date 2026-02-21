'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
    BookOpen, Users, FileText, AlertCircle, 
    ArrowRight, CheckSquare, MessageSquare 
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { 
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip, 
    BarChart, Bar, XAxis, YAxis
} from 'recharts';

interface DosenStats {
    total_titles: number;
    active_groups: number;
    pending_bimbingan: number;
}

import { useAuth } from '@/context/AuthContext';

export default function DosenDashboard() {
    const { user } = useAuth();
    const [stats, setStats] = useState<DosenStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await api.get('/dosen/dashboard');
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

    const guidanceData = [
        { name: 'Active Groups', value: stats.active_groups, fill: 'var(--chart-1)' },
        { name: 'Pending Requests', value: stats.pending_bimbingan, fill: 'var(--chart-5)' },
    ];

    // Mock data for titles status (since we only have total_titles)
    const titleData = [
        { name: 'Available', value: Math.floor(stats.total_titles * 0.4) || 2, fill: 'var(--chart-2)' },
        { name: 'Taken', value: Math.ceil(stats.total_titles * 0.6) || 3, fill: 'var(--muted)' },
    ];

    return (
        <div className="space-y-4 p-4 lg:p-8">
            <div className="text-2xl font-bold tracking-tight">
                Welcome to {user?.name || 'User'}&apos;s Dashboard
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* 1. Guidance Status Donut */}
                <div className="col-span-1 md:col-span-1 row-span-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 flex flex-col justify-between min-h-[300px] relative overflow-hidden">
                     <div className="flex flex-row items-center justify-between pb-2 z-10">
                        <h3 className="text-sm font-medium text-muted-foreground">Guidance Workload</h3>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-h-0 flex flex-col items-center justify-center relative z-10">
                        <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center pointer-events-none">
                             <span className="text-3xl font-bold">{stats.active_groups + stats.pending_bimbingan}</span>
                             <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Students</span>
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={guidanceData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    cornerRadius={4}
                                >
                                    {guidanceData.map((entry, index) => (
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
                    <div className="flex justify-center gap-4 mt-2 z-10">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <div className="w-2 h-2 rounded-full bg-chart-1" />
                            <span>Active</span>
                        </div>
                         <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <div className="w-2 h-2 rounded-full bg-chart-5" />
                            <span>Pending</span>
                        </div>
                    </div>
                </div>

                {/* 2. Titles Status (Bar Chart Mockup) */}
                 <div className="col-span-1 md:col-span-1 row-span-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 flex flex-col justify-between min-h-[300px] group">
                    <div className="flex flex-row items-center justify-between pb-2">
                        <h3 className="text-sm font-medium text-muted-foreground">My Titles</h3>
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </div>
                     <div className="flex items-end gap-2 mb-4">
                         <div className="text-4xl font-bold tracking-tight">{stats.total_titles}</div>
                         <div className="text-sm text-muted-foreground mb-1">submitted titles</div>
                    </div>
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={titleData} layout="vertical" margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={60} tick={{fontSize: 10, fill: 'var(--muted-foreground)'}} axisLine={false} tickLine={false} />
                                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ background: 'var(--background)', borderColor: 'var(--border)', borderRadius: 'var(--radius)' }} />
                                <Bar dataKey="value" fill="var(--primary)" radius={[0, 4, 4, 0]} barSize={20} background={{ fill: 'var(--muted)', opacity: 0.1 }} >
                                     {titleData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-2 text-right">
                         <Button variant="link" className="p-0 h-auto text-xs text-primary" asChild>
                            <Link href="/dosen/titles" className="flex items-center justify-end">
                                Manage Titles <ArrowRight className="ml-1 w-3 h-3" />
                            </Link>
                        </Button>
                    </div>
                </div>

                 {/* 3. Pending Guidance - Alert Style */}
                 <div className={cn(
                     "col-span-1 md:col-span-1 row-span-1 flex flex-col justify-between border rounded-xl p-6 relative overflow-hidden transition-colors min-h-[200px]",
                     stats.pending_bimbingan > 0 
                        ? "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800" 
                        : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                 )}>
                    <div>
                        <div className="flex justify-between items-start">
                             <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <FileText className="w-4 h-4" /> Action Required
                             </div>
                             {stats.pending_bimbingan > 0 && <AlertCircle className="w-4 h-4 text-orange-500 animate-pulse" />}
                        </div>
                        <div className="text-4xl font-bold mt-2 tracking-tight">{stats.pending_bimbingan}</div>
                        <p className="text-xs text-muted-foreground mt-1">Pending student requests waiting for your approval.</p>
                    </div>
                    
                    <div className="flex items-center justify-between mt-4">
                         <div className="text-xs font-medium">
                            {stats.pending_bimbingan > 0 ? (
                                <span className="text-orange-600 dark:text-orange-400">Needs attention</span>
                            ) : (
                                <span className="text-zinc-500">All caught up</span>
                            )}
                         </div>
                         <Button variant={stats.pending_bimbingan > 0 ? "default" : "outline"} size="sm" className="h-8 text-xs" asChild>
                            <Link href="/dosen/bimbingan">
                                Review <ArrowRight className="ml-1 w-3 h-3" />
                            </Link>
                        </Button>
                    </div>
                </div>

                {/* 4. Quick Actions - Wide */}
                 <Card className="col-span-1 md:col-span-3 row-span-1 border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-center bg-white dark:bg-zinc-900">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                         <Button variant="outline" className="h-full py-4 flex flex-col gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 border-zinc-200 dark:border-zinc-800" asChild>
                            <Link href="/dosen/requests">
                                <CheckSquare className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                                <span className="text-xs font-medium">Approve Groups</span>
                            </Link>
                         </Button>
                         <Button variant="outline" className="h-full py-4 flex flex-col gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 border-zinc-200 dark:border-zinc-800" asChild>
                             <Link href="/dosen/bimbingan">
                                <MessageSquare className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                                <span className="text-xs font-medium">Guidance</span>
                             </Link>
                         </Button>
                         <Button variant="outline" className="h-full py-4 flex flex-col gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 border-zinc-200 dark:border-zinc-800" asChild>
                             <Link href="/dosen/titles">
                                <BookOpen className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                                <span className="text-xs font-medium">Manage Titles</span>
                             </Link>
                         </Button>
                         <Button variant="outline" className="h-full py-4 flex flex-col gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 border-zinc-200 dark:border-zinc-800" asChild>
                             <Link href="/dosen/evaluation">
                                <FileText className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                                <span className="text-xs font-medium">Input Grades</span>
                             </Link>
                         </Button>
                    </CardContent>
                </Card>

            </div>
        </div>
    );
}
