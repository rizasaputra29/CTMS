'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Download, FileSpreadsheet, Loader2, Users, GraduationCap, GitCompare, Star } from 'lucide-react';
import { toast } from 'sonner';

interface Period { id: number; name: string; is_active: boolean; }

const REPORTS = [
    { type: 'assessments', title: 'Assessment Scores', description: 'Export all assessment scores (CPMK/CPL) for the selected period.', icon: GraduationCap, color: 'text-blue-500' },
    { type: 'peer-reviews', title: 'Peer Reviews', description: 'Export peer review results between group members.', icon: Star, color: 'text-yellow-500' },
    { type: 'grade-consistency', title: 'Grade Consistency', description: 'Export PDC1 vs PDC2 grade consistency check results.', icon: GitCompare, color: 'text-purple-500' },
    { type: 'groups', title: 'Group Details', description: 'Export all groups with members, titles, and supervisors.', icon: Users, color: 'text-green-500' },
];

export default function AdminReportsPage() {
    const [periods, setPeriods] = useState<Period[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('');
    const [downloading, setDownloading] = useState<string | null>(null);

    const fetchPeriods = useCallback(async () => {
        try {
            const res = await api.get('/admin/periods');
            setPeriods(res.data || []);
            const active = (res.data || []).find((p: Period) => p.is_active);
            if (active) setSelectedPeriod(active.id.toString());
        } catch { /* ignore */ }
    }, []);

    useEffect(() => { fetchPeriods(); }, [fetchPeriods]);

    const handleExport = async (type: string) => {
        if (!selectedPeriod) { toast.error('Please select a period'); return; }
        setDownloading(type);
        try {
            const res = await api.get(`/admin/reports/${type}/export`, {
                params: { period_id: selectedPeriod, format: 'csv' },
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `${type}_report_period_${selectedPeriod}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast.success(`${type} report downloaded`);
        } catch {
            toast.error('Failed to export report');
        } finally {
            setDownloading(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Reports & Export</h1>
                    <p className="text-muted-foreground">Download CSV reports for assessment data, peer reviews, and groups.</p>
                </div>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select period" /></SelectTrigger>
                    <SelectContent>{periods.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {REPORTS.map(report => (
                    <Card key={report.type}>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg bg-muted ${report.color}`}>
                                    <report.icon className="h-5 w-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-base">{report.title}</CardTitle>
                                    <CardDescription className="text-sm">{report.description}</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Button
                                className="w-full"
                                variant="outline"
                                disabled={!selectedPeriod || downloading === report.type}
                                onClick={() => handleExport(report.type)}
                            >
                                {downloading === report.type ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exporting...</>
                                ) : (
                                    <><Download className="mr-2 h-4 w-4" /> Export CSV</>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <CardTitle className="text-base">About Reports</CardTitle>
                            <CardDescription>All reports are exported as CSV files compatible with Excel and Google Sheets. Data is filtered by the selected period.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>
        </div>
    );
}
