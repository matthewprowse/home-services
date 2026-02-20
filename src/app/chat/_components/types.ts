export interface DiagnosisData {
    thinking: string;
    diagnosis: string;
    trade: string;
    action_required: string;
    estimated_cost: string;
    message?: string;
}

export interface Message {
    role: 'user' | 'assistant';
    content: string;
    feedback?: 'up' | 'down' | null;
    attachments?: string[];
    hasUpdatedDiagnosis?: boolean;
}

export interface Service {
    short: string;
    full: string;
}

export interface Provider {
    name: string;
    address: string;
    rating?: number;
    ratingCount?: number;
    phone?: string;
    website?: string;
    latitude?: number;
    longitude?: number;
    summary: string;
    services: Service[];
    distanceText?: string;
    isOpen?: boolean | null;
}
