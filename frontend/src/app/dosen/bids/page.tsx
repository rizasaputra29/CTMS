'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Gavel, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';

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
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState<number | null>(null);

    const fetchBids = useCallback(async () => {
        try {
            const res = await api.get('/dosen/bids');
            setBids(res.data.data || []);
        } catch (err) {
            console.error('Failed to fetch bids', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBids();
    }, [fetchBids]);

    const handleRecommend = async (bidId: number, recommendation: 'ACCEPT' | 'REJECT') => {
        setSubmitting(bidId);
        try {
            await api.put(`/dosen/bids/${bidId}/recommend`, { recommendation });
            toast.success(`Recommendation: ${recommendation}`);
            fetchBids();
        } catch (error) {
            if (axios.isAxiosError(error)) toast.error(error.response?.data?.message || 'Failed');
            else toast.error('Failed to submit recommendation');
        } finally {
            setSubmitting(null);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    // Group bids by title
    const byTitle = bids.reduce((acc, bid) => {
        const key = bid.title.id;
        if (!acc[key]) acc[key] = { title: bid.title, bids: [] };
        acc[key].bids.push(bid);
        return acc;
    }, {} as Record<number, { title: { id: number; title: string }; bids: Bid[] }>);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Bid Review</h1>
                <p className="text-muted-foreground">Review bids on your titles. Your recommendation is advisory for admin.</p>
            </div>

            {Object.keys(byTitle).length === 0 ? (
                <div className="text-center py-12 border rounded-lg border-dashed">
                    <Gavel className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                    <h2 className="text-xl font-bold mb-2">No Bids Yet</h2>
                    <p className="text-muted-foreground">Bids on your titles will appear here.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {Object.values(byTitle).map(({ title, bids: titleBids }) => (
                        <Card key={title.id}>
                            <CardHeader>
                                <CardTitle className="text-base">{title.title}</CardTitle>
                                <CardDescription>{titleBids.length} bid(s)</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {titleBids.sort((a, b) => a.priority - b.priority).map(bid => (
                                    <div key={bid.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                                        <div className="flex items-center gap-4">
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                                P{bid.priority}
                                            </div>
                                            <div>
                                                <div className="font-medium text-sm">
                                                    {bid.group.members.map(m => m.student.name).join(', ')}
                                                </div>
                                                <div className="text-xs text-muted-foreground">Group #{bid.group_id}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {bid.lecturer_recommendation ? (
                                                <Badge variant={bid.lecturer_recommendation === 'ACCEPT' ? 'default' : 'destructive'}>
                                                    {bid.lecturer_recommendation}
                                                </Badge>
                                            ) : (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="text-green-600 border-green-300 hover:bg-green-50"
                                                        onClick={() => handleRecommend(bid.id, 'ACCEPT')}
                                                        disabled={submitting === bid.id}
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
                                ))}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
