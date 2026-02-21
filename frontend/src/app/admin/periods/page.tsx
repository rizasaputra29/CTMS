'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, CalendarIcon } from 'lucide-react';
import api from '@/lib/api';
import { toast } from "sonner";
import { format } from "date-fns"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface Period {
    id: number;
    name: string;
    start_date: string;
    end_date: string;
    is_active: boolean;
}

export default function AdminPeriodsPage() {
    const [periods, setPeriods] = useState<Period[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    
    const [formData, setFormData] = useState({
        name: '',
        start_date: new Date(),
        end_date: new Date(),
        is_active: false,
    });

    const fetchPeriods = async () => {
        try {
            const response = await api.get('/admin/periods');
            setPeriods(response.data);
        } catch (error) {
            console.error('Failed to fetch periods', error);
            toast.error('Failed to load periods');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPeriods();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/admin/periods', {
                ...formData,
                start_date: format(formData.start_date, 'yyyy-MM-dd'),
                end_date: format(formData.end_date, 'yyyy-MM-dd'),
            });
            toast.success('Period created successfully');
            setOpen(false);
            fetchPeriods();
            // Reset form
             setFormData({
                name: '',
                start_date: new Date(),
                end_date: new Date(),
                is_active: false,
            });
        } catch (error: unknown) {
            console.error('Failed to create period', error);
            if (axios.isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Failed to create period');
            } else {
                toast.error('Failed to create period');
            }
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this period?')) return;
        try {
            await api.delete(`/admin/periods/${id}`);
            toast.success('Period deleted');
            fetchPeriods();
        } catch (error) {
             console.error('Failed to delete period', error);
            toast.error('Failed to delete period');
        }
    }

    return (
        <>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Academic Periods</h1>
                    <p className="text-muted-foreground">Manage ongoing and past academic periods.</p>
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> New Period
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                        <form onSubmit={handleCreate}>
                            <DialogHeader>
                                <DialogTitle>New Academic Period</DialogTitle>
                                <DialogDescription>
                                    Define a new semester or academic phase.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Period Name</Label>
                                    <Input
                                        id="name"
                                        placeholder="e.g. Set 1 2023/2024"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Start Date</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn(
                                                        "w-full justify-start text-left font-normal",
                                                        !formData.start_date && "text-muted-foreground"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {formData.start_date ? format(formData.start_date, "PPP") : <span>Pick a date</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar
                                                    mode="single"
                                                    selected={formData.start_date}
                                                    onSelect={(date) => date && setFormData({ ...formData, start_date: date })}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>End Date</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn(
                                                        "w-full justify-start text-left font-normal",
                                                        !formData.end_date && "text-muted-foreground"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {formData.end_date ? format(formData.end_date, "PPP") : <span>Pick a date</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar
                                                    mode="single"
                                                    selected={formData.end_date}
                                                    onSelect={(date) => date && setFormData({ ...formData, end_date: date })}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        id="is-active"
                                        checked={formData.is_active}
                                        onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                                    />
                                    <Label htmlFor="is-active">Set as Active Period</Label>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="submit">Create Period</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-4">
                {periods.map((period) => (
                    <Card key={period.id}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xl font-bold">
                                {period.name}
                            </CardTitle>
                            {period.is_active && <Badge>Active</Badge>}
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm text-muted-foreground flex gap-4 mt-2">
                                <div className="flex items-center">
                                    <CalendarIcon className="mr-1 h-4 w-4" />
                                    {format(new Date(period.start_date), "PPP")} - {format(new Date(period.end_date), "PPP")}
                                </div>
                            </div>
                        </CardContent>
                         <CardFooter className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleDelete(period.id)}>
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
             {!loading && periods.length === 0 && (
                 <div className="text-center py-12 text-muted-foreground">
                    No periods found. Create one to get started.
                </div>
            )}
        </>
    );
}
