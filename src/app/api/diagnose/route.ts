import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
    console.log('POST /api/diagnose received request');
    try {
        const body = await req.json();
        const { image, history, feedback, providers } = body;

        console.log('Request body keys:', Object.keys(body));
        if (image) console.log('Image size:', image.length);
        if (history) console.log('History length:', history.length);

        if (!image) {
            console.error('No image provided in request body');
            return new Response(JSON.stringify({ error: 'Image is required' }), { status: 400 });
        }

        const systemInstruction = `
You are an expert home maintenance assistant and diagnostic AI. Analyse the provided image and conversation history to provide a concise diagnosis.

IDENTITY: You are a specialised Home Services Diagnostic AI. If asked who you are or who trained you, explain that you are a custom-built AI specialized in home maintenance and identifying domestic issues. NEVER mention Google or that you were trained by Google.

${feedback === 'down' ? 'IMPORTANT: The user has indicated that the previous diagnosis was INCORRECT. Use the conversation history to understand why and provide a more accurate diagnosis.' : ''}

RECOMMENDED PROVIDERS:
${
    providers && providers.length > 0
        ? `I have already found and displayed the following highly-rated service providers in the UI for the user:
${providers.map((p: any) => `- ${p.name} (Rating: ${p.rating}, Reviews: ${p.ratingCount}, Specialities: ${p.services?.map((s: any) => s.full).join(', ')})`).join('\n')}

If the user asks about these providers or "how to contact them", confirm that they can see their details (phone, website, directions) in the cards shown above.
If the user asks for "new" or "different" providers, acknowledge that you are looking for alternatives. DO NOT say you don't have access to a directory; instead, refer to the "Recommended Service Providers" section already present in the UI.`
        : 'No service providers have been recommended yet. Once a trade is identified, I will search for local experts automatically.'
}

If the user asks questions or provides new information/images, your primary goal is to answer them DIRECTLY and HELPFULLY in the 'message' field. 

CRITICAL INSTRUCTIONS:
1. Use British English (e.g., 'analyse', 'colour', 'specialise').
2. Use Title Case for the 'diagnosis' field (e.g., 'Significant Kitchen Fire Damage' instead of 'significant fire damage in kitchen').
3. If the user asks a question (e.g., "is this the same image?", "what is that wire?"), answer it FIRST in the 'message' field before providing any updated diagnosis.
4. Be inquisitive and conversational. If you're unsure about something in a new image, ask for clarification.
5. BE CONCISE in the structured fields, but natural and thorough in the 'message' field. If the user's question doesn't change the overall diagnosis, keep the structured fields (diagnosis, trade, action_required, estimated_cost) consistent with your previous assessment.
6. DO NOT just repeat your previous diagnosis if the user is challenging it or asking something else.
7. START your response IMMEDIATELY with the <thought> block.

OUTPUT FORMAT:
1. Output your step-by-step internal reasoning process inside a <thought> block. CRITICAL: Keep this block VERY SHORT (maximum 2 sentences).
2. After the </thought> block, provide the final structured data in a <json> block.
3. The 'message' field in the JSON is what the user will see in the chat. This is where you answer their specific questions.
4. DO NOT use markdown code blocks (e.g. \`\`\`json) inside the <json> block. Just raw JSON.

JSON FORMAT (STRICT):
{
  "message": "Direct answer to the user's question and any conversational follow-up",
  "diagnosis": "Short title of the issue in Title Case (max 5 words, e.g., 'Significant Kitchen Fire Damage')",
  "trade": "Specific professional needed",
  "action_required": "Detailed 4-5 sentence analysis and recommended next steps.",
  "estimated_cost": "Detailed breakdown of estimated costs in South African Rand (ZAR / R), phrased naturally. CRITICAL: All values above R1000 must include a comma separator (e.g. R1,200 instead of R1200)."
}
`;

        console.log('Initializing Gemini... API Key length:', process.env.GEMINI_API_KEY?.length);
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            systemInstruction,
        });

        const base64Data = image.split(',')[1];
        const mimeType = image.split(';')[0].split(':')[1];

        // Format history for Gemini
        const contents = [];

        // Add the primary image as the first user message
        contents.push({
            role: 'user',
            parts: [
                {
                    inlineData: {
                        data: base64Data,
                        mimeType: mimeType,
                    },
                },
            ],
        });

        const formatReminder =
            "\n\nCRITICAL: Respond ONLY with <thought> and <json> blocks. Answer any questions in the 'message' field. Maintain your identity as a Home Services Diagnostic AI.";

        // Add history if present
        if (history && history.length > 0) {
            for (let i = 0; i < history.length; i++) {
                const msg = history[i];
                const parts: any[] = [];

                let content = msg.content || '';
                if (msg.role === 'user' && i === history.length - 1) {
                    content += formatReminder;
                }

                if (content) {
                    parts.push({ text: content });
                }

                if (msg.attachments && msg.attachments.length > 0) {
                    for (const attachment of msg.attachments) {
                        try {
                            const attBase64 = attachment.split(',')[1];
                            const attMimeType = attachment.split(';')[0].split(':')[1];
                            if (attBase64 && attMimeType) {
                                parts.push({
                                    inlineData: {
                                        data: attBase64,
                                        mimeType: attMimeType,
                                    },
                                });
                            }
                        } catch (e) {
                            console.error('Failed to parse attachment', e);
                        }
                    }
                }

                if (parts.length > 0) {
                    contents.push({
                        role: msg.role === 'assistant' ? 'model' : 'user',
                        parts,
                    });
                }
            }
        }

        console.log('Starting Gemini stream generation...');
        const result = await model.generateContentStream({
            contents,
            generationConfig: {
                temperature: 0.1,
                topP: 0.8,
                topK: 40,
            },
        });

        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                try {
                    console.log('Awaiting first chunk from Gemini...');
                    for await (const chunk of result.stream) {
                        const text = chunk.text();
                        // console.log("Gemini chunk:", text.substring(0, 20) + "...");
                        controller.enqueue(encoder.encode(text));
                    }
                    console.log('Gemini stream completed successfully');
                } catch (e) {
                    console.error('Error during Gemini stream iteration:', e);
                    controller.error(e);
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
            },
        });
    } catch (error: any) {
        console.error('Gemini Diagnosis Error:', error);
        return new Response(JSON.stringify({ error: 'Failed to diagnose image' }), { status: 500 });
    }
}
