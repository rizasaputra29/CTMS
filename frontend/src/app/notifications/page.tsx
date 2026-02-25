'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Loader2, Bell, CheckCheck, Mail, MailOpen, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';

interface Notification {
    id: number;
    type: string;
    title: string;
    message: string;
    is_read: boolean;
    related_type: string | null;
    related_id: number | null;
    created_at: string;
}

interface PaginatedNotifications {
    data: Notification[];
    current_page: number;
    last_page: number;
    total: number;
}

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [total, setTotal] = useState(0);

    const fetchNotifications = useCallback(async (p: number) => {
        try {
            const res = await api.get(`/notifications?page=${p}&per_page=15`);
            const data: PaginatedNotifications = res.data;
            setNotifications(data.data || []);
            setPage(data.current_page);
            setLastPage(data.last_page);
            setTotal(data.total);
        } catch (err) {
            console.error('Failed to fetch notifications', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchNotifications(1); }, [fetchNotifications]);

    const markAsRead = async (id: number) => {
        try {
            await api.put(`/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        } catch (err) {
            console.error('Failed to mark as read', err);
        }
    };

    const markAllAsRead = async () => {
        try {
            await api.put('/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            toast.success('All notifications marked as read');
        } catch (err) {
            toast.error('Failed to mark all as read');
        }
    };

    const typeIcon = (type: string) => {
        const colors: Record<string, string> = {
            PROPOSAL_SUBMITTED: 'bg-blue-100 text-blue-600',
            PROPOSAL_APPROVED: 'bg-green-100 text-green-600',
            PROPOSAL_REJECTED: 'bg-red-100 text-red-600',
            PROPOSAL_RESUBMITTED: 'bg-yellow-100 text-yellow-600',
            EXPO_REGISTRATION: 'bg-purple-100 text-purple-600',
            SCHEDULE_APPROVED: 'bg-green-100 text-green-600',
            SCHEDULE_REJECTED: 'bg-red-100 text-red-600',
        };
        return colors[type] || 'bg-muted text-muted-foreground';
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
                    <p className="text-muted-foreground">
                        {total} notifications · {unreadCount} unread
                    </p>
                </div>
                {unreadCount > 0 && (
                    <Button variant="outline" size="sm" onClick={markAllAsRead}>
                        <CheckCheck className="mr-2 h-4 w-4" /> Mark All Read
                    </Button>
                )}
            </div>

            {notifications.length === 0 ? (
                <div className="text-center py-12 border rounded-lg border-dashed">
                    <Bell className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                    <h2 className="text-xl font-bold mb-2">No Notifications</h2>
                    <p className="text-muted-foreground">You&#39;re all caught up!</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {notifications.map((n) => (
                        <Card
                            key={n.id}
                            className={`cursor-pointer transition-colors hover:bg-muted/50 ${!n.is_read ? 'border-primary/30 bg-primary/5' : ''}`}
                            onClick={() => !n.is_read && markAsRead(n.id)}
                        >
                            <CardContent className="flex items-start gap-4 py-4">
                                <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${typeIcon(n.type)}`}>
                                    {n.is_read ? (
                                        <MailOpen className="h-4 w-4" />
                                    ) : (
                                        <Mail className="h-4 w-4" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-sm font-medium ${!n.is_read ? 'text-primary' : ''}`}>
                                            {n.title}
                                        </span>
                                        {!n.is_read && (
                                            <Badge variant="default" className="text-xs px-1.5 py-0">New</Badge>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: id })}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {lastPage > 1 && (
                <div className="flex justify-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => fetchNotifications(page - 1)}
                    >
                        Previous
                    </Button>
                    <span className="text-sm text-muted-foreground flex items-center px-3">
                        Page {page} of {lastPage}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= lastPage}
                        onClick={() => fetchNotifications(page + 1)}
                    >
                        Next
                    </Button>
                </div>
            )}
        </div>
    );
}
