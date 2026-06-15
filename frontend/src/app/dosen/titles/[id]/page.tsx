'use client';

import { useParams } from 'next/navigation';
import { TitleDetailFeature } from "@/features/dosen/title-detail";

export default function DosenTitleDetailPage() {
    const { id } = useParams<{ id: string }>();

    return <TitleDetailFeature titleId={id} />;
}
