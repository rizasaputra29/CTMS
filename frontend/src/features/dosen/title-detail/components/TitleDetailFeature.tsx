'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users } from 'lucide-react';
import { Loading } from '@/components/ui/loading';
import { EmptyState } from '@/components/common/EmptyState';
import { useTitleDetail } from '../hooks/use-title-detail';

interface TitleDetailFeatureProps {
    titleId: string;
}

export function TitleDetailFeature({ titleId }: TitleDetailFeatureProps) {
    const router = useRouter();
    const { title, loading } = useTitleDetail(titleId);

    if (loading) {
        return <Loading variant="section" text="Memuat detail judul..." />;
    }

    if (!title) {
        return (
            <EmptyState
                title="Judul tidak ditemukan"
                description="Judul yang Anda cari tidak tersedia atau telah dihapus."
                action={
                    <Button variant="outline" onClick={() => router.push('/dosen/titles')}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke Daftar Judul
                    </Button>
                }
            />
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
                                        <span className="font-medium text-sm">{group.code || `Group ${group.id}`}</span>
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
