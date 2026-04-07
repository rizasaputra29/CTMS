'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search } from 'lucide-react';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Gavel, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface Bid {
    id: number;
    group_id: number;
    priority: number;
    status: string;
    lecturer_recommendation: string | null;
    title: { id: number; title: string };
    group: {
        id: number;
        members: { id: number; student: { name: string; email: string }; is_leader: boolean }[];
    };
}

export default function DosenBidsPage() {
    const [bids, setBids] = useState<Bid[]>([]);
    const [periods, setPeriods] = useState<{ id: number; name: string; is_active: boolean }[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [submitting, setSubmitting] = useState<number | null>(null);

    const fetchData = useCallback(async (periodId?: string) => {
        if (periodId) setRefreshing(true);
        else setLoading(true);

        try {
            // Fetch periods if not already fetched
            if (periods.length === 0) {
                const periodsRes = await api.get('/periods-list');
                setPeriods(periodsRes.data);
            }

            const url = periodId && periodId !== 'all' 
                ? `/dosen/bids?period_id=${periodId}` 
                : '/dosen/bids';
            
            const res = await api.get(url);
            setBids(res.data.data || []);
        } catch (err) {
            console.error('Failed to fetch bids', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [periods.length]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handlePeriodChange = (val: string) => {
        setSelectedPeriod(val);
        fetchData(val);
    };

    const handleRecommend = async (bidId: number, recommendation: 'ACCEPT' | 'REJECT') => {
        setSubmitting(bidId);
        try {
            await api.put(`/dosen/bids/${bidId}/recommend`, { recommendation });
            toast.success(`Recommendation: ${recommendation}`);
            fetchData(selectedPeriod);
        } catch (error) {
            if (api.isAxiosError(error)) toast.error(error.response?.data?.message || 'Failed');
            else toast.error('Failed to submit recommendation');
        } finally {
            setSubmitting(null);
        }
    };

    const filteredBids = useMemo(() => {
        if (!searchQuery) return bids;
        const q = searchQuery.toLowerCase();
        return bids.filter(bid => 
            bid.title.title.toLowerCase().includes(q) ||
            bid.group_id.toString().includes(q) ||
            bid.group.members.some(m => m.student.name.toLowerCase().includes(q))
        );
    }, [bids, searchQuery]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    // Group bids by title
    const byTitle = filteredBids.reduce((acc, bid) => {
        const key = bid.title.id;
        if (!acc[key]) acc[key] = { title: bid.title, bids: [] };
        acc[key].bids.push(bid);
        return acc;
    }, {} as Record<number, { title: { id: number; title: string }; bids: Bid[] }>);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Bid Review</h1>
                    <p className="text-muted-foreground">Review bids on your titles. Your recommendation is advisory for admin.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="All Periods" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectLabel>Academic Period</SelectLabel>
                                <SelectItem value="all">All Periods</SelectItem>
                                {periods.map(p => (
                                    <SelectItem key={p.id} value={p.id.toString()}>
                                        {p.name} {p.is_active && "(Active)"}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                    {refreshing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search titles, students, or groups..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                />
            </div>

            {Object.keys(byTitle).length === 0 ? (
                <div className="text-center py-12 border rounded-lg border-dashed">
                    <Gavel className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                    <h2 className="text-xl font-bold mb-2">No Bids Yet</h2>
                    <p className="text-muted-foreground">Bids on your titles will appear here.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {Object.values(byTitle).map(({ title, bids: titleBids }) => {
                        const acceptedBid = titleBids.find(b => b.lecturer_recommendation === 'ACCEPT');
                        
                        return (
                            <Card key={title.id}>
                                <CardHeader>
                                    <CardTitle className="text-base">{title.title}</CardTitle>
                                    <CardDescription>{titleBids.length} bid(s)</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {acceptedBid && (
                                        <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
                                            <strong className="text-green-700">Kelompok Diterima:</strong>{' '}
                                            <span className="text-green-600">
                                                Group #{acceptedBid.group_id} - {acceptedBid.group.members.map(m => m.student.name).join(', ')}
                                            </span>
                                            <p className="text-xs text-green-600 mt-1">Kelompok lain untuk judul ini otomatis ditolak.</p>
                                        </div>
                                    )}
                                    {titleBids.sort((a, b) => a.priority - b.priority).map(bid => {
                                        const isAccepted = bid.lecturer_recommendation === 'ACCEPT';
                                        const isRejected = bid.lecturer_recommendation === 'REJECT';
                                        const canAcceptOthers = !acceptedBid || acceptedBid.id === bid.id;
                                        
                                        return (
                                            <div 
                                                key={bid.id} 
                                                className={`flex items-center justify-between p-3 rounded-lg border ${
                                                    isAccepted 
                                                        ? 'bg-green-50 border-green-300' 
                                                        : isRejected 
                                                        ? 'bg-muted/30 border-muted' 
                                                        : 'bg-muted/50 border-muted'
                                                }`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                                        isAccepted 
                                                            ? 'bg-green-600 text-white' 
                                                            : 'bg-primary/10 text-primary'
                                                    }`}>
                                                        P{bid.priority}
                                                    </div>
                                                    <div>
                                                        <div className={`font-medium text-sm ${isRejected ? 'text-muted-foreground' : ''}`}>
                                                            {bid.group.members.map(m => m.student.name).join(', ')}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">Group #{bid.group_id}</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {bid.lecturer_recommendation ? (
                                                        <>
                                                            <Badge variant={bid.lecturer_recommendation === 'ACCEPT' ? 'default' : 'destructive'}>
                                                                {bid.lecturer_recommendation === 'ACCEPT' ? 'DITERIMA' : 'DITOLAK'}
                                                            </Badge>
                                                            {isAccepted && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="text-orange-600 border-orange-300 hover:bg-orange-50"
                                                                    onClick={() => handleRecommend(bid.id, 'REJECT')}
                                                                    disabled={submitting === bid.id}
                                                                >
                                                                    Batalkan
                                                                </Button>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="text-green-600 border-green-300 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                onClick={() => handleRecommend(bid.id, 'ACCEPT')}
                                                                disabled={submitting === bid.id || !canAcceptOthers}
                                                                title={!canAcceptOthers ? 'Anda sudah menerima kelompok lain untuk judul ini' : ''}
                                                            >
                                                                <ThumbsUp className="mr-1 h-3 w-3" /> Accept
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="text-red-600 border-red-300 hover:bg-red-50"
                                                                onClick={() => handleRecommend(bid.id, 'REJECT')}
                                                                disabled={submitting === bid.id}
                                                            >
                                                                <ThumbsDown className="mr-1 h-3 w-3" /> Reject
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
