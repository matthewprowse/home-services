'use client';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';

interface AppHeaderProps {
    title?: string;
    isLoading?: boolean;
}

export function AppHeader({ title = 'Chat Name', isLoading = false }: AppHeaderProps) {
    const router = useRouter();

    return (
        <header className="sticky top-0 z-50 bg-background">
            <div className="mx-auto px-4 md:px-12 py-4 grid grid-cols-3 items-center gap-4 h-16">
                {/* Left Section: Placeholder or Back Button? */}
                <div className="flex items-center gap-3">
                    {/* Sidebar trigger was here */}
                </div>

                {/* Center Section: Title */}
                <div className="flex justify-center min-w-0">
                    {isLoading ? (
                        <Skeleton className="h-7 w-48 rounded-md" />
                    ) : (
                        <h1 className="text-md font-semibold truncate leading-none text-center">
                            {title}
                        </h1>
                    )}
                </div>

                {/* Right Section: Actions */}
                <div className="flex justify-end items-center gap-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <button className="size-8 rounded-full bg-secondary cursor-pointer hover:bg-secondary/80 transition-colors" />
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-3" align="end">
                            <div className="flex flex-col gap-2">
                                <Button
                                    variant="ghost"
                                    className="justify-start font-normal"
                                    onClick={() => router.push('/settings')}
                                >
                                    Settings
                                </Button>
                                <Button
                                    variant="ghost"
                                    className="justify-start font-normal"
                                    onClick={() => console.log('Logout clicked')}
                                >
                                    Log Out
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
        </header>
    );
}
