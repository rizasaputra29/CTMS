'use client';

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Filter } from 'lucide-react';

interface Period {
    id: number;
    name: string;
    is_active?: boolean;
    is_finalized?: boolean;
}

interface PeriodFilterProps {
    periods: Period[];
    value: string;
    onChange: (value: string) => void;
}

export function PeriodFilter({ periods, value, onChange }: PeriodFilterProps) {
    return (
        <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select period..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Periods</SelectItem>
                    {periods.map((period) => (
                        <SelectItem key={period.id} value={period.id.toString()}>
                            <div className="flex items-center justify-between w-full">
                                <span>{period.name}</span>
                                {period.is_active && (
                                    <span className="ml-2 text-xs text-green-600 font-medium">Active</span>
                                )}
                                {period.is_finalized && !period.is_active && (
                                    <span className="ml-2 text-xs text-amber-600 font-medium">Finalized</span>
                                )}
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
