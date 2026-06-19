'use client';

import { Users, BookOpen, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useSupervisedGroups } from '../hooks/use-supervised-groups';

const statusProgress: Record<string, number> = {
    'FORMING': 0, 'FORMING_SOLO': 0, 'READY_FOR_BIDDING': 10,
    'KELOMPOK_FINAL': 20, 'PDC1_ACTIVE': 30, 'READY_FOR_SEMPRO': 40,
    'SEMPRO_DONE': 50, 'PDC2_ACTIVE': 60, 'TA_DRAFT': 65, 'PDC2_READY_FOR_EXPO': 70,
    'EXPO_REGISTERED': 80, 'EXPO_DONE': 90, 'READY_FOR_TA_INDIVIDUAL': 100, 'CLOSED': 100
};

export function SupervisedGroupsFeature() {
    const { groups, groupsLoading, periods, selectedPeriod, refreshing, handlePeriodChange } = useSupervisedGroups();

    return (
        <div className="space-y-6">
            <PageHeader
                title="Supervised Groups"
                description="Monitor the progress of your supervised groups."
                action={(
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
                )}
            />

            {groupsLoading ? (
                <Loading variant="section" />
            ) : groups.length === 0 ? (
                <EmptyState
                    icon={BookOpen}
                    title="No Groups"
                    description="You are not currently supervising any groups."
                />
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {groups.map((group) => {
                        const progress = statusProgress[group.status] || 0;
                        const latestDoc = group.documents?.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];

                        return (
                            <Card key={group.id}>
                                <CardHeader className="pb-3">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2">
                                            <CardTitle className="text-lg">{group.code || `Group ${group.id}`}</CardTitle>
                                            {group.is_dosbing_1 && (
                                                <Badge className="bg-blue-500">Dosbing 1</Badge>
                                            )}
                                            {group.is_dosbing_2 && (
                                                <Badge className="bg-green-500">Dosbing 2</Badge>
                                            )}
                                        </div>
                                        <StatusBadge status={group.status} category="group" />
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <p className="text-sm font-medium">Period</p>
                                            <Badge variant="outline" className="text-xs">
                                                {group.period?.name || 'Unknown Period'}
                                            </Badge>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-sm font-medium mb-1">Title</p>
                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                            {group.title?.title || 'No title set'}
                                        </p>
                                    </div>

                                    <div>
                                        <div className="flex items-center gap-1 text-sm font-medium mb-1">
                                            <Users className="h-4 w-4" /> Members
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            {group.members.map(m => m.student.name).join(', ')}
                                        </p>
                                    </div>

                                    {latestDoc && (
                                        <div className="p-3 bg-muted/50 rounded-lg text-sm">
                                            <p className="font-medium text-xs text-muted-foreground uppercase mb-1">Latest Activity</p>
                                            <div className="flex justify-between items-center">
                                                <span>{latestDoc.phase} (v{latestDoc.version})</span>
                                                <Badge variant={latestDoc.status === 'APPROVED' ? 'default' : latestDoc.status === 'REJECTED' ? 'destructive' : 'secondary'} className="text-[10px] px-1.5 py-0">
                                                    {latestDoc.status}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {formatDistanceToNow(new Date(latestDoc.updated_at), { addSuffix: true, locale: localeId })}
                                            </p>
                                        </div>
                                    )}

                                    <div className="pt-2 border-t">
                                        <div className="flex justify-between text-xs font-medium mb-1.5">
                                            <span>Overall Progress</span>
                                            <span>{progress}%</span>
                                        </div>
                                        <div className="w-full bg-muted rounded-full h-2">
                                            <div
                                                className={`h-2 rounded-full transition-all ${progress === 100 ? 'bg-green-500' : 'bg-primary'}`}
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
