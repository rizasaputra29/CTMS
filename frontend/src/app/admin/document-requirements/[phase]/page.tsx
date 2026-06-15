'use client';

import { useParams } from 'next/navigation';
import { PhaseRequirementFeature } from '@/features/admin/document-requirements';

const PHASES = ['PDC1', 'SEMPRO', 'PDC2', 'EXPO', 'TA', 'SIDANG'];

export default function PhaseDocumentRequirementsPage() {
    const params = useParams();
    const phaseParam = (params.phase as string)?.toUpperCase();
    const phase = PHASES.includes(phaseParam) ? phaseParam : '';

    return <PhaseRequirementFeature phase={phase} />;
}
