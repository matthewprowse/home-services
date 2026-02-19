"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase, getSupabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const dynamic = 'force-dynamic';

function AuthCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState("Verifying your session...");

    useEffect(() => {
        const handleCallback = async () => {
            const client = getSupabase();
            if (!client) {
                console.error("Supabase client not initialized");
                router.push("/auth/error");
                return;
            }

            const code = searchParams.get("code");
            const next = searchParams.get("next") || "/";
            const error = searchParams.get("error");
            const errorDescription = searchParams.get("error_description");

            if (error) {
                console.error("Auth error:", error, errorDescription);
                toast.error(errorDescription || "Authentication failed");
                router.push("/auth/error");
                return;
            }

            try {
                // 1. Check for PKCE code
                if (code) {
                    const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
                    if (exchangeError) {
                        // If PKCE fails, see if we already have a session as a fallback
                        const { data: { session: fallbackSession } } = await client.auth.getSession();
                        if (fallbackSession) {
                            toast.success("Successfully signed in!");
                            router.push(next);
                            return;
                        }
                        throw exchangeError;
                    }
                    
                    toast.success("Successfully signed in!");
                    router.push(next);
                    return;
                }

                // 2. Check for existing session (Implicit Flow hash parsing happens automatically)
                const { data: { session }, error: sessionError } = await client.auth.getSession();
                
                if (sessionError) throw sessionError;

                if (session) {
                    toast.success("Successfully signed in!");
                    router.push(next);
                    return;
                }

                // 3. Handle hash fragment specifically if Supabase hasn't parsed it yet
                if (window.location.hash.includes("access_token")) {
                    setStatus("Completing sign in...");
                    // Small delay to let Supabase parse the hash
                    setTimeout(async () => {
                        const { data: { session: retrySession } } = await client.auth.getSession();
                        if (retrySession) {
                            toast.success("Successfully signed in!");
                            router.push(next);
                        } else {
                            throw new Error("Session not found after hash parsing");
                        }
                    }, 1000);
                    return;
                }

                // If we reach here, no session was found
                console.warn("No session or code found in callback");
                setStatus("Session not found. Redirecting to login...");
                setTimeout(() => router.push("/auth"), 2000);

            } catch (err: any) {
                console.error("Callback error:", err);
                toast.error(err.message || "Failed to complete sign in");
                router.push("/auth/error");
            }
        };

        handleCallback();
    }, [router, searchParams]);

    return (
        <div className="flex min-h-screen items-center justify-center p-4 bg-background">
            <Card className="w-full max-w-md border-input shadow-none text-center">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold tracking-tight">Authenticating</CardTitle>
                    <CardDescription>
                        {status}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center py-8">
                    <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </CardContent>
            </Card>
        </div>
    );
}

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center p-4 bg-background">
                <Card className="w-full max-w-md border-input shadow-none text-center">
                    <CardHeader>
                        <CardTitle className="text-2xl font-bold tracking-tight">Authenticating</CardTitle>
                        <CardDescription>
                            Preparing to verify session...
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex justify-center py-8">
                        <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    </CardContent>
                </Card>
            </div>
        }>
            <AuthCallbackContent />
        </Suspense>
    );
}
