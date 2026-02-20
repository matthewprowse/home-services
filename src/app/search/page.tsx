'use client';

import { AppHeader } from '@/components/app-header';
import { Suspense } from 'react';
import { Spinner } from '@/components/ui/spinner';

export default function SearchPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen w-full items-center justify-center bg-background">
                    <Spinner className="size-8 text-muted-foreground" />
                </div>
            }
        >
            <SearchContent />
        </Suspense>
    );
}

function SearchContent() {
    return (
        <>
            <AppHeader title="Search & History" />
            <main className="flex flex-1 flex-col p-4 md:p-12">
                <div className="max-w-3xl mx-auto w-full">
                    <h2 className="text-xl font-semibold mb-4">Chat History</h2>
                    <div className="text-muted-foreground italic">
                        Search and history features coming soon...
                    </div>
                </div>
            </main>
        </>
    );
}
