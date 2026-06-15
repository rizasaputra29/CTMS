'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import { toast } from 'sonner';
import ScheduleCalendar, { type ScheduleEvent } from '@/components/schedule/ScheduleCalendar';
import { ViewToggle } from '@/components/schedule/ViewToggle';
import { PeriodFilter } from '@/components/schedule/PeriodFilter';
import { ScheduleExport } from '@/components/schedule/ScheduleExport';
import { ScheduleTable } from '@/components/schedule/ScheduleTable';
import { ScheduleDetailModal } from '@/components/schedule/ScheduleDetailModal';
import { useSchedules } from '../hooks/use-schedules';

export function ScheduleFeature() {
    const {
        periods,
        filteredSchedules,
        schedules,
        view,
        setView,
        selectedPeriod,
        setSelectedPeriod,
        isLoading,
        isProcessing,
        handleApprove,
        handleReject,
    } = useSchedules();

    const [selectedSchedule, setSelectedSchedule] = useState<ScheduleEvent | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);

    const handleRowClick = (schedule: ScheduleEvent) => {
        setSelectedSchedule(schedule);
        setDetailOpen(true);
    };

    if (isLoading) {
        return <Loading variant="section" />;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Schedule Dashboard</h1>
                        <p className="text-muted-foreground">
                            View all schedules across all periods. Select a period to filter.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href="/admin/sempro">
                            <Button variant="outline" size="sm">
                                <CalendarPlus className="mr-2 h-4 w-4" />
                                New SEMPRO
                            </Button>
                        </Link>
                        <Link href="/admin/expo">
                            <Button variant="outline" size="sm">
                                <CalendarPlus className="mr-2 h-4 w-4" />
                                New EXPO
                            </Button>
                        </Link>
                        <Link href="/admin/ta-defense">
                            <Button variant="outline" size="sm">
                                <CalendarPlus className="mr-2 h-4 w-4" />
                                New TA Defense
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-4 bg-muted/50 rounded-lg">
                    <div className="flex flex-wrap items-center gap-4">
                        <ViewToggle value={view} onChange={setView} />
                        <PeriodFilter
                            periods={periods}
                            value={selectedPeriod}
                            onChange={setSelectedPeriod}
                        />
                    </div>
                    <ScheduleExport
                        schedules={schedules}
                        filteredSchedules={filteredSchedules}
                    />
                </div>
            </div>

            {view === 'calendar' ? (
                <ScheduleCalendar
                    schedules={filteredSchedules}
                    canEdit={false}
                    onApprove={handleApprove}
                    onReject={(_id, _type) => {
                        toast.info('Use table view for quick actions');
                    }}
                />
            ) : (
                <ScheduleTable
                    schedules={filteredSchedules}
                    onRowClick={handleRowClick}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    isProcessing={isProcessing}
                />
            )}

            <ScheduleDetailModal
                schedule={selectedSchedule}
                open={detailOpen}
                onOpenChange={setDetailOpen}
            />
        </div>
    );
}
