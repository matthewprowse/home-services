/**
 * File: results.tsx
 * Description: The primary results page that handles AI image diagnosis, 
 * local service provider discovery, and an interactive chat interface.
 */

"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { getImageData, clearImageData } from "@/lib/image-store";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { 
    Paperclip,
    ThumbUp as ThumbsUp, 
    ThumbDown as ThumbsDown, 
    Star,
    StarFill,
    Copy, 
    RotateCounterClockwise as RotateCcw, 
    Cross as X,
} from "geist-icons";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { 
    Phone, 
    Envelope as Mail, 
    Globe,
    Location as LocationIcon
} from "geist-icons";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { compressImage } from "@/lib/image-compression";

// --- Types ---

interface DiagnosisData {
    thinking: string;
    diagnosis: string;
    trade: string;
    action_required: string;
    estimated_cost: string;
    message?: string;
}

interface Message {
    role: "user" | "assistant";
    content: string;
    feedback?: "up" | "down" | null;
    attachments?: string[];
}

interface Provider {
    name: string;
    address: string;
    rating?: number;
    ratingCount?: number;
    phone?: string;
    website?: string;
    latitude?: number;
    longitude?: number;
    summary: string;
    services: string[];
}

// --- Main Component ---

export default function Results() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;
    
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
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
    const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
    const [message, setMessage] = useState("");
    const [attachments, setAttachments] = useState<string[]>([]);
    
    // --- Refs ---
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Log state changes for debugging
    useEffect(() => {
        console.log("UI State Update:", { 
            isDiagnosing, 
            hasDiagnosis: !!diagnosis, 
            diagnosisTitle: diagnosis?.diagnosis,
            hasStartedDiagnosis 
        });
    }, [isDiagnosing, diagnosis, hasStartedDiagnosis]);

    // --- Persistence & Usage ---

    /**
     * Loads existing conversation and messages from Supabase.
     */
    const loadConversation = useCallback(async () => {
        if (!id) return;
        
        console.log("Loading conversation:", id);
        const timeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Database timeout")), 5000)
        );

        try {
            const fetchPromise = (async () => {
                // Run conversation and messages fetch in parallel
                const [convResult, msgsResult] = await Promise.all([
                    supabase.from('conversations').select('*').eq('id', id),
                    supabase.from('messages').select('*').eq('conversation_id', id).order('created_at', { ascending: true })
                ]);
                
                if (convResult.error) {
                    console.error("Supabase Conv Error Details:", convResult.error);
                    throw convResult.error;
                }
                
                if (msgsResult.error) {
                    console.error("Supabase Msgs Error Details:", msgsResult.error);
                }
                
                return { conv: convResult.data?.[0], msgs: msgsResult.data };
            })();

            const result = await Promise.race([fetchPromise, timeout]) as any;
            const conv = result?.conv;
            const msgs = result?.msgs;
            
            if (conv) {
                if (conv.image_url) setImageSrc(conv.image_url);
                if (conv.diagnosis_json) setDiagnosis(conv.diagnosis_json);
                if (conv.user_lat && conv.user_lng) {
                    setUserLocation({ 
                        lat: conv.user_lat, 
                        lng: conv.user_lng, 
                        address: conv.user_address || "" 
                    });
                }
            }

            if (msgs && msgs.length > 0) {
                const mappedMsgs = msgs.map((m: any) => ({
                    role: m.role as "user" | "assistant",
                    content: m.content,
                    attachments: m.attachments,
                    feedback: m.feedback as "up" | "down" | null
                }));
                setMessages(mappedMsgs);
                return mappedMsgs;
            }
        } catch (err) {
            console.error("Failed to load conversation:", err);
        } finally {
            setIsLoaded(true);
        }
        return null;
    }, [id]);

    /**
     * Saves a new message to Supabase.
     */
    const saveMessage = async (role: "user" | "assistant", content: string, attachments: string[] = []) => {
        if (!id) return;
        const { error } = await (supabase as any).from('messages').insert({
            conversation_id: id,
            role,
            content,
            attachments
        });
        if (error) console.error("Error saving message:", error);
    };

    const saveConversation = async (diag?: DiagnosisData) => {
        if (!id) return;
        
        const deviceType = /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
        
        // Ensure we're saving the full diagnosis object
        const finalDiagnosis = diag || diagnosis;
        
        console.log("Saving conversation metadata:", { id, diagnosisTitle: finalDiagnosis?.diagnosis });

        const { error } = await (supabase as any).from('conversations').upsert({
            id,
            title: finalDiagnosis?.diagnosis || "New Diagnosis",
            image_url: imageSrc,
            user_lat: userLocation?.lat,
            user_lng: userLocation?.lng,
            user_address: userLocation?.address,
            diagnosis_json: finalDiagnosis,
            device_type: deviceType,
            user_agent: navigator.userAgent,
            updated_at: new Date().toISOString()
        });
        if (error) console.error("Error saving conversation:", error);
    };

    // --- Utilities ---

    /**
     * Smoothly scrolls the chat container to the latest message.
     */
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
    const fetchProviders = async (lat: number, lng: number, tradeToSearch?: string) => {
        const trade = tradeToSearch || diagnosis?.trade;
        if (!trade) return;
        
        setIsLoadingProviders(true);
        try {
            const res = await fetch("/api/providers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lat, lng, trade })
            });
            const data = await res.json();
            if (res.ok && data.providers) {
                setProviders(data.providers);
            } else {
                console.error("API Error:", data.error || "Unknown error");
            }
        } catch (err) {
            console.error("Failed to fetch providers:", err);
        } finally {
            setIsLoadingProviders(false);
        }
    };

    /**
     * Gets the user's current geolocation and triggers provider search.
     * @param tradeToSearch - Optional trade to override current diagnosis trade.
     */
    const getCurrentLocation = (tradeToSearch?: string) => {
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude: lat, longitude: lng } = pos.coords;
                
                // Parallelize geocoding (for the UI address) and provider fetching
                const geocodePromise = fetch("/api/geocode", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ lat, lng })
                }).then(res => res.json()).catch(() => ({ address: "Current Location" }));

                const providersPromise = fetchProviders(lat, lng, tradeToSearch);

                try {
                    const [geoData] = await Promise.all([geocodePromise, providersPromise]);
                    const address = geoData.address || "Current Location";
                    setUserLocation({ lat, lng, address });
                } catch (e) {
                    console.error("Error in location-based fetching:", e);
                    setUserLocation({ lat, lng, address: "Current Location" });
                }
            },
            (err) => {
                console.error("Location access denied", err);
                toast.error("Location access denied");
            }
        );
    };

    const startInitialDiagnosis = useCallback(async (img: string) => {
        if (diagnosisStartedRef.current) return;
        diagnosisStartedRef.current = true;
        setHasStartedDiagnosis(true);
        setIsDiagnosing(true);
        setDiagnosis(null);
        
        console.log("Starting initial diagnosis... Image length:", img.length);
        try {
            const res = await fetch("/api/diagnose", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: img })
            });
            
            console.log("Diagnosis response status:", res.status);
            if (!res.ok) {
                const error = await res.json().catch(() => ({ error: "Unknown error" }));
                console.error("Diagnosis API error:", error);
                toast.error(error.error || "Failed to start analysis");
                setIsDiagnosing(false);
                return; // Don't reset hasStartedDiagnosis immediately to avoid loop
            }

            if (!res.body) {
                console.error("Diagnosis response body is null");
                setIsDiagnosing(false);
                return;
            }
            
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let fullText = "";
            let currentThinking = "";
            let isSearchTriggered = false;

            console.log("Beginning to read stream...");
            while (true) {
                const { done, value } = await reader.read();
                const chunk = decoder.decode(value || new Uint8Array(), { stream: !done });
                fullText += chunk;

                if (done) {
                    console.log("Stream finished. Total text length:", fullText.length);
                    // console.log("Full AI response text:", fullText);
                    
                    // Final attempt to parse if not already done
                    if (!diagnosis?.diagnosis) {
                        // 1. Try tags first
                        const finalJsonMatch = fullText.match(/<json>([\s\S]*?)(?:<\/json>|$)/i);
                        if (finalJsonMatch) {
                            processJson(finalJsonMatch[1], currentThinking, true);
                        } else {
                            // 2. Fallback: Try to find ANY JSON object in the text
                            const anyJsonMatch = fullText.match(/\{[\s\S]*\}/);
                            if (anyJsonMatch) {
                                console.log("Found raw JSON fallback at end");
                                processJson(anyJsonMatch[0], currentThinking, true);
                            }
                        }
                    }
                    break;
                }
                
                // 1. Extract thinking
                const thoughtMatch = fullText.match(/<(?:thought|thought_process)>([\s\S]*?)(?:<\/(?:thought|thought_process)>|$)/i) 
                    || fullText.match(/```thought\s*([\s\S]*?)(?:```|$)/i);
                
                if (thoughtMatch) {
                    currentThinking = thoughtMatch[1].trim();
                    setDiagnosis(prev => ({
                        thinking: currentThinking,
                        diagnosis: prev?.diagnosis || "",
                        trade: prev?.trade || "",
                        action_required: prev?.action_required || "",
                        estimated_cost: prev?.estimated_cost || ""
                    }));
                }

                // 2. Extract JSON
                const jsonMatch = fullText.match(/<json>([\s\S]*?)(?:<\/json>|$)/i);
                if (jsonMatch) {
                    processJson(jsonMatch[1], currentThinking, fullText.toLowerCase().includes("</json>"));
                } else {
                    // Try to find JSON even if tags are missing or wrapped in markdown
                    const anyJsonMatch = fullText.match(/\{[\s\S]*\}/);
                    if (anyJsonMatch) {
                        processJson(anyJsonMatch[0], currentThinking, false);
                    }
                }
            }

            function processJson(jsonText: string, thinking: string, isComplete: boolean) {
                // Clean up markdown artifacts and surrounding whitespace
                let cleaned = jsonText.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
                
                // Early trade detection
                if (!isSearchTriggered) {
                    const tradeMatch = cleaned.match(/"trade"\s*:\s*"([^"]+)"/i);
                    if (tradeMatch && tradeMatch[1]) {
                        console.log("Early trade detected:", tradeMatch[1]);
                        isSearchTriggered = true;
                        getCurrentLocation(tradeMatch[1]);
                    }
                }

                // Try to parse partial or full JSON
                try {
                    // Find the last valid-looking closing brace if not complete
                    let toParse = cleaned;
                    if (!isComplete && !cleaned.endsWith("}")) {
                        const lastBrace = cleaned.lastIndexOf("}");
                        if (lastBrace !== -1) {
                            toParse = cleaned.substring(0, lastBrace + 1);
                        }
                    }

                    const parsedJson = JSON.parse(toParse);
                    if (parsedJson.diagnosis) {
                        setDiagnosis({ thinking, ...parsedJson });
                        
                        if (isComplete) {
                            console.log("JSON complete, saving to Supabase...");
                            saveConversation({ thinking, ...parsedJson });
                            saveMessage("assistant", parsedJson.message || `I identified a ${parsedJson.diagnosis}.`);
                        }
                    }
                } catch (e) {
                    // console.log("JSON parse skipped (incomplete)");
                }
            }
        } catch (err) {
            console.error("Diagnosis critical failure:", err);
            toast.error("Diagnosis failed. Please check your internet connection.");
        } finally {
            setIsDiagnosing(false);
            console.log("Diagnosis process finished.");
        }
    }, [id, saveConversation, saveMessage, getCurrentLocation]);

    /**
     * Initial data loading and image detection.
     */
    useEffect(() => {
        const init = async () => {
            if (!id) return;

            // 1. Get image from store (fastest)
            const imageData = getImageData();
            if (imageData && imageData.id === id) {
                console.log("Image found in local store for this id");
                setImageSrc(imageData.dataUrl);
            }

            // 2. Load DB data (including existing diagnosis/messages)
            const loadedMsgs = await loadConversation();
            
            // 3. Clear store ONLY if it's a new session
            if (imageData && (!loadedMsgs || loadedMsgs.length === 0)) {
                clearImageData();
            }
        };
        
        init();
    }, [id, loadConversation]);

    /**
     * Triggers the diagnosis when ready.
     */
    useEffect(() => {
        if (isLoaded && imageSrc && messages.length === 0 && !diagnosis && !isDiagnosing && !hasStartedDiagnosis) {
            startInitialDiagnosis(imageSrc);
        }
    }, [isLoaded, imageSrc, messages.length, diagnosis, isDiagnosing, hasStartedDiagnosis, startInitialDiagnosis]);

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
            role: "user", 
            content: userMsg,
            attachments: userAttachments
        };

        setMessages(prev => [...prev, newMessage]);
        setMessage("");
        setAttachments([]);
        setIsResponding(true);

        // Save user message to DB
        saveMessage("user", userMsg, userAttachments);

        try {
            // Context for AI includes initial diagnosis + conversation history + providers
            const initialMsgContent = diagnosis 
                ? `DIAGNOSIS: ${diagnosis.diagnosis}\n\n${diagnosis.action_required}\n\nESTIMATED COST: ${diagnosis.estimated_cost}`
                : "";

            const history = [
                ...(initialMsgContent ? [{ role: "assistant" as const, content: initialMsgContent }] : []),
                ...messages,
                newMessage
            ].map(m => ({ role: m.role, content: m.content, attachments: m.attachments }));

            const res = await fetch("/api/diagnose", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: imageSrc, history, providers })
            });
            
            if (!res.ok) {
                const error = await res.json();
                toast.error(error.error || "Failed to get response");
                setIsResponding(false);
                return;
            }

            if (!res.body) {
                setIsResponding(false);
                return;
            }

            // Placeholder for assistant response
            setMessages(prev => [...prev, { role: "assistant", content: "", feedback: null }]);

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let fullText = "";
            let currentThinking = "";

            while (true) {
                const { done, value } = await reader.read();
                const chunk = decoder.decode(value || new Uint8Array(), { stream: !done });
                fullText += chunk;

                if (done) {
                    console.log("Follow-up stream finished.");
                    break;
                }

                // 1. Extract thinking
                const thoughtMatch = fullText.match(/<thought>([\s\S]*?)(?:\s*<\/thought>|$)/i);
                if (thoughtMatch && thoughtMatch[1]) {
                    currentThinking = thoughtMatch[1].trim();
                    setDiagnosis(prev => prev ? { ...prev, thinking: currentThinking } : { 
                        thinking: currentThinking, 
                        diagnosis: "", 
                        trade: "", 
                        action_required: "", 
                        estimated_cost: "" 
                    });
                }

                // 2. Extract and parse JSON
                const jsonMatch = fullText.match(/<json>([\s\S]*?)(?:<\/json>|$)/i);
                if (jsonMatch) {
                    let cleaned = jsonMatch[1].trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
                    
                    try {
                        let toParse = cleaned;
                        if (!fullText.toLowerCase().includes("</json>") && !cleaned.endsWith("}")) {
                            const lastBrace = cleaned.lastIndexOf("}");
                            if (lastBrace !== -1) toParse = cleaned.substring(0, lastBrace + 1);
                        }

                        const parsedJson = JSON.parse(toParse);
                        if (parsedJson.diagnosis) {
                            const assistantContent = parsedJson.message || (parsedJson.diagnosis + "\n\n" + parsedJson.action_required);
                            
                            // Update the chat bubble
                            setMessages(prev => {
                                const next = [...prev];
                                next[next.length - 1] = { ...next[next.length - 1], content: assistantContent };
                                return next;
                            });

                            // Update main diagnosis state
                            const prevTrade = diagnosis?.trade;
                            setDiagnosis({ thinking: currentThinking, ...parsedJson });

                            // Auto-trigger provider search
                            const userAskedForProviders = userMsg.toLowerCase().match(/provider|contact|who/);
                            if (parsedJson.trade && (parsedJson.trade !== prevTrade || providers.length === 0 || userAskedForProviders)) {
                                getCurrentLocation(parsedJson.trade);
                            }

                            // Save assistant message to DB
                            if (fullText.toLowerCase().includes("</json>")) {
                                saveMessage("assistant", assistantContent);
                            }
                        }
                    } catch (e) { /* partial */ }
                }
            }
        } catch (err) {
            console.error("Follow-up failed:", err);
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

        Array.from(files).slice(0, slots).forEach(file => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const url = e.target?.result as string;
                if (url) {
                    try {
                        const compressed = await compressImage(url);
                        setAttachments(prev => [...prev, compressed].slice(0, 5));
                    } catch (err) {
                        console.error("Attachment compression failed:", err);
                        setAttachments(prev => [...prev, url].slice(0, 5));
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
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    /**
     * Updates thumbs up/down feedback for assistant messages.
     */
    const handleMessageFeedback = (index: number, type: "up" | "down") => {
        setMessages(prev => prev.map((msg, i) => 
            i === index ? { ...msg, feedback: msg.feedback === type ? null : type } : msg
        ));
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
        const lastUserMsg = [...messageHistory].reverse().find(m => m.role === "user");
        
        if (!lastUserMsg) return;

        setMessages(prev => prev.slice(0, index));
        setIsResponding(true);

        try {
            const initialMsgContent = diagnosis 
                ? `DIAGNOSIS: ${diagnosis.diagnosis}\n\n${diagnosis.action_required}\n\nESTIMATED COST: ${diagnosis.estimated_cost}`
                : "";

            const history = [
                ...(initialMsgContent ? [{ role: "assistant" as const, content: initialMsgContent }] : []),
                ...messageHistory
            ].map(m => ({ role: m.role, content: m.content, attachments: m.attachments }));

            const res = await fetch("/api/diagnose", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: imageSrc, history, providers })
            });

            if (!res.ok) {
                const error = await res.json();
                toast.error(error.error || "Failed to regenerate");
                setIsResponding(false);
                return;
            }

            if (!res.body) {
                setIsResponding(false);
                return;
            }

            setMessages(prev => [...prev, { role: "assistant", content: "", feedback: null }]);

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let fullText = "";
            let currentThinking = "";

            while (true) {
                const { done, value } = await reader.read();
                const chunk = decoder.decode(value || new Uint8Array(), { stream: !done });
                fullText += chunk;

                if (done) break;

                const thoughtMatch = fullText.match(/<thought>([\s\S]*?)(?:\s*<\/thought>|$)/i);
                if (thoughtMatch && thoughtMatch[1]) {
                    currentThinking = thoughtMatch[1].trim();
                    setDiagnosis(prev => prev ? { ...prev, thinking: currentThinking } : {
                        thinking: currentThinking,
                        diagnosis: "",
                        trade: "",
                        action_required: "",
                        estimated_cost: ""
                    });
                }

                const jsonMatch = fullText.match(/<json>([\s\S]*?)(?:\s*<\/json>|$)/i);
                if (jsonMatch) {
                    let cleaned = jsonMatch[1].trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
                    try {
                        let toParse = cleaned;
                        if (!fullText.toLowerCase().includes("</json>") && !cleaned.endsWith("}")) {
                            const lastBrace = cleaned.lastIndexOf("}");
                            if (lastBrace !== -1) toParse = cleaned.substring(0, lastBrace + 1);
                        }

                        const parsedJson = JSON.parse(toParse);
                        if (parsedJson.diagnosis) {
                            const assistantContent = parsedJson.message || (parsedJson.diagnosis + "\n\n" + parsedJson.action_required);
                            
                            setMessages(prev => {
                                const next = [...prev];
                                next[next.length - 1] = { ...next[next.length - 1], content: assistantContent };
                                return next;
                            });

                            const prevTrade = diagnosis?.trade;
                            setDiagnosis({ thinking: currentThinking, ...parsedJson });

                            const userAskedForProviders = lastUserMsg.content.toLowerCase().match(/provider|contact|who/);
                            if (parsedJson.trade && (parsedJson.trade !== prevTrade || providers.length === 0 || userAskedForProviders)) {
                                getCurrentLocation(parsedJson.trade);
                            }
                        }
                    } catch (e) {}
                }
            }
        } catch (err) {
            console.error("Regeneration failed:", err);
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
            <div className="flex min-h-screen flex-col">
                <AppHeader diagnosis={diagnosis} router={router} />
                <div className="flex flex-1 items-center justify-center">
                    <Spinner className="size-8 text-muted-foreground" />
                </div>
            </div>
        );
    }

    if (!imageSrc) {
        return <NoImageFallback router={router} diagnosis={diagnosis} />;
    }

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <AppHeader diagnosis={diagnosis} router={router} />

            <main className="flex flex-1 flex-col">
                <div className="max-w-3xl mx-auto w-full px-4 py-4">
                    <div className="flex gap-4 items-start">
                        <div className="flex flex-col gap-3 w-full">
                            
                            {/* Diagnosis Section: Image & Initial Analysis */}
                            <div className="flex-shrink-0 w-full sm:w-1/2 md:w-2/5 relative">
                                <div className="rounded-lg overflow-hidden border border-border/50">
                                    <img src={imageSrc} alt="Issue" className="w-full h-auto max-h-[50vh] object-cover" />
                                </div>
                            </div>

                            <div className="text-sm text-muted-foreground italic leading-relaxed min-h-[1.25rem] flex items-center">
                                {diagnosis?.thinking || (isDiagnosing && <Skeleton className="h-3.5 w-[250px]" />)}
                            </div>

                            <div className="mt-4 flex flex-col gap-2">
                                {isDiagnosing || !diagnosis?.diagnosis ? (
                                    hasStartedDiagnosis ? (
                                        <DiagnosisSkeleton onRetry={handleRetryDiagnosis} />
                                    ) : (
                                        <div className="py-8 text-center text-muted-foreground">
                                            Waiting to start diagnosis...
                                        </div>
                                    )
                                ) : (
                                    <DiagnosisReport diagnosis={diagnosis} />
                                )}

                                {/* Providers Section: Cards Grid */}
                                {diagnosis && (
                                    <div className="mt-8 flex flex-col gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
                                        <Separator className="w-full" />
                                        
                                        <div className="flex flex-col gap-2">
                                            <h3 className="text-lg font-semibold flex items-center gap-2">Recommended Service Providers</h3>
                                            <p className="text-sm leading-relaxed text-muted-foreground">
                                                I found these highly-rated {diagnosis?.trade || "service"} providers within 25km of your location.
                                            </p>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {isLoadingProviders ? (
                                                <ProvidersSkeleton />
                                            ) : providers.length === 0 ? (
                                                <div className="col-span-full py-12 text-center text-muted-foreground">No providers found in your area.</div>
                                            ) : (
                                                providers.map((p, i) => (
                                                    <ProviderCard key={i} provider={p} index={i} openPopoverId={openPopoverId} setOpenPopoverId={setOpenPopoverId} />
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

// --- Sub-Components ---

/**
 * Standard app header with dynamic diagnosis title and user avatar.
 */
function AppHeader({ diagnosis, router }: { diagnosis: DiagnosisData | null, router: any }) {
    return (
        <header className="sticky top-0 z-50 bg-background">
            <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
                <h1 className="text-lg font-semibold">{diagnosis?.diagnosis || "Conversation"}</h1>
                <Popover>
                    <PopoverTrigger asChild>
                        <button className="size-8 rounded-full bg-secondary cursor-pointer hover:bg-secondary/80 transition-colors" />
                    </PopoverTrigger>
                    <PopoverContent className="w-40 p-1" align="end">
                        <div className="flex flex-col">
                            <Button variant="ghost" className="justify-start font-normal h-9 px-3" onClick={() => router.push("/settings")}>Settings</Button>
                            <Button variant="ghost" className="justify-start font-normal h-9 px-3 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => console.log("Logout clicked")}>Log out</Button>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
        </header>
    );
}

/**
 * Displays the structured AI diagnosis and recommended actions.
 */
function DiagnosisReport({ diagnosis }: { diagnosis: DiagnosisData | null }) {
    if (!diagnosis?.diagnosis) return null;
    return (
        <div className="animate-in fade-in slide-in-from-bottom-3 duration-500">
            <h2 className="text-xl font-semibold">{diagnosis.diagnosis}</h2>
            <div className="mt-3 space-y-4">
                <p className="text-sm text-foreground/90">{diagnosis.action_required}</p>
                <p className="text-sm font-medium text-foreground/80">{diagnosis.estimated_cost}</p>
            </div>
        </div>
    );
}

/**
 * Displays service badges in a single line with smart truncation.
 * Hides services that would be truncated by more than 25%.
 */
function ServiceBadges({ services }: { services: string[] }) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [visibleCount, setVisibleCount] = useState(services.length);

    useEffect(() => {
        const calculateVisible = () => {
            if (!containerRef.current) return;
            // The parent is the "flex flex-wrap gap-2" div, but we want the card's inner width
            // Let's look up to the card content or header area
            const parent = containerRef.current.closest('.flex-col.gap-2');
            if (!parent) return;
            
            const style = window.getComputedStyle(parent);
            const containerWidth = parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 4;
            
            if (containerWidth <= 0) return;

            const moreBadgeWidth = 40; 
            let currentWidth = 0;
            let count = 0;

            const measureSpan = document.createElement("span");
            measureSpan.style.visibility = "hidden";
            measureSpan.style.position = "absolute";
            measureSpan.style.whiteSpace = "nowrap";
            measureSpan.style.font = "600 12px sans-serif"; 
            document.body.appendChild(measureSpan);

            for (let i = 0; i < services.length; i++) {
                measureSpan.innerText = services[i];
                const badgeWidth = measureSpan.offsetWidth + 16; 
                const gap = 8;

                const remainingItems = services.length - (i + 1);
                let neededWidth = currentWidth + badgeWidth + (count > 0 ? gap : 0);
                const finalWidthWithMore = neededWidth + (remainingItems > 0 ? gap + moreBadgeWidth : 0);

                if (finalWidthWithMore <= containerWidth) {
                    currentWidth = neededWidth;
                    count++;
                } else {
                    const availableForThis = containerWidth - currentWidth - (count > 0 ? gap : 0) - (remainingItems > 0 ? gap + moreBadgeWidth : 0);
                    // 25% rule: if we can show 75% of it and it's at least 30px wide
                    if (availableForThis >= badgeWidth * 0.75 && availableForThis > 30) {
                        count++;
                    }
                    break;
                }
            }

            document.body.removeChild(measureSpan);
            setVisibleCount(Math.max(1, count));
        };

        const timer = setTimeout(calculateVisible, 100);
        window.addEventListener("resize", calculateVisible);
        return () => {
            clearTimeout(timer);
            window.removeEventListener("resize", calculateVisible);
        };
    }, [services]);

    const visibleServices = services.slice(0, visibleCount);
    const hiddenServices = services.slice(visibleCount);

    return (
        <div ref={containerRef} className="flex flex-row items-center gap-2 w-full min-w-0 overflow-hidden h-7 pr-1">
            {visibleServices.map((service, i) => (
                <Badge key={i} variant="secondary" className="whitespace-nowrap truncate min-w-0 flex-shrink-1">
                    {service}
                </Badge>
            ))}
            {hiddenServices.length > 0 && (
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Badge 
                            variant="outline" 
                            className="cursor-pointer whitespace-nowrap transition-colors border-dotted border-2 flex-shrink-0"
                            onMouseEnter={() => setOpen(true)}
                            onMouseLeave={() => setOpen(false)}
                        >
                            +{hiddenServices.length}
                        </Badge>
                    </PopoverTrigger>
                    <PopoverContent 
                        className="w-64 p-3 shadow-xl rounded-md border-input" 
                        side="top" 
                        align="end"
                        onMouseEnter={() => setOpen(true)}
                        onMouseLeave={() => setOpen(false)}
                    >
                        <div className="flex flex-col gap-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">All Services</p>
                            <div className="flex flex-wrap gap-1.5">
                                {services.map((service, i) => (
                                    <Badge key={i} variant="secondary">
                                        {service}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            )}
        </div>
    );
}

/**
 * Individual provider card with contact, website, and directions.
 */
function ProviderCard({ provider, index, openPopoverId, setOpenPopoverId }: { 
    provider: Provider, index: number, openPopoverId: string | null, setOpenPopoverId: (id: string | null) => void 
}) {
    if (!provider) return null;
    const popoverId = `contact-${index}`;
    const displayName = provider.name.replace(/\band\b/gi, "&");
    return (
        <Card className="flex flex-col h-full border-input shadow-none p-4 rounded-lg">
            <CardHeader className="flex flex-col gap-3 p-0">
                <div className="flex flex-col gap-2 w-full min-w-0">
                    <div className="flex justify-between items-center gap-2 w-full min-w-0">
                        <CardTitle className="text-lg font-semibold truncate min-w-0" title={displayName}>{displayName}</CardTitle>
                        <div className="flex items-center gap-2 shrink-0">
                            <StarFill className="size-4 text-yellow-500 fill-yellow-500" />
                            <div className="flex items-center gap-1">
                                <span className="text-sm font-semibold">{provider.rating?.toFixed(1) || "N/A"}</span>
                                <span className="text-xs text-muted-foreground">({provider.ratingCount || 0})</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <ServiceBadges services={provider.services || []} />
                    </div>
                </div>
            </CardHeader>
            <p className="text-xs text-muted-foreground" title={provider.address}>{provider.address}</p>
            <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Customer Summary</p>
                <blockquote className="border-l-2 border-input pl-3">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        {provider.summary}
                    </p>
                </blockquote>
            </div>
            <div className="flex flex-row gap-2 mt-auto">
                <Popover open={openPopoverId === popoverId} onOpenChange={(open) => setOpenPopoverId(open ? popoverId : null)}>
                    <PopoverTrigger asChild>
                        <Button variant="default" className="flex-1">Contact</Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-2 rounded-md shadow-xl border-input" align="start" side="top">
                        <div className="flex flex-col gap-1">
                            {provider.phone && (
                                <Button variant="ghost" className="justify-start h-10 font-medium" asChild><a href={`tel:${provider.phone}`}>Call</a></Button>
                            )}
                            <Button variant="ghost" className="justify-start h-10 font-medium" onClick={() => window.open(`mailto:info@${provider.name.toLowerCase().replace(/\s+/g, "")}.com`)}>Email</Button>
                        </div>
                    </PopoverContent>
                </Popover>
                {provider.website && (
                    <Button variant="secondary" className="flex-1" onClick={() => window.open(provider.website, "_blank")}>Website</Button>
                )}
                <Button variant="secondary" className="flex-1" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(provider.address)}`, "_blank")}>Directions</Button>
            </div>
        </Card>
    );
}

/**
 * A single chat message bubble (User or AI).
 */
function ChatMessage({ message, isLast, isResponding, onFeedback, onCopy, onRegenerate }: { 
    message: Message, isLast: boolean, isResponding: boolean, onFeedback: (type: "up" | "down") => void, onCopy: () => void, onRegenerate: () => void 
}) {
    return (
        <div className={cn("flex flex-col gap-2 w-full mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300", message.role === "user" ? "items-end" : "items-start")}>
            <div className={cn("text-sm leading-relaxed", message.role === "user" ? "bg-secondary text-secondary-foreground rounded-md px-3 py-1.5 max-w-[75%]" : "text-foreground w-full")}>
                {message.attachments && message.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                        {message.attachments.map((src, i) => (
                            <img key={i} src={src} alt="Attachment" className="h-32 w-auto rounded-md object-cover border border-border/50" />
                        ))}
                    </div>
                )}
                {message.content === "" && isLast && isResponding ? (
                    <div className="flex items-center py-1"><Spinner className="size-4 text-muted-foreground" /></div>
                ) : (
                    message.content
                )}
            </div>
            {message.role === "assistant" && message.content !== "" && (
                <div className="flex items-center gap-1 mt-1 -ml-2">
                    <Button variant={message.feedback === "up" ? "secondary" : "ghost"} size="icon" className="size-8 group" onClick={() => onFeedback("up")}>
                        <ThumbsUp className={cn("size-4 transition-colors", message.feedback === "up" ? "text-black dark:text-white" : "text-muted-foreground group-hover:text-black dark:group-hover:text-white")} />
                    </Button>
                    <Button variant={message.feedback === "down" ? "secondary" : "ghost"} size="icon" className="size-8 group" onClick={() => onFeedback("down")}>
                        <ThumbsDown className={cn("size-4 transition-colors", message.feedback === "down" ? "text-black dark:text-white" : "text-muted-foreground group-hover:text-black dark:group-hover:text-white")} />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8 group" onClick={onCopy}>
                        <Copy className="size-4 text-muted-foreground transition-colors group-hover:text-black dark:group-hover:text-white" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8 group" onClick={onRegenerate}>
                        <RotateCcw className="size-4 text-muted-foreground transition-colors group-hover:text-black dark:group-hover:text-white" />
                    </Button>
                </div>
            )}
        </div>
    );
}

/**
 * The sticky bottom footer containing the message input and attachments.
 */
function ChatFooter({ 
    message, setMessage, attachments, handleSend, handleFilesChosen, removeAttachment, 
    isDiagnosing, isResponding, hasDiagnosis, fileInputRef 
}: any) {
    const isDisabled = (!hasDiagnosis && isDiagnosing) || isResponding;
    
    return (
        <footer className="sticky bottom-0 z-50 bg-background">
            <div className="max-w-3xl mx-auto px-4 py-4">
                {attachments.length > 0 && (
                    <div className="flex gap-3 mb-3 overflow-x-auto py-2 scrollbar-hide">
                        {attachments.map((src: string, i: number) => (
                            <div key={i} className="relative flex-shrink-0 size-28 group/thumb rounded-md overflow-hidden border border-border">
                                <img src={src} alt="Preview" className="size-full object-cover cursor-pointer hover:opacity-90 transition-opacity" onClick={() => removeAttachment(i)} />
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
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder={isDisabled ? "Please wait..." : "Type Message..."}
                        className="min-h-[80px] w-full resize-none p-3"
                        disabled={isDisabled}
                    />
                    <div className="flex justify-between items-center">
                        <div>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={(e) => handleFilesChosen(e.target.files)} />
                            <Button 
                                variant="secondary" 
                                size="icon" 
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isDisabled || attachments.length >= 5}
                            >
                                <Paperclip className="size-5" />
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
            </div>
        </footer>
    );
}

/**
 * Skeleton loader for the diagnosis results.
 */
function DiagnosisSkeleton({ onRetry }: { onRetry?: () => void }) {
    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <Skeleton className="h-8 w-64 rounded-md" /> 
                <div className="space-y-2.5 pt-1">
                    <Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-[97%]" /><Skeleton className="h-4 w-[98%]" /><Skeleton className="h-4 w-[94%]" /><Skeleton className="h-4 w-[45%]" />
                </div>
            </div>
            <div className="pt-2 border-t border-border/40 flex justify-between items-center">
                <div className="space-y-2">
                    <Skeleton className="h-5 w-48 mb-2" /><Skeleton className="h-4 w-64" />
                </div>
                {onRetry && (
                    <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0">
                        Retry Analysis
                    </Button>
                )}
            </div>
        </div>
    );
}

/**
 * Skeleton loader for provider cards.
 */
function ProvidersSkeleton() {
    return (
        <>
            {[1, 2].map((i) => (
                <div key={i} className="flex flex-col gap-4 animate-pulse border-input border p-4 rounded-xl shadow-sm">
                    <div className="flex justify-between items-start">
                        <div className="h-6 w-48 bg-secondary/50 rounded-md" />
                        <div className="h-6 w-16 bg-secondary/50 rounded-md" />
                    </div>
                    <div className="flex gap-2">
                        <div className="h-5 w-20 bg-secondary/50 rounded-md" />
                        <div className="h-5 w-20 bg-secondary/50 rounded-md" />
                    </div>
                    <div className="h-4 w-full bg-secondary/50 rounded-md" />
                    <div className="mt-auto flex gap-2">
                        <div className="h-10 flex-1 bg-secondary/50 rounded-md" />
                        <div className="h-10 flex-1 bg-secondary/50 rounded-md" />
                        <div className="h-10 flex-1 bg-secondary/50 rounded-md" />
                    </div>
                </div>
            ))}
        </>
    );
}

/**
 * Fallback when no image is selected.
 */
function NoImageFallback({ router, diagnosis }: any) {
    return (
        <div className="flex min-h-screen flex-col">
            <AppHeader diagnosis={diagnosis} router={router} />
            <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-muted-foreground">No image found. Please go back and select an image.</p>
            </div>
        </div>
    );
}
