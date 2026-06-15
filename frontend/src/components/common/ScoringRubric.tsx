'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Eye } from 'lucide-react';

export interface ScoringComponent {
  id: number;
  code?: string | null;
  name: string;
  description?: string | null;
  weight: number;
}

export interface ScoringStudent {
  id: number;
  name: string;
  nim?: string | null;
}

export interface ScoringRubricProps {
  components: ScoringComponent[];
  students: ScoringStudent[];
  scores: Record<string, number>;
  notes: Record<string, string>;
  onScoreChange: (key: string, value: number) => void;
  onNoteChange: (key: string, value: string) => void;
  readOnly?: boolean;
  title?: string;
  description?: string;
  getKey?: (componentId: number, studentId: number) => string;
}

export function formatScoringKey(componentId: number, studentId: number): string {
  return `${componentId}_${studentId}`;
}

export function calculateWeightedScore(
  components: ScoringComponent[],
  scores: Record<string, number>,
  studentId: number,
  getKey: (componentId: number, studentId: number) => string = formatScoringKey
): number {
  return components.reduce((total, component) => {
    const score = scores[getKey(component.id, studentId)] || 0;
    return total + (score * component.weight) / 100;
  }, 0);
}

export function ScoringRubric({
  components,
  students,
  scores,
  notes,
  onScoreChange,
  onNoteChange,
  readOnly = false,
  title = 'Assessment Rubric',
  description = 'Rate the student on each component (0-100)',
  getKey = formatScoringKey,
}: ScoringRubricProps) {
  const multiStudent = students.length > 1;

  return (
    <Card className="shadow-xl">
      <CardHeader className="bg-muted/30">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {readOnly && (
            <Badge variant="secondary" className="text-sm px-3 py-1">
              <Eye className="w-4 h-4 mr-1" />
              View Only
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {components.map((component) => (
            <div key={component.id} className="p-6 space-y-4 hover:bg-muted/5 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {component.code && (
                      <span className="text-xs font-bold px-2 py-0.5 bg-primary/10 text-primary rounded">
                        {component.code}
                      </span>
                    )}
                    <h3 className="font-bold text-lg">{component.name}</h3>
                  </div>
                  {component.description && (
                    <p className="text-sm text-muted-foreground">{component.description}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-bold text-muted-foreground uppercase">Weight</p>
                  <p className="text-lg font-extrabold text-primary">{component.weight}%</p>
                </div>
              </div>

              <div className={`grid grid-cols-1 ${multiStudent ? 'md:grid-cols-2' : ''} gap-4 mt-4`}>
                {students.map((student) => {
                  const key = getKey(component.id, student.id);
                  const score = scores[key];
                  return (
                    <div key={student.id} className="space-y-2">
                      <Label className="text-xs flex justify-between">
                        <span>{student.name}</span>
                        <span className="font-bold text-primary">Score: {score ?? 0}</span>
                      </Label>
                      <div className="flex gap-4 items-start">
                        <div className="w-1/3">
                          <Input
                            type="number"
                            className="text-center font-bold"
                            placeholder={readOnly ? '-' : '0-100'}
                            value={score ?? ''}
                            onChange={(e) =>
                              onScoreChange(
                                key,
                                Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))
                              )
                            }
                            disabled={readOnly}
                            readOnly={readOnly}
                          />
                        </div>
                        <div className="flex-1">
                          <Textarea
                            placeholder={readOnly ? 'No notes' : 'Notes/feedback (optional)...'}
                            className="h-10 min-h-[40px] text-sm py-2"
                            value={notes[key] || ''}
                            onChange={(e) => onNoteChange(key, e.target.value)}
                            disabled={readOnly}
                            readOnly={readOnly}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
