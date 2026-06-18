'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Calendar, CheckCircle, GraduationCap, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Loading } from '@/components/ui/loading';
import { formatDate } from '@/lib/utils';
import { Period } from '../types';

export function RegistrationFeature() {
    const router = useRouter();
    const { user } = useAuth();
    const [periods, setPeriods] = useState<Period[]>([]);
    const [loading, setLoading] = useState(true);
    const [registering, setRegistering] = useState<number | null>(null);
    const [registeredPeriodId, setRegisteredPeriodId] = useState<number | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            // Fetch available periods
            const periodsRes = await api.get('/periods-list');
            const periodsData = periodsRes.data?.data || [];

            // Filter only active and non-finalized periods
            const availablePeriods = periodsData.filter(
                (p: Period) => p.is_active && !p.is_finalized
            );
            setPeriods(availablePeriods);

            // Check if already registered
            const registrationRes = await api.get('/mahasiswa/my-period');
            const registrationData = registrationRes.data?.data ?? registrationRes.data;
            if (registrationData?.period) {
                setRegisteredPeriodId(registrationData.period.id);
            }
        } catch (error) {
            console.error('Failed to fetch data', error);
            toast.error('Failed to load registration data');
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (periodId: number) => {
        setRegistering(periodId);
        try {
            await api.post('/mahasiswa/periods/register', { period_id: periodId });
            toast.success('Successfully registered for period');
            setRegisteredPeriodId(periodId);

            // Notify sidebar that registration is complete
            window.dispatchEvent(new Event('registration-complete'));

            // Redirect to dashboard after short delay
            setTimeout(() => {
                router.push('/mahasiswa/dashboard');
            }, 1500);
        } catch (error) {
            const errorMessage = api.isAxiosError(error)
                ? error.response?.data?.message
                : 'Failed to register for period';
            toast.error(errorMessage || 'Failed to register for period');
        } finally {
            setRegistering(null);
        }
    };

    if (loading) return <Loading variant="section" />;

    // If already registered, show success state
    if (registeredPeriodId) {
        const registeredPeriod = periods.find(p => p.id === registeredPeriodId);
        return (
            <div className="max-w-2xl mx-auto py-12">
                <Card className="border-green-200 bg-green-50/50">
                    <CardContent className="pt-6 pb-6 text-center">
                        <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-green-800 mb-2">
                            Registration Complete!
                        </h2>
                        <p className="text-green-700 mb-4">
                            You are registered for: <strong>{registeredPeriod?.name || 'Selected Period'}</strong>
                        </p>
                        <p className="text-sm text-green-600 mb-6">
                            Redirecting to dashboard...
                        </p>
                        <Button onClick={() => router.push('/mahasiswa/dashboard')}>
                            Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            {/* Header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                    <GraduationCap className="h-8 w-8 text-primary" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">
                    Welcome, {user?.name || 'Student'}!
                </h1>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                    To get started, you need to register for an academic period.
                    Select one of the available periods below.
                </p>
            </div>

            {/* Info Alert */}
            <Alert className="mb-8">
                <Calendar className="h-4 w-4" />
                <AlertTitle>Registration Required</AlertTitle>
                <AlertDescription>
                    You must register for a period before you can create or join a group,
                    browse titles, or access other features. You can only register for one period at a time.
                </AlertDescription>
            </Alert>

            {/* Period Cards */}
            {periods.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="pt-8 pb-8 text-center">
                        <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium mb-2">No Active Periods</h3>
                        <p className="text-muted-foreground">
                            There are no active periods available for registration at this time.
                            Please check back later or contact your administrator.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {periods.map((period) => (
                        <Card key={period.id} className="relative overflow-hidden">
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="text-xl">{period.name}</CardTitle>
                                        <CardDescription className="mt-1.5">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-3.5 w-3.5" />
                                                {formatDate(period.start_date)} - {formatDate(period.end_date)}
                                            </div>
                                        </CardDescription>
                                    </div>
                                    <Badge variant="default" className="bg-green-600">
                                        Open
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Button
                                    className="w-full"
                                    size="lg"
                                    onClick={() => handleRegister(period.id)}
                                    disabled={registering === period.id}
                                >
                                    {registering === period.id ? (
                                        <>
                                            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                            Registering...
                                        </>
                                    ) : (
                                        <>
                                            Register for This Period
                                            <ArrowRight className="ml-2 h-4 w-4" />
                                        </>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Footer Note */}
            <p className="text-center text-sm text-muted-foreground mt-8">
                Need help? Contact your academic advisor or administrator for assistance with period registration.
            </p>
        </div>
    );
}
