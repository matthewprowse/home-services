'use client';

import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import Link from 'next/link';

export default function AuthCodeErrorPage() {
    return (
        <div className="flex min-h-screen items-center justify-center p-4 bg-background">
            <Card className="w-full max-w-md border-input shadow-none">
                <CardHeader className="space-y-1 text-center">
                    <CardTitle className="text-2xl font-bold tracking-tight">
                        Authentication Error
                    </CardTitle>
                    <CardDescription>
                        Something went wrong during the sign-in process.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center py-4">
                    <p className="text-sm text-muted-foreground">
                        This could be due to an expired magic link, a network issue, or an invalid
                        session. Please try signing in again from the login page.
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
