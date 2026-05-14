'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import axios from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { 
    ArrowLeft, 
    Save, 
    AlertCircle, 
    CheckCircle2, 
    User, 
    BookOpen, 
    Calendar as CalendarIcon, 
    Clock,
    Eye
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

interface AssessmentComponent {
    id: number
    name: string
    code: string
    description: string
    weight: number
}

interface Student {
    id: number
    name: string
    nim: string
}

interface Group {
    id: number
    code?: string
    period_id: number
    members?: { student: Student }[]
    title?: { name: string; title?: string }
}

interface Schedule {
    id: number
    type: string
    date: string
    start_time: string
    end_time: string
    room?: string
}

interface Evaluation {
    id: number
    status: 'PENDING' | 'COMPLETED' | 'SUBMITTED'
}

interface EvaluationContext {
    evaluation: Evaluation;
    schedule: Schedule;
    group: Group;
    components: AssessmentComponent[];
    existing_scores: Record<string, { score: string; notes?: string }>;
    type: 'SEMINAR' | 'TA_DEFENSE';
    // For TA Defense - single student
    student?: Student | null;
}

export default function EvaluationDetailPage() {
    const { id } = useParams()
    const searchParams = useSearchParams()
    const router = useRouter()
    const type = searchParams.get('type') as 'SEMINAR' | 'TA_DEFENSE' | null // SEMINAR or TA_DEFENSE
    const scheduleId = searchParams.get('schedule_id')

    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [context, setContext] = useState<EvaluationContext | null>(null)
    const [scores, setScores] = useState<Record<string, number>>({})
    const [notes, setNotes] = useState<Record<string, string>>({})
    const [overallResult, setOverallResult] = useState<'PASS' | 'FAIL'>('PASS')
    const [isViewOnly, setIsViewOnly] = useState(false)

    const fetchContext = useCallback(async () => {
        if (!id || !type) return
        
        try {
            setLoading(true)
            const isTaDefenseWithSchedule = type === 'TA_DEFENSE' && Boolean(scheduleId)
            const contextId = isTaDefenseWithSchedule ? scheduleId : id
            const response = await axios.get(`/dosen/evaluation-context/${type}/${contextId}`, {
                params: isTaDefenseWithSchedule ? { schedule_id: scheduleId } : undefined,
            })
            const data = response.data as EvaluationContext
            setContext(data)

            // Determine if view-only mode (completed evaluation)
            const viewOnly = data.evaluation?.status === 'COMPLETED' || data.evaluation?.status === 'SUBMITTED'
            setIsViewOnly(viewOnly)

            // Get students to evaluate
            // For SEMPRO: all group members
            // For TA_DEFENSE: single student (from schedule.student or first member)
            let students: Student[] = []
            if (type === 'TA_DEFENSE' && data.student) {
                students = [data.student]
            } else if (data.group?.members) {
                students = data.group.members.map(m => m.student)
            }

            // Initialize scores and notes
            const initialScores: Record<string, number> = {}
            const initialNotes: Record<string, string> = {}
            
            data.components.forEach((comp: AssessmentComponent) => {
                students.forEach((student: Student) => {
                    const key = `${comp.id}_${student.id}`
                    const existing = data.existing_scores?.[key]
                    initialScores[key] = existing ? parseFloat(existing.score) : 0
                    initialNotes[key] = existing ? (existing.notes || '') : ''
                })
            })
            setScores(initialScores)
            setNotes(initialNotes)
        } catch (error) {
            console.error('Failed to fetch evaluation context:', error)
            toast.error('Gagal memuat detail penilaian')
        } finally {
            setLoading(false)
        }
    }, [id, type, scheduleId])

    useEffect(() => {
        if (id && type) {
            fetchContext()
        }
    }, [id, type, fetchContext])

    const handleScoreChange = (componentId: number, studentId: number, value: string) => {
        if (isViewOnly) return
        const numValue = Math.min(100, Math.max(0, parseFloat(value) || 0))
        setScores(prev => ({ ...prev, [`${componentId}_${studentId}`]: numValue }))
    }

    const handleNoteChange = (componentId: number, studentId: number, value: string) => {
        if (isViewOnly) return
        setNotes(prev => ({ ...prev, [`${componentId}_${studentId}`]: value }))
    }

    const calculateTotalScore = (studentId: number) => {
        if (!context) return '0.00'
        let total = 0
        context.components.forEach(comp => {
            const score = scores[`${comp.id}_${studentId}`] || 0
            total += (score * comp.weight) / 100
        })
        return total.toFixed(2)
    }

    const getStudents = (): Student[] => {
        if (!context) return []
        // For TA Defense: single student
        if (type === 'TA_DEFENSE' && context.student) {
            return [context.student]
        }
        // For SEMPRO: all group members
        return context.group?.members?.map(m => m.student) || []
    }

    const handleSubmit = async () => {
        if (!context || isViewOnly) return
        setSubmitting(true)

        try {
            // 1. Submit detailed scores to AssessmentScoreController
            const scorePayload = {
                group_id: context.group.id,
                evaluation_type: type === 'SEMINAR' ? context.schedule.type : 'SIDANG_TA',
                scores: Object.entries(scores).map(([key, score]) => {
                    const [componentId, studentId] = key.split('_').map(Number)
                    return {
                        period_component_id: componentId,
                        student_id: studentId,
                        score: score,
                        notes: notes[key] || ''
                    }
                })
            }
            await axios.post('/dosen/assessment-scores', scorePayload)

            // 2. Finalize evaluation
            // Calculate average score across all students and components
            const allScores = Object.values(scores)
            const avgScore = allScores.length > 0 
                ? allScores.reduce((a, b) => a + b, 0) / allScores.length 
                : 0
            
            const finalizeEndpoint = type === 'SEMINAR' 
                ? `/dosen/sempro/${context.schedule.id}/evaluate`
                : `/dosen/ta-defense/${context.schedule.id}/evaluate`

            await axios.post(finalizeEndpoint, {
                rubric_json: { scores, notes },
                score: avgScore,
                result: overallResult
            })

            toast.success('Penilaian berhasil disimpan')
            router.push('/dosen/evaluation')
        } catch (error) {
            console.error('Failed to submit evaluation:', error)
            toast.error('Gagal menyimpan penilaian')
        } finally {
            setSubmitting(false)
        }
    }

    const getPageTitle = () => {
        if (isViewOnly) return 'Lihat Nilai'
        return 'Penilaian Presentasi'
    }

    const getEvaluationTypeLabel = () => {
        if (type === 'TA_DEFENSE') return 'Sidang Tugas Akhir'
        return context?.schedule?.type || 'Seminar'
    }

    if (loading) {
        return (
            <div className="space-y-6 container py-6">
                <Skeleton className="h-10 w-1/4" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Skeleton className="h-[400px] md:col-span-1" />
                    <Skeleton className="h-[600px] md:col-span-2" />
                </div>
            </div>
        )
    }

    if (!context) {
        return (
            <div className="container py-12 text-center">
                <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
                <h2 className="text-2xl font-bold">Penilaian Tidak Ditemukan</h2>
                <Button onClick={() => router.back()} className="mt-4">Kembali</Button>
            </div>
        )
    }

    const students = getStudents()
    const isTaDefense = type === 'TA_DEFENSE'

    return (
        <div className="container py-6 space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => router.back()} className="rounded-full">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight">
                            {getPageTitle()}
                        </h1>
                        <p className="text-muted-foreground">
                            {getEvaluationTypeLabel()} {isTaDefense ? '(Per Mahasiswa)' : ''}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isViewOnly && (
                        <Badge variant="secondary" className="text-sm px-3 py-1">
                            <Eye className="w-4 h-4 mr-1" />
                            Lihat Nilai
                        </Badge>
                    )}
                    <Badge variant={context.evaluation.status === 'PENDING' ? 'secondary' : 'outline'} 
                        className={context.evaluation.status !== 'PENDING' ? "bg-green-500/10 text-green-700 border-green-500/20 px-3 py-1 text-sm" : "px-3 py-1 text-sm"}>
                        {context.evaluation.status === 'COMPLETED' || context.evaluation.status === 'SUBMITTED' ? 'Sudah Dinilai' : 'Belum Dinilai'}
                    </Badge>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Info */}
                <div className="lg:col-span-4 space-y-6">
                    <Card className="border-primary/20 shadow-lg overflow-hidden">
                        <div className="h-2 bg-primary" />
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5 text-primary" />
                                {isTaDefense ? 'Informasi Mahasiswa' : 'Informasi Kelompok'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-4 bg-muted/30 rounded-xl space-y-3">
                                {context.group.title && (
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground uppercase font-semibold">Judul Proyek</Label>
                                        <p className="font-medium text-sm leading-tight text-primary">
                                            {context.group.title.name || context.group.title.title}
                                        </p>
                                    </div>
                                )}
                                <Separator className="bg-primary/10" />
                                {!isTaDefense && (
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground uppercase font-semibold">Group</Label>
                                        <p className="font-medium">{context.group.code || `Group ${context.group.id}`}</p>
                                        <Separator className="bg-primary/10" />
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground uppercase font-semibold">
                                        {isTaDefense ? 'Mahasiswa' : 'Anggota'}
                                    </Label>
                                    {students.map((student) => (
                                        <div key={student.id} className="flex items-center gap-3 bg-background p-2 rounded-lg border border-primary/5 shadow-sm">
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                                {student.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold">{student.name}</p>
                                                <p className="text-xs text-muted-foreground">{student.nim}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <CalendarIcon className="h-4 w-4" />
                                    <span>{context.schedule.date ? format(new Date(context.schedule.date), 'EEEE, dd MMMM yyyy', { locale: idLocale }) : 'Tanggal belum ditentukan'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Clock className="h-4 w-4" />
                                    <span>{context.schedule.start_time?.substring(0, 5) || '--:--'} - {context.schedule.end_time?.substring(0, 5) || '--:--'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <BookOpen className="h-4 w-4" />
                                    <span>Ruangan: {context.schedule.room || 'TBA'}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Overall Result - Only show when not in view mode */}
                    {!isViewOnly && (
                        <Card className="border-primary/10 shadow-md">
                            <CardHeader>
                                <CardTitle className="text-lg">Keputusan Akhir</CardTitle>
                                <CardDescription>Keputusan akhir untuk presentasi ini</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <Button 
                                        type="button"
                                        variant={overallResult === 'PASS' ? 'default' : 'outline'}
                                        className={overallResult === 'PASS' ? 'bg-green-600 hover:bg-green-700' : ''}
                                        onClick={() => setOverallResult('PASS')}
                                    >
                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                        LULUS
                                    </Button>
                                    <Button 
                                        type="button"
                                        variant={overallResult === 'FAIL' ? 'destructive' : 'outline'}
                                        onClick={() => setOverallResult('FAIL')}
                                    >
                                        <AlertCircle className="mr-2 h-4 w-4" />
                                        GAGAL
                                    </Button>
                                </div>
                                
                                <Alert className="bg-yellow-500/10 border-yellow-500/20 text-yellow-700 dark:text-yellow-400">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription className="text-xs">
                                        Keputusan Anda akan digabungkan dengan penguji lain untuk menentukan hasil akhir.
                                    </AlertDescription>
                                </Alert>
                            </CardContent>
                        </Card>
                    )}

                    {/* Info Card */}
                    <Card className="border-primary/10 shadow-md">
                        <CardHeader>
                            <CardTitle className="text-lg">Informasi Penilaian</CardTitle>
                            <CardDescription>Panduan memberikan nilai</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="text-sm text-muted-foreground space-y-2">
                                <p>• Nilai range: 0 - 100</p>
                                <p>• Setiap komponen memiliki bobot tertentu</p>
                                <p>• Nilai akhir dihitung secara otomatis</p>
                                <p>• Catatan bersifat opsional</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Rubric */}
                <div className="lg:col-span-8 space-y-6">
                    <Card className="shadow-xl">
                        <CardHeader className="bg-muted/30">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Rubrik Penilaian</CardTitle>
                                    <CardDescription>
                                        {isViewOnly
                                            ? 'Lihat nilai yang telah disubmit (mode read-only)'
                                            : 'Masukkan nilai (0-100) untuk setiap komponen penilaian'}
                                    </CardDescription>
                                </div>
                                {isViewOnly && (
                                    <Badge variant="secondary" className="text-sm px-3 py-1">
                                        <Eye className="w-4 h-4 mr-1" />
                                        Lihat Nilai
                                    </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-border">
                                {context.components.map((comp) => (
                                    <div key={comp.id} className="p-6 space-y-4 hover:bg-muted/5 transition-colors">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold px-2 py-0.5 bg-primary/10 text-primary rounded">{comp.code}</span>
                                                    <h3 className="font-bold text-lg">{comp.name}</h3>
                                                </div>
                                                <p className="text-sm text-muted-foreground">{comp.description}</p>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <p className="text-xs font-bold text-muted-foreground uppercase">Bobot</p>
                                                <p className="text-lg font-extrabold text-primary">{comp.weight}%</p>
                                            </div>
                                        </div>

                                        <div className={`grid grid-cols-1 ${students.length > 1 ? 'md:grid-cols-2' : ''} gap-4 mt-4`}>
                                            {students.map((student) => (
                                                <div key={student.id} className="space-y-2">
                                                    <Label className="text-xs flex justify-between">
                                                        <span>{student.name}</span>
                                                        <span className="font-bold text-primary">Nilai: {scores[`${comp.id}_${student.id}`] || 0}</span>
                                                    </Label>
                                                    <div className="flex gap-4 items-start">
                                                        <div className="w-1/3">
                                                            <Input 
                                                                type="number"
                                                                className="text-center font-bold"
                                                                placeholder={isViewOnly ? "-" : "0-100"}
                                                                value={scores[`${comp.id}_${student.id}`] || ''}
                                                                onChange={(e) => handleScoreChange(comp.id, student.id, e.target.value)}
                                                                disabled={isViewOnly}
                                                                readOnly={isViewOnly}
                                                            />
                                                        </div>
                                                        <div className="flex-1">
                                                            <Textarea 
                                                                placeholder={isViewOnly ? "Tidak ada catatan" : "Catatan/feedback (opsional)..."}
                                                                className="h-10 min-h-[40px] text-sm py-2"
                                                                value={notes[`${comp.id}_${student.id}`] || ''}
                                                                onChange={(e) => handleNoteChange(comp.id, student.id, e.target.value)}
                                                                disabled={isViewOnly}
                                                                readOnly={isViewOnly}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Summary Card */}
                    <Card className="border-primary shadow-lg bg-primary/5">
                        <CardContent className="p-6">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                <div className="space-y-2">
                                    <h4 className="font-bold text-muted-foreground">Ringkasan Nilai</h4>
                                    <div className="flex gap-4">
                                        {students.map(student => (
                                            <div key={student.id} className="text-center">
                                                <p className="text-xs text-muted-foreground">{student.name.split(' ')[0]}</p>
                                                <p className="text-2xl font-black text-primary">{calculateTotalScore(student.id)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    {isViewOnly ? (
                                        <Button
                                            size="lg"
                                            variant="outline"
                                            className="px-8 font-bold"
                                            onClick={() => router.push('/dosen/evaluation')}
                                        >
                                            Kembali
                                        </Button>
                                    ) : (
                                        <>
                                            <Button
                                                variant="outline"
                                                onClick={() => router.push('/dosen/evaluation')}
                                            >
                                                Batal
                                            </Button>
                                            <Button
                                                size="lg"
                                                className="px-8 font-bold shadow-xl shadow-primary/20 hover:scale-105 transition-transform"
                                                onClick={handleSubmit}
                                                disabled={submitting}
                                            >
                                                {submitting ? 'Menyimpan...' : 'Simpan Penilaian'}
                                                <Save className="ml-2 h-5 w-5" />
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
