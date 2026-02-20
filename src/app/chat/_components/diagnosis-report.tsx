import { DiagnosisData } from './types';

export function DiagnosisReport({ diagnosis }: { diagnosis: DiagnosisData | null }) {
    if (!diagnosis?.diagnosis) return null;
    return (
        <div className="animate-in fade-in slide-in-from-bottom-3 duration-500">
            <h2 className="text-xl font-semibold">{diagnosis.diagnosis}</h2>
            <div className="mt-3 space-y-4">
                <p className="text-sm text-foreground/90">{diagnosis.action_required}</p>
                <p className="text-sm font-medium text-foreground/80">{diagnosis.estimated_cost}</p>
            </div>
        </div>
    );
}
