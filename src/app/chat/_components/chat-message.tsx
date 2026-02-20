import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { ThumbsUp, ThumbsDown, Copy, RotateCounterClockwise as RotateCcw } from 'geist-icons';
import { Message } from './types';

export function ChatMessage({
    message,
    isLast,
    isResponding,
    onFeedback,
    onCopy,
    onRegenerate,
    onScrollToDiagnosis,
}: {
    message: Message;
    isLast: boolean;
    isResponding: boolean;
    onFeedback: (type: 'up' | 'down') => void;
    onCopy: () => void;
    onRegenerate: () => void;
    onScrollToDiagnosis: () => void;
}) {
    return (
        <div
            className={cn(
                'flex flex-col gap-2 w-full mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300',
                message.role === 'user' ? 'items-end' : 'items-start'
            )}
        >
            {message.attachments && message.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-1">
                    {message.attachments.map((src, i) => (
                        <img
                            key={i}
                            src={src}
                            alt="Attachment"
                            className="h-40 w-auto rounded-md object-cover border border-border/50"
                        />
                    ))}
                </div>
            )}
            <div
                className={cn(
                    'text-sm leading-relaxed',
                    message.role === 'user'
                        ? 'bg-secondary text-secondary-foreground rounded-md px-3 py-1.5 max-w-[75%]'
                        : 'text-foreground w-full'
                )}
            >
                {message.content === '' && isLast && isResponding ? (
                    <div className="flex items-center py-1">
                        <Spinner className="size-4 text-muted-foreground" />
                    </div>
                ) : (
                    message.content
                )}
            </div>
            {message.role === 'assistant' && message.content !== '' && (
                <div className="flex flex-col items-start gap-3 mt-1">
                    {message.hasUpdatedDiagnosis && (
                        <Button variant="outline" onClick={onScrollToDiagnosis}>
                            View New Diagnosis
                        </Button>
                    )}
                    <div className="flex items-center gap-1 -ml-2">
                        <Button
                            variant={message.feedback === 'up' ? 'secondary' : 'ghost'}
                            size="icon"
                            className="size-8 group"
                            onClick={() => onFeedback('up')}
                        >
                            <ThumbsUp
                                className={cn(
                                    'size-4 transition-colors',
                                    message.feedback === 'up'
                                        ? 'text-black dark:text-white'
                                        : 'text-muted-foreground group-hover:text-black dark:group-hover:text-white'
                                )}
                            />
                        </Button>
                        <Button
                            variant={message.feedback === 'down' ? 'secondary' : 'ghost'}
                            size="icon"
                            className="size-8 group"
                            onClick={() => onFeedback('down')}
                        >
                            <ThumbsDown
                                className={cn(
                                    'size-4 transition-colors',
                                    message.feedback === 'down'
                                        ? 'text-black dark:text-white'
                                        : 'text-muted-foreground group-hover:text-black dark:group-hover:text-white'
                                )}
                            />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 group"
                            onClick={onCopy}
                        >
                            <Copy className="size-4 text-muted-foreground transition-colors group-hover:text-black dark:group-hover:text-white" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 group"
                            onClick={onRegenerate}
                        >
                            <RotateCcw className="size-4 text-muted-foreground transition-colors group-hover:text-black dark:group-hover:text-white" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
