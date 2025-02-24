import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
    try {
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY is missing in environment variables");
        }
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        //const dimension = 768; // Gemini embedding output dimension size (text-embedding-004)
        //const token_limit = 2048 // Gemini embedding input token limit (text-embedding-004)
        const { text } = await req.json();
        if (!text) {
            return new Response(JSON.stringify({ error: "Failed to get the text to be embedded" }), { status: 404 });
        }

        const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
        console.log("Sending text to Google Embeddings:", text.slice(0, 200));

        const result = await model.embedContent(text);
        const embedding_values = result.embedding.values; // Extract the embedding array
        //console.log("Google Embeddings Response:", embedding_values);
        return NextResponse.json({ embedding_values }, { status: 200 });
    } catch (error: any) {
        throw new Error(`Error generating embeddings:, ${error.response?.data || error.message || error}`);
    }
}