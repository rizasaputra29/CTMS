export interface Pdc1Weights {
    SEMPRO: number;
    BIMBINGAN_SEMPRO: number;
}

export interface Pdc2Weights {
    NILAI_DOSEN: number;
    MILESTONE: number;
    EXPO: number;
    PEER_REVIEW: number;
}

export interface TaWeights {
    BIMBINGAN_TA: number;
    SIDANG_TA: number;
}

export interface GradeConfig {
    pdc1: {
        weights: Pdc1Weights;
    };
    pdc2: {
        weights: Pdc2Weights;
    };
    ta: {
        weights: TaWeights;
    };
}

export interface GradeConfigurationPeriod {
    id: number;
    name: string;
    is_active: boolean;
}
