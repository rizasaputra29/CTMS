'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, Loader2, User, Lock } from 'lucide-react';
import api from '@/lib/api';
import DashboardLayout from '@/components/layout/DashboardLayout';
import axios from 'axios';
import { toast } from "sonner";

export default function ProfilePage() {
    const router = useRouter();
    const { user, login } = useAuth();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user) {
            setName(user.name);
            setEmail(user.email);
        }
    }, [user]);

    const handleProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await api.put('/profile', { name, email });
            toast.success('Profile updated successfully.');
            const token = localStorage.getItem('token');
            if (token) {
                login(token, response.data.user);
            }
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                toast.error(err.response?.data?.message || 'Failed to update profile');
            } else {
                toast.error('An unexpected error occurred');
            }
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== passwordConfirmation) {
            toast.error('Passwords do not match');
            return;
        }
        setLoading(true);
        try {
            await api.put('/profile', {
                name,
                email,
                password,
                password_confirmation: passwordConfirmation,
            });
            toast.success('Password updated successfully.');
            setPassword('');
            setPasswordConfirmation('');
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                toast.error(err.response?.data?.message || 'Failed to update password');
            } else {
                toast.error('An unexpected error occurred');
            }
        } finally {
            setLoading(false);
        }
    };

    const initials = user?.name
        ? user.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
        : '?';

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header with Back Button */}
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Account</h1>
                        <p className="text-muted-foreground">Manage your profile information and password.</p>
                    </div>
                </div>

                {/* User Info Banner */}
                <Card>
                    <CardContent className="flex items-center gap-5 p-6">
                        <Avatar className="h-16 w-16 rounded-lg">
                            <AvatarFallback className="rounded-lg text-lg">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-lg font-semibold truncate">{user?.name}</h2>
                            <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                        </div>
                        <Badge variant="secondary" className="capitalize shrink-0">
                            {user?.role}
                        </Badge>
                    </CardContent>
                </Card>

                <div className="grid gap-8 md:grid-cols-2">
                    {/* Profile Information */}
                    <Card>
                        <form onSubmit={handleProfileSubmit}>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <User className="h-4 w-4" /> Profile Information
                                </CardTitle>
                                <CardDescription>Update your name and email address.</CardDescription>
                            </CardHeader>
                            <CardContent className="py-2">
                                <div className="grid gap-2.5 py-2">
                                    <Label htmlFor="name">Full Name</Label>
                                    <Input
                                        id="name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="grid gap-2.5">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                            </CardContent>
                            <CardFooter className="pt-2">
                                <Button type="submit" disabled={loading}>
                                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Profile
                                </Button>
                            </CardFooter>
                        </form>
                    </Card>

                    {/* Change Password */}
                    <Card>
                        <form onSubmit={handlePasswordSubmit}>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Lock className="h-4 w-4" /> Change Password
                                </CardTitle>
                                <CardDescription>Leave blank to keep your current password.</CardDescription>
                            </CardHeader>
                            <CardContent className="py-2">
                                <div className="grid gap-2.5 py-2">
                                    <Label htmlFor="password">New Password</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        minLength={8}
                                        placeholder="Min. 8 characters"
                                    />
                                </div>
                                <div className="grid gap-2.5">
                                    <Label htmlFor="password_confirmation">Confirm Password</Label>
                                    <Input
                                        id="password_confirmation"
                                        type="password"
                                        value={passwordConfirmation}
                                        onChange={(e) => setPasswordConfirmation(e.target.value)}
                                        minLength={8}
                                        placeholder="Re-enter password"
                                    />
                                </div>
                            </CardContent>
                            <CardFooter className="pt-2">
                                <Button type="submit" disabled={loading || !password}>
                                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Update Password
                                </Button>
                            </CardFooter>
                        </form>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}
