'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { FieldLabel } from '@/components/ui/field-label';
import { AlertCircle, Eye, EyeOff, Loader2, User } from 'lucide-react';
import api from '@/lib/api';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import { loginSchema, type LoginFormData } from '@/lib/validations/auth';

export default function LoginPage() {
    const { login } = useAuth();
    const [showPassword, setShowPassword] = useState(false);
    
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
        <div
            className="min-h-screen flex flex-col bg-grey-0"
            style={{
                backgroundImage: 'radial-gradient(circle, rgba(164,171,184,0.28) 1px, transparent 1px)',
                backgroundSize: '28px 28px',
            }}
        >
            <header className="pt-10 pb-6 flex justify-center px-6">
                <Link href="/" className="inline-flex items-center gap-3">
                    <Image src="/logo.png" alt="SITKOM" width={42} height={42} priority />
                    <div className="leading-tight">
                        <p className="text-2xl font-bold text-primary-500">SITKOM</p>
                        <p className="text-xs text-foreground">Sistem Informasi Teknik Komputer</p>
                    </div>
                </Link>
            </header>

            <main className="flex-1 flex items-center justify-center px-6 pb-10">
                <section className="w-full max-w-[560px] rounded-3xl border border-grey-100 bg-background p-7 sm:p-8 shadow-sm">
                    <div className="mx-auto mb-7 flex h-20 w-20 items-center justify-center rounded-full border border-grey-100 bg-grey-25">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-primary-200 bg-background text-primary-500">
                            <User className="h-6 w-6" />
                        </div>
                    </div>

                    <div className="mb-7 space-y-2 text-center">
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome Back</h1>
                        <p className="text-base text-muted-foreground">Glad to see you again. Log in to your account.</p>
                    </div>

                    {errors.root && (
                        <div className="mb-5 rounded-lg border border-error-50 bg-error-0 p-3 text-sm text-error-200">
                            {errors.root.message}
                        </div>
                    )}

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <Controller
                            name="email"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor={field.name} className="mb-1.5 text-sm font-medium text-foreground">
                                        Email Address <span className="text-error-100">*</span>
                                    </FieldLabel>
                                    <Input
                                        {...field}
                                        id={field.name}
                                        type="email"
                                        placeholder="Enter your email"
                                        aria-invalid={fieldState.invalid}
                                        className={`h-12 rounded-2xl px-4 text-base placeholder:text-grey-400 ${
                                            fieldState.invalid
                                                ? 'border-error-100 bg-error-0/35 focus-visible:border-error-100'
                                                : 'border-grey-100 bg-background text-foreground focus-visible:border-primary-200'
                                        }`}
                                    />
                                    {fieldState.invalid && (
                                        <p className="mt-1 flex items-center gap-1.5 text-sm text-error-100">
                                            <AlertCircle className="h-3.5 w-3.5" />
                                            {fieldState.error?.message}
                                        </p>
                                    )}
                                </Field>
                            )}
                        />

                        <Controller
                            name="password"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor={field.name} className="mb-1.5 text-sm font-medium text-foreground">
                                        Password <span className="text-error-100">*</span>
                                    </FieldLabel>
                                    <div className="relative">
                                        <Input
                                            {...field}
                                            id={field.name}
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder="Enter your password"
                                            aria-invalid={fieldState.invalid}
                                            className={`h-12 rounded-2xl px-4 pr-11 text-base placeholder:text-grey-400 ${
                                                fieldState.invalid
                                                    ? 'border-error-100 bg-error-0/35 focus-visible:border-error-100'
                                                    : 'border-grey-100 bg-background text-foreground focus-visible:border-primary-200'
                                            }`}
                                        />
                                        <button
                                            type="button"
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-grey-400 transition-colors hover:text-primary-500"
                                            onClick={() => setShowPassword((value) => !value)}
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        >
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                    {fieldState.invalid && (
                                        <p className="mt-1 flex items-center gap-1.5 text-sm text-error-100">
                                            <AlertCircle className="h-3.5 w-3.5" />
                                            {fieldState.error?.message}
                                        </p>
                                    )}
                                </Field>
                            )}
                        />

                        <div className="flex items-center justify-between gap-3 pt-1">
                            <label htmlFor="keep-login" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                                <Checkbox id="keep-login" />
                                Keep me login
                            </label>
                            <Link href="#" className="text-sm font-medium text-primary-500 transition-colors hover:text-primary-400">
                                Forgot Password?
                            </Link>
                        </div>

                        <Button
                            type="submit"
                            className="h-12 w-full rounded-2xl bg-primary-500 text-base font-semibold text-background hover:bg-primary-400"
                            disabled={isSubmitting}
                        >
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Login
                        </Button>
                    </form>

                    <p className="mt-9 text-center text-sm text-muted-foreground">
                        Don&apos;t have an account?{' '}
                        <Link href="#" className="font-semibold text-primary-500 transition-colors hover:text-primary-400">
                            Register
                        </Link>
                    </p>
                </section>
            </main>

            <footer className="px-6 pb-10 text-center text-sm text-muted-foreground">
                &copy; 2026 SITKOM. All right reserved.
            </footer>
        </div>
    );
}
