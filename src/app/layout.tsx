import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/context/auth-context';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

export const metadata: Metadata = {
    title: 'Home Services Diagnostic AI',
    description: 'Identify home maintenance issues with AI',
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    let initialConversations: any[] = [];
    if (user) {
        const { data } = await supabase
            .from('conversations')
            .select('id, title, created_at')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })
            .limit(20);
        initialConversations = data || [];
    }

    return (
        <html lang="en">
            <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
                <AuthProvider initialUser={user}>
                    <TooltipProvider>
                        <div className="flex flex-col min-h-screen bg-background">
                            {children}
                        </div>
                        <Toaster />
                    </TooltipProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
