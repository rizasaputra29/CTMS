'use client';

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
import { id } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface MiniCalendarEvent {
    id: number | string;
    date: string;
    title: string;
    type: string;
}

interface MiniScheduleCalendarProps {
    events: MiniCalendarEvent[];
}

const EVENT_COLORS: Record<string, string> = {
    BIMBINGAN: 'bg-blue-500',
    SEMPRO: 'bg-amber-500',
    SIDANG: 'bg-primary-500',
    EXPO: 'bg-emerald-500',
    TA_DEFENSE: 'bg-rose-500',
    PDC1: 'bg-sky-500',
    PDC2: 'bg-violet-500',
};

export function MiniScheduleCalendar({ events }: MiniScheduleCalendarProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const days = useMemo(() => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
        const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

        const daysArray = [];
        let day = startDate;
        while (day <= endDate) {
            daysArray.push(day);
            day = addDays(day, 1);
        }
        return daysArray;
    }, [currentMonth]);

    const eventsByDate = useMemo(() => {
        const map = new Map<string, MiniCalendarEvent[]>();
        events.forEach((event) => {
            const dateKey = parseISO(event.date).toDateString();
            if (!map.has(dateKey)) map.set(dateKey, []);
            map.get(dateKey)!.push(event);
        });
        return map;
    }, [events]);

    const handlePrevMonth = useCallback(() => setCurrentMonth(subMonths(currentMonth, 1)), [currentMonth]);
    const handleNextMonth = useCallback(() => setCurrentMonth(addMonths(currentMonth, 1)), [currentMonth]);

    return (
        <Card className="h-full">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold">Schedule</CardTitle>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrevMonth}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNextMonth}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="text-center mb-3">
                    <h3 className="text-lg font-semibold">
                        {format(currentMonth, 'MMMM yyyy', { locale: id })}
                    </h3>
                </div>

                {/* Weekday headers */}
                <div className="grid grid-cols-7 mb-1">
                    {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day) => (
                        <div key={day} className="text-center text-xs font-medium text-gray-400 py-1">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-px bg-gray-100 border border-gray-100 rounded-lg overflow-hidden">
                    {days.map((day, dayIdx) => {
                        const dateKey = day.toDateString();
                        const dayEvents = eventsByDate.get(dateKey) || [];
                        const isCurrentMonth = isSameMonth(day, currentMonth);
                        const isTodayDate = isToday(day);

                        return (
                            <TooltipProvider key={dayIdx} delayDuration={100}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div
                                            className={cn(
                                                'min-h-[40px] bg-white p-1 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors',
                                                !isCurrentMonth && 'bg-gray-50 text-gray-300',
                                                isTodayDate && 'bg-primary-50',
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    'text-sm font-medium',
                                                    isTodayDate && 'text-primary-600',
                                                    !isCurrentMonth && 'text-gray-300',
                                                )}
                                            >
                                                {format(day, 'd')}
                                            </span>
                                            {dayEvents.length > 0 && (
                                                <div className="flex gap-0.5 mt-0.5">
                                                    {dayEvents.slice(0, 3).map((event, i) => (
                                                        <div
                                                            key={i}
                                                            className={cn(
                                                                'w-1.5 h-1.5 rounded-full',
                                                                EVENT_COLORS[event.type] || 'bg-gray-400',
                                                            )}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </TooltipTrigger>
                                    {dayEvents.length > 0 && (
                                        <TooltipContent side="bottom" className="max-w-xs">
                                            <div className="space-y-1">
                                                {dayEvents.map((event) => (
                                                    <div key={event.id} className="flex items-center gap-2">
                                                        <div
                                                            className={cn(
                                                                'w-2 h-2 rounded-full',
                                                                EVENT_COLORS[event.type] || 'bg-gray-400',
                                                            )}
                                                        />
                                                        <span className="text-xs">{event.title}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </TooltipContent>
                                    )}
                                </Tooltip>
                            </TooltipProvider>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
