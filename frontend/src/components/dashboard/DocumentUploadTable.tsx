'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { FileText, Upload, Eye, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import type { WorkflowPhase } from '@/types/dashboard';

const DOC_STATUS_MAP: Record<string, { label: string; color: string }> = {
    missing: { label: 'Belum Upload', color: 'bg-red-50 text-red-700 border-red-200' },
    DRAFT: { label: 'Draft', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    SUBMITTED: { label: 'Terkirim', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    APPROVED: { label: 'Disetujui', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    REJECTED: { label: 'Ditolak', color: 'bg-red-50 text-red-700 border-red-200' },
};

interface DocumentUploadTableProps {
    phases?: WorkflowPhase[];
}

export function DocumentUploadTable({ phases = [] }: DocumentUploadTableProps) {
    // Flatten all documents from all phases, filter out approved ones
    const pendingDocs = (phases ?? [])
        .flatMap((phase) =>
            (phase.documents ?? [])
                .filter((doc) => doc.status !== 'APPROVED')
                .map((doc) => ({
                    ...doc,
                    phaseLabel: phase.phase,
                    phaseStatus: phase.status,
                })),
        )
        .slice(0, 6); // Show max 6 items

    if (pendingDocs.length === 0) {
        return (
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Upload Document
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <CheckCircle2 className="h-10 w-10 text-emerald-400 mb-3" />
                        <p className="text-sm font-medium text-gray-700">Semua dokumen telah diupload</p>
                        <p className="text-xs text-gray-400 mt-1">
                            Tidak ada dokumen yang perlu diupload saat ini.
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Upload Document
                </CardTitle>
                <Link href="/mahasiswa/documents">
                    <Button variant="ghost" size="sm" className="h-7 text-xs">
                        Lihat Semua
                    </Button>
                </Link>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="border rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="text-xs font-medium text-gray-500">Nama Dokumen</TableHead>
                                <TableHead className="text-xs font-medium text-gray-500">Tipe</TableHead>
                                <TableHead className="text-xs font-medium text-gray-500">Status</TableHead>
                                <TableHead className="text-xs font-medium text-gray-500 text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pendingDocs.map((doc, idx) => {
                                const statusInfo = DOC_STATUS_MAP[doc.status] || {
                                    label: doc.status,
                                    color: 'bg-gray-50 text-gray-700 border-gray-200',
                                };

                                return (
                                    <TableRow key={`${doc.phaseLabel}-${doc.type}-${idx}`} className="hover:bg-gray-50/50">
                                        <TableCell className="text-sm font-medium text-gray-700">
                                            <div className="flex items-center gap-2">
                                                <FileText className="h-3.5 w-3.5 text-gray-400" />
                                                {doc.type}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs text-gray-500">{doc.phaseLabel}</TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={cn('text-[10px] h-5', statusInfo.color)}
                                            >
                                                {statusInfo.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Link href="/mahasiswa/documents">
                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                                    {doc.status === 'missing' ? (
                                                        <Upload className="h-3.5 w-3.5 text-primary-500" />
                                                    ) : (
                                                        <Eye className="h-3.5 w-3.5 text-gray-400" />
                                                    )}
                                                </Button>
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
