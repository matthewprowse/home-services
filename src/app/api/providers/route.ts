import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createServerClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
    try {
        const { lat, lng, trade, radius: customRadius } = await req.json();
        const supabase = createServerClient();

        if (!lat || !lng || !trade) {
            return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
        }

        const apiKey = process.env.GOOGLE_PLACES_API_KEY;
        const geminiKey = process.env.GEMINI_API_KEY;

        if (!geminiKey) {
            console.error("GEMINI_API_KEY is missing");
            throw new Error("Gemini API key is not configured");
        }
        
        if (!apiKey) {
            console.error("GOOGLE_PLACES_API_KEY is missing");
            throw new Error("Google Places API key is not configured");
        }

        const radius = customRadius || 25000; // Default 25km

        const genAI = new GoogleGenerativeAI(geminiKey || "");
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.0-flash",
            generationConfig: {
                temperature: 0.1,
                topP: 0.8,
                topK: 40,
            }
        });

        // 1. Normalize the trade into a robust search query
        let searchQuery = `${trade} service provider`;
        try {
            const normalizationPrompt = `
Convert the following home maintenance trade/speciality into a single, highly effective Google Maps search query.
Focus on getting the most relevant business results.

Trade: ${trade}

Output ONLY the search query string. No quotes, no explanation.
Example Input: "Leaking Pipe/Plumbing" -> Output: Plumber
Example Input: "Gate Technician/Electrician" -> Output: Gate Repair Service
Example Input: "Roofing/Guttering" -> Output: Roofing Contractor`;

            const result = await model.generateContent(normalizationPrompt);
            const normalized = result.response.text().trim().replace(/["']/g, "");
            if (normalized && normalized.length > 2) {
                searchQuery = normalized;
            }
        } catch (e) {
            console.error("Trade normalization failed, using fallback:", e);
        }

        // 2. Fetch providers from Google Places API
        const url = `https://places.googleapis.com/v1/places:searchText`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": apiKey || "",
                "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.addressComponents,places.rating,places.userRatingCount,places.nationalPhoneNumber,places.websiteUri,places.location,places.editorialSummary,places.types,places.reviews"
            },
            body: JSON.stringify({
                textQuery: searchQuery,
                locationBias: {
                    circle: {
                        center: { latitude: lat, longitude: lng },
                        radius: radius
                    }
                },
                maxResultCount: 6
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Google Places API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        const places = data.places || [];
        if (places.length === 0) {
            return NextResponse.json({ providers: [] });
        }

        // 3. Caching Logic: Check which providers are already analyzed
        const placeIds = places.map((p: any) => p.id);
        const { data: cachedData } = await supabase
            .from('cached_providers')
            .select('*')
            .in('place_id', placeIds);

        const cachedMap = new Map(cachedData?.map(item => [item.place_id, item]));
        const missingPlaces = places.filter((p: any) => !cachedMap.has(p.id));

        let aiResults: any[] = [];
        if (missingPlaces.length > 0) {
            const providersContext = missingPlaces.map((place: any) => {
                const reviews = place.reviews?.map((r: any) => r.text?.text).filter(Boolean).slice(0, 3) || [];
                return {
                    place_id: place.id,
                    name: place.displayName?.text || "Unknown",
                    description: place.editorialSummary?.text || "N/A",
                    reviews: reviews
                };
            });

            const batchPrompt = `
Analyse the following list of ${providersContext.length} home service providers.
For each provider, perform the following tasks:
1. Format the company name in Title Case (e.g. "Kin Electrical" instead of "kin electrical"). Keep acronyms like "DNSD" capitalised.
2. Provide a single, punchy, engaging summary sentence (max 20 words) focusing on their strengths. CRITICAL: DO NOT include the company name in the summary.
3. List exactly 3 specific service categories/specialities they offer (e.g. "Boiler Repair").

CRITICAL: 
- Use British English.
- Output raw JSON ONLY. 
- FORMAT: {"results": [{"place_id": "...", "name": "...", "summary": "...", "services": ["...", "...", "..."]}, ...]}

DATA:
${JSON.stringify(providersContext, null, 2)}`;

            try {
                const result = await model.generateContent(batchPrompt);
                const responseText = result.response.text().trim();
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    aiResults = parsed.results || [];
                }
            } catch (e) {
                console.error("Batch AI processing failed:", e);
            }
        }

        // 4. Map results back and identify new data to cache
        const toCache: any[] = [];
        const processedProviders = places.map((place: any) => {
            const isCached = cachedMap.has(place.id);
            const aiData = isCached 
                ? cachedMap.get(place.id) 
                : aiResults.find((r: any) => r.place_id === place.id);
            
            // Safe address formatting
            const components = place.addressComponents || [];
            const getComponent = (type: string) => 
                components.find((c: any) => c.types && Array.isArray(c.types) && c.types.includes(type))?.longText || "";

            const streetNumber = getComponent("street_number");
            const route = getComponent("route");
            const suburb = getComponent("sublocality_level_1") || getComponent("neighborhood");
            const town = getComponent("postal_town") || getComponent("locality");
            const county = getComponent("administrative_area_level_2");

            const shortAddress = [
                streetNumber && route ? `${streetNumber} ${route}` : (route || ""),
                suburb,
                town,
                county
            ].filter(Boolean).join(", ");

            const providerData = {
                place_id: place.id,
                name: aiData?.name || place.displayName?.text || "Unknown Provider",
                address: shortAddress || place.formattedAddress || "Address not available",
                rating: place.rating,
                rating_count: place.userRatingCount,
                phone: place.nationalPhoneNumber,
                website: place.websiteUri,
                latitude: place.location?.latitude,
                longitude: place.location?.longitude,
                summary: aiData?.summary || place.editorialSummary?.text || `Local ${trade} professional.`,
                services: aiData?.services || (place.types?.filter((t: string) => !["point_of_interest", "establishment", "premise", "map"].includes(t)).slice(0, 3) || [])
            };

            // Add to batch cache update if it's new and we have AI data for it
            if (!isCached && aiData) {
                toCache.push(providerData);
            }

            return {
                ...providerData,
                ratingCount: providerData.rating_count // Keep frontend compatibility
            };
        });

        // Batch update the cache in the background (don't await it to keep response fast)
        if (toCache.length > 0) {
            supabase.from('cached_providers').upsert(toCache).then(({ error }) => {
                if (error) console.error("Background cache update failed:", error);
            });
        }

        return NextResponse.json({ providers: processedProviders });

    } catch (error: any) {
        console.error("Places API Error:", error);
        return NextResponse.json({ error: error.message || "Failed to fetch providers" }, { status: 500 });
    }
}
