/**
 * File: page.tsx
 * Description: The primary results page that handles AI image diagnosis,
 * local service provider discovery, and an interactive chat interface.
 */

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, useRef, useCallback } from 'react';
import { getImageData, clearImageData, setImageData } from '@/lib/image-store';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/lib/image-compression';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { AppHeader } from '@/components/app-header';
import { useAuth } from '@/context/auth-context';

import { DiagnosisData, Message, Provider } from './_components/types';
import { DiagnosisSkeleton, ProvidersSkeleton } from './_components/skeletons';
import { ProviderCard } from './_components/provider-card';
import { ChatMessage } from './_components/chat-message';
import { ChatFooter } from './_components/chat-footer';
import { DiagnosisReport } from './_components/diagnosis-report';
import { NoImageFallback } from './_components/no-image-fallback';

// --- Main Component ---

export default function Results() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen w-full items-center justify-center bg-background">
                    <Spinner className="size-8 text-muted-foreground" />
                </div>
            }
        >
            <ResultsContent />
        </Suspense>
    );
}

function ResultsContent() {
    const router = useRouter();
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const id = searchParams.get('id');

    // --- State: Core Data ---
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [diagnosis, setDiagnosis] = useState<DiagnosisData | null>(null);
    const [providers, setProviders] = useState<Provider[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    const [isDiagnosing, setIsDiagnosing] = useState(false);
    const [hasStartedDiagnosis, setHasStartedDiagnosis] = useState(false);
    const diagnosisStartedRef = useRef(false);
    const [isResponding, setIsResponding] = useState(false);
    const [isLoadingProviders, setIsLoadingProviders] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [userLocation, setUserLocation] = useState<{
        lat: number;
        lng: number;
        address: string;
    } | null>(null);
    const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
    const [message, setMessage] = useState('');
    const [attachments, setAttachments] = useState<string[]>([]);

    // --- Refs ---
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const diagnosisRef = useRef<HTMLDivElement>(null);

    // Log state changes for debugging
    useEffect(() => {
        console.log('UI State Update:', {
            isDiagnosing,
            hasDiagnosis: !!diagnosis,
            diagnosisTitle: diagnosis?.diagnosis,
            hasStartedDiagnosis,
        });
    }, [isDiagnosing, diagnosis, hasStartedDiagnosis]);

    const handleFallbackUpload = async (file: File) => {
        if (!file || !id) return;
        setIsUploading(true);
        try {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = reader.result as string;
                const compressed = await compressImage(base64);
                setImageData(id, compressed, file.name);
                setImageSrc(compressed);
                setHasStartedDiagnosis(false);
                diagnosisStartedRef.current = false;
                setIsUploading(false);
            };
            reader.readAsDataURL(file);
        } catch (err) {
            console.error('Fallback upload failed:', err);
            setIsUploading(false);
        }
    };

    // --- Persistence & Usage ---

    /**
     * Loads existing conversation and messages from Supabase.
     */
    const loadConversation = useCallback(async () => {
        if (!id) return;

        console.log('Loading conversation:', id);
        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Database timeout')), 5000)
        );

        try {
            const fetchPromise = (async () => {
                // Run conversation and messages fetch in parallel
                const [convResult, msgsResult] = await Promise.all([
                    supabase.from('conversations').select('*').eq('id', id),
                    supabase
                        .from('messages')
                        .select('*')
                        .eq('conversation_id', id)
                        .order('created_at', { ascending: true }),
                ]);

                if (convResult.error) {
                    console.error('Supabase Conv Error Details:', convResult.error);
                    throw convResult.error;
                }

                if (msgsResult.error) {
                    console.error('Supabase Msgs Error Details:', msgsResult.error);
                }

                return { conv: convResult.data?.[0], msgs: msgsResult.data };
            })();

            const result = (await Promise.race([fetchPromise, timeout])) as any;
            const conv = result?.conv;
            const msgs = result?.msgs;

            if (conv) {
                if (conv.image_url) setImageSrc(conv.image_url);
                if (conv.diagnosis_json) setDiagnosis(conv.diagnosis_json);
                if (conv.providers_json) setProviders(conv.providers_json);
                if (conv.user_lat && conv.user_lng) {
                    setUserLocation({
                        lat: conv.user_lat,
                        lng: conv.user_lng,
                        address: conv.user_address || '',
                    });
                }
            }

            if (msgs && msgs.length > 0) {
                const mappedMsgs = msgs.map((m: any) => ({
                    role: m.role as 'user' | 'assistant',
                    content: m.content,
                    attachments: m.attachments,
                    feedback: m.feedback as 'up' | 'down' | null,
                    hasUpdatedDiagnosis: m.has_updated_diagnosis,
                }));
                setMessages(mappedMsgs);
                return mappedMsgs;
            }
        } catch (err) {
            console.error('Failed to load conversation:', err);
        } finally {
            setIsLoaded(true);
        }
        return null;
    }, [id]);

    /**
     * Saves a new message to Supabase.
     */
    const saveMessage = async (
        role: 'user' | 'assistant',
        content: string,
        attachments: string[] = [],
        hasUpdatedDiagnosis: boolean = false
    ) => {
        if (!id) return;
        const { error } = await (supabase as any).from('messages').insert({
            conversation_id: id,
            role,
            content,
            attachments,
            has_updated_diagnosis: hasUpdatedDiagnosis,
        });
        if (error) console.error('Error saving message:', error);
    };

    const saveConversation = async (overrides?: {
        diag?: DiagnosisData;
        loc?: { lat: number; lng: number; address: string };
        provs?: Provider[];
    }) => {
        if (!id) return;

        const deviceType = /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
        const finalDiagnosis = overrides?.diag || diagnosis;
        const finalLocation = overrides?.loc || userLocation;
        const finalProviders = overrides?.provs || providers;

        console.log('Saving conversation metadata:', {
            id,
            diagnosisTitle: finalDiagnosis?.diagnosis,
        });

        const { error } = await (supabase as any).from('conversations').upsert({
            id,
            title: finalDiagnosis?.diagnosis || 'New Diagnosis',
            image_url: imageSrc,
            user_lat: finalLocation?.lat,
            user_lng: finalLocation?.lng,
            user_address: finalLocation?.address,
            diagnosis_json: finalDiagnosis,
            providers_json: finalProviders,
            device_type: deviceType,
            user_agent: navigator.userAgent,
            user_id: user?.id,
            updated_at: new Date().toISOString(),
        });
        if (error) console.error('Error saving conversation:', error);
    };

    // --- Utilities ---

    /**
     * Smoothly scrolls the chat container to the latest message.
     */
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    const scrollToDiagnosis = useCallback(() => {
        diagnosisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // --- Data Fetching: Providers ---

    /**
     * Fetches local service providers from the API based on location and trade.
     * @param lat - Latitude
     * @param lng - Longitude
     * @param tradeToSearch - The specific trade (e.g. "Plumber") to search for.
     */
    const fetchProviders = useCallback(
        async (lat: number, lng: number, tradeToSearch?: string) => {
            const trade = tradeToSearch || diagnosis?.trade;
            if (!trade) return;

            setIsLoadingProviders(true);
            try {
                const res = await fetch('/api/providers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ lat, lng, trade }),
                });
                const data = await res.json();
                if (res.ok && data.providers) {
                    setProviders(data.providers);
                    saveConversation({ provs: data.providers });
                } else {
                    console.error('API Error:', data.error || 'Unknown error');
                }
            } catch (err) {
                console.error('Failed to fetch providers:', err);
            } finally {
                setIsLoadingProviders(false);
            }
        },
        [diagnosis?.trade]
    );

    /**
     * Gets the user's current geolocation and triggers provider search.
     * @param tradeToSearch - Optional trade to override current diagnosis trade.
     */
    const getCurrentLocation = useCallback(
        (tradeToSearch?: string) => {
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const { latitude: lat, longitude: lng } = pos.coords;

                    // Parallelize geocoding (for the UI address) and provider fetching
                    const geocodePromise = fetch('/api/geocode', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ lat, lng }),
                    })
                        .then((res) => res.json())
                        .catch(() => ({ address: 'Current Location' }));

                    const providersPromise = fetchProviders(lat, lng, tradeToSearch);

                    try {
                        const [geoData] = await Promise.all([geocodePromise, providersPromise]);
                        const address = geoData.address || 'Current Location';
                        const loc = { lat, lng, address };
                        setUserLocation(loc);
                        saveConversation({ loc });
                    } catch (e) {
                        console.error('Error in location-based fetching:', e);
                        setUserLocation({ lat, lng, address: 'Current Location' });
                    }
                },
                (err) => {
                    console.error('Location access denied', err);
                    toast.error('Location access denied');
                }
            );
        },
        [fetchProviders]
    );

    const startInitialDiagnosis = useCallback(
        async (img: string) => {
            if (diagnosisStartedRef.current) return;
            diagnosisStartedRef.current = true;
            setHasStartedDiagnosis(true);
            setIsDiagnosing(true);
            setDiagnosis(null);

            console.log('Starting initial diagnosis... Image length:', img.length);
            try {
                const res = await fetch('/api/diagnose', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: img }),
                });

                console.log('Diagnosis response status:', res.status);
                if (!res.ok) {
                    const error = await res.json().catch(() => ({ error: 'Unknown error' }));
                    console.error('Diagnosis API error:', error);
                    toast.error(error.error || 'Failed to start analysis');
                    setIsDiagnosing(false);
                    return; // Don't reset hasStartedDiagnosis immediately to avoid loop
                }

                if (!res.body) {
                    console.error('Diagnosis response body is null');
                    setIsDiagnosing(false);
                    return;
                }

                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let fullText = '';
                let currentThinking = '';
                let isSearchTriggered = false;

                console.log('Beginning to read stream...');
                while (true) {
                    const { done, value } = await reader.read();
                    const chunk = decoder.decode(value || new Uint8Array(), { stream: !done });
                    fullText += chunk;

                    if (done) {
                        console.log('Stream finished. Total text length:', fullText.length);
                        // console.log("Full AI response text:", fullText);

                        // Final attempt to parse if not already done
                        if (!diagnosis?.diagnosis) {
                            // 1. Try tags first
                            const finalJsonMatch = fullText.match(
                                /<json>([\s\S]*?)(?:<\/json>|$)/i
                            );
                            if (finalJsonMatch) {
                                await processJson(finalJsonMatch[1], currentThinking, true);
                            } else {
                                // 2. Fallback: Try to find ANY JSON object in the text
                                const anyJsonMatch = fullText.match(/\{[\s\S]*\}/);
                                if (anyJsonMatch) {
                                    console.log('Found raw JSON fallback at end');
                                    await processJson(anyJsonMatch[0], currentThinking, true);
                                }
                            }
                        }
                        break;
                    }

                    // 1. Extract thinking - refined to strictly exclude tags
                    const thoughtMatch =
                        fullText.match(
                            /<(?:thought|thought_process)>([\s\S]*?)(?:<\/(?:thought|thought_process)>|$)/i
                        ) || fullText.match(/```thought\s*([\s\S]*?)(?:```|$)/i);

                    if (thoughtMatch) {
                        // Remove any internal tags if the AI accidentally nested them
                        currentThinking = thoughtMatch[1]
                            .replace(/<\/?(?:thought|thought_process)>/gi, '')
                            .replace(/```thought/gi, '')
                            .replace(/```/gi, '')
                            .trim();

                        setDiagnosis((prev) => ({
                            thinking: currentThinking,
                            diagnosis: prev?.diagnosis || '',
                            trade: prev?.trade || '',
                            action_required: prev?.action_required || '',
                            estimated_cost: prev?.estimated_cost || '',
                        }));
                    }

                    // 2. Extract JSON
                    const jsonMatch = fullText.match(/<json>([\s\S]*?)(?:<\/json>|$)/i);
                    if (jsonMatch) {
                        await processJson(
                            jsonMatch[1],
                            currentThinking,
                            fullText.toLowerCase().includes('</json>')
                        );
                    } else {
                        // Try to find JSON even if tags are missing or wrapped in markdown
                        const anyJsonMatch = fullText.match(/\{[\s\S]*\}/);
                        if (anyJsonMatch) {
                            await processJson(anyJsonMatch[0], currentThinking, false);
                        }
                    }
                }

                async function processJson(
                    jsonText: string,
                    thinking: string,
                    isComplete: boolean
                ) {
                    // Clean up markdown artifacts and surrounding whitespace
                    let cleaned = jsonText
                        .trim()
                        .replace(/^```json\s*/i, '')
                        .replace(/```$/i, '')
                        .trim();

                    // Early trade detection
                    if (!isSearchTriggered) {
                        const tradeMatch = cleaned.match(/"trade"\s*:\s*"([^"]+)"/i);
                        if (tradeMatch && tradeMatch[1]) {
                            console.log('Early trade detected:', tradeMatch[1]);
                            isSearchTriggered = true;
                            getCurrentLocation(tradeMatch[1]);
                        }
                    }

                    // Try to parse partial or full JSON
                    try {
                        // Find the last valid-looking closing brace if not complete
                        let toParse = cleaned;
                        if (!isComplete && !cleaned.endsWith('}')) {
                            const lastBrace = cleaned.lastIndexOf('}');
                            if (lastBrace !== -1) {
                                toParse = cleaned.substring(0, lastBrace + 1);
                            }
                        }

                        const parsedJson = JSON.parse(toParse);
                        if (parsedJson.diagnosis) {
                            setDiagnosis({ thinking, ...parsedJson });

                            if (isComplete) {
                                console.log('JSON complete, saving to Supabase...');
                                await saveConversation({ diag: { thinking, ...parsedJson } });
                                saveMessage(
                                    'assistant',
                                    parsedJson.message || `I identified a ${parsedJson.diagnosis}.`,
                                    [],
                                    false
                                );
                            }
                        }
                    } catch (e) {
                        // console.log("JSON parse skipped (incomplete)");
                    }
                }
            } catch (err) {
                console.error('Diagnosis critical failure:', err);
                toast.error('Diagnosis failed. Please check your internet connection.');
            } finally {
                setIsDiagnosing(false);
                console.log('Diagnosis process finished.');
            }
        },
        [id, saveConversation, saveMessage, getCurrentLocation]
    );

    /**
     * Re-fetches providers if they are missing on page load/refresh.
     */
    useEffect(() => {
        if (
            isLoaded &&
            userLocation &&
            diagnosis?.trade &&
            providers.length === 0 &&
            !isLoadingProviders
        ) {
            console.log('Auto-fetching providers for loaded conversation:', diagnosis.trade);
            fetchProviders(userLocation.lat, userLocation.lng, diagnosis.trade);
        }
    }, [
        isLoaded,
        userLocation,
        diagnosis?.trade,
        providers.length,
        isLoadingProviders,
        fetchProviders,
    ]);

    /**
     * Initial data loading and image detection.
     */
    useEffect(() => {
        const init = async () => {
            if (!id) return;

            // 1. Get image from store (fastest)
            const imageData = getImageData();
            if (imageData && imageData.id === id) {
                console.log('Image found in local store for this id');
                setImageSrc(imageData.dataUrl);
                // Immediately show thinking state if we have a new image
                setIsDiagnosing(true);
            }

            // 2. Load DB data (including existing diagnosis/messages)
            const loadedMsgs = await loadConversation();

            // If we found data in the DB, stop the "diagnosing" state as we have content
            // The diagnosis state itself will be set inside loadConversation if found
            if (loadedMsgs && loadedMsgs.length > 0) {
                setIsDiagnosing(false);
            }

            // 3. Clear store ONLY if it's for a different session or we've already saved messages
            if (imageData && (imageData.id !== id || (loadedMsgs && loadedMsgs.length > 0))) {
                clearImageData();
            }
        };

        init();

        // 4. Listen for realtime updates to sync title/diagnosis renaming
        const channel = supabase
            .channel(`conv-${id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'conversations',
                    filter: `id=eq.${id}`,
                },
                (payload) => {
                    console.log('Realtime update received:', payload);
                    if (payload.new.diagnosis_json) {
                        setDiagnosis(payload.new.diagnosis_json);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [id, loadConversation]);

    /**
     * Triggers the diagnosis when ready.
     */
    useEffect(() => {
        if (
            isLoaded &&
            imageSrc &&
            messages.length === 0 &&
            !diagnosis &&
            // !isDiagnosing && // Allow triggering even if isDiagnosing is true (set by local image)
            !hasStartedDiagnosis
        ) {
            startInitialDiagnosis(imageSrc);
        }
    }, [
        isLoaded,
        imageSrc,
        messages.length,
        diagnosis,
        // isDiagnosing,
        hasStartedDiagnosis,
        startInitialDiagnosis,
    ]);

    // --- Chat Logic: Sending & Responding ---

    /**
     * Handles sending a user message, updating the chat UI,
     * and triggering the AI's streaming response.
     */
    const handleSend = async () => {
        if (!message.trim() && attachments.length === 0) return;
        if (isResponding) return;

        const userMsg = message.trim();
        const userAttachments = [...attachments];
        const newMessage: Message = {
            role: 'user',
            content: userMsg,
            attachments: userAttachments,
        };

        const previousDiagnosis = diagnosis;
        setMessages((prev) => [...prev, newMessage]);
        setMessage('');
        setAttachments([]);
        setIsResponding(true);

        // Save user message to DB
        saveMessage('user', userMsg, userAttachments);

        // Clear thinking to show loading state
        setDiagnosis((prev) => (prev ? { ...prev, thinking: '' } : prev));

        try {
            // Context for AI includes initial diagnosis + conversation history + providers
            const initialMsgContent = diagnosis
                ? `DIAGNOSIS: ${diagnosis.diagnosis}\n\n${diagnosis.action_required}\n\nESTIMATED COST: ${diagnosis.estimated_cost}`
                : '';

            const history = [
                ...(initialMsgContent
                    ? [{ role: 'assistant' as const, content: initialMsgContent }]
                    : []),
                ...messages,
                newMessage,
            ].map((m) => ({ role: m.role, content: m.content, attachments: m.attachments }));

            const res = await fetch('/api/diagnose', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageSrc, history, providers }),
            });

            if (!res.ok) {
                const error = await res.json();
                toast.error(error.error || 'Failed to get response');
                setIsResponding(false);
                return;
            }

            if (!res.body) {
                setIsResponding(false);
                return;
            }

            // Placeholder for assistant response
            setMessages((prev) => [...prev, { role: 'assistant', content: '', feedback: null }]);

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let fullText = '';
            let currentThinking = '';

            while (true) {
                const { done, value } = await reader.read();
                const chunk = decoder.decode(value || new Uint8Array(), { stream: !done });
                fullText += chunk;

                if (done) {
                    console.log('Follow-up stream finished.');
                    break;
                }

                // 1. Extract thinking
                const thoughtMatch =
                    fullText.match(
                        /<(?:thought|thought_process)>([\s\S]*?)(?:\s*<\/(?:thought|thought_process)>|$)/i
                    ) || fullText.match(/```thought\s*([\s\S]*?)(?:\s*```|$)/i);

                if (thoughtMatch && thoughtMatch[1]) {
                    currentThinking = thoughtMatch[1]
                        .replace(/<\/?(?:thought|thought_process)>/gi, '')
                        .replace(/```thought/gi, '')
                        .replace(/```/gi, '')
                        .trim();

                    setDiagnosis((prev) =>
                        prev
                            ? { ...prev, thinking: currentThinking }
                            : {
                                  thinking: currentThinking,
                                  diagnosis: '',
                                  trade: '',
                                  action_required: '',
                                  estimated_cost: '',
                                  message: '',
                              }
                    );
                }

                // 2. Extract and parse JSON
                const jsonMatch = fullText.match(/<json>([\s\S]*?)(?:<\/json>|$)/i);
                if (jsonMatch) {
                    let cleaned = jsonMatch[1]
                        .trim()
                        .replace(/^```json\s*/i, '')
                        .replace(/```$/i, '')
                        .trim();

                    try {
                        let toParse = cleaned;
                        if (!fullText.toLowerCase().includes('</json>') && !cleaned.endsWith('}')) {
                            const lastBrace = cleaned.lastIndexOf('}');
                            if (lastBrace !== -1) toParse = cleaned.substring(0, lastBrace + 1);
                        }

                        const parsedJson = JSON.parse(toParse);
                        if (parsedJson.diagnosis) {
                            const assistantContent =
                                parsedJson.message ||
                                parsedJson.diagnosis + '\n\n' + parsedJson.action_required;

                            // Update the chat bubble with a robust comparison
                            const clean = (s: string | undefined) => (s || '').trim().toLowerCase();
                            const hasChanged =
                                clean(previousDiagnosis?.diagnosis) !==
                                    clean(parsedJson.diagnosis) ||
                                clean(previousDiagnosis?.trade) !== clean(parsedJson.trade);

                            setMessages((prev) => {
                                const next = [...prev];
                                next[next.length - 1] = {
                                    ...next[next.length - 1],
                                    content: assistantContent,
                                    hasUpdatedDiagnosis: hasChanged,
                                };
                                return next;
                            });

                            // Update main diagnosis state
                            const prevTrade = diagnosis?.trade;
                            const diag = { thinking: currentThinking, ...parsedJson };
                            setDiagnosis(diag);

                            // Auto-trigger provider search
                            const userAskedForProviders = userMsg
                                .toLowerCase()
                                .match(/provider|contact|who/);
                            if (
                                parsedJson.trade &&
                                (parsedJson.trade !== prevTrade ||
                                    providers.length === 0 ||
                                    userAskedForProviders)
                            ) {
                                getCurrentLocation(parsedJson.trade);
                            }

                            // Save assistant message to DB
                            if (fullText.toLowerCase().includes('</json>')) {
                                await saveConversation({ diag });
                                saveMessage('assistant', assistantContent, [], hasChanged);
                            }
                        }
                    } catch (e) {
                        /* partial */
                    }
                }
            }
        } catch (err) {
            console.error('Follow-up failed:', err);
        } finally {
            setIsResponding(false);
        }
    };

    /**
     * Handles file selection for chat attachments.
     */
    const handleFilesChosen = (files: FileList | null) => {
        if (!files) return;
        const slots = 5 - attachments.length;
        if (slots <= 0) return;

        Array.from(files)
            .slice(0, slots)
            .forEach((file) => {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const url = e.target?.result as string;
                    if (url) {
                        try {
                            // Compress additional attachments to ~50% the size of the main upload
                            const compressed = await compressImage(url, 512, 0.7);
                            setAttachments((prev) => [...prev, compressed].slice(0, 5));
                        } catch (err) {
                            console.error('Attachment compression failed:', err);
                            setAttachments((prev) => [...prev, url].slice(0, 5));
                        }
                    }
                };
                reader.readAsDataURL(file);
            });
    };

    /**
     * Removes an attachment before sending.
     */
    const removeAttachment = (index: number) => {
        setAttachments((prev) => prev.filter((_, i) => i !== index));
    };

    /**
     * Updates thumbs up/down feedback for assistant messages.
     */
    const handleMessageFeedback = (index: number, type: 'up' | 'down') => {
        setMessages((prev) =>
            prev.map((msg, i) =>
                i === index ? { ...msg, feedback: msg.feedback === type ? null : type } : msg
            )
        );
    };

    /**
     * Copies message text to the clipboard.
     */
    const handleCopy = (content: string) => {
        navigator.clipboard.writeText(content);
    };

    /**
     * Removes the last assistant response and triggers a new one based on previous context.
     */
    const handleRegenerate = async (index: number) => {
        const messageHistory = messages.slice(0, index);
        const lastUserMsg = [...messageHistory].reverse().find((m) => m.role === 'user');

        if (!lastUserMsg) return;

        const previousDiagnosis = diagnosis;
        setMessages((prev) => prev.slice(0, index));
        setIsResponding(true);

        try {
            const initialMsgContent = diagnosis
                ? `DIAGNOSIS: ${diagnosis.diagnosis}\n\n${diagnosis.action_required}\n\nESTIMATED COST: ${diagnosis.estimated_cost}`
                : '';

            const history = [
                ...(initialMsgContent
                    ? [{ role: 'assistant' as const, content: initialMsgContent }]
                    : []),
                ...messageHistory,
            ].map((m) => ({ role: m.role, content: m.content, attachments: m.attachments }));

            const res = await fetch('/api/diagnose', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageSrc, history, providers }),
            });

            if (!res.ok) {
                const error = await res.json();
                toast.error(error.error || 'Failed to regenerate');
                setIsResponding(false);
                return;
            }

            if (!res.body) {
                setIsResponding(false);
                return;
            }

            setMessages((prev) => [...prev, { role: 'assistant', content: '', feedback: null }]);

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let fullText = '';
            let currentThinking = '';

            while (true) {
                const { done, value } = await reader.read();
                const chunk = decoder.decode(value || new Uint8Array(), { stream: !done });
                fullText += chunk;

                if (done) break;

                // 1. Extract thinking
                const thoughtMatch = fullText.match(
                    /<(?:thought|thought_process)>([\s\S]*?)(?:\s*<\/(?:thought|thought_process)>|$)/i
                );
                if (thoughtMatch && thoughtMatch[1]) {
                    currentThinking = thoughtMatch[1]
                        .replace(/<\/?(?:thought|thought_process)>/gi, '')
                        .replace(/```thought/gi, '')
                        .replace(/```/gi, '')
                        .trim();
                    setDiagnosis((prev) =>
                        prev
                            ? { ...prev, thinking: currentThinking }
                            : {
                                  thinking: currentThinking,
                                  diagnosis: '',
                                  trade: '',
                                  action_required: '',
                                  estimated_cost: '',
                                  message: '',
                              }
                    );
                }

                // 2. Extract JSON
                const jsonMatch = fullText.match(
                    /<(?:json|diagnosis_data)>([\s\S]*?)(?:\s*<\/(?:json|diagnosis_data)>|$)/i
                );
                if (jsonMatch) {
                    let cleaned = jsonMatch[1]
                        .trim()
                        .replace(/^```json\s*/i, '')
                        .replace(/```$/i, '')
                        .trim();
                    try {
                        let toParse = cleaned;
                        const isComplete =
                            fullText.toLowerCase().includes('</json>') ||
                            fullText.toLowerCase().includes('</diagnosis_data>');
                        if (!isComplete && !cleaned.endsWith('}')) {
                            const lastBrace = cleaned.lastIndexOf('}');
                            if (lastBrace !== -1) toParse = cleaned.substring(0, lastBrace + 1);
                        }

                        const parsedJson = JSON.parse(toParse);
                        if (parsedJson.diagnosis) {
                            const assistantContent =
                                parsedJson.message ||
                                parsedJson.diagnosis + '\n\n' + parsedJson.action_required;

                            const clean = (s: string | undefined) => (s || '').trim().toLowerCase();
                            const hasChanged =
                                clean(previousDiagnosis?.diagnosis) !==
                                    clean(parsedJson.diagnosis) ||
                                clean(previousDiagnosis?.trade) !== clean(parsedJson.trade);

                            setMessages((prev) => {
                                const next = [...prev];
                                next[next.length - 1] = {
                                    ...next[next.length - 1],
                                    content: assistantContent,
                                    hasUpdatedDiagnosis: hasChanged,
                                };
                                return next;
                            });

                            const prevTrade = diagnosis?.trade;
                            const diag = { thinking: currentThinking, ...parsedJson };
                            setDiagnosis(diag);

                            const userAskedForProviders = lastUserMsg.content
                                .toLowerCase()
                                .match(/provider|contact|who/);
                            if (
                                parsedJson.trade &&
                                (parsedJson.trade !== prevTrade ||
                                    providers.length === 0 ||
                                    userAskedForProviders)
                            ) {
                                getCurrentLocation(parsedJson.trade);
                            }

                            if (isComplete) {
                                await saveConversation({ diag });
                                saveMessage('assistant', assistantContent, [], hasChanged);
                            }
                        }
                    } catch (e) {}
                }
            }
        } catch (err) {
            console.error('Regeneration failed:', err);
        } finally {
            setIsResponding(false);
        }
    };

    const handleRetryDiagnosis = () => {
        if (!imageSrc) return;
        diagnosisStartedRef.current = false;
        setHasStartedDiagnosis(false);
        setDiagnosis(null);
        // The useEffect will pick it up
    };

    // --- Components: Header & Layout ---

    if (!isLoaded && !imageSrc) {
        return (
            <div className="flex flex-1 flex-col">
                <AppHeader isLoading />
                <div className="flex flex-1 items-center justify-center">
                    <Spinner className="size-8 text-muted-foreground" />
                </div>
            </div>
        );
    }

    if (!imageSrc) {
        return (
            <NoImageFallback
                router={router}
                diagnosis={diagnosis}
                onImageUpload={handleFallbackUpload}
                isUploading={isUploading}
            />
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-background">
            <AppHeader title={diagnosis?.diagnosis || 'Chat Name'} />

            <main className="flex flex-1 flex-col">
                <div className="max-w-3xl mx-auto w-full px-4 py-4">
                    <div className="flex gap-4 items-start">
                        <div className="flex flex-col gap-3 w-full">
                            {/* Diagnosis Section: Image & Initial Analysis */}
                            <div
                                ref={diagnosisRef}
                                className="flex-shrink-0 w-full sm:max-w-[50%] aspect-square relative scroll-mt-20"
                            >
                                <div className="rounded-lg overflow-hidden border border-border/50 h-full">
                                    <img
                                        src={imageSrc}
                                        alt="Issue"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            </div>

                            <div className="text-sm text-muted-foreground italic leading-relaxed min-h-[1.25rem] flex items-center">
                                {diagnosis?.thinking ||
                                    ((isDiagnosing || isResponding) && (
                                        <Skeleton className="h-3.5 w-[250px]" />
                                    ))}
                            </div>

                            <div className="mt-4 flex flex-col gap-2">
                                {isDiagnosing || !diagnosis?.diagnosis ? (
                                    <DiagnosisSkeleton />
                                ) : (
                                    <DiagnosisReport diagnosis={diagnosis} />
                                )}

                                {/* Providers Section: Cards Grid */}
                                {diagnosis && (
                                    <div className="mt-8 flex flex-col gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
                                        <Separator className="w-full" />

                                        <div className="flex flex-col gap-2">
                                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                                Recommended Service Providers
                                            </h3>
                                            <p className="text-sm leading-relaxed text-muted-foreground">
                                                I found these highly-rated{' '}
                                                {diagnosis?.trade && diagnosis.trade !== 'N/A'
                                                    ? diagnosis.trade
                                                    : 'service'}{' '}
                                                providers within 25km of your location.
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {isLoadingProviders ? (
                                                <ProvidersSkeleton />
                                            ) : providers.length === 0 ? (
                                                <div className="col-span-full py-12 text-center text-muted-foreground">
                                                    No providers found in your area.
                                                </div>
                                            ) : (
                                                providers.map((p, i) => (
                                                    <ProviderCard
                                                        key={i}
                                                        provider={p}
                                                        index={i}
                                                        openPopoverId={openPopoverId}
                                                        setOpenPopoverId={setOpenPopoverId}
                                                        trade={diagnosis?.trade}
                                                        userLocation={userLocation}
                                                    />
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Chat Interface: Message History */}
                                <div className="flex flex-col gap-4">
                                    {messages.map((msg, i) => (
                                        <ChatMessage
                                            key={i}
                                            message={msg}
                                            isLast={i === messages.length - 1}
                                            isResponding={isResponding}
                                            onFeedback={(type) => handleMessageFeedback(i, type)}
                                            onCopy={() => handleCopy(msg.content)}
                                            onRegenerate={() => handleRegenerate(i)}
                                            onScrollToDiagnosis={scrollToDiagnosis}
                                        />
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <ChatFooter
                message={message}
                setMessage={setMessage}
                attachments={attachments}
                handleSend={handleSend}
                handleFilesChosen={handleFilesChosen}
                removeAttachment={removeAttachment}
                isDiagnosing={isDiagnosing}
                isResponding={isResponding}
                hasDiagnosis={!!diagnosis}
                fileInputRef={fileInputRef}
            />
        </div>
    );
}
