'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Save, RotateCcw, Info, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Pdc1Weights {
  SEMPRO: number;
  BIMBINGAN_SEMPRO: number;
}

interface Pdc2Weights {
  NILAI_DOSEN: number;
  MILESTONE: number;
  EXPO: number;
  PEER_REVIEW: number;
}

interface TaWeights {
  BIMBINGAN_TA: number;
  SIDANG_TA: number;
}

interface GradeConfig {
  pdc1: {
    weights: Pdc1Weights;
  };
  pdc2: {
    weights: Pdc2Weights;
  };
  ta: {
    weights: TaWeights;
  };
}

interface Period {
  id: number;
  name: string;
  is_active: boolean;
}

export default function GradeConfigurationPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [, setConfig] = useState<GradeConfig | null>(null);
  const [pdc1Weights, setPdc1Weights] = useState({ SEMPRO: 50, BIMBINGAN_SEMPRO: 50 });
  const [pdc2Weights, setPdc2Weights] = useState({ NILAI_DOSEN: 25, MILESTONE: 25, EXPO: 25, PEER_REVIEW: 25 });
  const [taWeights, setTaWeights] = useState({ BIMBINGAN_TA: 50, SIDANG_TA: 50 });
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');

  useEffect(() => {
    fetchPeriods();
  }, []);

  const fetchConfig = useCallback(async () => {
    if (!selectedPeriod) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await api.get(`/admin/grade-configuration/${selectedPeriod}`);
      setConfig(res.data);
      // Backend returns { pdc1: { weights: {...} }, pdc2: { weights: {...} }, ta: { weights: {...} } }
      setPdc1Weights(res.data.pdc1?.weights || { SEMPRO: 50, BIMBINGAN_SEMPRO: 50 });
      setPdc2Weights(res.data.pdc2?.weights || { NILAI_DOSEN: 25, MILESTONE: 25, EXPO: 25, PEER_REVIEW: 25 });
      setTaWeights(res.data.ta?.weights || { BIMBINGAN_TA: 50, SIDANG_TA: 50 });
    } catch {
      toast.error('Failed to load grade configuration');
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    if (selectedPeriod) {
      fetchConfig();
    }
  }, [selectedPeriod, fetchConfig]);

  const fetchPeriods = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/periods');
      // Backend returns wrapped response: { success: true, data: [...] }
      const periodsData = Array.isArray(res.data?.data) ? res.data.data : [];
      setPeriods(periodsData);
      // Auto-select active period if none selected
      const active = periodsData.find((p: Period) => p.is_active);
      if (active && !selectedPeriod) {
        setSelectedPeriod(active.id.toString());
      }
    } catch {
      toast.error('Failed to load periods');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedPeriod) return;
    
    // Validate weights equal 100%
    const pdc1Total = Object.values(pdc1Weights).reduce((sum, weight) => sum + weight, 0);
    const pdc2Total = Object.values(pdc2Weights).reduce((sum, weight) => sum + weight, 0);
    
    if (pdc1Total !== 100) {
      toast.error(`PDC1 weights must total 100%. Current total: ${pdc1Total}%`);
      return;
    }
    
    if (pdc2Total !== 100) {
      toast.error(`PDC2 weights must total 100%. Current total: ${pdc2Total}%`);
      return;
    }

    // Validate TA weights equal 100%
    const taTotal = Object.values(taWeights).reduce((sum, weight) => sum + weight, 0);

    if (taTotal !== 100) {
      toast.error(`TA weights must total 100%. Current total: ${taTotal}%`);
      return;
    }

    try {
      setSaving(true);
      // Backend expects pdc1_weights, pdc2_weights, and ta_weights
      await api.post(`/admin/grade-configuration/${selectedPeriod}`, {
        pdc1_weights: pdc1Weights,
        pdc2_weights: pdc2Weights,
        ta_weights: taWeights,
      });
      toast.success('Grade configuration saved successfully');
      fetchConfig();
    } catch {
      toast.error('Failed to save grade configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!selectedPeriod) return;
    if (!confirm('Reset to default weights? This will overwrite your current configuration.')) return;
    
    try {
      setSaving(true);
      await api.post(`/admin/grade-configuration/${selectedPeriod}/reset`);
      toast.success('Reset to defaults');
      fetchConfig();
    } catch {
      toast.error('Failed to reset configuration');
    } finally {
      setSaving(false);
    }
  };

  const updatePdc1Weight = (key: keyof typeof pdc1Weights, value: string) => {
    const numValue = parseFloat(value) || 0;
    setPdc1Weights(prev => ({ ...prev, [key]: numValue }));
  };

  const updatePdc2Weight = (key: keyof typeof pdc2Weights, value: string) => {
    const numValue = parseFloat(value) || 0;
    setPdc2Weights(prev => ({ ...prev, [key]: numValue }));
  };

  const updateTaWeight = (key: keyof typeof taWeights, value: string) => {
    const numValue = parseFloat(value) || 0;
    setTaWeights(prev => ({ ...prev, [key]: numValue }));
  };

  // Calculate total weights for display
  const pdc1Total = Object.values(pdc1Weights).reduce((sum, weight) => sum + weight, 0);
  const pdc2Total = Object.values(pdc2Weights).reduce((sum, weight) => sum + weight, 0);
  const taTotal = Object.values(taWeights).reduce((sum, weight) => sum + weight, 0);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Show message if no periods exist
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
          <Button variant="outline" onClick={handleReset} disabled={saving || !selectedPeriod}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset to Defaults
          </Button>
          <Button onClick={handleSave} disabled={saving || !selectedPeriod}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
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
              <Badge variant={pdc1Total === 100 ? "default" : "destructive"}>
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
              <Badge variant={pdc2Total === 100 ? "default" : "destructive"}>
                {pdc2Total}%
              </Badge>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="nilai-dosen-weight">NILAI_DOSEN (Supervisor)</Label>
                <Badge variant="outline">{pdc2Weights.NILAI_DOSEN}%</Badge>
              </div>
              <Input
                id="nilai-dosen-weight"
                type="number"
                min={0}
                max={100}
                step={5}
                value={pdc2Weights.NILAI_DOSEN}
                onChange={(e) => updatePdc2Weight('NILAI_DOSEN', e.target.value)}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="milestone-weight">MILESTONE</Label>
                <Badge variant="outline">{pdc2Weights.MILESTONE}%</Badge>
              </div>
              <Input
                id="milestone-weight"
                type="number"
                min={0}
                max={100}
                step={5}
                value={pdc2Weights.MILESTONE}
                onChange={(e) => updatePdc2Weight('MILESTONE', e.target.value)}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="expo-weight">EXPO</Label>
                <Badge variant="outline">{pdc2Weights.EXPO}%</Badge>
              </div>
              <Input
                id="expo-weight"
                type="number"
                min={0}
                max={100}
                step={5}
                value={pdc2Weights.EXPO}
                onChange={(e) => updatePdc2Weight('EXPO', e.target.value)}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="peer-review-weight">PEER_REVIEW</Label>
                <Badge variant="outline">{pdc2Weights.PEER_REVIEW}%</Badge>
              </div>
              <Input
                id="peer-review-weight"
                type="number"
                min={0}
                max={100}
                step={5}
                value={pdc2Weights.PEER_REVIEW}
                onChange={(e) => updatePdc2Weight('PEER_REVIEW', e.target.value)}
              />
            </div>

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
              <Badge variant={taTotal === 100 ? "default" : "destructive"}>
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
                Default: BIMBINGAN_TA (50%) + SIDANG_TA (50%) <br/>
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
