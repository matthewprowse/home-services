"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { LandingHeader } from "@/components/landing-header";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { setImageData } from "@/lib/image-store";
import { compressImage } from "@/lib/image-compression";

export default function Home() {
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    const handleFileChosen = (file: File | undefined) => {
        if (!file) return;

        // Convert file to base64 data URL
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result as string;
            
            try {
                // Compress image before storing
                const compressedBase64 = await compressImage(base64String);
                
                // Generate a unique conversation ID
                const conversationId = typeof crypto?.randomUUID === 'function' 
                    ? crypto.randomUUID() 
                    : Date.now().toString(36) + Math.random().toString(36).substring(2);
                
                // Store in memory & session storage fallback
                setImageData(conversationId, compressedBase64, file.name);
                
                // Navigate to dynamic results page
                router.push(`/chat?id=${conversationId}`);
            } catch (err) {
                console.error("Processing failed:", err);
                const conversationId = Date.now().toString(36);
                setImageData(conversationId, base64String, file.name);
                router.push(`/chat?id=${conversationId}`);
            }
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="flex flex-col justify-center items-center min-h-screen bg-background">        
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    aria-hidden
                    onChange={(e) => {
                        handleFileChosen(e.target.files?.[0]);
                        e.target.value = "";
                    }}
                />
                <Button 
                    variant="secondary" 
                    size="lg" 
                    className="min-w-[164px]"
                    onClick={() => inputRef.current?.click()}
                >
                    Start Diagnosis
                </Button>
                <Button variant="ghost" size="lg" className="min-w-[164px]">View Sample Report</Button>
            </div>
        </div>
    );
}
