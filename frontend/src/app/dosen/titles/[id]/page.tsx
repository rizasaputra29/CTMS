'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Users } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface TitleDetail {
    id: number;
    title: string;
    description: string;
    problem_statement: string | null;
    scope: string | null;
    specializations: string[] | null;
    quota: number;
    status: string;
    title_source: string | null;
    lecturer?: { id: number; name: string; email: string };
    groups?: { id: number; status: string; members: { id: number; student_id: number; is_leader: boolean; student: { id: number; name: string; email: string } }[] }[];
}

export default function DosenTitleDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [title, setTitle] = useState<TitleDetail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTitle = async () => {
            try {
                const res = await api.get(`/dosen/titles/${params.id}`);
                setTitle(res.data);
            } catch (error) {
                toast.error('Failed to load title details');
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchTitle();
    }, [params.id]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (!title) {
        return (
            <div className="text-center py-12">
                <p className="text-muted-foreground">Title not found.</p>
                <Button variant="outline" className="mt-4" onClick={() => router.push('/dosen/titles')}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Titles
                </Button>
            </div>
        );
    }

    const activeGroups = title.groups?.filter(g => g.status !== 'REJECTED') || [];

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.push('/dosen/titles')}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold tracking-tight">{title.title}</h1>
                    <p className="text-muted-foreground">Title Details</p>
                </div>
                <Badge variant={title.status === 'open' ? 'default' : 'secondary'} className="text-sm">
                    {title.status}
                </Badge>
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
                            <span className="text-sm text-muted-foreground">Quota:</span>
                            <span className="ml-2 text-sm font-medium">{activeGroups.length}/{title.quota} groups</span>
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

            {/* Groups bidding on this title */}
            {activeGroups.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Users className="h-4 w-4" /> Groups ({activeGroups.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {activeGroups.map(group => (
                                <div key={group.id} className="border rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium text-sm">Group #{group.id}</span>
                                        <Badge variant={group.status === 'APPROVED' ? 'default' : 'secondary'}>{group.status}</Badge>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {group.members.map(m => (
                                            <Badge key={m.id} variant="outline" className="text-xs">
                                                {m.student.name}{m.is_leader ? ' (Leader)' : ''}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
