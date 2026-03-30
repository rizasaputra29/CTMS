'use client'

import { useEffect, useState } from 'react'
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
import { ArrowLeft, Save, AlertCircle, CheckCircle2, User, BookOpen, Calendar as CalendarIcon, Clock } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

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
    period_id: number
    members: { student: Student }[]
    title?: { name: string }
}

interface EvaluationContext {
    evaluation: { status: string; id: number };
    schedule: { id: number; type: string; date: string; start_time: string; end_time: string; room?: string };
    group: Group;
    components: AssessmentComponent[];
    existing_scores: Record<string, { score: string; notes?: string }>;
    type: 'SEMINAR' | 'TA_DEFENSE';
}

export default function EvaluationDetailPage() {
    const { id } = useParams()
    const searchParams = useSearchParams()
    const router = useRouter()
    const type = searchParams.get('type') // SEMINAR or TA_DEFENSE

    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [context, setContext] = useState<EvaluationContext | null>(null)
    const [scores, setScores] = useState<Record<string, number>>({})
    const [notes, setNotes] = useState<Record<string, string>>({})
    const [overallResult, setOverallResult] = useState<'PASS' | 'FAIL'>('PASS')

    useEffect(() => {
        const fetchContext = async () => {
            try {
                const response = await axios.get(`/api/dosen/evaluation-context/${type}/${id}`)
                const data = response.data
                setContext(data)

                // Initialize scores and notes
                const initialScores: Record<string, number> = {}
                const initialNotes: Record<string, string> = {}
                
                data.components.forEach((comp: AssessmentComponent) => {
                    data.group.members.forEach((m: { student: Student }) => {
                        const key = `${comp.id}_${m.student.id}`
                        const existing = data.existing_scores[key]
                        initialScores[key] = existing ? parseFloat(existing.score) : 0
                        initialNotes[key] = existing ? (existing.notes || '') : ''
                    })
                })
                setScores(initialScores)
                setNotes(initialNotes)
            } catch (error) {
                console.error('Failed to fetch evaluation context:', error)
                toast.error('Failed to load evaluation details')
            } finally {
                setLoading(false)
            }
        }

        if (id && type) {
            fetchContext()
        }
    }, [id, type])

    const handleScoreChange = (componentId: number, studentId: number, value: string) => {
        const numValue = Math.min(100, Math.max(0, parseFloat(value) || 0))
        setScores(prev => ({ ...prev, [`${componentId}_${studentId}`]: numValue }))
    }

    const handleNoteChange = (componentId: number, studentId: number, value: string) => {
        setNotes(prev => ({ ...prev, [`${componentId}_${studentId}`]: value }))
    }

    const calculateTotalScore = (studentId: number) => {
        if (!context) return 0
        let total = 0
        context.components.forEach(comp => {
            const score = scores[`${comp.id}_${studentId}`] || 0
            total += (score * comp.weight) / 100
        })
        return total.toFixed(2)
    }

    const handleSubmit = async () => {
        if (!context) return
        setSubmitting(true)

        try {
            // 1. Submit detailed scores to AssessmentScoreController
            const scorePayload = {
                group_id: context.group.id,
                evaluation_type: context.type === 'SEMINAR' ? context.schedule.type : 'SIDANG_TA',
                scores: Object.entries(scores).map(([key, score]) => {
                    const [componentId, studentId] = key.split('_').map(Number)
                    return {
                        component_id: componentId,
                        student_id: studentId,
                        score: score,
                        notes: notes[key] || ''
                    }
                })
            }
            await axios.post('/api/dosen/assessment-scores', scorePayload)

            // 2. Finalize evaluation to SemproController or TaDefenseController
            // Need to pick one student's representative score or average if it's a group seminar
            // For CTMS, Sempro is usually group-based, but Sidang TA is individual.
            
            const avgScore = Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length
            
            const finalizeEndpoint = context.type === 'SEMINAR' 
                ? `/api/dosen/sempro/${context.schedule.id}/evaluate`
                : `/api/dosen/ta-defense/${context.schedule.id}/evaluate`

            await axios.post(finalizeEndpoint, {
                rubric_json: { scores, notes }, // Storing the breakdown in the blob too
                score: avgScore,
                result: overallResult
            })

            toast.success('Evaluation submitted successfully')
            router.push('/dosen/evaluation')
        } catch (error) {
            console.error('Failed to submit evaluation:', error)
            toast.error('Failed to submit evaluation')
        } finally {
            setSubmitting(false)
        }
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
                <h2 className="text-2xl font-bold">Evaluation Not Found</h2>
                <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
            </div>
        )
    }

    return (
        <div className="container py-6 space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => router.back()} className="rounded-full">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight">
                            Evaluate Presentation
                        </h1>
                        <p className="text-muted-foreground">
                            {context.type === 'SEMINAR' ? `${context.schedule.type} Seminar` : 'TA Defense'}
                        </p>
                    </div>
                </div>
                <Badge variant={context.evaluation.status === 'PENDING' ? 'secondary' : 'outline'} className={context.evaluation.status !== 'PENDING' ? "bg-green-500/10 text-green-700 border-green-500/20 px-3 py-1 text-sm" : "px-3 py-1 text-sm"}>
                    {context.evaluation.status}
                </Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Info */}
                <div className="lg:col-span-4 space-y-6">
                    <Card className="border-primary/20 shadow-lg overflow-hidden">
                        <div className="h-2 bg-primary" />
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5 text-primary" />
                                Student / Group Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-4 bg-muted/30 rounded-xl space-y-3">
                                {context.group.title && (
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground uppercase font-semibold">Project Title</Label>
                                        <p className="font-medium text-sm leading-tight text-primary">{context.group.title.name}</p>
                                    </div>
                                )}
                                <Separator className="bg-primary/10" />
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground uppercase font-semibold">Members</Label>
                                    {context.group.members.map((m, i) => (
                                        <div key={i} className="flex items-center gap-3 bg-background p-2 rounded-lg border border-primary/5 shadow-sm">
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                                {m.student.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold">{m.student.name}</p>
                                                <p className="text-xs text-muted-foreground">{m.student.nim}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <CalendarIcon className="h-4 w-4" />
                                    <span>{new Date(context.schedule.date).toLocaleDateString('id-ID', { dateStyle: 'long' })}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Clock className="h-4 w-4" />
                                    <span>{context.schedule.start_time.substring(0, 5)} - {context.schedule.end_time.substring(0, 5)}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <BookOpen className="h-4 w-4" />
                                    <span>Room: {context.schedule.room || 'TBA'}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-primary/10 shadow-md">
                        <CardHeader>
                            <CardTitle className="text-lg">Overall Result</CardTitle>
                            <CardDescription>Final decision for this presentation</CardDescription>
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
                                    PASS
                                </Button>
                                <Button 
                                    type="button"
                                    variant={overallResult === 'FAIL' ? 'destructive' : 'outline'}
                                    onClick={() => setOverallResult('FAIL')}
                                >
                                    <AlertCircle className="mr-2 h-4 w-4" />
                                    FAIL
                                </Button>
                            </div>
                            
                            <Alert className="bg-yellow-500/10 border-yellow-500/20 text-yellow-700 dark:text-yellow-400">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription className="text-xs">
                                    Your decision will be combined with other examiners to determine the final result.
                                </AlertDescription>
                            </Alert>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Rubric */}
                <div className="lg:col-span-8 space-y-6">
                    <Card className="shadow-xl">
                        <CardHeader className="bg-muted/30">
                            <CardTitle>Assessment Rubric</CardTitle>
                            <CardDescription>Enter scores (0-100) for each assessment component</CardDescription>
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
                                                <p className="text-xs font-bold text-muted-foreground uppercase">Weight</p>
                                                <p className="text-lg font-extrabold text-primary">{comp.weight}%</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                            {context.group.members.map((m) => (
                                                <div key={m.student.id} className="space-y-2">
                                                    <Label className="text-xs flex justify-between">
                                                        <span>{m.student.name}</span>
                                                        <span className="font-bold text-primary">Score: {scores[`${comp.id}_${m.student.id}`] || 0}</span>
                                                    </Label>
                                                    <div className="flex gap-4 items-start">
                                                        <div className="w-1/3">
                                                            <Input 
                                                                type="number"
                                                                className="text-center font-bold"
                                                                placeholder="0-100"
                                                                value={scores[`${comp.id}_${m.student.id}`] || ''}
                                                                onChange={(e) => handleScoreChange(comp.id, m.student.id, e.target.value)}
                                                            />
                                                        </div>
                                                        <div className="flex-1">
                                                            <Textarea 
                                                                placeholder="Optional notes/feedback..."
                                                                className="h-10 min-h-[40px] text-sm py-2"
                                                                value={notes[`${comp.id}_${m.student.id}`] || ''}
                                                                onChange={(e) => handleNoteChange(comp.id, m.student.id, e.target.value)}
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
                                    <h4 className="font-bold text-muted-foreground">Total Summary</h4>
                                    <div className="flex gap-4">
                                        {context.group.members.map(m => (
                                            <div key={m.student.id} className="text-center">
                                                <p className="text-xs text-muted-foreground">{m.student.name.split(' ')[0]}</p>
                                                <p className="text-2xl font-black text-primary">{calculateTotalScore(m.student.id)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <Button 
                                    size="lg" 
                                    className="px-8 font-bold shadow-xl shadow-primary/20 hover:scale-105 transition-transform" 
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                >
                                    {submitting ? 'Submitting...' : 'Submit Final Evaluation'}
                                    <Save className="ml-2 h-5 w-5" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
