import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { address, lat: inputLat, lng: inputLng } = body;

        const apiKey = process.env.GOOGLE_PLACES_API_KEY;
        let url = "";

        if (address) {
            url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
        } else if (inputLat && inputLng) {
            url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${inputLat},${inputLng}&key=${apiKey}`;
        } else {
            return NextResponse.json({ error: "Address or coordinates are required" }, { status: 400 });
        }
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.status !== "OK") {
            return NextResponse.json({ error: data.error_message || "Failed to find location" }, { status: 400 });
        }

        const result = data.results[0];
        const location = result.geometry.location;
        const formattedAddress = result.formatted_address;

        return NextResponse.json({ 
            lat: location.lat, 
            lng: location.lng, 
            address: formattedAddress 
        });

    } catch (error: any) {
        console.error("Geocoding Error:", error);
        return NextResponse.json({ error: "Failed to geocode address" }, { status: 500 });
    }
}
