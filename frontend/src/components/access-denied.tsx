'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface AccessDeniedProps {
    title?: string;
    message?: string;
    showBackButton?: boolean;
    backHref?: string;
    backLabel?: string;
}

export default function AccessDenied({
    title = 'Access Denied',
    message = 'You do not have permission to access this page. This area is restricted to administrators only.',
    showBackButton = true,
    backHref = '/',
    backLabel = 'Go Back',
}: AccessDeniedProps) {
    return (
        <div className="flex items-center justify-center min-h-[60vh] p-4">
            <Card className="max-w-md w-full border-red-200">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                        <ShieldAlert className="h-8 w-8 text-red-600" />
                    </div>
                    <CardTitle className="text-2xl text-red-700">{title}</CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-6">
                    <p className="text-muted-foreground">
                        {message}
                    </p>
                    {showBackButton && (
                        <Link href={backHref}>
                            <Button variant="outline" className="w-full">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                {backLabel}
                            </Button>
                        </Link>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
