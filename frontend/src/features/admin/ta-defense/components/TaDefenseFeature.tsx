'use client';

import { useState } from 'react';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Search, GraduationCap } from 'lucide-react';
import { Loading } from '@/components/ui/loading';
import { useTaDefense } from '../hooks/use-ta-defense';
import { TaDefenseTable } from './TaDefenseTable';
import { TaDefenseFormDialog } from './TaDefenseFormDialog';
import type { TaDefenseSchedule } from '../types';
import type { TaDefenseFormData } from '@/lib/validations/ta-defense';

export function TaDefenseFeature() {
    const {
        periods,
        dosens,
        locations,
        filteredSchedules,
        eligibleGroups,
        selectedPeriod,
        setSelectedPeriod,
        searchQuery,
        setSearchQuery,
        statusFilter,
        setStatusFilter,
        sortKey,
        handleSort,
        isLoading,
        fetchEligibleGroups,
        createSchedule,
        updateSchedule,
        cancelSchedule,
        isCreating,
        isUpdating,
        isCancelling,
    } = useTaDefense();

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
    const [editingSchedule, setEditingSchedule] = useState<TaDefenseSchedule | null>(null);

    const [cancelOpen, setCancelOpen] = useState(false);
    const [cancellingSchedule, setCancellingSchedule] = useState<TaDefenseSchedule | null>(null);

    const handleCreateClick = () => {
        const activePeriod = periods.find(p => p.is_active);
        const defaultPeriodId = activePeriod
            ? activePeriod.id.toString()
            : (selectedPeriod !== 'all' ? selectedPeriod : '');

        // We need to set the form default period before opening
        setFormMode('create');
        setEditingSchedule(null);
        if (defaultPeriodId) {
            fetchEligibleGroups(defaultPeriodId);
        }
        setFormOpen(true);
    };

    const handleEditClick = (schedule: TaDefenseSchedule) => {
        setFormMode('edit');
        setEditingSchedule(schedule);
        setFormOpen(true);
    };

    const handleCancelClick = (schedule: TaDefenseSchedule) => {
        setCancellingSchedule(schedule);
        setCancelOpen(true);
    };

    const handleConfirmCancel = async () => {
        if (!cancellingSchedule) return;
        await cancelSchedule(cancellingSchedule.id);
        setCancelOpen(false);
        setCancellingSchedule(null);
    };

    const handleCreate = async (data: TaDefenseFormData) => {
        await createSchedule(data);
    };

    const handleUpdate = async (id: number, data: TaDefenseFormData, periodId: number) => {
        await updateSchedule({ id, data, periodId });
    };

    if (isLoading) {
        return <Loading variant="section" />;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">TA Defense Schedules</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Manage individual TA defense schedules for students.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={handleCreateClick} disabled={!selectedPeriod}>
                        <Plus className="mr-2 h-4 w-4" />
                        Schedule TA Defense
                    </Button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Period</span>
                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                        <SelectTrigger className="w-55">
                            <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Periods</SelectItem>
                            {periods.map(p => (
                                <SelectItem key={p.id} value={p.id.toString()}>
                                    {p.name}
                                    {p.is_active && <span className="ml-2 text-[11px] text-muted-foreground/60">(active)</span>}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Status</span>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-40">
                            <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Status</SelectItem>
                            <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                            <SelectItem value="DONE">Done</SelectItem>
                            <SelectItem value="CANCELLED">Cancelled</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="relative flex-1 sm:ml-auto sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search student, NIM, group..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {!selectedPeriod && (
                <div className="text-center py-16 text-muted-foreground border rounded-lg border-dashed">
                    <GraduationCap className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="text-sm">Select a period to view TA defense schedules.</p>
                </div>
            )}

            {selectedPeriod && filteredSchedules.length === 0 && (
                <div className="text-center py-16 text-muted-foreground border rounded-lg border-dashed">
                    <GraduationCap className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="text-sm font-medium">No TA defense schedules found</p>
                    <p className="text-[13px] text-muted-foreground/60 mt-1">
                        {statusFilter !== 'ALL' ? `No ${statusFilter.toLowerCase()} schedules. Try changing the status filter.` : 'Create a new schedule to get started.'}
                    </p>
                </div>
            )}

            {selectedPeriod && filteredSchedules.length > 0 && (
                <TaDefenseTable
                    data={filteredSchedules}
                    locations={locations}
                    sortKey={sortKey}
                    onSort={handleSort}
                    onEdit={handleEditClick}
                    onCancel={handleCancelClick}
                />
            )}

            <TaDefenseFormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                mode={formMode}
                editingSchedule={editingSchedule}
                periods={periods}
                dosens={dosens}
                locations={locations}
                eligibleGroups={eligibleGroups}
                fetchEligibleGroups={fetchEligibleGroups}
                onCreate={handleCreate}
                onUpdate={handleUpdate}
                isSubmitting={isCreating || isUpdating}
            />

            <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cancel Schedule</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to cancel this TA defense schedule?
                            This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    {cancellingSchedule && (
                        <div className="py-4">
                            <p className="font-medium">
                                {cancellingSchedule.student?.name ||
                                    (cancellingSchedule.students && cancellingSchedule.students.length > 0
                                        ? cancellingSchedule.students.map(s => s.name).join(', ')
                                        : 'Multiple Students')}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Group {cancellingSchedule.group.id} - {cancellingSchedule.date}
                            </p>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCancelOpen(false)}>
                            Keep Schedule
                        </Button>
                        <Button variant="destructive" onClick={handleConfirmCancel} disabled={isCancelling}>
                            Cancel Schedule
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
