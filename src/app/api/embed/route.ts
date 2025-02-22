import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";

export async function POST(req: NextRequest) {
    try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        //const dimension = 1536; // OpenAI embedding size (text-embedding-3-small)
        const { text } = await req.json();
        if (!text) {
            return new Response(JSON.stringify({ error: "Empty text provided for embedding." }), { status: 404 });
            //return NextResponse.json({ error: "Empty text provided for embedding." }, { status: 400 });
        }
        console.log("Sending text to OpenAI:", text.slice(0, 100));

        const embedding = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: text,
            encoding_format: "float",
        });

        console.log("OpenAI Response:", embedding);
        return NextResponse.json({ embedding: embedding.data[0].embedding }, { status: 200 });
    } catch (error: any) {
        //console.error("Error generating embeddings:", error.response?.data || error.message || error);
        throw new Error(`Error generating embeddings:, ${error.response?.data || error.message || error}`);
        /*return NextResponse.json(
            { error: error.response?.data || error.message || "Internal server error" },
            { status: 500 }
        );*/
    }
}