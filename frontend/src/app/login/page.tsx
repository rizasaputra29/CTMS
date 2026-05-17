'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { FieldLabel } from '@/components/ui/field-label';
import { FieldError } from '@/components/ui/field-error';
import { ArrowLeft, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import { loginSchema, type LoginFormData } from '@/lib/validations/auth';

export default function LoginPage() {
    const { login } = useAuth();
    
    const {
        control,
        handleSubmit,
        formState: { errors, isSubmitting },
        setError,
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
        mode: 'onBlur',
        defaultValues: {
            email: '',
            password: '',
        },
    });

    const onSubmit = async (data: LoginFormData) => {
        try {
            await api.get('/sanctum/csrf-cookie', { baseURL: 'http://localhost:8000' });
            const res = await api.post('/login', data);
            
            // Login for all users (single and multi-role) - no role selection dialog
            login(res.data.access_token, res.data.user, res.data.roles);
            toast.success('Login successful');
        } catch (err: unknown) {
            if (api.isAxiosError(err)) {
                setError('root', {
                    type: 'manual',
                    message: err.response?.data?.message || 'Login failed',
                });
            } else {
                setError('root', {
                    type: 'manual',
                    message: 'An unexpected error occurred',
                });
            }
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

                        {/* Root Error */}
                        {errors.root && (
                            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                                {errors.root.message}
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                            <Controller
                                name="email"
                                control={control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                                        <Input
                                            {...field}
                                            id={field.name}
                                            type="email"
                                            placeholder="Enter your email"
                                            aria-invalid={fieldState.invalid}
                                            className="h-11"
                                        />
                                        {fieldState.invalid && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />
                            
                            <Controller
                                name="password"
                                control={control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                                        <Input
                                            {...field}
                                            id={field.name}
                                            type="password"
                                            placeholder="Enter your password"
                                            aria-invalid={fieldState.invalid}
                                            className="h-11"
                                        />
                                        {fieldState.invalid && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />
                            
                            <Button 
                                type="submit" 
                                className="w-full h-11 text-sm font-medium" 
                                disabled={isSubmitting}
                            >
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
