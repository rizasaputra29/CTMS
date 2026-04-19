'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Save, RotateCcw, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface GradeWeights {
  pdc1: {
    SEMPRO: number;
    BIMBINGAN_SEMPRO: number;
  };
  pdc2: {
    EXPO: number;
    BIMBINGAN_EXPO: number;
    MILESTONE: number;
  };
}

interface GradeConfig {
  pdc1: {
    SEMPRO: number;
    BIMBINGAN_SEMPRO: number;
  };
  pdc2: {
    EXPO: number;
    BIMBINGAN_EXPO: number;
    MILESTONE: number;
  };
  defaults: GradeWeights;
}

export default function GradeConfigurationPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [, setConfig] = useState<GradeConfig | null>(null);
  const [pdc1Weights, setPdc1Weights] = useState({ SEMPRO: 60, BIMBINGAN_SEMPRO: 40 });
  const [pdc2Weights, setPdc2Weights] = useState({ EXPO: 50, BIMBINGAN_EXPO: 25, MILESTONE: 25 });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/grade-configuration');
      setConfig(res.data);
      setPdc1Weights(res.data.pdc1);
      setPdc2Weights(res.data.pdc2);
    } catch {
      toast.error('Failed to load grade configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.post('/admin/grade-configuration', {
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
    if (!confirm('Reset to default weights? This will overwrite your current configuration.')) return;
    
    try {
      setSaving(true);
      await api.post('/admin/grade-configuration/reset');
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
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Grade Configuration</h1>
          <p className="text-muted-foreground">Configure grade weights for PDC1 and PDC2 evaluations.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} disabled={saving}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset to Defaults
          </Button>
          <Button onClick={handleSave} disabled={saving}>
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
                <Label htmlFor="bimbingan-expo-weight">BIMBINGAN_EXPO</Label>
                <Badge variant="outline">{pdc2Weights.BIMBINGAN_EXPO}%</Badge>
              </div>
              <Input
                id="bimbingan-expo-weight"
                type="number"
                min={0}
                max={100}
                step={5}
                value={pdc2Weights.BIMBINGAN_EXPO}
                onChange={(e) => updatePdc2Weight('BIMBINGAN_EXPO', e.target.value)}
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

            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Default: EXPO (50%) + BIMBINGAN_EXPO (25%) + MILESTONE (25%)
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
              (EXPO × {pdc2Weights.EXPO}%) + (BIMBINGAN_EXPO × {pdc2Weights.BIMBINGAN_EXPO}%) + (MILESTONE × {pdc2Weights.MILESTONE}%)
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
