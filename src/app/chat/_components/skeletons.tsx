import { Skeleton } from '@/components/ui/skeleton';

export function DiagnosisSkeleton() {
    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <Skeleton className="h-8 w-64 rounded-md" />
                <div className="space-y-2.5 pt-1">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-[97%]" />
                    <Skeleton className="h-4 w-[98%]" />
                    <Skeleton className="h-4 w-[94%]" />
                    <Skeleton className="h-4 w-[45%]" />
                </div>
            </div>
            <div className="pt-2 border-t border-border/40 flex justify-between items-center">
                <div className="space-y-2">
                    <Skeleton className="h-5 w-48 mb-2" />
                    <Skeleton className="h-4 w-64" />
                </div>
            </div>
        </div>
    );
}

export function ProvidersSkeleton() {
    return (
        <>
            {[1, 2].map((i) => (
                <div
                    key={i}
                    className="flex flex-col gap-4 animate-pulse border-input border p-4 rounded-xl shadow-sm"
                >
                    <div className="flex justify-between items-start">
                        <div className="h-6 w-48 bg-secondary/50 rounded-md" />
                        <div className="h-6 w-16 bg-secondary/50 rounded-md" />
                    </div>
                    <div className="flex flex-row items-center gap-2 h-7 overflow-hidden">
                        <div className="h-5 w-20 bg-secondary/50 rounded-md" />
                        <div className="h-5 w-20 bg-secondary/50 rounded-md" />
                        <div className="h-5 w-16 bg-secondary/50 rounded-md" />
                    </div>
                    <div className="h-4 w-full bg-secondary/50 rounded-md" />
                    <div className="mt-auto flex gap-2">
                        <div className="h-10 flex-1 bg-secondary/50 rounded-md" />
                        <div className="h-10 flex-1 bg-secondary/50 rounded-md" />
                        <div className="h-10 flex-1 bg-secondary/50 rounded-md" />
                    </div>
                </div>
            ))}
        </>
    );
}
