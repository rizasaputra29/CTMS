'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import axios from 'axios';
import Link from 'next/link';
import Image from 'next/image';

export default function LoginPage() {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await api.get('/sanctum/csrf-cookie', { baseURL: 'http://localhost:8000' });
            const response = await api.post('/login', { email, password });
            login(response.data.access_token, response.data.user);
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                setError(err.response?.data?.message || 'Login failed');
            } else {
                setError('An unexpected error occurred');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex">
            {/* Left Panel - Login Form */}
            <div className="w-full lg:w-1/2 flex flex-col">
                {/* Back to Home */}
                <div className="p-6">
                    <Button variant="ghost" size="sm" asChild>
                        <Link href="/">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Home
                        </Link>
                    </Button>
                </div>

                {/* Form Container */}
                <div className="flex-1 flex items-center justify-center px-6 pb-12">
                    <div className="w-full max-w-sm space-y-8">
                        {/* Logo & Heading */}
                        <div className="space-y-2">
                            <Link href="/" className="inline-flex items-center gap-2 mb-6">
                                <Image
                                    src="/logo.png"
                                    alt="CTMS Logo"
                                    width={32}
                                    height={32}
                                />
                                <span className="text-2xl font-bold">CTMS</span>
                            </Link>
                            <h1 className="text-3xl font-bold tracking-tight">Welcome back!</h1>
                            <p className="text-muted-foreground">
                                Sign in to access your academic dashboard.
                            </p>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                                {error}
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="grid gap-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="Enter your email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="h-11"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="h-11"
                                />
                            </div>
                            <Button type="submit" className="w-full h-11 text-sm font-medium" disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Sign In
                            </Button>
                        </form>
                    </div>
                </div>
            </div>

            {/* Right Panel - Image (hidden on mobile) */}
            <div className="hidden lg:block lg:w-1/2 relative">
                <Image
                    src="/login-bg.png"
                    alt="Campus"
                    fill
                    className="object-cover"
                    priority
                />
                {/* Subtle overlay */}
                <div className="absolute inset-0 bg-black/10" />
            </div>
        </div>
    );
}
