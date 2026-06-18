"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import type { DocumentType, DocumentTypeFormData } from '@/features/admin/document-types/types';

const QUERY_KEY = ['admin', 'document-types'] as const;
const PHASES = ['PDC1', 'SEMPRO', 'PDC2', 'TA', 'EXPO', 'SIDANG'];

const fetchDocumentTypes = async (): Promise<DocumentType[]> => {
    const res = await api.get('/admin/document-types');
    return res.data?.data || [];
};

export function useDocumentTypes() {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');

    const { data: types = [], isLoading } = useQuery({
        queryKey: QUERY_KEY,
        queryFn: fetchDocumentTypes,
    });

    const createMutation = useMutation({
        mutationFn: async (form: DocumentTypeFormData) => {
            const payload = { ...form, phase: form.phase === 'ALL' ? null : form.phase };
            await api.post('/admin/document-types', payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY });
            toast.success('Document type created');
        },
        onError: (error: unknown) => {
            toast.error(api.getApiErrorMessage(error, 'Failed to save'));
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, form }: { id: number; form: DocumentTypeFormData }) => {
            const payload = { ...form, phase: form.phase === 'ALL' ? null : form.phase };
            await api.put(`/admin/document-types/${id}`, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY });
            toast.success('Document type updated');
        },
        onError: (error: unknown) => {
            toast.error(api.getApiErrorMessage(error, 'Failed to save'));
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/admin/document-types/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY });
            toast.success('Deleted');
        },
        onError: (error: unknown) => {
            toast.error(api.getApiErrorMessage(error, 'Failed to delete'));
        },
    });

    const filteredTypes = types.filter((t) =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return {
        types,
        filteredTypes,
        isLoading,
        searchQuery,
        setSearchQuery,
        phases: PHASES,
        createMutation,
        updateMutation,
        deleteMutation,
    };
}
