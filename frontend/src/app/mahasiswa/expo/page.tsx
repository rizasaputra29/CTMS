'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Loader2, CalendarDays, MapPin, Users, Clock, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

interface ExpoEvent {
    id: number;
    name: string;
    date: string;
    start_time: string;
    end_time: string;
    room: string;
    capacity: number;
    registrations_count: number;
    is_registered: boolean;
}

export default function MahasiswaExpoPage() {
    const [events, setEvents] = useState<ExpoEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [registering, setRegistering] = useState<number | null>(null);

    const fetchEvents = useCallback(async () => {
        try {
            const res = await api.get('/mahasiswa/expo-events');
            setEvents(res.data || []);
        } catch (err) {
            console.error('Failed to fetch expo events', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchEvents(); }, [fetchEvents]);

    const handleRegister = async (eventId: number) => {
        if (!confirm('Register your group for this expo event?')) return;
        setRegistering(eventId);
        try {
            await api.post(`/mahasiswa/expo-events/${eventId}/register`);
            toast.success('Successfully registered for expo!');
            fetchEvents();
        } catch (error) {
            if (axios.isAxiosError(error)) toast.error(error.response?.data?.message || 'Registration failed');
            else toast.error('Registration failed');
        } finally {
            setRegistering(null);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Expo Events</h1>
                <p className="text-muted-foreground">Register your group for an available expo event.</p>
            </div>

            {events.length === 0 ? (
                <div className="text-center py-12 border rounded-lg border-dashed">
                    <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                    <h2 className="text-xl font-bold mb-2">No Expo Events Available</h2>
                    <p className="text-muted-foreground">No expo events are currently open for registration.</p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {events.map((evt) => {
                        const isFull = evt.registrations_count >= evt.capacity;
                        const remaining = evt.capacity - evt.registrations_count;

                        return (
                            <Card key={evt.id} className={evt.is_registered ? 'border-primary' : isFull ? 'opacity-60' : ''}>
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-lg">{evt.name}</CardTitle>
                                        {evt.is_registered ? (
                                            <Badge className="bg-green-600">
                                                <CheckCircle2 className="mr-1 h-3 w-3" /> Registered
                                            </Badge>
                                        ) : isFull ? (
                                            <Badge variant="destructive">
                                                <AlertCircle className="mr-1 h-3 w-3" /> Full
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline">{remaining} slots left</Badge>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex items-center gap-2 text-sm">
                                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                                        <span>{new Date(evt.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                        <span>{evt.start_time.slice(0, 5)} – {evt.end_time.slice(0, 5)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <MapPin className="h-4 w-4 text-muted-foreground" />
                                        <span>{evt.room}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <Users className="h-4 w-4 text-muted-foreground" />
                                        <span>{evt.registrations_count}/{evt.capacity} registered</span>
                                    </div>
                                    {/* Capacity bar */}
                                    <div className="w-full bg-muted rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full transition-all ${isFull ? 'bg-destructive' : 'bg-primary'}`}
                                            style={{ width: `${Math.min(100, (evt.registrations_count / evt.capacity) * 100)}%` }}
                                        />
                                    </div>
                                    {!evt.is_registered && !isFull && (
                                        <Button
                                            className="w-full mt-2"
                                            onClick={() => handleRegister(evt.id)}
                                            disabled={registering === evt.id}
                                        >
                                            {registering === evt.id ? (
                                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Registering...</>
                                            ) : (
                                                'Daftar Expo'
                                            )}
                                        </Button>
                                    )}
                                    {evt.is_registered && (
                                        <p className="text-sm text-green-600 font-medium text-center">
                                            ✓ Your group is registered for this event
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
