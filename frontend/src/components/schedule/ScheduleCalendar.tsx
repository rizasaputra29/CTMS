'use client';

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, MapPin, Video, Building, User, Users, StickyNote, Check, X, Edit, Trash2 } from 'lucide-react';
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    addDays,
    isSameMonth,
    isSameDay,
    isToday,
    addMonths,
    subMonths,
    parseISO,
} from 'date-fns';
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
    start_time?: string;
    end_time?: string;
    online_link?: string;
    rejection_reason?: string;
    group: {
        title: {
            title: string;
            lecturer?: { name: string } | null;
        } | null;
        members?: {
            student: { name: string };
        }[];
        supervisor?: { name: string } | null;
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
    onRowClick?: (schedule: ScheduleEvent) => void;
}

const TYPE_CONFIG: Record<string, { 
    label: string; 
    textColor: string; 
    bgColor: string;
    borderColor: string;
}> = {
    BIMBINGAN: {
        label: 'Bimbingan',
        textColor: 'text-blue-700',
        bgColor: 'bg-blue-100',
        borderColor: 'border-blue-200',
    },
    SEMPRO: {
        label: 'Sempro',
        textColor: 'text-amber-700',
        bgColor: 'bg-amber-100',
        borderColor: 'border-amber-200',
    },
    SIDANG: {
        label: 'Sidang TA',
        textColor: 'text-purple-700',
        bgColor: 'bg-purple-100',
        borderColor: 'border-purple-200',
    },
    EXPO: {
        label: 'Expo',
        textColor: 'text-emerald-700',
        bgColor: 'bg-emerald-100',
        borderColor: 'border-emerald-200',
    },
    TA_DEFENSE: {
        label: 'TA Defense',
        textColor: 'text-rose-700',
        bgColor: 'bg-rose-100',
        borderColor: 'border-rose-200',
    },
};

// Get event title for display
const getEventTitle = (event: ScheduleEvent): string => {
    if (event.student_name) {
        return event.student_name;
    }
    if (event.group?.title?.title) {
        return event.group.title.title;
    }
    return TYPE_CONFIG[event.type]?.label || event.type;
};

// Format time to display format matching dedicated pages (e.g., "09:00")
const formatTime = (timeString: string): string => {
    if (!timeString) return '';
    // Return HH:mm format (slice first 5 chars: "09:00:00" -> "09:00")
    return timeString.slice(0, 5);
};

// Get event time for display
const getEventTime = (event: ScheduleEvent): string => {
    return formatTime(event.start_time || '');
};

// Format time range for display matching dedicated pages (e.g., "09:00 — 11:00")
const formatTimeRange = (event: ScheduleEvent): string => {
    const start = formatTime(event.start_time || '');
    const end = formatTime(event.end_time || '');
    
    if (start && end) {
        return `${start} — ${end}`; // Using em-dash with spacing like dedicated pages
    } else if (start) {
        return `${start}`;
    }
    return 'Time not set';
};

export default function ScheduleCalendar({
    schedules,
    canEdit = false,
    onAdd,
    onEdit,
    onDelete,
    onApprove,
    onReject,
    onRowClick,
}: ScheduleCalendarProps) {
    const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

    // Group events by date
    const eventsByDate = useMemo(() => {
        const map = new Map<string, ScheduleEvent[]>();
        for (const s of schedules) {
            // Use parseISO for proper date parsing, fallback to new Date if that fails
            let dateObj: Date;
            try {
                dateObj = parseISO(s.date);
                if (isNaN(dateObj.getTime())) {
                    // Try new Date as fallback for non-ISO formats
                    dateObj = new Date(s.date);
                }
            } catch {
                dateObj = new Date(s.date);
            }

            if (isNaN(dateObj.getTime())) {
                console.warn('Invalid date in schedule:', s);
                continue;
            }
            const key = format(dateObj, 'yyyy-MM-dd');
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(s);
        }
        // Sort events by time
        map.forEach((events) => {
            events.sort((a, b) => {
                const timeA = a.start_time || '';
                const timeB = b.start_time || '';
                return timeA.localeCompare(timeB);
            });
        });
        return map;
    }, [schedules]);

    // Generate calendar days
    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);

        const days: Date[] = [];
        let day = startDate;
        while (day <= endDate) {
            days.push(day);
            day = addDays(day, 1);
        }
        return days;
    }, [currentMonth]);

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const handleToday = () => {
        const today = new Date();
        setCurrentMonth(today);
        setSelectedDate(today);
    };

    const getEventsForDate = useCallback((date: Date): ScheduleEvent[] => {
        const key = format(date, 'yyyy-MM-dd');
        return eventsByDate.get(key) || [];
    }, [eventsByDate]);

    const selectedDayEvents = useMemo(() => {
        return getEventsForDate(selectedDate);
    }, [selectedDate, getEventsForDate]);

    return (
        <div className="flex flex-col gap-6">
            {/* Calendar Card */}
            <Card className="w-full overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleToday}
                            className="font-medium"
                        >
                            Today
                        </Button>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handlePrevMonth}
                                className="h-8 w-8"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleNextMonth}
                                className="h-8 w-8"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                        <h2 className="text-xl font-semibold">
                            {format(currentMonth, 'MMMM yyyy')}
                        </h2>
                    </div>
                    <div className="flex items-center gap-2">
                        {canEdit && onAdd && (
                            <Button
                                size="sm"
                                onClick={() => onAdd(selectedDate)}
                                className="bg-black text-white hover:bg-gray-800"
                            >
                                <span className="mr-1">+</span> New event
                            </Button>
                        )}
                    </div>
                </div>

                {/* Calendar Grid */}
                <CardContent className="p-0">
                    {/* Week Day Headers */}
                    <div className="grid grid-cols-7 border-b">
                        {weekDays.map((day) => (
                            <div
                                key={day}
                                className="py-3 text-center text-sm font-medium text-gray-500"
                            >
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar Days */}
                    <div className="grid grid-cols-7">
                        {calendarDays.map((day, dayIdx) => {
                            const events = getEventsForDate(day);
                            const isCurrentMonth = isSameMonth(day, currentMonth);
                            const isSelected = isSameDay(day, selectedDate);
                            const isTodayDate = isToday(day);

                            return (
                                <div
                                    key={day.toISOString()}
                                    onClick={() => setSelectedDate(day)}
                                    className={cn(
                                        "min-h-[100px] border-b border-r p-2 cursor-pointer transition-colors",
                                        !isCurrentMonth && "bg-gray-50/50",
                                        isSelected && "bg-blue-50/50",
                                        "hover:bg-gray-50",
                                        (dayIdx + 1) % 7 === 0 && "border-r-0",
                                        dayIdx >= calendarDays.length - 7 && "border-b-0"
                                    )}
                                >
                                    {/* Date Number */}
                                    <div className="flex justify-center mb-1">
                                        {isTodayDate ? (
                                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-black text-white text-sm font-medium">
                                                {format(day, 'd')}
                                            </span>
                                        ) : (
                                            <span className={cn(
                                                "text-sm font-medium",
                                                !isCurrentMonth && "text-gray-400",
                                                isCurrentMonth && "text-gray-900"
                                            )}>
                                                {format(day, 'd')}
                                            </span>
                                        )}
                                    </div>

                                    {/* Events */}
                                    <div className="space-y-1">
                                        {events.slice(0, 3).map((event) => {
                                            const cfg = TYPE_CONFIG[event.type] || TYPE_CONFIG.BIMBINGAN;
                                            const time = getEventTime(event);
                                            const title = getEventTitle(event);

                                            return (
                                                <div
                                                    key={event.id}
                                                    className={cn(
                                                        "px-2 py-1 rounded-md text-xs truncate cursor-pointer transition-opacity",
                                                        cfg.bgColor,
                                                        cfg.textColor,
                                                        cfg.borderColor,
                                                        "border",
                                                        "hover:opacity-80"
                                                    )}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onRowClick?.(event);
                                                    }}
                                                    title={`${time} ${title}`}
                                                >
                                                    {time && (
                                                        <span className="font-medium mr-1">
                                                            {time}
                                                        </span>
                                                    )}
                                                    <span>{title}</span>
                                                </div>
                                            );
                                        })}
                                        {events.length > 3 && (
                                            <div className="px-2 py-0.5 text-xs text-gray-500">
                                                +{events.length - 3} more
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Selected Day Events Panel */}
            <Card className="min-h-[300px]">
                <div className="px-6 py-4 border-b bg-gray-50/50">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold text-lg">
                                {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                            </h3>
                            <p className="text-sm text-gray-500">
                                {selectedDayEvents.length === 0
                                    ? 'No events scheduled'
                                    : `${selectedDayEvents.length} event${selectedDayEvents.length > 1 ? 's' : ''} scheduled`}
                            </p>
                        </div>
                    </div>
                </div>
                <CardContent className="p-0">
                    {selectedDayEvents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                            <CalendarIcon className="h-12 w-12 mb-3 opacity-20" />
                            <p className="text-sm font-medium">No events on this day</p>
                            <p className="text-xs mt-1 opacity-70">Select a date with events to view details</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {selectedDayEvents.map((event, index) => {
                                const cfg = TYPE_CONFIG[event.type] || TYPE_CONFIG.BIMBINGAN;
                                const timeRange = formatTimeRange(event);
                                const isPending = event.status === 'PENDING' || event.status === 'PENDING_APPROVAL';
                                const isRejected = event.status === 'REJECTED' || event.status === 'CANCELLED';

                                return (
                                    <div
                                        key={event.id}
                                        className={cn(
                                            "group p-5 hover:bg-gray-50 transition-colors",
                                            index === 0 && "rounded-t-lg",
                                            index === selectedDayEvents.length - 1 && "rounded-b-lg"
                                        )}
                                    >
                                        {/* Header Row */}
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                {/* Event Type Badge */}
                                                <span className={cn(
                                                    "px-2.5 py-1 rounded-md text-xs font-medium",
                                                    cfg.bgColor,
                                                    cfg.textColor
                                                )}>
                                                    {cfg.label}
                                                </span>
                                                
                                                {/* Status Badge */}
                                                {event.status && (
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded-full text-xs font-medium",
                                                        event.status === 'APPROVED' || event.status === 'SCHEDULED'
                                                            ? "bg-green-100 text-green-700"
                                                            : event.status === 'COMPLETED' || event.status === 'DONE'
                                                                ? "bg-blue-100 text-blue-700"
                                                                : event.status === 'REJECTED' || event.status === 'CANCELLED'
                                                                    ? "bg-red-100 text-red-700"
                                                                    : "bg-amber-100 text-amber-700"
                                                    )}>
                                                        {event.status}
                                                    </span>
                                                )}
                                            </div>
                                            
                                            {/* Period */}
                                            {event.period_name && (
                                                <span className="text-xs text-gray-400">
                                                    {event.period_name}
                                                </span>
                                            )}
                                        </div>

                                        {/* Title */}
                                        <h4 className="text-base font-semibold text-gray-900 mb-3">
                                            {event.group?.title?.title || 'Untitled'}
                                        </h4>

                                        {/* Details Grid */}
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            {/* Time */}
                                            <div className="flex items-center gap-2 text-gray-600">
                                                <Clock className="h-4 w-4 text-gray-400" />
                                                <span className="font-medium text-gray-900">
                                                    {timeRange}
                                                </span>
                                            </div>

                                            {/* Location */}
                                            <div className="flex items-center gap-2 text-gray-600">
                                                <MapPin className="h-4 w-4 text-gray-400" />
                                                <span>
                                                    {event.room ? (
                                                        <span className="font-medium text-gray-900">{event.room}</span>
                                                    ) : event.mode === 'online' ? (
                                                        <span className="font-medium text-gray-900">Online</span>
                                                    ) : (
                                                        <span className="text-gray-400">Location not set</span>
                                                    )}
                                                </span>
                                            </div>

                                            {/* Student */}
                                            {(event.student_name || event.type === 'TA_DEFENSE') && (
                                                <div className="flex items-center gap-2 text-gray-600">
                                                    <User className="h-4 w-4 text-gray-400" />
                                                    <span>
                                                        {event.student_name ? (
                                                            <span className="font-medium text-gray-900">{event.student_name}</span>
                                                        ) : (
                                                            <span className="text-gray-400">No student assigned</span>
                                                        )}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Mode */}
                                            {event.mode && (
                                                <div className="flex items-center gap-2 text-gray-600">
                                                    {event.mode === 'online' ? (
                                                        <Video className="h-4 w-4 text-gray-400" />
                                                    ) : (
                                                        <Building className="h-4 w-4 text-gray-400" />
                                                    )}
                                                    <span className="capitalize font-medium text-gray-900">{event.mode}</span>
                                                </div>
                                            )}

                                            {/* Examiners */}
                                            {(event.examiner1 || event.examiner2 || (event.examiners && event.examiners.length > 0)) && (
                                                <div className="flex items-start gap-2 text-gray-600 col-span-2">
                                                    <Users className="h-4 w-4 text-gray-400 mt-0.5" />
                                                    <div>
                                                        <span className="text-xs text-gray-400 block mb-0.5">Examiners</span>
                                                        <span className="text-gray-900">
                                                            {event.examiners && event.examiners.length > 0
                                                                ? event.examiners.map(e => e.name).join(', ')
                                                                : [event.examiner1?.name, event.examiner2?.name].filter(Boolean).join(', ')}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Group Members */}
                                            {event.group?.members && event.group.members.length > 0 && (
                                                <div className="flex items-start gap-2 text-gray-600 col-span-2">
                                                    <Users className="h-4 w-4 text-gray-400 mt-0.5" />
                                                    <div>
                                                        <span className="text-xs text-gray-400 block mb-0.5">Group Members</span>
                                                        <span className="text-gray-900">
                                                            {event.group.members.map(m => m.student.name).join(', ')}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Notes */}
                                        {event.notes && (
                                            <div className="mt-3 pt-3 border-t border-gray-100">
                                                <div className="flex items-start gap-2">
                                                    <StickyNote className="h-4 w-4 text-gray-400 mt-0.5" />
                                                    <p className="text-sm text-gray-600">{event.notes}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Rejection Reason */}
                                        {isRejected && event.rejection_reason && (
                                            <div className="mt-3 p-3 bg-red-50 rounded-md border border-red-100">
                                                <p className="text-sm text-red-700">
                                                    <span className="font-medium">Rejection Reason:</span> {event.rejection_reason}
                                                </p>
                                            </div>
                                        )}

                                        {/* Action Buttons */}
                                        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                                            {isPending && (
                                                <>
                                                    {onApprove && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                                                            onClick={() => onApprove(event.id, event.type)}
                                                        >
                                                            <Check className="h-3.5 w-3.5 mr-1.5" />
                                                            Approve
                                                        </Button>
                                                    )}
                                                    {onReject && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                                                            onClick={() => onReject(event.id, event.type)}
                                                        >
                                                            <X className="h-3.5 w-3.5 mr-1.5" />
                                                            Reject
                                                        </Button>
                                                    )}
                                                </>
                                            )}
                                            {canEdit && event.type === 'BIMBINGAN' && (
                                                <>
                                                    {onEdit && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-gray-600 hover:text-gray-900"
                                                            onClick={() => onEdit(event)}
                                                        >
                                                            <Edit className="h-3.5 w-3.5 mr-1.5" />
                                                            Edit
                                                        </Button>
                                                    )}
                                                    {onDelete && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                            onClick={() => onDelete(event.id)}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                                            Delete
                                                        </Button>
                                                    )}
                                                </>
                                            )}
                                        </div>
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
