import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
    try {
        const { lat, lng, trade, radius: customRadius } = await req.json();
        const supabase = await createSupabaseServerClient();

        if (!lat || !lng || !trade) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const apiKey = process.env.GOOGLE_PLACES_API_KEY;
        const geminiKey = process.env.GEMINI_API_KEY;

        if (!geminiKey) {
            console.error('GEMINI_API_KEY is missing');
            throw new Error('Gemini API key is not configured');
        }

        if (!apiKey) {
            console.error('GOOGLE_PLACES_API_KEY is missing from environment variables');
            return NextResponse.json(
                { error: 'Google Places API key is not configured' },
                { status: 500 }
            );
        }

        console.log(
            `Using API Key starting with: ${apiKey.substring(0, 6)}... (Length: ${apiKey.length})`
        );

        const radius = customRadius || 25000; // Default 25km

        const genAI = new GoogleGenerativeAI(geminiKey || '');
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            generationConfig: {
                temperature: 0.1,
                topP: 0.8,
                topK: 40,
            },
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
            const normalized = result.response.text().trim().replace(/["']/g, '');
            if (normalized && normalized.length > 2) {
                searchQuery = normalized;
            }
        } catch (e) {
            console.error('Trade normalization failed, using fallback:', e);
        }

        // 2. Fetch providers from Google Places API
        const url = `https://places.googleapis.com/v1/places:searchText`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask':
                    'places.id,places.displayName,places.formattedAddress,places.addressComponents,places.rating,places.userRatingCount,places.nationalPhoneNumber,places.websiteUri,places.location,places.editorialSummary,places.types,places.reviews,routingSummaries,places.regularOpeningHours',
            },
            body: JSON.stringify({
                textQuery: searchQuery,
                routingParameters: {
                    origin: {
                        latitude: lat,
                        longitude: lng,
                    },
                },
                locationBias: {
                    circle: {
                        center: { latitude: lat, longitude: lng },
                        radius: radius,
                    },
                },
                maxResultCount: 10,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Google Places API Error Details: ${errorText}`);
            throw new Error(`Google Places API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        const places = data.places || [];
        const routingSummaries = data.routingSummaries || [];
        if (places.length === 0) {
            return NextResponse.json({ providers: [] });
        }

        // 3. Caching Logic: Check which providers are already analyzed
        const placeIds = places.map((p: any) => p.id);
        let cachedData = [];
        if (supabase) {
            const { data } = await supabase
                .from('cached_providers')
                .select('*')
                .in('place_id', placeIds);
            cachedData = data || [];
        }

        const cachedMap = new Map(cachedData?.map((item) => [item.place_id, item]));
        const missingPlaces = places.filter((p: any) => !cachedMap.has(p.id));

        let aiResults: any[] = [];
        if (missingPlaces.length > 0) {
            const providersContext = missingPlaces.map((place: any) => {
                const reviews =
                    place.reviews
                        ?.map((r: any) => ({
                            text: r.text?.text,
                            rating: r.rating,
                        }))
                        .filter((r: any) => r.text)
                        .slice(0, 5) || [];

                return {
                    place_id: place.id,
                    name: place.displayName?.text || 'Unknown',
                    rating: place.rating,
                    rating_count: place.userRatingCount,
                    description: place.editorialSummary?.text || 'N/A',
                    reviews: reviews,
                };
            });

            const batchPrompt = `
Analyse the following list of ${providersContext.length} home service providers.
For each provider, perform the following tasks:
1. Format the company name in Title Case (e.g. "Kin Electrical" instead of "kin electrical"). Keep acronyms like "DNSD" capitalised.
2. Provide a "Customer Summary" (max 30 words). 
   - This must be a balanced, honest overview of their reputation based on the individual reviews provided.
   - Mention both positives and negatives if they appear in the reviews.
   - CRITICAL: Weight the proportion of positive vs negative sentiment in your summary to accurately reflect the provided data. If most reviews are positive but there are common complaints, ensure those complaints are mentioned proportionally.
   - NEVER mention the numeric rating or "stars" in this text. Focus entirely on the feedback content.
   - DO NOT include the company name in the summary.
3. List exactly 5 specific service categories/specialities they offer (e.g. "Boiler Repair").

CRITICAL SERVICE RULES (for the "short" field):
- Service names MUST NOT exceed 15 characters in length.
- Use 1-2 word descriptions that are punchy and professional.
- If a word is too long to fit the 15-character limit, shorten it and append a full stop (e.g., "Maint.", "Install.", "Rep.", "Cert.").
- Ensure services are highly relevant to the trade: ${trade}.
- Aim for high quality and clarity while staying strictly within the 15-character limit.

FORMAT FOR SERVICES:
Provide an object for each service with two fields:
- "short": The shortened name (max 15 chars, professional shortening).
- "full": The full, descriptive name of the service (max 30 chars).

CRITICAL: 
- Use British English.
- Output raw JSON ONLY. 
- FORMAT: {"results": [{"place_id": "...", "name": "...", "summary": "...", "services": [{"short": "...", "full": "..."}, ...]}, ...]}

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
                console.error('Batch AI processing failed:', e);
            }
        }

        // 4. Map results back and identify new data to cache
        const toCache: any[] = [];
        const processedProviders = places.map((place: any, index: number) => {
            const isCached = cachedMap.has(place.id);
            const aiData = isCached
                ? cachedMap.get(place.id)
                : aiResults.find((r: any) => r.place_id === place.id);

            // Safe address formatting
            const components = place.addressComponents || [];
            const getComponent = (type: string) =>
                components.find(
                    (c: any) => c.types && Array.isArray(c.types) && c.types.includes(type)
                )?.longText || '';

            const streetNumber = getComponent('street_number');
            const route = getComponent('route');
            const suburb = getComponent('sublocality_level_1') || getComponent('neighborhood');
            const town = getComponent('postal_town') || getComponent('locality');
            const county = getComponent('administrative_area_level_2');

            const shortAddress = [
                streetNumber && route ? `${streetNumber} ${route}` : route || '',
                suburb,
                town,
                county,
            ]
                .filter(Boolean)
                .join(', ');

            // Extract driving distance from routingSummaries (parallel array to places)
            let distanceText = '';
            const meters = routingSummaries[index]?.legs?.[0]?.distanceMeters;
            if (meters !== undefined) {
                distanceText = (meters / 1000).toFixed(1);
            }

            const providerData = {
                place_id: place.id,
                name: aiData?.name || place.displayName?.text || 'Unknown Provider',
                address: shortAddress || place.formattedAddress || 'Address not available',
                rating: place.rating,
                rating_count: place.userRatingCount,
                phone: place.nationalPhoneNumber,
                website: place.websiteUri,
                latitude: place.location?.latitude,
                longitude: place.location?.longitude,
                isOpen: place.regularOpeningHours?.openNow ?? null,
                summary:
                    aiData?.summary ||
                    place.editorialSummary?.text ||
                    `Local ${trade} professional.`,
                services:
                    aiData?.services ||
                    place.types
                        ?.filter(
                            (t: string) =>
                                !['point_of_interest', 'establishment', 'premise', 'map'].includes(
                                    t
                                )
                        )
                        .slice(0, 5)
                        .map((t: string) => ({ short: t.slice(0, 15), full: t })) ||
                    [],
                distanceText: distanceText,
            };

            // Add to batch cache update if it's new and we have AI data for it
            if (!isCached && aiData) {
                toCache.push(providerData);
            }

            return {
                ...providerData,
                distanceText, // Add driving distance to the final response
                ratingCount: providerData.rating_count, // Keep frontend compatibility
                isOpen: providerData.isOpen,
            };
        });

        // Batch update the cache in the background (don't await it to keep response fast)
        if (toCache.length > 0) {
            createSupabaseAdminClient().then((adminSupabase) => {
                const dbToCache = toCache.map((p) => ({
                    place_id: p.place_id,
                    name: p.name,
                    address: p.address,
                    rating: p.rating,
                    rating_count: p.rating_count,
                    phone: p.phone,
                    website: p.website,
                    latitude: p.latitude,
                    longitude: p.longitude,
                    summary: p.summary,
                    services: p.services,
                }));

                adminSupabase
                    .from('cached_providers')
                    .upsert(dbToCache)
                    .then(({ error }) => {
                        if (error) console.error('Background cache update failed:', error);
                    });
            });
        }

        return NextResponse.json({ providers: processedProviders });
    } catch (error: any) {
        console.error('Places API Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch providers' },
            { status: 500 }
        );
    }
}
