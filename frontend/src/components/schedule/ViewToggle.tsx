'use client';

import { Calendar, List } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ViewToggleProps {
    value: 'calendar' | 'table';
    onChange: (value: 'calendar' | 'table') => void;
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
    return (
        <div className="inline-flex items-center rounded-lg border bg-muted p-1">
            <button
                onClick={() => onChange('calendar')}
                className={cn(
                    "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                    value === 'calendar'
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                )}
            >
                <Calendar className="h-4 w-4" />
                Calendar
            </button>
            <button
                onClick={() => onChange('table')}
                className={cn(
                    "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                    value === 'table'
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                )}
            >
                <List className="h-4 w-4" />
                Table
            </button>
        </div>
    );
}
