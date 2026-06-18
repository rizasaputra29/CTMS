'use client';

import axios from 'axios';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Loading } from '@/components/ui/loading';
import type { Group, TitleDetail } from '../types';

export function TitleDetailFeature() {
    const params = useParams();
    const router = useRouter();
    const [title, setTitle] = useState<TitleDetail | null>(null);
    const [group, setGroup] = useState<Group | null>(null);
    const [loading, setLoading] = useState(true);
    const [bidding, setBidding] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [titleRes, groupRes] = await Promise.all([
                    api.get(`/mahasiswa/titles/${params.id}`),
                    api.get('/mahasiswa/group'),
                ]);
                setTitle(titleRes.data?.data ?? titleRes.data);
                const groupData = groupRes.data?.data ?? groupRes.data;
                setGroup(groupData?.group ?? groupData);
            } catch (error) {
                toast.error('Failed to load title details');
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [params.id]);

    const hasGroup = !!group;
    const canBid = hasGroup && !group?.title_id && group?.status === 'READY_FOR_BIDDING';

    const handleBid = async () => {
        if (!title || !canBid) return;
        if (!title.lecturer?.id) {
            toast.error('Data dosen pembimbing untuk judul ini tidak tersedia.');
            return;
        }

        setBidding(true);
        try {
            await api.post('/mahasiswa/bids', {
                title_id: title.id,
                priority: 1,
                proposed_supervisor_1_id: title.lecturer.id,
                proposed_supervisor_2_id: null,
            });
            toast.success('Bid submitted successfully!');
            router.push('/mahasiswa/group');
        } catch (error) {
            if (axios.isAxiosError(error)) {
                toast.error(api.getApiErrorMessage(error, 'Failed to bid'));
            } else {
                toast.error('Failed to submit bid');
            }
        } finally {
            setBidding(false);
        }
    };

    if (loading) return <Loading variant="section" />;

    if (!title) {
        return (
            <div className="text-center py-12">
                <p className="text-muted-foreground">Title not found.</p>
                <Button variant="outline" className="mt-4" onClick={() => router.push('/mahasiswa/titles')}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Titles
                </Button>
            </div>
        );
    }

    const activeGroups = title.groups?.filter(g => g.status !== 'REJECTED') || [];

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.push('/mahasiswa/titles')}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold tracking-tight">{title.title}</h1>
                    <p className="text-muted-foreground">By {title.lecturer?.name || 'Unknown Lecturer'}</p>
                </div>
                {canBid && (
                    <Button onClick={handleBid} disabled={bidding}>
                        {bidding && <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                        Bid for This Title
                    </Button>
                )}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader>
                    <CardContent><p className="text-sm whitespace-pre-wrap">{title.description}</p></CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="text-base">Problem Statement</CardTitle></CardHeader>
                    <CardContent><p className="text-sm whitespace-pre-wrap">{title.problem_statement || 'Not specified'}</p></CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="text-base">Scope</CardTitle></CardHeader>
                    <CardContent><p className="text-sm whitespace-pre-wrap">{title.scope || 'Not specified'}</p></CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        <div>
                            <span className="text-sm text-muted-foreground">Lecturer:</span>
                            <span className="ml-2 text-sm font-medium">{title.lecturer?.name}</span>
                        </div>
                        <div>
                            <span className="text-sm text-muted-foreground">Available Slots:</span>
                            <span className="ml-2 text-sm font-medium">{title.quota - activeGroups.length}/{title.quota} groups</span>
                        </div>
                        <div>
                            <span className="text-sm text-muted-foreground">Specializations:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                                {(title.specializations || []).map(s => (
                                    <Badge key={s} variant="outline">{s}</Badge>
                                ))}
                                {(!title.specializations || title.specializations.length === 0) && (
                                    <span className="text-sm text-muted-foreground">None specified</span>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
