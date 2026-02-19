"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { toast } from "sonner";

export default function AuthCodeErrorPage() {
    const router = useRouter();
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        const checkSession = async () => {
            // Check if there's a session in the URL hash (Implicit Flow)
            const { data, error } = await supabase.auth.getSession();
            
            if (data?.session) {
                toast.success("Successfully signed in!");
                router.push("/");
                return;
            }

            // Even if getSession doesn't return anything, the hash might be there.
            // Supabase client usually parses it automatically on init.
            if (window.location.hash.includes("access_token")) {
                // Wait a bit for Supabase to parse the hash
                setTimeout(async () => {
                    const { data: retryData } = await supabase.auth.getSession();
                    if (retryData?.session) {
                        toast.success("Successfully signed in!");
                        router.push("/");
                    } else {
                        setIsChecking(false);
                    }
                }, 500);
            } else {
                setIsChecking(false);
            }
        };

        checkSession();
    }, [router]);

    if (isChecking) {
        return (
            <div className="flex min-h-screen items-center justify-center p-4 bg-background">
                <Card className="w-full max-w-md border-input shadow-none">
                    <CardHeader className="space-y-1 text-center">
                        <CardTitle className="text-2xl font-bold tracking-tight">Checking Auth Status</CardTitle>
                        <CardDescription>
                            Please wait while we verify your session...
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex justify-center py-8">
                        <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center p-4 bg-background">
            <Card className="w-full max-w-md border-input shadow-none">
                <CardHeader className="space-y-1 text-center">
                    <CardTitle className="text-2xl font-bold tracking-tight">Authentication Error</CardTitle>
                    <CardDescription>
                        Something went wrong during the sign-in process.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center py-4">
                    <p className="text-sm text-muted-foreground">
                        This could be due to an expired magic link or a technical issue. 
                        Please try signing in again.
                    </p>
                </CardContent>
                <CardFooter>
                    <Button asChild className="w-full">
                        <Link href="/auth">Back to Login</Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
