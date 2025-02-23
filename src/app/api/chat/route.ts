import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userMessage } = await req.json();
    // Already checking for errors in the frontend but double checking just in case
    if (!userMessage) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    //
    // Make sure to change the url for production
    const embeddingResponse = await fetch(`${process.env.PROD_URL}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: userMessage }),
    });
    if (!embeddingResponse.ok) {
      return new Response(JSON.stringify({ error: "Failed to generate chat msgs embedding" }), { status: 404 });
    }

    const embeddingData = await embeddingResponse.json();
    if (!embeddingData || typeof embeddingData !== "object") {
      throw new Error("Either the API response is empty or not of object(json) type");
    }
    if (!embeddingData.embedding_values || !Array.isArray(embeddingData.embedding_values)) {
      throw new Error("embedding_values field is missing or not an array in API response");
    }

    // Converts any[] to number[]
    const queryEmbeddingsAsArray = embeddingData.embedding_values.map((val: unknown) => {
      if (typeof val !== "number") {
        throw new Error("Invalid embedding value generated: Not a number");
      }
      return val;
    });

    const queryVector = `[${queryEmbeddingsAsArray.join(",")}]`; // Supabase uses `{}` for array storage
    // Perform similarity search in Supabase (using pgvector's cosine similarity)
    // Does an rpc call to a function named match_webpages in the postgreas db
    const { data: matches, error } = await supabase.rpc("match_webpages", {
      query_embedding: queryVector,
      match_threshold: 0.75, // Set a similarity threshold
      match_count: 3,
    });

    if (error) {
      console.error("Search error:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 404 });
    }
    //console.log(matches[0].similarity)
    //console.log(matches[0].embedding)
    const results = matches?.length > 0 ?
      matches.map((match: any) => ({ url: match.url, content: match.content, similarity: match.similarity })) :
      ["No relevant data found."];

    return NextResponse.json({ matches: results });
  } catch (error: any) {
    console.error("Query API Error:", error);
    return NextResponse.json({
      error: error.message || "Internal server error",
      stack: process.env.NODE_ENV === "development" ? error.stack : null,
    }, { status: 500 });
  }
}