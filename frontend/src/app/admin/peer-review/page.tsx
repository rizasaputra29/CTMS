'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Save, CheckCircle, BarChart3, Users } from 'lucide-react';
import { toast } from 'sonner';

interface Period {
  id: number;
  name: string;
  is_active: boolean;
}

interface Template {
  id: number;
  code: string;
  name: string;
  description: string | null;
  weight: number;
  sort_order: number;
  is_active: boolean;
}

interface SelectedIndicator {
  id: number;
  template_id: number;
  code: string;
  name: string;
  description: string | null;
  weight: number;
  sort_order: number;
}

interface GroupMemberScore {
  student_id: number;
  student_name: string;
  weighted_avg: number;
  individual_scores: { indicator_code: string; raw_score: number; converted_score: number; weight: number }[];
}

interface GroupScore {
  group_id: number;
  group_code: string;
  group_name: string;
  members: GroupMemberScore[];
}

export default function AdminPeerReviewPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [allTemplates, setAllTemplates] = useState<Template[]>([]);
  const [selectedIndicators, setSelectedIndicators] = useState<SelectedIndicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('configuration');
  
  // Scores state
  const [scoresData, setScoresData] = useState<GroupScore[]>([]);
  const [scoresLoading, setScoresLoading] = useState(false);

  const fetchPeriods = useCallback(async () => {
    try {
      const res = await api.get('/admin/periods');
      const periodsData = res.data?.data || [];
      setPeriods(periodsData);
      const active = periodsData.find((p: Period) => p.is_active);
      if (active) setSelectedPeriod(active.id.toString());
    } catch {
      toast.error('Failed to load periods');
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    if (!selectedPeriod) return;
    setLoading(true);
    try {
      const res = await api.get(`/admin/periods/${selectedPeriod}/peer-review-config`);
      setAllTemplates(res.data.all_templates || []);
      setSelectedIndicators(res.data.selected_indicators || []);
    } catch {
      toast.error('Failed to load configuration');
      setAllTemplates([]);
      setSelectedIndicators([]);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  const fetchScores = useCallback(async () => {
    if (!selectedPeriod) return;
    setScoresLoading(true);
    try {
      const res = await api.get(`/admin/peer-review/scores?period_id=${selectedPeriod}`);
      setScoresData(res.data?.groups || []);
    } catch (error: unknown) {
      console.error('Failed to load scores:', error);
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message || 'Unknown error'
        : 'Unknown error';
      toast.error('Failed to load peer review scores: ' + message);
      setScoresData([]);
    } finally {
      setScoresLoading(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  useEffect(() => {
    if (selectedPeriod) {
      fetchConfig();
      if (activeTab === 'scores') {
        fetchScores();
      }
    }
  }, [fetchConfig, fetchScores, selectedPeriod, activeTab]);

  const isTemplateSelected = (templateId: number) => {
    return selectedIndicators.some((i) => i.template_id === templateId);
  };

  const handleToggleTemplate = (template: Template) => {
    if (isTemplateSelected(template.id)) {
      setSelectedIndicators((prev) => prev.filter((i) => i.template_id !== template.id));
    } else {
      const newIndicator: SelectedIndicator = {
        id: 0, // Will be assigned by backend
        template_id: template.id,
        code: template.code,
        name: template.name,
        description: template.description,
        weight: template.weight,
        sort_order: selectedIndicators.length,
      };
      setSelectedIndicators((prev) => [...prev, newIndicator]);
    }
  };

  const handleSave = async () => {
    if (!selectedPeriod) return;
    
    setSaving(true);
    try {
      const templateIds = selectedIndicators.map((i) => i.template_id);
      await api.post(`/admin/periods/${selectedPeriod}/peer-review-config`, {
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
    if (!selectedPeriod) return;
    
    try {
      await api.post(`/admin/periods/${selectedPeriod}/peer-review-config/copy`, {
        source_period_id: sourcePeriodId,
      });
      toast.success('Configuration copied successfully');
      fetchConfig();
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to copy configuration');
    }
  };

  const totalWeight = selectedIndicators.reduce((sum, i) => sum + Number(i.weight), 0);

  // Convert 1-4 scale to 0-100 scale - commented out as unused
  // const convertScoreTo100 = (rawScore: number): number => {
  //   return rawScore > 0 ? rawScore * 25 : 0;
  // };

  // const getScoreColor = (score: number) => {
  //   // For converted scores (0-100 scale)
  //   if (score >= 80) return 'text-green-600';
  //   if (score >= 60) return 'text-amber-600';
  //   return 'text-red-600';
  // };

  const getRawScoreColor = (score: number) => {
    // For raw scores (1-4 scale)
    if (score >= 3) return 'text-green-600';
    if (score >= 2) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 80) return 'default';
    if (score >= 60) return 'secondary';
    return 'destructive';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Peer Review</h1>
        <p className="text-muted-foreground">
          Configure peer review indicators and view submitted scores.
        </p>
      </div>

      {/* Period Selector - Always visible */}
      <Card>
        <CardHeader>
          <CardTitle>Select Period</CardTitle>
          <CardDescription>Choose a period to configure or view peer review data</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-full md:w-80">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              {periods.map((p) => (
                <SelectItem key={p.id} value={p.id.toString()}>
                  {p.name} {p.is_active && '(Active)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full md:w-auto grid-cols-2 md:inline-flex">
          <TabsTrigger value="configuration" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="scores" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            View Scores
          </TabsTrigger>
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="configuration" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Configuration Panel */}
            <div className="lg:col-span-1 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Configuration</CardTitle>
                  <CardDescription>Configure indicators for peer review</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="pt-4 border-t">
                    <Label className="mb-2 block">Copy from Period</Label>
                    <Select onValueChange={handleCopyFromPeriod}>
                      <SelectTrigger>
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
                      Copy peer review configuration from another period
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
                    <span className="text-sm text-muted-foreground">Selected Indicators:</span>
                    <Badge variant="secondary">{selectedIndicators.length}</Badge>
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
                    disabled={saving || !selectedPeriod}
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
                  <CardTitle>Assessment Bank</CardTitle>
                  <CardDescription>
                    Select assessment components to include in peer review for the selected period
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex justify-center items-center h-64">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : allTemplates.length === 0 ? (
                    <div className="text-center py-12 border rounded-lg border-dashed text-muted-foreground">
                      No assessment templates available. Please create templates in the Assessment Bank first.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {allTemplates
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

              {/* Selected Indicators Preview */}
              {selectedIndicators.length > 0 && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Selected Indicators</CardTitle>
                    <CardDescription>Indicators that will be used for peer review</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selectedIndicators.map((indicator, index) => (
                        <div
                          key={indicator.id || indicator.template_id}
                          className="flex items-center justify-between p-3 bg-muted rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">{index + 1}</Badge>
                            <div>
                              <p className="font-medium">{indicator.code}: {indicator.name}</p>
                              {indicator.description && (
                                <p className="text-xs text-muted-foreground">
                                  {indicator.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <Badge>Weight: {indicator.weight}%</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* View Scores Tab */}
        <TabsContent value="scores" className="space-y-6">
          {!selectedPeriod ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Please select a period to view peer review scores.
              </CardContent>
            </Card>
          ) : scoresLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : scoresData.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <h3 className="text-lg font-semibold mb-2">No Scores Available</h3>
                <p className="text-muted-foreground">
                  No peer review scores have been submitted for this period yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {scoresData.map((group) => (
                <Card key={group.group_id}>
                  <CardHeader className="bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{group.group_code || `Group ${group.group_id}`}</CardTitle>
                        {group.group_name && (
                          <CardDescription>{group.group_name}</CardDescription>
                        )}
                      </div>
                      <Badge variant="secondary">
                        {group.members.length} Members
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold">Member</th>
                            {group.members[0]?.individual_scores.map((score) => (
                              <th key={score.indicator_code} className="px-4 py-3 text-center font-semibold">
                                {score.indicator_code}
                                <span className="block text-xs font-normal text-muted-foreground">({score.weight}%)</span>
                              </th>
                            ))}
                            <th className="px-4 py-3 text-center font-semibold">
                              Weighted Average
                              <span className="block text-xs font-normal text-muted-foreground">(0-100 scale)</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {group.members.map((member) => (
                            <tr key={member.student_id} className="hover:bg-muted/20">
                              <td className="px-4 py-3 font-medium">{member.student_name}</td>
                              {member.individual_scores.map((score) => (
                                <td key={score.indicator_code} className="px-4 py-3 text-center">
                                  <div className="flex flex-col items-center">
                                    <span className={`font-bold ${getRawScoreColor(score.raw_score)}`}>
                                      {score.raw_score}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      ({score.converted_score})
                                    </span>
                                  </div>
                                </td>
                              ))}
                              <td className="px-4 py-3 text-center">
                                <Badge variant={getScoreBadgeVariant(member.weighted_avg)} className="text-lg px-3 py-1">
                                  {member.weighted_avg.toFixed(1)}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-4 bg-muted/30 text-xs text-muted-foreground flex items-center gap-4">
                      <span><strong>Raw Score (1-4):</strong> 1=Poor, 2=Fair, 3=Good, 4=Excellent</span>
                      <span className="text-border">|</span>
                      <span><strong>Converted:</strong> Raw × 25 (0-100 scale)</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
