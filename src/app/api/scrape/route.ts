import * as cheerio from 'cheerio'; // Cheerio library is exported using module.exports rather than export default
import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

async function scrapeWebsiteCheerio(url: string): Promise<string> {
    try {
        // Checks whether the url exists and is accessible by directly fetching the HTMl.
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch the URL: ${url} with status: ${response.status}`);
        }

        // Specifically handles { content-type: text/plain } since playwright did it by default but cheerio doesn't
        const contentType = response.headers.get("content-type") || "";
        const isPlainText = contentType.includes("text/plain");
        if (isPlainText) {
            const plainText = await response.text();
            /*
            const plainText = plainText.slice(0, 8192);
            if (!plainText || plainText.length < 10) {
                throw new Error(`Scraped content is too short or empty for: ${url}`);
            }
            return plainText;
            */
            return plainText;
        }

        // Specifically handles { content-type: text/html } since it's what cheerio handles by default
        if (!contentType.includes("text/html")) {
            throw new Error(`Unsupported content type: ${contentType}`);
        }

        const html = await response.text();
        //console.log(html)
        const $ = cheerio.load(html);  // $ is a naming convention for the cheerio object
        const htmlBody = $('body')
            .find('*:not(script):not(style):not(meta):not(link):not(head)')
            .map((_index: any, element: any) => $(element).text().trim())  // index is unused, So prefixed it with _
            .get() // Converts mapping result into an array
            .join(' '); // Joins array into a single string

        if (!htmlBody) {
            throw new Error("CHEERIO FAILED");
        }
        /*
        const truncatedHtml = htmlBody.slice(0, 8192);
        if (truncatedHtml.length < 10) {
            throw new Error("CHEERIO FAILED");
            //throw new Error(`Scraped content is too short or empty for: ${url}`);
        }
        return truncatedHtml;
        */
        // Trying to keep Entire HTML Body for knowledge base
        return htmlBody;
    } catch (error: any) {
        if (error.message === "CHEERIO FAILED") {
            throw new Error("Cheerio was unable to extract meaningful content. A headless browser like playwright may be required.");
        }
        throw new Error(`Scraping failed for URL: ${url} Error: ${error.response?.data || error.message || error}`);
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
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Required for inserting into vector data columns

        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { url } = await req.json();
        //console.log("Received URL:", url);
        try {
            new URL(url); // Ensures valid URL format
        } catch {
            return new Response(JSON.stringify({ error: "Invalid URL format" }), { status: 400 });
        }

        // Scans the db for matches with the current url
        const { data: existingPage, error: selectError } = await supabase
            .from("webpages_1")
            .select("*")
            .eq("url", url)
            .single();

        // Checks whether the supabase db exists and is accessible
        if (selectError && selectError.code !== "PGRST116") {
            return new Response(JSON.stringify({ error: "Database Error" }), { status: 500 });
        }

        // Switch tabs like usual when entered url already exists in the db(no db update, no error returned)
        if (existingPage) {
            return NextResponse.json({ message: "URL already exists in the database", url });
        }

        const scrapedText = await scrapeWebsiteCheerio(url);
        //console.log("Scraped Text Length:", scrapedText.length);

        // Truncate text to enforce the 10,000-byte limit(for Gemini API)
        // Emojis may cause this to overflow
        const truncatedText = scrapedText.slice(0, 9000);

        if (scrapedText !== truncatedText) {
            console.log("Some of the scraped text is being truncated for the Gemini APi")
        }

        // Make sure to set the url in env of the production environment
        const embeddingResponse = await fetch(`${process.env.PROD_URL}/api/embed`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: truncatedText }),
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
            error: error.message,
            stack: process.env.NODE_ENV === "development" ? error.stack : null,
        }, { status: 500 });
    }
};