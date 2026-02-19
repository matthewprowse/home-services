"use client";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";

export default function SearchPage() {
    return (
        <SidebarProvider>
            <Suspense fallback={
                <div className="flex min-h-screen w-full items-center justify-center bg-background">
                    <Spinner className="size-8 text-muted-foreground" />
                </div>
            }>
                <AppSidebar />
                <SidebarInset className="flex flex-col min-h-screen bg-background">
                    <SearchContent />
                </SidebarInset>
            </Suspense>
        </SidebarProvider>
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
