'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, CheckCircle, ArrowLeft, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { usePeriodSelection } from '@/context/PeriodSelectionContext';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';

interface Period {
  id: number;
  name: string;
  is_active: boolean;
  is_finalized?: boolean;
}

interface Template {
  id: number;
  code: string;
  name: string;
  description: string | null;
  weight: number;
  is_active: boolean;
}

interface SelectedComponent {
  id: number;
  template_id: number;
  code: string;
  name: string;
  description: string | null;
  weight: number;
  sort_order: number;
}

const EVALUATION_TYPES = [
  { value: 'SEMPRO', label: 'SEMPRO', description: 'Seminar Proposal' },
  { value: 'SIDANG_TA', label: 'SIDANG_TA', description: 'Sidang Tugas Akhir' },
  { value: 'EXPO', label: 'EXPO', description: 'Expo' },
  { value: 'BIMBINGAN_SEMPRO', label: 'BIMBINGAN_SEMPRO', description: 'Penilaian Dosbing SEMPRO' },
  { value: 'BIMBINGAN_TA', label: 'BIMBINGAN_TA', description: 'Penilaian Dosbing Sidang TA' },
  { value: 'NILAI_DOSEN', label: 'NILAI_DOSEN', description: 'Nilai Dosen Pembimbing' },
  { value: 'MILESTONE', label: 'MILESTONE', description: 'Penilaian Milestone' },
];

const normalizePeriodList = (payload: unknown): Period[] => {
  if (Array.isArray(payload)) return payload as Period[];
  if (payload && typeof payload === 'object') {
    const data = (payload as { data?: unknown }).data;
    if (Array.isArray(data)) return data as Period[];
    if (data && typeof data === 'object') {
      const nested = (data as { data?: unknown }).data;
      if (Array.isArray(nested)) return nested as Period[];
    }
  }
  return [];
};

const normalizePeriodDetail = (payload: unknown): Period | null => {
  if (payload && typeof payload === 'object') {
    const data = (payload as { data?: unknown }).data;
    if (data && typeof data === 'object' && !Array.isArray(data)) return data as Period;
    if ('id' in (payload as Record<string, unknown>)) return payload as Period;
  }
  return null;
};

export default function PeriodAssessmentConfigPage() {
  const router = useRouter();
  const { setPeriodSelection } = usePeriodSelection();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('SEMPRO');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedComponents, setSelectedComponents] = useState<SelectedComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isPeriodFinalized = useMemo(() => {
    const p = periods.find((p) => p.id.toString() === selectedPeriod);
    return p?.is_finalized ?? false;
  }, [periods, selectedPeriod]);

  const hydrateSelectedPeriodFinalized = useCallback(async (periodId: string) => {
    try {
      const res = await api.get(`/admin/periods/${periodId}`);
      const detail = normalizePeriodDetail(res.data);
      if (!detail) return;
      setPeriods((prev) => prev.map((p) => (p.id === detail.id ? { ...p, is_finalized: detail.is_finalized } : p)));
    } catch {
      // ignore detail fetch errors
    }
  }, []);

  const fetchPeriods = useCallback(async () => {
    try {
      const res = await api.get('/admin/periods');
      const periodsData = normalizePeriodList(res.data);
      setPeriods(periodsData);
      const active = periodsData.find((p: Period) => p.is_active);
      if (active) setSelectedPeriod(active.id.toString());
    } catch {
      toast.error('Failed to load periods');
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await api.get('/admin/assessment-templates');
      setTemplates(res.data || []);
    } catch {
      toast.error('Failed to load templates');
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    if (!selectedPeriod || !selectedType) return;
    setLoading(true);
    try {
      const res = await api.get(`/admin/periods/${selectedPeriod}/assessment-config`, {
        params: { type: selectedType },
      });
      setSelectedComponents(res.data.selected_components || []);
    } catch {
      setSelectedComponents([]);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, selectedType]);

  useEffect(() => {
    fetchPeriods();
    fetchTemplates();
  }, [fetchPeriods, fetchTemplates]);

  useEffect(() => {
    if (selectedPeriod && selectedType) {
      fetchConfig();
    }
  }, [fetchConfig, selectedPeriod, selectedType]);

  useEffect(() => {
    const p = periods.find(p => p.id.toString() === selectedPeriod);
    if (p && typeof p.is_finalized === 'undefined') {
      hydrateSelectedPeriodFinalized(p.id.toString());
    }
    setPeriodSelection(p?.is_finalized ?? false);
  }, [selectedPeriod, periods, setPeriodSelection, hydrateSelectedPeriodFinalized]);

  const isTemplateSelected = (templateId: number) => {
    return selectedComponents.some((c) => c.template_id === templateId);
  };

  const handleToggleTemplate = (template: Template) => {
    if (isPeriodFinalized) return;
    if (isTemplateSelected(template.id)) {
      setSelectedComponents((prev) => prev.filter((c) => c.template_id !== template.id));
    } else {
      const newComponent: SelectedComponent = {
        id: 0, // Will be assigned by backend
        template_id: template.id,
        code: template.code,
        name: template.name,
        description: template.description,
        weight: template.weight,
        sort_order: selectedComponents.length,
      };
      setSelectedComponents((prev) => [...prev, newComponent]);
    }
  };

  const handleSave = async () => {
    if (isPeriodFinalized || !selectedPeriod || !selectedType) return;
    
    setSaving(true);
    try {
      const templateIds = selectedComponents.map((c) => c.template_id);
      await api.post(`/admin/periods/${selectedPeriod}/assessment-config`, {
        type: selectedType,
        template_ids: templateIds,
      });
      toast.success('Configuration saved successfully');
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyFromPeriod = async (sourcePeriodId: string) => {
    if (isPeriodFinalized || !selectedPeriod) return;
    
    try {
      await api.post(`/admin/periods/${selectedPeriod}/assessment-config/copy`, {
        source_period_id: sourcePeriodId,
      });
      toast.success('Configuration copied successfully');
      fetchConfig();
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to copy configuration');
    }
  };

  const totalWeight = selectedComponents.reduce((sum, c) => sum + Number(c.weight), 0);

  return (
    <div className="container mx-auto py-6 max-w-7xl">
      <div className="mb-6">
        <Button variant="ghost" className="mb-4" onClick={() => router.push('/admin/periods')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Periods
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Period Assessment Configuration</h1>
        <p className="text-muted-foreground">
          Configure assessment components for each period by selecting from the component bank.
        </p>
      </div>

      {isPeriodFinalized && (
        <Alert variant="destructive" className="border-amber-500 bg-amber-50 mb-6">
          <Lock className="h-4 w-4 text-amber-600" />
          <AlertTitle>Period Finalized</AlertTitle>
          <AlertDescription>
            This period is finalized. Reopen it on the
            <Link href="/admin/finalization" className="font-semibold underline hover:text-amber-900"> Finalization page</Link>
            {' '}to make changes.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Configuration Panel */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>Select period and evaluation type</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Period</Label>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    {periods.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.name} {p.is_active && '(Active)'} {p.is_finalized && '(Finalized)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Evaluation Type</Label>
                <Select value={selectedType} onValueChange={setSelectedType} disabled={isPeriodFinalized}>
                  <SelectTrigger disabled={isPeriodFinalized}>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {EVALUATION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex flex-col">
                          <span>{type.label}</span>
                          <span className="text-xs text-muted-foreground">{type.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-4 border-t">
                <Label className="mb-2 block">Copy from Period</Label>
                <Select onValueChange={handleCopyFromPeriod} disabled={isPeriodFinalized}>
                  <SelectTrigger disabled={isPeriodFinalized}>
                    <SelectValue placeholder="Select source period" />
                  </SelectTrigger>
                  <SelectContent>
                    {periods
                      .filter((p) => p.id.toString() !== selectedPeriod)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id.toString()}>
                          {p.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Copy all assessment configuration from another period
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Selected Components:</span>
                <Badge variant="secondary">{selectedComponents.length}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Weight:</span>
                <Badge variant={totalWeight === 100 ? 'default' : 'destructive'}>
                  {totalWeight.toFixed(2)}%
                </Badge>
              </div>
              {totalWeight !== 100 && (
                <p className="text-xs text-destructive">
                  Total weight should equal 100%
                </p>
              )}
              <Button 
                className="w-full" 
                onClick={handleSave} 
                disabled={saving || !selectedPeriod || !selectedType || isPeriodFinalized}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Configuration
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Templates Panel */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Component Bank</CardTitle>
              <CardDescription>
                Select components to include in {selectedType} for the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-12 border rounded-lg border-dashed text-muted-foreground">
                  No component templates available. Please create templates in the Assessment Bank first.
                </div>
              ) : (
                <div className="space-y-4">
                  {templates
                    .filter((t) => t.is_active)
                    .map((template, index) => (
                      <div
                        key={template.id}
                        className={`flex items-start space-x-4 p-4 rounded-lg border transition-colors ${
                          isTemplateSelected(template.id)
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <Checkbox
                          id={`template-${template.id}`}
                          checked={isTemplateSelected(template.id)}
                          onCheckedChange={() => handleToggleTemplate(template)}
                          disabled={isPeriodFinalized}
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <Label
                              htmlFor={`template-${template.id}`}
                              className="font-medium cursor-pointer"
                            >
                              {template.code}: {template.name}
                            </Label>
                            {isTemplateSelected(template.id) && (
                              <CheckCircle className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          {template.description && (
                            <p className="text-sm text-muted-foreground">
                              {template.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 text-sm">
                            <Badge variant="outline">Weight: {template.weight}%</Badge>
                            {isTemplateSelected(template.id) && (
                              <Badge variant="secondary">Order: {index + 1}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Selected Components Preview */}
          {selectedComponents.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Selected Components</CardTitle>
                <CardDescription>Components that will be used for this evaluation type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {selectedComponents.map((component, index) => (
                    <div
                      key={component.id || component.template_id}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{index + 1}</Badge>
                        <div>
                          <p className="font-medium">
                            {component.code}: {component.name}
                          </p>
                          {component.description && (
                            <p className="text-xs text-muted-foreground">
                              {component.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge>Weight: {component.weight}%</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
