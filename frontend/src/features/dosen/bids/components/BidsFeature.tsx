'use client';

import { Search, Gavel, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { useBids } from '../hooks/use-bids';

const flowReasonMap: Record<string, string> = {
    PERIOD_FINALIZED: 'Periode sudah difinalisasi. Rekomendasi bidding tidak dapat diubah.',
    BIDDING_LOCKED: 'Bidding sudah dikunci oleh sistem/admin.',
};

export function BidsFeature() {
    const {
        periods,
        selectedPeriod,
        searchQuery,
        loading,
        refreshing,
        submitting,
        bidsFlow,
        byTitle,
        setSearchQuery,
        handlePeriodChange,
        handleRecommend,
    } = useBids();

    const globalFlowMessage = bidsFlow?.reason ? flowReasonMap[bidsFlow.reason] || 'Aksi bidding saat ini tidak tersedia.' : null;

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <PageHeader
                    title="Bid Review"
                    description="Review bids on your titles. Your recommendation is advisory for admin."
                />
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
                                        {p.name} {p.is_active && '(Active)'}
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

            {globalFlowMessage && (
                <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {globalFlowMessage}
                </div>
            )}

            {Object.keys(byTitle).length === 0 ? (
                <EmptyState
                    icon={Gavel}
                    title="No Bids Yet"
                    description="Bids on your titles will appear here."
                />
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
                                                Group {acceptedBid.group_id} - {acceptedBid.group.members.map(m => m.student.name).join(', ')}
                                            </span>
                                            <p className="text-xs text-green-600 mt-1">Kelompok lain untuk judul ini otomatis ditolak.</p>
                                        </div>
                                    )}
                                    {titleBids.sort((a, b) => a.priority - b.priority).map(bid => {
                                        const isAccepted = bid.lecturer_recommendation === 'ACCEPT';
                                        const isRejected = bid.lecturer_recommendation === 'REJECT';
                                        const canAcceptOthers = !acceptedBid || acceptedBid.id === bid.id;
                                        const actions = bid.allowed_actions ?? {
                                            can_accept: !isAccepted && !isRejected,
                                            can_reject: !isRejected,
                                            can_cancel_accept: isAccepted,
                                            reason: canAcceptOthers ? null : 'TITLE_ALREADY_HAS_ACCEPTED_BID',
                                        };
                                        const canAccept = actions.can_accept && canAcceptOthers;
                                        const canReject = actions.can_reject;
                                        const canCancelAccept = actions.can_cancel_accept;

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
                                                        <div className="text-xs text-muted-foreground">Group {bid.group_id}</div>
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
                                                                    disabled={submitting === bid.id || !canCancelAccept}
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
                                                                disabled={submitting === bid.id || !canAccept}
                                                                title={!canAccept ? 'Anda sudah menerima kelompok lain untuk judul ini' : ''}
                                                            >
                                                                <ThumbsUp className="mr-1 h-3 w-3" /> Accept
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="text-red-600 border-red-300 hover:bg-red-50"
                                                                onClick={() => handleRecommend(bid.id, 'REJECT')}
                                                                disabled={submitting === bid.id || !canReject}
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
