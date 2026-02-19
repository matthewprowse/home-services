import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    // if "next" is in search params, use it as the redirection URL
    const next = searchParams.get("next") ?? "/";

    if (code) {
        const supabase = await createSupabaseServerClient();
        if (!supabase) {
            console.error("Auth callback: Supabase client initialization failed");
            return NextResponse.redirect(`${origin}/auth/auth-code-error`);
        }
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            // Check if there's a redirection next param
            return NextResponse.redirect(`${origin}${next}`);
        }
        console.error("Auth callback error:", error);
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
