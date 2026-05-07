'use client';

import { useState, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Clock, Video, Building, Edit, Trash2, Plus, StickyNote } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export interface ScheduleEvent {
    id: number | string;
    group_id: number;
    student_id?: number;
    type: 'SEMPRO' | 'SIDANG' | 'EXPO' | 'BIMBINGAN' | 'TA_DEFENSE';
    date: string;
    room: string;
    mode?: string | null;
    notes?: string | null;
    status?: string;
    period_name?: string;
    student_name?: string;
    examiner1?: { name: string } | null;
    examiner2?: { name: string } | null;
    examiners?: { name: string; role?: string }[];
    group: {
        title: {
            title: string;
            lecturer?: { name: string } | null;
        } | null;
        members?: {
            student: { name: string };
        }[];
    };
}

interface ScheduleCalendarProps {
    schedules: ScheduleEvent[];
    canEdit?: boolean;
    onAdd?: (date: Date) => void;
    onEdit?: (schedule: ScheduleEvent) => void;
    onDelete?: (id: number | string) => void;
    onApprove?: (id: number | string, type: string) => void;
    onReject?: (id: number | string, type: string) => void;
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bgColor: string; dotColor: string }> = {
    BIMBINGAN: {
        label: 'Bimbingan',
        color: 'text-blue-700 dark:text-blue-400',
        bgColor: 'bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-900',
        dotColor: 'bg-blue-500',
    },
    SEMPRO: {
        label: 'Seminar Proposal',
        color: 'text-amber-700 dark:text-amber-400',
        bgColor: 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900',
        dotColor: 'bg-amber-500',
    },
    SIDANG: {
        label: 'Sidang TA',
        color: 'text-purple-700 dark:text-purple-400',
        bgColor: 'bg-purple-50 border-purple-200 dark:bg-purple-950/40 dark:border-purple-900',
        dotColor: 'bg-purple-500',
    },
    EXPO: {
        label: 'Expo',
        color: 'text-emerald-700 dark:text-emerald-400',
        bgColor: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900',
        dotColor: 'bg-emerald-500',
    },
    TA_DEFENSE: {
        label: 'TA Defense',
        color: 'text-rose-700 dark:text-rose-400',
        bgColor: 'bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-900',
        dotColor: 'bg-rose-500',
    },
};

export default function ScheduleCalendar({
    schedules,
    canEdit = false,
    onAdd,
    onEdit,
    onDelete,
    onApprove,
    onReject,
}: ScheduleCalendarProps) {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

    // Group events by date string for quick lookup
    const eventsByDate = useMemo(() => {
        const map = new Map<string, ScheduleEvent[]>();
        for (const s of schedules) {
            const dateObj = new Date(s.date);
            if (isNaN(dateObj.getTime())) {
                console.warn('Invalid date in schedule:', s);
                continue;
            }
            const key = format(dateObj, 'yyyy-MM-dd');
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(s);
        }
        return map;
    }, [schedules]);

    // Events for the selected day
    const selectedDayEvents = useMemo(() => {
        const key = format(selectedDate, 'yyyy-MM-dd');
        return (eventsByDate.get(key) || []).sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;
            return dateA.getTime() - dateB.getTime();
        });
    }, [selectedDate, eventsByDate]);

    // Get unique event types for a given date (for dot colors)
    const getEventTypesForDate = (date: Date): string[] => {
        const key = format(date, 'yyyy-MM-dd');
        const events = eventsByDate.get(key) || [];
        return [...new Set(events.map(e => e.type))];
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
            {/* Calendar Panel */}
            <Card className="w-full lg:w-fit">
                <CardContent className="p-3 sm:p-4">
                    <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => date && setSelectedDate(date)}
                        month={currentMonth}
                        onMonthChange={setCurrentMonth}
                        className="w-full"
                        classNames={{
                            day: "relative w-full h-full p-0 text-center [&:last-child[data-selected=true]_button]:rounded-r-md group/day aspect-square select-none [&:first-child[data-selected=true]_button]:rounded-l-md",
                        }}
                        components={{
                            DayButton: ({ day, modifiers, className, ...props }) => {
                                const types = getEventTypesForDate(day.date);
                                const hasEvents = types.length > 0;
                                const isSelected = modifiers.selected;
                                const isToday = modifiers.today;

                                return (
                                    <button
                                        className={cn(
                                            "inline-flex flex-col items-center justify-center w-full aspect-square rounded-md text-sm font-normal transition-colors relative",
                                            "hover:bg-accent hover:text-accent-foreground",
                                            isSelected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                                            isToday && !isSelected && "bg-accent text-accent-foreground",
                                            modifiers.outside && "text-muted-foreground opacity-50",
                                            modifiers.disabled && "text-muted-foreground opacity-50",
                                            className
                                        )}
                                        {...props}
                                    >
                                        <span>{day.date.getDate()}</span>
                                        {hasEvents && (
                                            <span className="flex gap-0.5 absolute bottom-1">
                                                {types.slice(0, 3).map((type) => (
                                                    <span
                                                        key={type}
                                                        className={cn(
                                                            "w-1.5 h-1.5 rounded-full",
                                                            isSelected ? "bg-primary-foreground/70" : TYPE_CONFIG[type]?.dotColor || 'bg-gray-400'
                                                        )}
                                                    />
                                                ))}
                                            </span>
                                        )}
                                    </button>
                                );
                            },
                        }}
                    />
                    {/* Legend */}
                    <div className="flex flex-wrap gap-3 pt-3 px-1 border-t mt-2">
                        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                            <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <span className={cn("w-2 h-2 rounded-full", cfg.dotColor)} />
                                {cfg.label}
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Day Detail Panel */}
            <Card className="min-h-[400px] flex flex-col">
                <CardHeader className="pb-3 flex flex-row items-center justify-between shrink-0">
                    <div>
                        <CardTitle className="text-lg">
                            {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {selectedDayEvents.length === 0
                                ? 'No events scheduled'
                                : `${selectedDayEvents.length} event${selectedDayEvents.length > 1 ? 's' : ''}`}
                        </p>
                    </div>
                    {canEdit && onAdd && (
                        <Button size="sm" onClick={() => onAdd(selectedDate)}>
                            <Plus className="mr-1 h-4 w-4" /> Add
                        </Button>
                    )}
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto">
                    {selectedDayEvents.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground text-sm py-12">
                            No events on this day.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {selectedDayEvents.map((event) => {
                                const cfg = TYPE_CONFIG[event.type] || TYPE_CONFIG.BIMBINGAN;
                                const isPending = event.status === 'PENDING_APPROVAL';
                                const statusLabel = event.status
                                    ? event.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                                    : '';
                                const statusVariant = event.status === 'COMPLETED' || event.status === 'DONE' ? 'default'
                                    : event.status === 'CANCELLED' ? 'destructive'
                                    : event.status === 'PENDING_APPROVAL' ? 'secondary'
                                    : 'secondary';

                                return (
                                    <div
                                        key={event.id}
                                        className={cn(
                                            "rounded-lg border border-muted-foreground/20 bg-white dark:bg-zinc-950 p-4 transition-colors",
                                            isPending && "border-amber-300 dark:border-amber-700"
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="flex flex-col gap-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Badge variant="outline" className="text-xs font-semibold text-black dark:text-white">
                                                        {cfg.label}
                                                    </Badge>
                                                    {event.status && (
                                                        <Badge variant={statusVariant as any} className="text-xs">
                                                            {statusLabel}
                                                        </Badge>
                                                    )}
                                                    {event.period_name && (
                                                        <Badge variant="outline" className="text-xs text-muted-foreground">
                                                            {event.period_name}
                                                        </Badge>
                                                    )}
                                                    {event.mode && (
                                                        <Badge variant="outline" className="text-xs gap-1 text-black dark:text-white">
                                                            {event.mode === 'online' ? (
                                                                <Video className="h-3 w-3" />
                                                            ) : (
                                                                <Building className="h-3 w-3" />
                                                            )}
                                                            {event.mode}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <h4 className="font-semibold text-sm leading-snug text-black dark:text-white truncate">
                                                    {event.group?.title?.title || 'Untitled Project'}
                                                </h4>
                                                {event.type === 'TA_DEFENSE' && event.student_name && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Student: {event.student_name}
                                                    </p>
                                                )}
                                                {(event.examiner1 || event.examiner2) && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Examiners: {[event.examiner1?.name, event.examiner2?.name].filter(Boolean).join(', ')}
                                                    </p>
                                                )}
                                                {event.examiners && event.examiners.length > 0 && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Examiners: {event.examiners.map(e => e.name).join(', ')}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex gap-1 shrink-0">
                                                {canEdit && event.type === 'BIMBINGAN' && (
                                                    <>
                                                        {onEdit && (
                                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(event)}>
                                                                <Edit className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
                                                        {onDelete && (
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(event.id)}>
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
                                                    </>
                                                )}
                                                {isPending && onApprove && (
                                                    <Button variant="ghost" size="sm" className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
                                                        onClick={() => onApprove(event.id, event.type)}>
                                                        Approve
                                                    </Button>
                                                )}
                                                {isPending && onReject && (
                                                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive"
                                                        onClick={() => onReject(event.id, event.type)}>
                                                        Reject
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {format(new Date(event.date), 'HH:mm')}
                                            </span>
                                            {event.room && (
                                                <span className="flex items-center gap-1">
                                                    <MapPin className="h-3 w-3" />
                                                    {event.room}
                                                </span>
                                            )}
                                            {event.group?.title?.lecturer && (
                                                <span className="text-xs">
                                                    Dosen: {event.group.title.lecturer.name}
                                                </span>
                                            )}
                                        </div>
                                        {event.notes && (
                                            <div className="mt-2 text-xs text-muted-foreground flex items-start gap-1">
                                                <StickyNote className="h-3 w-3 mt-0.5 shrink-0" />
                                                <span>{event.notes}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
