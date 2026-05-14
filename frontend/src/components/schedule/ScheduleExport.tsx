'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';
import type { ScheduleEvent } from './ScheduleCalendar';

interface ScheduleExportProps {
    schedules: ScheduleEvent[];
    filteredSchedules: ScheduleEvent[];
    fileName?: string;
}

export function ScheduleExport({ schedules, filteredSchedules, fileName = 'schedules' }: ScheduleExportProps) {
    const [isExporting, setIsExporting] = useState(false);

    const convertToCSV = (data: ScheduleEvent[]) => {
        const headers = [
            'ID',
            'Type',
            'Date',
            'Start Time',
            'End Time',
            'Room',
            'Group Title',
            'Student Name',
            'Period',
            'Status',
            'Examiner 1',
            'Examiner 2',
            'Mode',
            'Notes',
        ];

        const rows = data.map((schedule) => {
            const dateObj = new Date(schedule.date);
            const dateStr = !isNaN(dateObj.getTime()) ? format(dateObj, 'yyyy-MM-dd') : '';
            const timeStr = !isNaN(dateObj.getTime()) ? format(dateObj, 'HH:mm') : '';

            return [
                schedule.id,
                schedule.type,
                dateStr,
                schedule.start_time || timeStr,
                schedule.end_time || '',
                schedule.room || '',
                schedule.group?.title?.title || '',
                schedule.student_name || '',
                schedule.period_name || '',
                schedule.status || '',
                schedule.examiner1?.name || '',
                schedule.examiner2?.name || '',
                schedule.mode || '',
                schedule.notes || '',
            ];
        });

        const csvContent = [
            headers.join(','),
            ...rows.map((row) =>
                row.map((cell) => {
                    const cellStr = String(cell || '');
                    if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                        return `"${cellStr.replace(/"/g, '""')}"`;
                    }
                    return cellStr;
                }).join(',')
            ),
        ].join('\n');

        return csvContent;
    };

    const downloadCSV = (data: ScheduleEvent[], suffix: string) => {
        setIsExporting(true);
        try {
            const csvContent = convertToCSV(data);
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            
            const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm');
            link.setAttribute('href', url);
            link.setAttribute('download', `${fileName}_${suffix}_${timestamp}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={isExporting}>
                    <Download className="mr-2 h-4 w-4" />
                    {isExporting ? 'Exporting...' : 'Export'}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => downloadCSV(schedules, 'all')}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Export All
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadCSV(filteredSchedules, 'filtered')}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Export Filtered
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
