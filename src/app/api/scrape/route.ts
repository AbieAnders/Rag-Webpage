import { chromium } from "playwright";
import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

async function scrapeWebsite(url: string): Promise<string> {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
        await page.goto(url, { waitUntil: "domcontentloaded" });
        const text = await page.evaluate(() => {
            return Array.from(document.querySelectorAll("pre, p, h1, h2, h3, h4, h5, h6, div, span, a, li, article, section")) // pre is for the robots.txt page
                .map(p => p.textContent?.trim())
                .filter(Boolean)
                .join(" ");
        });
        // Truncate text to 8192 characters (about 4000 words)
        return text.slice(0, 8192);
    } catch (error: any) {
        throw new Error(`Scraping failed: ${error.response?.data || error.message || error}`);
    } finally {
        await browser.close();
    }
}

async function storeInSupabase(url: string, text: string, embedding: number[], supabase: SupabaseClient<any, "public", any>) {
    try {
        const { error } = await supabase
            .from("webpages_1")
            .insert([{ url, content: text, embedding }]);

        if (error) throw error;
    } catch (error: any) {
        throw new Error(`Supabase storage failed: ${error.response?.data || error.message || error}`);
    }
}

export async function POST(req: NextRequest) {
    try {
        const supabaseUrl = process.env.SUPABASE_URL!;  // ! is the non-null assertion operator
        const supabaseKey = process.env.SUPABASE_ANON_KEY!;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Required for inserting into vector data columns
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { url } = await req.json();
        if (!url || typeof url !== "string" || !/^https?:\/\/[\w.-]+(?:\.[\w.-]+)+[/\w.-]*$/.test(url)) {
            return new Response(JSON.stringify({ error: "Invalid URL format" }), { status: 400 });
        }

        // Checks whether the url exists and is accessible by fetching the header of the response.
        const response = await fetch(url, { method: "HEAD" });
        if (!response.ok) {
            return new Response(JSON.stringify({ error: "URL is unreachable" }), { status: response.status });
        }

        // Scans the db for matches with the current url
        const { data: existingPage, error: selectError } = await supabase
            .from("webpages_1")
            .select("*")
            .eq("url", url)
            .single();

        // Checks whether the supabase db exists and is accessible
        if (selectError && selectError.code !== "PGRST116") {
            return new Response(JSON.stringify({ error: "Database Error" }), { status: 404 });
        }

        // Switch tabs like usual when duplicate urls are entered(no db update, no error returned)
        if (existingPage) {
            return NextResponse.json({ message: "URL already exists in the database", url });
        }

        const scrapedText = await scrapeWebsite(url);
        console.log("Scraped Text Length:", scrapedText.length);
        // Already checking for errors in the function but double checking just in case.
        if (!scrapedText || scrapedText.length < 10) {
            return new Response(JSON.stringify({ error: "Scraped content is either too short or empty" }), { status: 404 });
        }

        //
        // Make sure to change the url for production
        const embeddingResponse = await fetch(`${process.env.PROD_URL}/api/embed`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: scrapedText }),
        });
        if (!embeddingResponse.ok) {
            return new Response(JSON.stringify({ error: "Failed to generate scraped contents embedding" }), { status: 404 });
        }

        const embeddingData = await embeddingResponse.json();
        if (!embeddingData || typeof embeddingData !== "object") {
            throw new Error("Either the API response is empty or not of object(json) type");
        }
        if (!embeddingData.embedding_values || !Array.isArray(embeddingData.embedding_values)) {
            throw new Error("embedding_values field is missing or not an array in API response");
        }

        // Converts any[] to number[]
        const paragraphEmbeddingsAsArray = embeddingData.embedding_values.map((val: unknown) => {
            if (typeof val !== "number") {
                throw new Error("Invalid embedding value generated: Not a number");
            }
            return val;
        });
        await storeInSupabase(url, scrapedText, paragraphEmbeddingsAsArray, supabase);
        return NextResponse.json({ message: "Scraped, embedded and stored successfully", url });
    }
    catch (error: any) {
        console.error("Scraping API Error:", error);
        return NextResponse.json({
            error: error.message || "Internal server error",
            stack: process.env.NODE_ENV === "development" ? error.stack : null,
        }, { status: 500 });
    }
};