"use client";

import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";

interface AppHeaderProps {
    title?: string;
    isLoading?: boolean;
}

export function AppHeader({ title = "Chat Name", isLoading = false }: AppHeaderProps) {
    const { state } = useSidebar();
    const router = useRouter();
    
    return (
        <header className="sticky top-0 z-50 bg-background border-b border-border/50">
            <div className="mx-auto px-4 md:px-12 py-4 grid grid-cols-3 items-center gap-4 h-16">
                {/* Left Section: Sidebar Trigger */}
                <div className="flex items-center gap-3">
                    {state === "collapsed" && (
                        <>
                            <SidebarTrigger className="-ml-1" />
                            <Separator orientation="vertical" className="mr-2 h-4 hidden sm:block" />
                        </>
                    )}
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
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-9 w-9"
                        onClick={() => router.push("/search")}
                    >
                        <Search className="size-4" />
                    </Button>
                    
                    <Popover>
                        <PopoverTrigger asChild>
                            <button className="size-8 rounded-full bg-secondary cursor-pointer hover:bg-secondary/80 transition-colors" />
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-3" align="end">
                            <div className="flex flex-col gap-2">
                                <Button variant="ghost" className="justify-start font-normal" onClick={() => router.push("/settings")}>Settings</Button>
                                <Button variant="ghost" className="justify-start font-normal" onClick={() => console.log("Logout clicked")}>Log Out</Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
        </header>
    );
}
