'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import api from '@/lib/api';
import { toast } from 'sonner';
import type { EvaluationContext } from '../types';

export function useTaEvaluation(scheduleId: string) {
    const id = scheduleId;
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [context, setContext] = useState<EvaluationContext | null>(null);
    const [scores, setScores] = useState<Record<string, number>>({});
    const [notes, setNotes] = useState<Record<string, string>>({});

    const fetchContext = useCallback(async () => {
        if (!id) return;
        try {
            setLoading(true);
            const response = await api.get(`/dosen/evaluation-context/TA_DEFENSE/${id}`, {
                params: { schedule_id: id },
            });
            const data = response.data.data as EvaluationContext;
            setContext(data);

            const initialScores: Record<string, number> = {};
            const initialNotes: Record<string, string> = {};

            if (data.existing_scores) {
                Object.entries(data.existing_scores).forEach(([key, value]) => {
                    initialScores[key] = parseFloat(String(value.score)) || 0;
                    if (value.notes) initialNotes[key] = value.notes;
                });
            }

            setScores(initialScores);
            setNotes(initialNotes);
        } catch {
            toast.error('Failed to load evaluation context');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (id) {
            fetchContext();
        }
    }, [id, fetchContext]);

    const handleScoreChange = useCallback((componentId: number, value: string) => {
        const numValue = Math.min(100, Math.max(0, parseFloat(value) || 0));
        setScores((prev) => ({ ...prev, [`${componentId}`]: numValue }));
    }, []);

    const handleNotesChange = useCallback((componentId: number, value: string) => {
        setNotes((prev) => ({ ...prev, [`${componentId}`]: value }));
    }, []);

    const submitEvaluation = useCallback(async () => {
        if (!context || !id) return false;

        const unscoredComponents = context.components.filter((c) => scores[c.id] === undefined);
        if (unscoredComponents.length > 0) {
            toast.error(`Please provide scores for all components (${unscoredComponents.length} remaining)`);
            return false;
        }

        try {
            setSubmitting(true);

            await api.post('/dosen/assessment-scores', {
                student_id: context.schedule.student.id,
                group_id: context.schedule.group.id,
                evaluation_type: 'TA_DEFENSE',
                scores: Object.entries(scores).map(([componentId, score]) => ({
                    period_component_id: parseInt(componentId),
                    student_id: context.schedule.student.id,
                    score,
                    notes: notes[componentId] || '',
                })),
            });

            await api.post(`/dosen/ta-defense/${id}/evaluate`, {
                result: 'PASS',
                notes: 'Evaluation completed',
            });

            toast.success('Evaluation submitted successfully');
            return true;
        } catch (error: unknown) {
            const message = axios.isAxiosError(error)
                ? (error.response?.data?.message as string) || 'Failed to submit evaluation'
                : 'Failed to submit evaluation';
            toast.error(message);
            return false;
        } finally {
            setSubmitting(false);
        }
    }, [context, id, scores, notes]);

    return {
        loading,
        submitting,
        context,
        scores,
        notes,
        handleScoreChange,
        handleNotesChange,
        submitEvaluation,
    };
}
