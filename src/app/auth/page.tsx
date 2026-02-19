"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function AuthPage() {
    const searchParams = useSearchParams();
    const next = searchParams.get("next") || "/";
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isEmailSent, setIsEmailSent] = useState(false);

    const handleMagicLink = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setIsLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
                },
            });

            if (error) throw error;
            setIsEmailSent(true);
            toast.success("Magic link sent! Check your email.");
        } catch (error: any) {
            console.error("Auth error:", error);
            if (error.message?.toLowerCase().includes("rate limit")) {
                toast.error("Email limit reached. Please try again in an hour or use Google to sign in immediately.");
            } else {
                toast.error(error.message || "Failed to send magic link");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setIsLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
                },
            });
            if (error) throw error;
        } catch (error: any) {
            console.error("Google auth error:", error);
            toast.error(error.message || "Failed to connect to Google");
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center p-4 bg-background">
            <Card className="w-full max-w-md border-input shadow-none">
                <CardHeader className="space-y-1 text-center">
                    <CardTitle className="text-2xl font-bold tracking-tight">Vantage Account</CardTitle>
                    <CardDescription>
                        Save your home diagnoses and manage your property services.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {!isEmailSent ? (
                        <form onSubmit={handleMagicLink} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <Input 
                                    id="email" 
                                    type="email" 
                                    placeholder="name@example.com" 
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="border-input"
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? "Sending..." : "Send Magic Link"}
                            </Button>
                        </form>
                    ) : (
                        <div className="text-center py-4 space-y-2">
                            <p className="text-sm font-medium">Check your inbox</p>
                            <p className="text-xs text-muted-foreground">
                                We sent a magic link to <span className="text-foreground font-medium">{email}</span>. 
                                Click the link in the email to sign in.
                            </p>
                            <Button variant="ghost" className="text-xs" onClick={() => setIsEmailSent(false)}>
                                Use a different email
                            </Button>
                        </div>
                    )}

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-input" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">
                                Or continue with
                            </span>
                        </div>
                    </div>

                    <Button variant="outline" className="w-full border-input" onClick={handleGoogleLogin} disabled={isLoading}>
                        Continue with Google
                    </Button>
                </CardContent>
                <CardFooter className="text-center">
                    <p className="w-full text-xs text-muted-foreground">
                        By continuing, you agree to our Terms of Service and Privacy Policy.
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}
