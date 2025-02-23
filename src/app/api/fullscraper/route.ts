import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";

async function scrapeWebsite(url: string): Promise<string> {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
        await page.goto(url, { waitUntil: "domcontentloaded" });
        const text = await page.evaluate(() => {
            return Array.from(document.body.querySelectorAll("*:not(style):not(script):not(link):not(meta):not(head)"))
                .map(p => p.textContent?.trim())
                .filter(Boolean)
                .join(" ");
        });
        return text.slice(0, 8192);
    } catch (error: any) {
        throw new Error(`Scraping failed: ${error.message}`);
    } finally {
        await browser.close();
    }
}

export async function POST(req: NextRequest) {
    try {
        const { url } = await req.json();
        console.log("Received URL:", url);

        if (!url || typeof url !== "string" || !/^https?:\/\/[\w.-]+(?:\.[\w.-]+)+[/\w.-]*$/.test(url)) {
            return new Response(JSON.stringify({ error: "Invalid URL format" }), { status: 400 });
        }

        const fullyScrapedText = await scrapeWebsite(url);

        if (!fullyScrapedText || fullyScrapedText.length < 10) {
            return new Response(JSON.stringify({ error: "Scraped content is either too short or empty" }), { status: 404 });
        }

        const response = { message: "Scraped successfully", content: fullyScrapedText };
        console.log("Response being sent:", response);

        return new Response(JSON.stringify(response), { status: 200, headers: { "Content-Type": "application/json" } });
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

