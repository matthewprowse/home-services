'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { toast } from 'sonner';

function AuthPageContent() {
    const searchParams = useSearchParams();
    const next = searchParams.get('next') || '/';
    const [email, setEmail] = useState('');
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
            toast.success('Magic link sent! Check your email.');
        } catch (error: any) {
            console.error('Auth error:', error);
            if (error.message?.toLowerCase().includes('rate limit')) {
                toast.error('Email limit reached. Please try again in an hour.');
            } else {
                toast.error(error.message || 'Failed to send magic link');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center p-4 bg-background">
            <Card className="w-full max-w-md border-input shadow-none">
                <CardHeader className="space-y-1 text-center">
                    <CardTitle className="text-2xl font-bold tracking-tight">
                        Vantage Account
                    </CardTitle>
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
                                {isLoading ? 'Sending...' : 'Send Magic Link'}
                            </Button>
                        </form>
                    ) : (
                        <div className="text-center pb-4 space-y-2">
                            <p className="text-xs text-muted-foreground">
                                We sent a magic link to{' '}
                                <span className="text-foreground font-medium">{email}</span>. Click
                                the link in the email to sign in.
                            </p>
                            <Button variant="secondary" onClick={() => setIsEmailSent(false)}>
                                Change Email Address
                            </Button>
                        </div>
                    )}
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

export default function AuthPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center p-4 bg-background">
                    <Card className="w-full max-w-md border-input shadow-none">
                        <CardHeader className="space-y-1 text-center animate-pulse">
                            <div className="h-8 w-48 bg-muted rounded mx-auto mb-2" />
                            <div className="h-4 w-64 bg-muted rounded mx-auto" />
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <div className="h-4 w-24 bg-muted rounded" />
                                <div className="h-10 w-full bg-muted rounded" />
                            </div>
                            <div className="h-10 w-full bg-muted rounded" />
                        </CardContent>
                    </Card>
                </div>
            }
        >
            <AuthPageContent />
        </Suspense>
    );
}
