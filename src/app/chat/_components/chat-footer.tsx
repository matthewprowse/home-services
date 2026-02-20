import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Paperclip, Cross as X, Plus } from 'geist-icons';
import { Spinner } from '@/components/ui/spinner';

export function ChatFooter({
    message,
    setMessage,
    attachments,
    handleSend,
    handleFilesChosen,
    removeAttachment,
    isDiagnosing,
    isResponding,
    hasDiagnosis,
    fileInputRef,
}: any) {
    const isDisabled = (!hasDiagnosis && isDiagnosing) || isResponding;

    return (
        <footer className="sticky bottom-0 z-50 bg-background">
            <div className="flex flex-row flex-nowrap items-stretch gap-2 p-4 max-w-3xl mx-auto w-full">
                <div className="flex flex-col justify-start">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        multiple
                        onChange={(e) => {
                            handleFilesChosen(e.target.files);
                            e.target.value = '';
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isDisabled || attachments.length >= 5}
                        className="flex-shrink-0 w-8 h-8 bg-secondary rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Plus size={16} />
                    </button>
                </div>
                <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    placeholder={isDisabled ? 'Processing...' : 'Ask Anything...'}
                    disabled={isDisabled}
                    className="flex-1 min-w-0 min-h-16 max-h-[96px] resize-none placeholder:text-muted-foreground"
                />
                <div className="flex flex-col justify-end flex-shrink-0">
                    <div className="w-8 h-8 bg-secondary rounded-full" />
                </div>
            </div>
            {/* <div className="max-w-3xl mx-auto px-4 py-4">
                {attachments.length > 0 && (
                    <div className="flex gap-3 mb-3 overflow-x-auto py-2 scrollbar-hide">
                        {attachments.map((src: string, i: number) => (
                            <div
                                key={i}
                                className="relative flex-shrink-0 size-28 group/thumb rounded-md overflow-hidden border border-border"
                            >
                                <img
                                    src={src}
                                    alt="Preview"
                                    className="size-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => removeAttachment(i)}
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity pointer-events-none">
                                    <X className="text-white size-6" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                <div className="flex flex-col gap-3">
                    <Textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder={isDisabled ? 'Please wait...' : 'Type Message...'}
                        className="min-h-[36px] md:min-h-[72px] w-full resize-none"
                        disabled={isDisabled}
                    />
                    <div className="flex justify-between items-center">
                        <div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                multiple
                                onChange={(e) => handleFilesChosen(e.target.files)}
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 group"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isDisabled || attachments.length >= 5}
                            >
                                <Paperclip className="size-4 text-muted-foreground transition-colors group-hover:text-black dark:group-hover:text-white" />
                            </Button>
                        </div>
                        <Button
                            onClick={handleSend}
                            disabled={isDisabled || (!message.trim() && attachments.length === 0)}
                        >
                            Submit
                        </Button>
                    </div>
                </div>
            </div> */}
        </footer>
    );
}
