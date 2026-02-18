import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
    console.log("POST /api/diagnose received request");
    try {
        const body = await req.json();
        const { image, history, feedback, providers } = body;

        console.log("Request body keys:", Object.keys(body));
        if (image) console.log("Image size:", image.length);
        if (history) console.log("History length:", history.length);

        if (!image) {
            console.error("No image provided in request body");
            return new Response(JSON.stringify({ error: "Image is required" }), { status: 400 });
        }

        console.log("Initializing Gemini... API Key length:", process.env.GEMINI_API_KEY?.length);
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `
You are an expert home maintenance assistant and diagnostic AI. Analyse the provided image and conversation history to provide a concise diagnosis.

IDENTITY: You are a specialised Home Services Diagnostic AI. If asked who you are or who trained you, explain that you are a custom-built AI specialized in home maintenance and identifying domestic issues. NEVER mention Google or that you were trained by Google.

${feedback === 'down' ? "IMPORTANT: The user has indicated that the previous diagnosis was INCORRECT. Use the conversation history to understand why and provide a more accurate diagnosis." : ""}

${providers && providers.length > 0 ? `The following service providers have been recommended to the user based on their location: ${providers.map((p: any) => p.name).join(", ")}. If the user asks about contacting them (or "the same people"), confirm that they can reach out to these recommended experts or their original installers.` : ""}

If the user asks questions or provides new information/images, your primary goal is to answer them DIRECTLY and HELPFULLY in the 'message' field. 

CRITICAL INSTRUCTIONS:
1. Use British English (e.g., 'analyse', 'colour', 'specialise').
2. If the user asks a question (e.g., "is this the same image?", "what is that wire?"), answer it FIRST in the 'message' field before providing any updated diagnosis.
3. Be inquisitive and conversational. If you're unsure about something in a new image, ask for clarification.
4. BE CONCISE in the structured fields, but natural and thorough in the 'message' field. If the user's question doesn't change the overall diagnosis, keep the structured fields (diagnosis, trade, action_required, estimated_cost) consistent with your previous assessment.
5. DO NOT just repeat your previous diagnosis if the user is challenging it or asking something else.
6. START your response IMMEDIATELY with the <thought> block.

INSTRUCTIONS:
1. Output your step-by-step internal reasoning process inside a <thought> block. Identify visual clues and compare images if multiple are provided. CRITICAL: Keep this block VERY SHORT (maximum 2 sentences).
2. After the </thought> block, provide the final structured data in a <json> block.
3. The 'message' field in the JSON is what the user will see in the chat. This is where you answer their specific questions.
4. DO NOT use markdown code blocks (e.g. \`\`\`json) inside the <json> block. Just raw JSON.

JSON FORMAT (STRICT):
{
  "message": "Direct answer to the user's question and any conversational follow-up",
  "diagnosis": "Short title of the issue (max 5 words)",
  "trade": "Specific professional needed",
  "action_required": "Detailed 4-5 sentence analysis and recommended next steps.",
  "estimated_cost": "Detailed breakdown of estimated costs in South African Rand (ZAR / R), phrased naturally. CRITICAL: All values above R1000 must include a comma separator (e.g. R1,200 instead of R1200)."
}

Example Output:
<thought>
I see *water stains* on the ceiling... this suggests a *plumbing leak*...
</thought>
<json>
{
  "message": "I've analysed the stains on your ceiling. It looks like a plumbing leak from above.",
  "diagnosis": "Ceiling Water Leak",
  "trade": "Plumber",
  "action_required": "The water damage on your ceiling indicates an active leak from the plumbing infrastructure above. You should immediately check the upstairs bathroom for any overflowing fixtures or leaking pipes under the sink. It is recommended to shut off the main water supply to prevent further structural damage to your ceiling boards. A professional plumber will need to cut an access hole to locate the source and repair the faulty pipework.",
  "estimated_cost": "A typical call-out fee ranges from R500 to R850, with pipe repairs costing between R1,200 and R3,500 depending on the accessibility and extent of the leak."
}
</json>
`;

        const base64Data = image.split(",")[1];
        const mimeType = image.split(";")[0].split(":")[1];

        // Format history for Gemini
        const contents = [];
        
        // Add the primary instruction and image as the first user message
        contents.push({
            role: "user",
            parts: [
                { text: prompt },
                {
                    inlineData: {
                        data: base64Data,
                        mimeType: mimeType
                    }
                }
            ]
        });

        const formatReminder = "\n\nCRITICAL: Respond ONLY with <thought> and <json> blocks as specified. Answer any questions in the 'message' field of the JSON. Maintain your identity as a Home Services Diagnostic AI and do not mention external companies or your creators.";

        // Add history if present
        if (history && history.length > 0) {
            for (let i = 0; i < history.length; i++) {
                const msg = history[i];
                const parts: any[] = [];
                
                let content = msg.content || "";
                if (msg.role === "user" && i === history.length - 1) {
                    content += formatReminder;
                }
                
                if (content) {
                    parts.push({ text: content });
                }

                if (msg.attachments && msg.attachments.length > 0) {
                    for (const attachment of msg.attachments) {
                        try {
                            const attBase64 = attachment.split(",")[1];
                            const attMimeType = attachment.split(";")[0].split(":")[1];
                            if (attBase64 && attMimeType) {
                                parts.push({
                                    inlineData: {
                                        data: attBase64,
                                        mimeType: attMimeType
                                    }
                                });
                            }
                        } catch (e) {
                            console.error("Failed to parse attachment", e);
                        }
                    }
                }

                if (parts.length > 0) {
                    contents.push({
                        role: msg.role === "assistant" ? "model" : "user",
                        parts
                    });
                }
            }
        }

        console.log("Starting Gemini stream generation...");
        const result = await model.generateContentStream({
            contents,
            generationConfig: {
                temperature: 0.1,
                topP: 0.8,
                topK: 40,
            }
        });

        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                try {
                    console.log("Awaiting first chunk from Gemini...");
                    for await (const chunk of result.stream) {
                        const text = chunk.text();
                        // console.log("Gemini chunk:", text.substring(0, 20) + "...");
                        controller.enqueue(encoder.encode(text));
                    }
                    console.log("Gemini stream completed successfully");
                } catch (e) {
                    console.error("Error during Gemini stream iteration:", e);
                    controller.error(e);
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Transfer-Encoding": "chunked",
            },
        });

    } catch (error: any) {
        console.error("Gemini Diagnosis Error:", error);
        return new Response(JSON.stringify({ error: "Failed to diagnose image" }), { status: 500 });
    }
}
