'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
    CalendarDays,
    FileText,
    GraduationCap,
    Presentation,
    ArrowRight,
} from 'lucide-react';

const QUICK_LINKS = [
    {
        label: 'Jadwal',
        href: '/mahasiswa/schedule',
        icon: CalendarDays,
        color: 'bg-blue-50 text-blue-600 border-blue-100 hover:border-blue-300',
        iconBg: 'bg-blue-100',
    },
    {
        label: 'Dokumen',
        href: '/mahasiswa/documents',
        icon: FileText,
        color: 'bg-amber-50 text-amber-600 border-amber-100 hover:border-amber-300',
        iconBg: 'bg-amber-100',
    },
    {
        label: 'Nilai',
        href: '/mahasiswa/grades',
        icon: GraduationCap,
        color: 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:border-emerald-300',
        iconBg: 'bg-emerald-100',
    },
    {
        label: 'Expo',
        href: '/mahasiswa/expo',
        icon: Presentation,
        color: 'bg-violet-50 text-violet-600 border-violet-100 hover:border-violet-300',
        iconBg: 'bg-violet-100',
    },
] as const;

export function QuickAccessCard() {
    return (
        <Card className="h-full">
            <CardContent className="p-5">
                <h3 className="text-base font-semibold text-gray-800 mb-4">Akses Cepat</h3>
                <div className="grid grid-cols-2 gap-3">
                    {QUICK_LINKS.map((link) => {
                        const Icon = link.icon;
                        return (
                            <Link key={link.href} href={link.href} className="block">
                                <Button
                                    variant="outline"
                                    className={cn(
                                        'w-full h-auto py-4 px-3 flex flex-col items-center gap-2.5 rounded-xl border transition-all hover:shadow-sm',
                                        link.color,
                                    )}
                                >
                                    <div className={cn('p-2 rounded-lg', link.iconBg)}>
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <span className="text-sm font-medium">{link.label}</span>
                                </Button>
                            </Link>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
