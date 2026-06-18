'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Loading } from '@/components/ui/loading';
import {
    ArrowLeft, Save, Calendar, MapPin, Clock, User, CheckCircle2, Upload,
    FileText, AlertCircle, Loader2,
} from 'lucide-react';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import type { Component, ExpoDetail, MyScore } from '../types';

export function ExpoDetailFeature() {
    const router = useRouter();
    const params = useParams();
    const expoId = params.expoId as string;
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [data, setData] = useState<ExpoDetail | null>(null);
    const [scores, setScores] = useState<Record<string, number>>({});
    const [notes, setNotes] = useState<Record<string, string>>({});

    const fetchDetail = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get(`/mahasiswa/expo-events/${expoId}/detail`);
            const unwrapped = res.data?.data ?? res.data;
            setData(unwrapped);

            const initialScores: Record<string, number> = {};
            const initialNotes: Record<string, string> = {};
            (unwrapped?.my_scores ?? []).forEach((s: MyScore) => {
                initialScores[s.period_component_id] = s.score ?? 0;
                initialNotes[s.period_component_id] = s.notes ?? '';
            });
            setScores(initialScores);
            setNotes(initialNotes);
        } catch (err) {
            console.error('Failed to fetch expo detail', err);
            toast.error('Gagal memuat detail expo');
            router.push('/mahasiswa/expo');
        } finally {
            setLoading(false);
        }
    }, [expoId, router]);

    useEffect(() => { fetchDetail(); }, [fetchDetail]);

    const handleScoreChange = (componentId: number, value: string) => {
        const numValue = Math.min(100, Math.max(0, parseFloat(value) || 0));
        setScores(prev => ({ ...prev, [componentId]: numValue }));
    };

    const handleNoteChange = (componentId: number, value: string) => {
        setNotes(prev => ({ ...prev, [componentId]: value }));
    };

    const handleSubmitEvaluation = async () => {
        if (!data) return;

        for (const comp of data.components) {
            if (!scores[comp.id] || scores[comp.id] < 1) {
                toast.error(`Nilai tidak valid untuk komponen ${comp.name}`);
                return;
            }
        }

        try {
            setSaving(true);
            await api.post(`/mahasiswa/expo-events/${expoId}/evaluation`, {
                scores: data.components.map((comp: Component) => ({
                    period_component_id: comp.id,
                    score: scores[comp.id] || 0,
                    notes: notes[comp.id] || '',
                })),
            });
            toast.success('Self-evaluation berhasil disimpan');
            fetchDetail();
        } catch (error) {
            toast.error(api.isAxiosError(error) ? api.getApiErrorMessage(error, 'Gagal menyimpan') : 'Gagal menyimpan');
        } finally {
            setSaving(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
        if (!allowedTypes.includes(file.type)) {
            toast.error('Format file tidak didukung. Gunakan PDF, DOC, DOCX, PPT, atau PPTX.');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            toast.error('Ukuran file maksimal 10MB');
            return;
        }

        try {
            setUploading(true);
            const formData = new FormData();
            formData.append('file', file);
            await api.post(`/mahasiswa/expo-events/${expoId}/document`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            toast.success('Dokumen berhasil diupload');
            fetchDetail();
        } catch (error) {
            toast.error(api.isAxiosError(error) ? api.getApiErrorMessage(error, 'Gagal upload') : 'Gagal upload');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const calculateWeightedScore = () => {
        if (!data) return '0.00';
        let total = 0;
        (data.components ?? []).forEach(comp => {
            total += ((scores[comp.id] || 0) * comp.weight) / 100;
        });
        return total.toFixed(2);
    };

    const getCompletionProgress = () => {
        if (!data) return { evalDone: false, docDone: false, evalPct: 0, docPct: 0 };
        const evalDone = data.my_scores.every(s => s.score !== null && s.score !== undefined && s.score > 0);
        const docDone = data.my_document !== null;
        return { evalDone, docDone, evalPct: evalDone ? 100 : 0, docPct: docDone ? 100 : 0 };
    };

    if (loading) return <Loading variant="section" />;
    if (!data) return null;

    const progress = getCompletionProgress();
    const isSubmitted = data.my_scores.some(s => s.score !== null && s.score !== undefined);

    return (
        <div className="container py-6 space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => router.push('/mahasiswa/expo')} className="rounded-full">
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight">{data.expo_event.name}</h1>
                    <p className="text-muted-foreground">Detail expo dan self-evaluation</p>
                </div>
            </div>

            {/* Progress Overview */}
            <Card className="border-primary/20 shadow-md">
                <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Calendar className="h-4 w-4" />
                                <span>{formatDate(data.expo_event.date)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                <span>{data.expo_event.start_time.slice(0, 5)} – {data.expo_event.end_time.slice(0, 5)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MapPin className="h-4 w-4" />
                                <span>{data.expo_event.room || 'TBA'}</span>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <p className="text-sm font-semibold">Progress Anda</p>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span>Self-Evaluation</span>
                                    <span className={progress.evalDone ? 'text-green-600 font-semibold' : 'text-orange-600'}>
                                        {progress.evalDone ? 'Selesai' : 'Belum'}
                                    </span>
                                </div>
                                <Progress value={progress.evalPct} className="h-2" />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span>Upload Dokumen</span>
                                    <span className={progress.docDone ? 'text-green-600 font-semibold' : 'text-orange-600'}>
                                        {progress.docDone ? 'Selesai' : 'Belum'}
                                    </span>
                                </div>
                                <Progress value={progress.docPct} className="h-2" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm font-semibold">Kelompok</p>
                            <p className="text-sm text-muted-foreground">{data.group.code}</p>
                            <p className="text-2xl font-black text-primary">{calculateWeightedScore()}</p>
                            <p className="text-xs text-muted-foreground">Nilai Akhir (Weighted)</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Members & Document */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Group Members */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5 text-primary" />
                                Anggota Kelompok
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {data.members.map((member) => (
                                <div key={member.id} className="flex items-center gap-3 bg-muted/30 p-3 rounded-lg border">
                                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                                        {member.name.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold truncate">{member.name}</p>
                                        <p className="text-xs text-muted-foreground">{member.nim}</p>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        {member.has_submitted_evaluation && (
                                            <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                                                <CheckCircle2 className="h-3 w-3 mr-1" /> Eval
                                            </Badge>
                                        )}
                                        {member.has_uploaded_document && (
                                            <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                                                <FileText className="h-3 w-3 mr-1" /> Doc
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Document Upload */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5 text-primary" />
                                Dokumen EXPO
                            </CardTitle>
                            <CardDescription>Upload dokumen pendukung EXPO Anda</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {data.my_document ? (
                                <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">{data.my_document.original_name}</p>
                                            <p className="text-xs text-green-600">Status: {data.my_document.status}</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="p-4 border-2 border-dashed rounded-lg text-center hover:border-primary/50 transition-colors">
                                        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                        <p className="text-sm text-muted-foreground">Drag & drop atau klik untuk upload</p>
                                        <p className="text-xs text-muted-foreground mt-1">PDF, DOC, DOCX, PPT, PPTX (maks. 10MB)</p>
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        className="hidden"
                                        accept=".pdf,.doc,.docx,.ppt,.pptx"
                                        onChange={handleFileUpload}
                                    />
                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading}
                                    >
                                        {uploading ? (
                                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</>
                                        ) : (
                                            <><Upload className="mr-2 h-4 w-4" /> Pilih File</>
                                        )}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right: Self-Evaluation Form */}
                <div className="lg:col-span-8 space-y-6">
                    <Card className="shadow-xl">
                        <CardHeader className="bg-muted/30">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Self-Evaluation</CardTitle>
                                    <CardDescription>
                                        {isSubmitted
                                            ? 'Anda sudah mengirim nilai. Nilai yang sudah terkirim tidak dapat diubah.'
                                            : 'Masukkan nilai (0-100) untuk setiap komponen penilaian'}
                                    </CardDescription>
                                </div>
                                {isSubmitted && (
                                    <Badge variant="secondary" className="text-sm px-3 py-1">
                                        Sudah Dikirim
                                    </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-border">
                                {data.components.map((comp) => (
                                    <div key={comp.id} className="p-6 space-y-4 hover:bg-muted/5 transition-colors">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold px-2 py-0.5 bg-primary/10 text-primary rounded">{comp.code}</span>
                                                    <h3 className="font-bold text-lg">{comp.name}</h3>
                                                </div>
                                                {comp.description && (
                                                    <p className="text-sm text-muted-foreground">{comp.description}</p>
                                                )}
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <p className="text-xs font-bold text-muted-foreground uppercase">Bobot</p>
                                                <p className="text-lg font-extrabold text-primary">{comp.weight}%</p>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs flex justify-between">
                                                <span>Nilai Anda</span>
                                                <span className="font-bold text-primary">Nilai: {scores[comp.id] || 0}</span>
                                            </Label>
                                            <div className="flex gap-4 items-start">
                                                <div className="w-1/3">
                                                    <Input
                                                        type="number"
                                                        className="text-center font-bold"
                                                        placeholder={isSubmitted ? '-' : '0-100'}
                                                        value={scores[comp.id] || ''}
                                                        onChange={(e) => handleScoreChange(comp.id, e.target.value)}
                                                        disabled={isSubmitted}
                                                        readOnly={isSubmitted}
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <Textarea
                                                        placeholder={isSubmitted ? 'Tidak ada catatan' : 'Catatan/feedback (opsional)...'}
                                                        className="h-10 min-h-[40px] text-sm py-2"
                                                        value={notes[comp.id] || ''}
                                                        onChange={(e) => handleNoteChange(comp.id, e.target.value)}
                                                        disabled={isSubmitted}
                                                        readOnly={isSubmitted}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Summary & Submit */}
                    <Card className="border-primary shadow-lg bg-primary/5">
                        <CardContent className="p-6">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                <div className="space-y-2">
                                    <h4 className="font-bold text-muted-foreground">Ringkasan Nilai</h4>
                                    <div className="flex gap-4">
                                        <div className="text-center">
                                            <p className="text-xs text-muted-foreground">Weighted Score</p>
                                            <p className="text-3xl font-black text-primary">{calculateWeightedScore()}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => router.push('/mahasiswa/expo')}
                                    >
                                        Kembali
                                    </Button>
                                    {!isSubmitted && (
                                        <Button
                                            size="lg"
                                            className="px-8 font-bold shadow-xl shadow-primary/20 hover:scale-105 transition-transform"
                                            onClick={handleSubmitEvaluation}
                                            disabled={saving}
                                        >
                                            {saving ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    Menyimpan...
                                                </>
                                            ) : (
                                                <>
                                                    Simpan Penilaian
                                                    <Save className="ml-2 h-5 w-5" />
                                                </>
                                            )}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
