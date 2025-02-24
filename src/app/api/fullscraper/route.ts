import * as cheerio from 'cheerio';
import { NextRequest } from "next/server";

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
            const text = await response.text();
            const plainText = text.slice(0, 8192);  // Can never return an undefined string
            if (plainText.length < 10) {
                throw new Error(`Scraped content is too short or empty for: ${url}`);
            }
            return plainText;
        }

        // Specifically handles { content-type: text/html } since it's what cheerio handles by default
        if (!contentType.includes("text/html")) {
            throw new Error(`Unsupported content type: ${contentType}`);
        }

        const html = await response.text();
        //console.log(html)
        const $ = cheerio.load(html);  // $ is a naming convention for the cheerio object
        const htmlBody = $('body').text().trim();
        if (!htmlBody) {
            throw new Error("CHEERIO FAILED");
        }
        /*
        const truncatedHtml = html.slice(0, 8192);
        if (truncatedHtml.length < 10) {
            throw new Error("CHEERIO FAILED");
            //throw new Error(`Scraped content is too short or empty for: ${url}`);
        }
        return truncatedHtml;
        */
        // Trying to keep Entire HTML for users reference
        return html;
    } catch (error: any) {
        if (error.message === "CHEERIO FAILED") {
            throw new Error("Cheerio was unable to extract meaningful content. A headless browser like playwright may be required.");
        }
        throw new Error(`Scraping failed for URL: ${url} Error: ${error.response?.data || error.message || error}`);
    }
}

export async function POST(req: NextRequest) {
    try {
        const { url } = await req.json();
        //console.log("Received URL:", url);
        try {
            new URL(url);
        } catch {
            return new Response(JSON.stringify({ error: "Invalid URL format" }), { status: 400 });
        }

        try {
            const fullyScrapedText = await scrapeWebsiteCheerio(url);
            const response = { message: "Scraped successfully", content: fullyScrapedText };
            return new Response(JSON.stringify(response), { status: 200, headers: { "Content-Type": "application/json" } });
            //console.log("Response being sent:", response);
        } catch (cheerioError: any) {
            if (cheerioError.message.includes("Cheerio was unable to extract meaningful content. A headless browser like playwright may be required.")) {
                console.warn(`Switch to Playwright for: ${url}`);
            }
            return new Response(JSON.stringify({ error: cheerioError.message }), { status: 400 });
        }
    } catch (error: any) {
        console.error("Full scraper API Error:", error);
        return new Response(
            JSON.stringify({
                error: error.message || "Internal server error",
                stack: process.env.NODE_ENV === "development" ? error.stack : null,
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}

