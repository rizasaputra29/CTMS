'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { Period } from '@/types/finalization';

interface PeriodSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periods: Period[];
  onSelect: (periodId: number) => void;
  error?: string | null;
}

export function PeriodSelectorDialog({
  open,
  onOpenChange,
  periods,
  onSelect,
  error,
}: PeriodSelectorDialogProps) {

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Pilih Periode
          </DialogTitle>
          <DialogDescription>
            Terdapat multiple periode aktif. Silakan pilih periode yang ingin difinalisasi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="grid gap-3">
            {periods.map((period) => (
              <Card
                key={period.id}
                className="cursor-pointer transition-all hover:border-primary hover:shadow-sm"
                onClick={() => onSelect(period.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{period.name}</CardTitle>
                      <CardDescription>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(period.start_date)} - {formatDate(period.end_date)}
                          </span>
                        </div>
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {period.is_active && (
                        <Badge variant="default" className="bg-green-600">
                          Aktif
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Max Beban Supervisor: {period.max_supervisor_load || 8} grup
                    </div>
                    <Button size="sm" variant="outline" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Pilih Periode
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {periods.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Tidak ada periode aktif yang tersedia.</p>
              <p className="text-sm mt-1">
                Silakan aktifkan periode di menu Pengaturan {'>'} Periode.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
