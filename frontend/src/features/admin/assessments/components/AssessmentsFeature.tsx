'use client';

import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { useAssessments } from '../hooks/use-assessments';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Eye, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Alert,
    AlertDescription,
} from '@/components/ui/alert';

export function AssessmentsFeature() {
    const router = useRouter();
    const {
        periods,
        selectedPeriod,
        setSelectedPeriod,
        selectedType,
        setSelectedType,
        evaluationTypes,
        components,
        isLoadingComponents,
        totalWeight,
        typeLabel,
    } = useAssessments();

    return (
        <div className="container mx-auto py-6 max-w-7xl">
            <PageHeader
                title="Active Assessment Components"
                description="View assessment components configured for each period and evaluation type."
                className="mb-6"
                action={
                    <Button variant="outline" onClick={() => router.push('/admin/assessment-bank')}>
                        Manage Bank Soal
                    </Button>
                }
            />

            {/* Info Alert */}
            <Alert className="mb-6">
                <AlertDescription className="flex items-center justify-between">
                    <span>
                        Components are configured via{' '}
                        <strong>Period Assessment Configuration</strong>.
                        Manage master templates in the{' '}
                        <Button
                            variant="link"
                            className="h-auto p-0"
                            onClick={() => router.push('/admin/assessment-bank')}
                        >
                            Assessment Bank
                        </Button>
                        .
                    </span>
                </AlertDescription>
            </Alert>

            {/* Filters */}
            <Card className="mb-6">
                <CardContent className="pt-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Period</label>
                            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                                <SelectTrigger>
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
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Evaluation Type</label>
                            <Select value={selectedType} onValueChange={setSelectedType}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {evaluationTypes.map((type) => (
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
                    </div>
                </CardContent>
            </Card>

            {/* Components Table */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>{typeLabel} Components</CardTitle>
                            <CardDescription>
                                {components.length} component{components.length !== 1 ? 's' : ''} configured
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Total Weight:</span>
                            <Badge variant={totalWeight === 100 ? 'default' : 'destructive'}>
                                {totalWeight.toFixed(2)}%
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoadingComponents ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : components.length === 0 ? (
                        <EmptyState
                            icon={Eye}
                            title={`No components configured for ${typeLabel}`}
                            description="Configure assessment components for this period and evaluation type."
                            action={
                                <Button
                                    variant="outline"
                                    onClick={() => router.push('/admin/period-assessment-config')}
                                >
                                    Configure Components
                                </Button>
                            }
                        />
                    ) : (
                        <>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[80px]">Order</TableHead>
                                            <TableHead className="w-[100px]">Code</TableHead>
                                            <TableHead>Name</TableHead>
                                            <TableHead className="hidden md:table-cell">Description</TableHead>
                                            <TableHead className="w-[100px]">Weight</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {components.map((component) => (
                                            <TableRow key={component.id}>
                                                <TableCell>
                                                    <Badge variant="outline">{component.sort_order + 1}</Badge>
                                                </TableCell>
                                                <TableCell className="font-medium">{component.code}</TableCell>
                                                <TableCell>{component.name}</TableCell>
                                                <TableCell className="hidden md:table-cell max-w-[300px] truncate">
                                                    {component.description || (
                                                        <span className="text-muted-foreground italic">No description</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">{component.weight}%</Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {totalWeight !== 100 && (
                                <p className="text-sm text-destructive mt-4">
                                    ⚠️ Total weight should equal 100%. Current total: {totalWeight.toFixed(2)}%
                                </p>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Quick Links */}
            <div className="grid gap-4 md:grid-cols-2 mt-6">
                <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => router.push('/admin/assessment-bank')}>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold">Assessment Bank</h3>
                                <p className="text-sm text-muted-foreground">
                                    Manage master component templates
                                </p>
                            </div>
                            <ArrowLeft className="h-5 w-5 text-muted-foreground rotate-180" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => router.push('/admin/period-assessment-config')}>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold">Period Configuration</h3>
                                <p className="text-sm text-muted-foreground">
                                    Configure components for each period
                                </p>
                            </div>
                            <ArrowLeft className="h-5 w-5 text-muted-foreground rotate-180" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
