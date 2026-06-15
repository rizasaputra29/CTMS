'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Save, RotateCcw, Info, Calendar } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useGradeConfiguration } from '@/features/admin/grade-configuration/hooks/use-grade-configuration';

export function GradeConfigurationFeature() {
    const {
        periods,
        selectedPeriod,
        setSelectedPeriod,
        pdc1Weights,
        pdc2Weights,
        taWeights,
        updatePdc1Weight,
        updatePdc2Weight,
        updateTaWeight,
        isLoading,
        isSaving,
        isResetting,
        handleSave,
        handleReset,
    } = useGradeConfiguration();

    const pdc1Total = Object.values(pdc1Weights).reduce((sum, weight) => sum + weight, 0);
    const pdc2Total = Object.values(pdc2Weights).reduce((sum, weight) => sum + weight, 0);
    const taTotal = Object.values(taWeights).reduce((sum, weight) => sum + weight, 0);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (periods.length === 0) {
        return (
            <div className="space-y-6">
                <h1 className="text-3xl font-bold tracking-tight">Grade Configuration</h1>
                <p className="text-muted-foreground">Configure grade weights for PDC1 and PDC2 evaluations.</p>
                <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                        No periods found. Please create a period first to configure grade weights.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-start">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">Grade Configuration</h1>
                    <p className="text-muted-foreground">Configure grade weights for PDC1, PDC2, and TA evaluations.</p>

                    {/* Period Selector */}
                    <div className="flex items-center gap-2 pt-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Select period" />
                            </SelectTrigger>
                            <SelectContent>
                                {periods.map((period) => (
                                    <SelectItem key={period.id} value={period.id.toString()}>
                                        {period.name} {period.is_active && '(Active)'}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleReset} disabled={isResetting || !selectedPeriod}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reset to Defaults
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving || !selectedPeriod}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Configuration
                    </Button>
                </div>
            </div>

            <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                    Weights are used to calculate final grades. Total weight must equal 100%.
                </AlertDescription>
            </Alert>

            <div className="grid gap-6 md:grid-cols-3">
                {/* PDC1 Configuration */}
                <Card>
                    <CardHeader>
                        <CardTitle>PDC1 Grade Weights</CardTitle>
                        <CardDescription>Configure weights for PDC1 (Semester 5-6)</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                            <span className="font-medium">Total Weight:</span>
                            <Badge variant={pdc1Total === 100 ? 'default' : 'destructive'}>
                                {pdc1Total}%
                            </Badge>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <Label htmlFor="sempro-weight">SEMPRO (Examiner)</Label>
                                <Badge variant="outline">{pdc1Weights.SEMPRO}%</Badge>
                            </div>
                            <Input
                                id="sempro-weight"
                                type="number"
                                min={0}
                                max={100}
                                step={5}
                                value={pdc1Weights.SEMPRO}
                                onChange={(e) => updatePdc1Weight('SEMPRO', e.target.value)}
                            />
                        </div>

                        <Separator />

                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <Label htmlFor="bimbingan-sempro-weight">BIMBINGAN_SEMPRO (Supervisor)</Label>
                                <Badge variant="outline">{pdc1Weights.BIMBINGAN_SEMPRO}%</Badge>
                            </div>
                            <Input
                                id="bimbingan-sempro-weight"
                                type="number"
                                min={0}
                                max={100}
                                step={5}
                                value={pdc1Weights.BIMBINGAN_SEMPRO}
                                onChange={(e) => updatePdc1Weight('BIMBINGAN_SEMPRO', e.target.value)}
                            />
                        </div>

                        <div className="pt-4 border-t">
                            <p className="text-sm text-muted-foreground">
                                Default: SEMPRO (60%) + BIMBINGAN_SEMPRO (40%)
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* PDC2 Configuration */}
                <Card>
                    <CardHeader>
                        <CardTitle>PDC2 Grade Weights</CardTitle>
                        <CardDescription>Configure weights for PDC2 (Semester 7-8)</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                            <span className="font-medium">Total Weight:</span>
                            <Badge variant={pdc2Total === 100 ? 'default' : 'destructive'}>
                                {pdc2Total}%
                            </Badge>
                        </div>

                        {(['NILAI_DOSEN', 'MILESTONE', 'EXPO', 'PEER_REVIEW'] as const).map((key, idx, arr) => (
                            <div key={key} className="space-y-2">
                                <div className="flex justify-between">
                                    <Label htmlFor={`${key.toLowerCase()}-weight`}>{key}</Label>
                                    <Badge variant="outline">{pdc2Weights[key]}%</Badge>
                                </div>
                                <Input
                                    id={`${key.toLowerCase()}-weight`}
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={5}
                                    value={pdc2Weights[key]}
                                    onChange={(e) => updatePdc2Weight(key, e.target.value)}
                                />
                                {idx < arr.length - 1 && <Separator />}
                            </div>
                        ))}

                        <div className="pt-4 border-t">
                            <p className="text-sm text-muted-foreground">
                                Default: NILAI_DOSEN (25%) + MILESTONE (25%) + EXPO (25%) + PEER_REVIEW (25%)
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* TA Configuration */}
                <Card>
                    <CardHeader>
                        <CardTitle>TA Grade Weights</CardTitle>
                        <CardDescription>Configure weights for Tugas Akhir (Individual)</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                            <span className="font-medium">Total Weight:</span>
                            <Badge variant={taTotal === 100 ? 'default' : 'destructive'}>
                                {taTotal}%
                            </Badge>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <Label htmlFor="bimbingan-ta-weight">BIMBINGAN_TA (Supervisor)</Label>
                                <Badge variant="outline">{taWeights.BIMBINGAN_TA}%</Badge>
                            </div>
                            <Input
                                id="bimbingan-ta-weight"
                                type="number"
                                min={0}
                                max={100}
                                step={5}
                                value={taWeights.BIMBINGAN_TA}
                                onChange={(e) => updateTaWeight('BIMBINGAN_TA', e.target.value)}
                            />
                        </div>

                        <Separator />

                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <Label htmlFor="sidang-ta-weight">SIDANG_TA (Defense)</Label>
                                <Badge variant="outline">{taWeights.SIDANG_TA}%</Badge>
                            </div>
                            <Input
                                id="sidang-ta-weight"
                                type="number"
                                min={0}
                                max={100}
                                step={5}
                                value={taWeights.SIDANG_TA}
                                onChange={(e) => updateTaWeight('SIDANG_TA', e.target.value)}
                            />
                        </div>

                        <div className="pt-4 border-t">
                            <p className="text-sm text-muted-foreground">
                                Default: BIMBINGAN_TA (50%) + SIDANG_TA (50%) <br />
                                <span className="text-xs italic">TA is calculated per student, not per group</span>
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Grade Calculation Formula */}
            <Card>
                <CardHeader>
                    <CardTitle>Grade Calculation Formula</CardTitle>
                    <CardDescription>How grades are calculated using the weights above</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="bg-muted p-4 rounded-lg">
                        <p className="font-medium mb-2">PDC1 Grade:</p>
                        <p className="text-sm text-muted-foreground">
                            (SEMPRO × {pdc1Weights.SEMPRO}%) + (BIMBINGAN_SEMPRO × {pdc1Weights.BIMBINGAN_SEMPRO}%)
                        </p>
                    </div>
                    <div className="bg-muted p-4 rounded-lg">
                        <p className="font-medium mb-2">PDC2 Grade:</p>
                        <p className="text-sm text-muted-foreground">
                            (NILAI_DOSEN × {pdc2Weights.NILAI_DOSEN}%) + (MILESTONE × {pdc2Weights.MILESTONE}%) + (EXPO × {pdc2Weights.EXPO}%) + (PEER_REVIEW × {pdc2Weights.PEER_REVIEW}%)
                        </p>
                    </div>
                    <div className="bg-muted p-4 rounded-lg">
                        <p className="font-medium mb-2">TA Grade (Per Student):</p>
                        <p className="text-sm text-muted-foreground">
                            (BIMBINGAN_TA × {taWeights.BIMBINGAN_TA}%) + (SIDANG_TA × {taWeights.SIDANG_TA}%)
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
