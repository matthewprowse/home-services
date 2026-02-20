import { useRef } from 'react';
import { AppHeader } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Paperclip } from 'geist-icons';
import { DiagnosisData } from './types';

export function NoImageFallback({
    router,
    diagnosis,
    onImageUpload,
    isUploading,
}: {
    router: any;
    diagnosis: DiagnosisData | null;
    onImageUpload: (file: File) => void;
    isUploading: boolean;
}) {
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <AppHeader title={diagnosis?.diagnosis || 'Chat Name'} />
            <div className="flex flex-1 flex-col items-center justify-center p-6">
                <div className="max-w-md w-full text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold tracking-tight">Missing Image</h2>
                        <p className="text-muted-foreground">
                            This diagnosis requires an image to get started. Please upload one below
                            to begin the analysis.
                        </p>
                    </div>

                    <div className="bg-secondary/20 rounded-2xl p-10 border-2 border-dashed border-border/60 hover:border-primary/40 transition-colors group">
                        <div className="flex flex-col items-center gap-4">
                            <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Paperclip className="size-8 text-primary" />
                            </div>

                            <input
                                ref={inputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) onImageUpload(file);
                                }}
                            />

                            <div className="flex flex-col gap-2 w-full">
                                <Button
                                    type="button"
                                    size="lg"
                                    className="w-full"
                                    disabled={isUploading}
                                    onClick={() => inputRef.current?.click()}
                                >
                                    {isUploading ? <Spinner className="mr-2" /> : null}
                                    {isUploading ? 'Processing...' : 'Select Image'}
                                </Button>
                                <p className="text-xs text-muted-foreground">
                                    Supports JPG, PNG and WebP
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4">
                        <Button
                            variant="ghost"
                            onClick={() => router.push('/')}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            ← Go back to home
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
