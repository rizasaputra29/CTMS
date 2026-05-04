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

interface GradeWeights {
  pdc1: {
    SEMPRO: number;
    BIMBINGAN_SEMPRO: number;
  };
  pdc2: {
    NILAI_DOSEN: number;
    MILESTONE: number;
    EXPO: number;
    PEER_REVIEW: number;
  };
}

interface GradeConfig {
  pdc1: {
    SEMPRO: number;
    BIMBINGAN_SEMPRO: number;
  };
  pdc2: {
    NILAI_DOSEN: number;
    MILESTONE: number;
    EXPO: number;
    PEER_REVIEW: number;
  };
  defaults: GradeWeights;
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
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');

  useEffect(() => {
    fetchPeriods();
  }, []);

  useEffect(() => {
    if (selectedPeriod) {
      fetchConfig();
    }
  }, [selectedPeriod, fetchConfig]);

  const fetchPeriods = async () => {
    try {
      const res = await api.get('/admin/periods');
      setPeriods(res.data);
      const active = res.data.find((p: Period) => p.is_active);
      if (active) {
        setSelectedPeriod(active.id.toString());
      } else if (res.data.length > 0) {
        setSelectedPeriod(res.data[0].id.toString());
      }
    } catch {
      toast.error('Failed to load periods');
    }
  };

  const fetchConfig = useCallback(async () => {
    if (!selectedPeriod) return;
    try {
      setLoading(true);
      const res = await api.get(`/admin/grade-configuration/${selectedPeriod}`);
      setConfig(res.data);
      setPdc1Weights(res.data.pdc1);
      setPdc2Weights(res.data.pdc2);
    } catch {
      toast.error('Failed to load grade configuration');
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  const handleSave = async () => {
    if (!selectedPeriod) return;
    try {
      setSaving(true);
      await api.post(`/admin/grade-configuration/${selectedPeriod}`, {
        pdc1: pdc1Weights,
        pdc2: pdc2Weights,
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-start">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Grade Configuration</h1>
          <p className="text-muted-foreground">Configure grade weights for PDC1 and PDC2 evaluations.</p>
          
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
          Weights are used to calculate final grades. Total weight does not need to equal 100%.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        {/* PDC1 Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>PDC1 Grade Weights</CardTitle>
            <CardDescription>Configure weights for PDC1 (Semester 5-6)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
        </CardContent>
      </Card>
    </div>
  );
}
