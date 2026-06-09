'use client';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, Users, FileText, ExternalLink } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { ScheduleEvent } from './ScheduleCalendar';

interface ScheduleDetailModalProps {
    schedule: ScheduleEvent | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ScheduleDetailModal({
    schedule,
    open,
    onOpenChange,
}: ScheduleDetailModalProps) {
    if (!schedule) return null;

    const date = parseISO(schedule.date);
    const isValidDate = !isNaN(date.getTime());

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'APPROVED':
            case 'COMPLETED':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'REJECTED':
                return 'bg-red-100 text-red-800 border-red-200';
            case 'PENDING':
                return 'bg-amber-100 text-amber-800 border-amber-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'BIMBINGAN':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'SEMPRO':
                return 'bg-amber-100 text-amber-800 border-amber-200';
            case 'EXPO':
                return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case 'TA_DEFENSE':
                return 'bg-rose-100 text-rose-800 border-rose-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'BIMBINGAN':
                return 'Guidance Session';
            case 'SEMPRO':
                return 'Proposal Defense';
            case 'EXPO':
                return 'Expo Presentation';
            case 'TA_DEFENSE':
                return 'Final Defense';
            default:
                return type;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <Badge
                            variant="outline"
                            className={`${getTypeColor(schedule.type)} capitalize font-semibold`}
                        >
                            {getTypeLabel(schedule.type)}
                        </Badge>
                        <Badge
                            variant="outline"
                            className={`${getStatusColor(schedule.status)} capitalize`}
                        >
                            {(schedule.status || 'SCHEDULED').toLowerCase()}
                        </Badge>
                    </div>
                    <DialogTitle className="text-2xl font-bold mt-2">
                        {schedule.group?.title?.title || 'Schedule Details'}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-start gap-3">
                            <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Date</p>
                                <p className="text-base">
                                    {isValidDate ? format(date, 'EEEE, MMMM d, yyyy') : 'Invalid date'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Time</p>
                                <p className="text-base">
                                    {schedule.start_time
                                        ? `${schedule.start_time} - ${schedule.end_time || 'TBD'}`
                                        : isValidDate
                                          ? format(date, 'HH:mm')
                                          : 'Time not set'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Location</p>
                                <p className="text-base">
                                    {schedule.mode === 'online'
                                        ? 'Online Meeting'
                                        : schedule.room || 'Room not specified'}
                                </p>
                                {schedule.online_link && (
                                    <a
                                        href={schedule.online_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                                    >
                                        Join Online
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                )}
                            </div>
                        </div>

                        {schedule.period_name && (
                            <div className="flex items-start gap-3">
                                <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                                    <span className="text-xs font-medium">P</span>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Period</p>
                                    <p className="text-base">{schedule.period_name}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <hr />

                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-muted-foreground" />
                            <h3 className="font-semibold">Participants</h3>
                        </div>

                        {(schedule.students && schedule.students.length > 0) || schedule.student_name ? (
                            <div className="pl-7 space-y-2">
                                <p className="text-sm text-muted-foreground">Student{schedule.students && schedule.students.length > 1 ? 's' : ''}</p>
                                {schedule.students && schedule.students.length > 0 ? (
                                    <div className="space-y-1">
                                        {schedule.students.map((student, idx) => (
                                            <p key={student.id} className="text-base font-medium">
                                                {idx + 1}. {student.name}
                                            </p>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-base font-medium">{schedule.student_name}</p>
                                )}
                            </div>
                        ) : null}

                        {(schedule.examiner1 || schedule.examiner2) && (
                            <div className="pl-7 space-y-2">
                                <p className="text-sm text-muted-foreground">Examiners</p>
                                <div className="space-y-1">
                                    {schedule.examiner1 && (
                                        <p className="text-base">
                                            1. {schedule.examiner1.name}
                                        </p>
                                    )}
                                    {schedule.examiner2 && (
                                        <p className="text-base">
                                            2. {schedule.examiner2.name}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {schedule.group?.supervisor && (
                            <div className="pl-7 space-y-2">
                                <p className="text-sm text-muted-foreground">Supervisor</p>
                                <p className="text-base">{schedule.group.supervisor.name}</p>
                            </div>
                        )}
                    </div>

                    {schedule.notes && (
                        <>
                            <hr />
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-muted-foreground" />
                                    <h3 className="font-semibold">Notes</h3>
                                </div>
                                <p className="pl-7 text-sm text-muted-foreground">
                                    {schedule.notes}
                                </p>
                            </div>
                        </>
                    )}

                    {schedule.rejection_reason && schedule.status === 'REJECTED' && (
                        <>
                            <hr />
                            <div className="space-y-2 rounded-md bg-red-50 p-4 border border-red-100">
                                <p className="text-sm font-medium text-red-800">
                                    Rejection Reason:
                                </p>
                                <p className="text-sm text-red-700">
                                    {schedule.rejection_reason}
                                </p>
                            </div>
                        </>
                    )}
                </div>

                <div className="flex justify-end gap-2 mt-6">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
