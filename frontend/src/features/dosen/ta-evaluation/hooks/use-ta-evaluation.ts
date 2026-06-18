'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import api from '@/lib/api';
import { toast } from 'sonner';
import { formatScoringKey } from '@/components/common/ScoringRubric';
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
            const data = (response.data?.data ?? response.data) as EvaluationContext;
            setContext(data);

            const studentId = data.schedule.student.id;
            const initialScores: Record<string, number> = {};
            const initialNotes: Record<string, string> = {};

            if (data.existing_scores) {
                Object.entries(data.existing_scores).forEach(([key, value]) => {
                    initialScores[key] = parseFloat(String(value.score)) || 0;
                    if (value.notes) initialNotes[key] = value.notes;
                });
            }

            (data.components ?? []).forEach((component) => {
                const key = formatScoringKey(component.id, studentId);
                if (initialScores[key] === undefined) {
                    initialScores[key] = 0;
                }
            });

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

    const handleScoreChange = useCallback((key: string, value: number) => {
        setScores((prev) => ({ ...prev, [key]: value }));
    }, []);

    const handleNotesChange = useCallback((key: string, value: string) => {
        setNotes((prev) => ({ ...prev, [key]: value }));
    }, []);

    const submitEvaluation = useCallback(async () => {
        if (!context || !id) return false;

        const studentId = context.schedule.student.id;
        const allScored = context.components.every(
            (c) => scores[formatScoringKey(c.id, studentId)] !== undefined
        );
        if (!allScored) {
            const remaining = context.components.filter(
                (c) => scores[formatScoringKey(c.id, studentId)] === undefined
            ).length;
            toast.error(`Please provide scores for all components (${remaining} remaining)`);
            return false;
        }

        try {
            setSubmitting(true);

            await api.post('/dosen/assessment-scores', {
                student_id: studentId,
                group_id: context.schedule.group.id,
                evaluation_type: 'TA_DEFENSE',
                scores: context.components.map((component) => {
                    const key = formatScoringKey(component.id, studentId);
                    return {
                        period_component_id: component.id,
                        student_id: studentId,
                        score: scores[key] || 0,
                        notes: notes[key] || '',
                    };
                }),
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
