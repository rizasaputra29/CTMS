'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner";
import { User } from 'lucide-react';

interface Group {
    id: number;
    title: {
        title: string;
    } | null;
    members: {
        id: number;
        student: {
            id: number;
            name: string;
            email: string;
        }
    }[];
}

interface Evaluation {
    id: number;
    student_id: number;
    type: string;
    score: number;
    feedback: string | null;
}

export default function DosenEvaluationPage() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string>('');
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    
    // Grading State
    const [gradingOpen, setGradingOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<{id: number, name: string} | null>(null);
    const [gradeType, setGradeType] = useState('bimbingan');
    const [score, setScore] = useState('');
    const [feedback, setFeedback] = useState('');
    const [saving, setSaving] = useState(false);

    const fetchGroups = useCallback(async () => {
        try {
            const response = await api.get('/dosen/groups');
            setGroups(response.data.data);
            if (response.data.data.length > 0) {
                // Select first group by default? Or let user select.
                // setSelectedGroupId(response.data.data[0].id.toString());
            }
        } catch (error) {
            console.error('Failed to fetch groups', error);
        }
    }, []);

    const fetchEvaluations = useCallback(async (groupId: string) => {
        if (!groupId) return;
        try {
            const response = await api.get('/evaluations', { params: { group_id: groupId } });
            setEvaluations(response.data.data);
        } catch (error) {
            console.error('Failed to fetch evaluations', error);
        }
    }, []);

    useEffect(() => {
        fetchGroups();
    }, [fetchGroups]);

    useEffect(() => {
        if (selectedGroupId) {
            fetchEvaluations(selectedGroupId);
        } else {
            setEvaluations([]);
        }
    }, [selectedGroupId, fetchEvaluations]);

    const handleGrade = (student: {id: number, name: string}, type: string) => {
        setSelectedStudent(student);
        setGradeType(type);
        // Find existing grade
        const existing = evaluations.find(e => e.student_id === student.id && e.type === type);
        setScore(existing ? existing.score.toString() : '');
        setFeedback(existing?.feedback || '');
        setGradingOpen(true);
    };

    const submitGrade = async () => {
        if (!selectedStudent || !selectedGroupId) return;
        setSaving(true);
        try {
            await api.post('/evaluations', {
                group_id: selectedGroupId,
                student_id: selectedStudent.id,
                type: gradeType,
                score: score,
                feedback: feedback,
            });
            toast.success('Grade saved successfully');
            setGradingOpen(false);
            fetchEvaluations(selectedGroupId);
        } catch (error) {
            console.error('Failed to save grade', error);
            toast.error('Failed to save grade');
        } finally {
            setSaving(false);
        }
    };

    const getScore = (studentId: number, type: string) => {
        const evaluation = evaluations.find(e => e.student_id === studentId && e.type === type);
        return evaluation ? (
            <div className="text-center">
                <div className="text-lg font-bold">{evaluation.score}</div>
                {evaluation.feedback && <div className="text-xs text-muted-foreground truncate max-w-[100px]">{evaluation.feedback}</div>}
            </div>
        ) : <span className="text-muted-foreground">-</span>;
    };

    const selectedGroup = groups.find(g => g.id.toString() === selectedGroupId);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Evaluations</h1>
                    <p className="text-muted-foreground">Grade students based on Bimbingan, Proposal, and Skripsi.</p>
                </div>
                 <div className="w-[300px]">
                    <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Group to Grade" />
                        </SelectTrigger>
                        <SelectContent>
                            {groups.map((group) => (
                                <SelectItem key={group.id} value={group.id.toString()}>
                                    {group.title?.title || `Group #${group.id}`}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {!selectedGroupId ? (
                <div className="text-center py-20 text-muted-foreground border rounded-lg border-dashed">
                    Please select a group to start grading.
                </div>
            ) : !selectedGroup ? (
                 <div className="text-center py-20 text-muted-foreground">
                    Group not found.
                </div>
            ) : (
                <div className="grid gap-6">
                    {selectedGroup.members.map((member) => (
                        <Card key={member.id}>
                            <CardHeader className="flex flex-row items-center gap-4 py-4">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                    <User className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1">
                                    <CardTitle className="text-lg">{member.student.name}</CardTitle>
                                    <CardDescription>{member.student.email}</CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-3 gap-4">
                                    {['bimbingan', 'proposal', 'skripsi'].map((type) => (
                                        <div key={type} className="border rounded-md p-4 flex flex-col items-center justify-between gap-2">
                                            <div className="font-semibold capitalize text-sm">{type}</div>
                                            {getScore(member.student.id, type)}
                                            <Button variant="outline" size="sm" onClick={() => handleGrade(member.student, type)}>
                                                Grade
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={gradingOpen} onOpenChange={setGradingOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Grade {selectedStudent?.name}</DialogTitle>
                        <DialogDescription>
                            Enter score for <span className="font-semibold capitalize">{gradeType}</span>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="score">Score (0-100)</Label>
                            <Input
                                id="score"
                                type="number"
                                min="0"
                                max="100"
                                value={score}
                                onChange={(e) => setScore(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="feedback">Feedback</Label>
                            <Textarea
                                id="feedback"
                                placeholder="Optional feedback..."
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={submitGrade} disabled={saving}>
                            {saving ? 'Saving...' : 'Save Grade'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
