import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
    try {
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY is missing in environment variables");
        }
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

        const { userMessage, context } = await req.json();
        if (!userMessage || typeof userMessage !== "string" || userMessage.trim() === "") {
            return NextResponse.json({ error: "Query is required" }, { status: 400 });
        }
        if (context && typeof context !== "string" && context.trim() === "") {
            return NextResponse.json({ error: "Context is not being passsed properly" }, { status: 400 });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const generationConfig = {
            temperature: 1,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 8192,
            responseMimeType: "text/plain",
        };

        const result = await model.generateContent({
            contents: [{
                role: "user",
                parts: [{ text: context ? `Users prompt to assistant: ${userMessage}\n\nContext:${context}` : userMessage }]
            }],
            generationConfig,
        });
        const reply = result.response.text();
        return NextResponse.json({ llm_reply: reply || "No response." });
    } catch (error: any) {
        console.error("Gemini API Route Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
