import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
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
        // Truncate text to 8192 characters (about 4000 words) to avoid OpenAI limits
        console.log(text.slice(0, 20))
        return text.slice(0, 8192) || "No text found on the page.";
    } catch (error: any) {
        //console.error("Error scraping website:", error);
        throw new Error(`Scraping failed: ${error.response?.data || error.message || error}`);
    } finally {
        await browser.close();
    }
}

async function storeInSupabase(url: string, text: string, embedding: number[], supabase: SupabaseClient<any, "public", any>) {
    try {
        const { error } = await supabase
            .from("webpages_test")
            .insert([{ url, content: text, embedding }]);

        if (error) throw error;
    } catch (error: any) {
        throw new Error(`Supabase storage failed: ${error.response?.data || error.message || error}`);
    }
}

export async function POST(req: NextRequest) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;  //type assertion
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Required for inserting vector data

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const storedMetadata: Record<string, string> = {}; // Store text with URLs
        const urlToIndex: Record<number, string> = {}; // FAISS index -> URL mapping
        const embeddingsList: Float32Array[] = []; // To store embeddings


        const { url } = await req.json();
        if (!url || typeof url !== "string" || !/^https?:\/\/[\w.-]+(?:\.[\w.-]+)+[/\w.-]*$/.test(url)) {
            return new Response(JSON.stringify({ error: "Invalid URL format" }), { status: 400 });
        }

        // Checks whether the url exists and is accessible.
        const response = await fetch(url, { method: "HEAD" });
        if (!response.ok) {
            return new Response(JSON.stringify({ error: "URL is unreachable" }), { status: 404 });
        }

        // Check the db for matches with the current url
        const { data: existingPage, error: selectError } = await supabase
            .from("webpages_test")
            .select("*")
            .eq("url", url)
            .single();

        // Checks to make sure the db is accessible
        if (selectError && selectError.code !== "PGRST116") {
            return new Response(JSON.stringify({ error: "Database Error" }), { status: 404 });
        }

        // Switch tabs when duplicate urls are entered(no db update)
        if (existingPage) {
            //return new Response(JSON.stringify({ error: "URL already exists in the database" }), { status: 404 });
            return NextResponse.json({ message: "URL already exists in the database", url });
        }

        const scrapedText = await scrapeWebsite(url);
        //console.log("Scraped Text Length:", scrapedText.length);
        // Already checking for errors in the function but double checking just in case.
        if (!scrapedText || scrapedText.length < 10) {
            return new Response(JSON.stringify({ error: "Scraped content is either too short or empty" }), { status: 404 });
        }

        //const embeddingResponse = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/embed`, {
        /*const embeddingResponse = await fetch(`/api/embed`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: scrapedText }),
        });
        //const embedding = await getTextEmbedding(scrapedText) as number[];
        // Already checking for errors in the function but double checking just in case
        if (!embeddingResponse.ok) {
            return new Response(JSON.stringify({ error: "Failed to generate scraped contents embedding" }), { status: 404 });
        }*/


        // Converts Float32Array to number[]
        const paragraphEmbeddingsAsArray = Array.from(paragraph_embeddings);


        // Add embeddings2D to the embeddings list
        //const embeddings2DArray = [...embeddings2D];
        //embeddingsList.push(embeddings2D);

        await storeInSupabase(url, scrapedText, paragraphEmbeddingsAsArray, supabase);
        // Store the scraped metadata with the URL
        storedMetadata[url] = scrapedText;
        urlToIndex[embeddingsList.length - 1] = url;

        return NextResponse.json({ message: "Scraped, embedded and stored successfully", url });
    }
    catch (error: any) {
        console.error("Scraping API Error:", error);
        return NextResponse.json({
            error: error.message || "Internal server error",
            stack: process.env.NODE_ENV === "development" ? error.stack : null,
            //stack: error.stack || null
        }, { status: 500 });
    }
};

//const hard_coded_paragraph = "In the ever-evolving world of technology, artificial intelligence has become a cornerstone of innovation. From autonomous vehicles to personalized recommendations, AI is transforming industries and reshaping the way we live and work. As algorithms become more sophisticated, the potential for AI to revolutionize fields like healthcare, finance, and education continues to grow. With every breakthrough, new opportunities arise for businesses and individuals alike, but the question remains: how will we responsibly harness its power?"

const paragraph_embeddings = new Float32Array([
    -0.025407724, 0.005144218, -0.014828739, 0.03149142, 0.017037634, 0.033317633, -0.010614063, -0.004778364, 0.042132147, -0.045932062, -0.08013085, 0.07921911, 0.0010898246, 0.020781076, -0.055672154, 0.06254317, -0.00024526526, -0.017419452, -0.118817054, -0.089971215, -0.0063512158, 0.002290008, 0.026392704, -0.05809822, -0.011417094, 0.045758713, -0.03796841, -0.11586696, -0.02059851, -0.06520997, 0.076039486, -0.048224516, 0.051511977, 0.01858042, -0.056356683, 0.03678565, 0.029798755, 0.013186115, 0.07108466, -0.011303637, 0.008619177, -0.12850139, -0.034025487, -0.0018586466, 0.07865883, 0.02326143, -0.005289682, 0.033702906, 0.03971438, 0.0046062768, -0.15004878, -0.050863788, 0.01204381, -0.034922086, -0.07510604, 0.053055126, 0.034957666, 0.00999261, -0.020189986, -0.028794877, 0.009868826, -0.048279237, 0.051192183, 0.01879604, 0.001943486, -0.00096528104, -0.040424652, 0.02875162, -0.06109143, 0.056847952, 0.06924497, 0.022727568, -0.0020371862, -0.008256552, 0.04530313, -0.002893731, 0.0022159244, -0.008313516, 0.11157927, -0.01408599, 0.03339874, 0.011772019, 0.007899265, 0.10637893, 0.0064589335, 0.022207411, 0.0037942438, -0.033639777, 0.041594397, -0.0063082892, -0.055205386, -0.061581563, -0.025797317, -0.0539613, 0.03593174, 0.029702364, -0.060615472, -0.09490152, -0.049086057, 0.04181966, -0.008239422, 0.020186612, 0.007878075, -0.04909311, -0.048148353, 0.0053286534, 0.02398177, 0.057145637, 0.07416, -0.0428555, 0.039515264, 0.04832806, 0.030991742, -0.043377716, -0.015918458, 0.016411202, -0.08820233, 0.04475658, 0.062486656, 0.06142073, -0.029422376, 0.055823855, -0.005968823, -0.0031755555, -0.0037308857, 0.034697156, -0.0733742, 2.612583e-34, -0.13665113, 0.056055848, 0.11695559, 0.05918607, -0.0053410083, -0.05108604, -0.059611138, -0.045614798, -0.05105302, 0.03232981, 0.0011547421, 0.095099576, 0.025994336, 0.060967516, 0.034662493, -0.04747212, -0.021962555, 0.013235938, 0.036157716, -0.057593536, 0.08141197, -0.061201364, 0.0055012223, -0.014778931, 0.015118551, 0.025586033, 0.019937132, 0.017385513, 0.13259631, -0.0047430587, 0.044269897, 0.05594907, -0.058337767, -0.043017704, -0.062787555, -0.028854718, -0.0579494, -0.0144556705, 0.01672535, 0.055228766, 0.012948756, 0.045050245, -0.0026387046, -0.05099331, -0.027334403, 0.037763204, 0.07177131, -0.012580397, -0.054699946, -0.0133616505, -0.015699062, 0.010427518, -0.017381893, -0.030378327, -0.0004066849, -0.04505952, -0.060811546, -0.018632341, 0.018936926, -0.10652197, 0.03489247, -0.09590366, -0.025476871, 0.11754096, 1.14471595e-05, 0.058390044, 0.079713665, 0.013785696, 0.035150573, 0.057757568, 0.016746946, -0.0032752869, -0.038433846, -0.040779024, -0.018237624, 0.026305694, 0.004397984, -0.11377294, 0.012149548, -0.022196816, -0.09076337, 0.008123108, 0.021168502, 0.043139745, 0.12846175, 0.0104512535, -0.018336937, 0.005415249, 0.016637765, 0.05515723, -0.09334061, -0.011490139, -0.065282404, 0.071993, -0.003858606, -2.6305773e-33, -0.0013340982, -0.041465994, -0.0037946247, 0.029003838, 0.032028608, -0.03237337, -0.060691092, -0.101176195, 0.045696143, 0.040455364, -0.07554787, -0.0345514, 0.04735886, -0.00012610467, 0.047944874, -0.009870233, 0.026994323, -0.03132992, -0.034603436, -0.022236036, 0.050697528, 0.07711078, 0.006613142, 0.024559999, 0.026796501, 0.053069618, -0.1148818, 0.052550558, 0.023518922, 0.016191475, -0.09253195, -0.0129471, -0.056227624, 0.05237989, -0.041077573, 0.08802307, -0.023632877, -0.040213075, -0.03176192, 0.060650736, 0.046309046, -0.02754954, -0.07182907, -0.041786596, 0.035665505, -0.02934081, -0.024384685, 0.024911702, 0.027809568, -0.041658342, 0.041333485, -0.005923364, -0.038848117, -0.029512584, -0.09472207, 0.067177504, 0.0931634, -0.0042996043, 0.0102822, 0.103846624, -0.050110016, -0.0924614, -0.007485899, 0.07069595, -0.0644215, 0.0006376206, 0.05409247, 0.024329117, -0.061527632, -0.042070232, 0.0340537, -0.004853289, -0.016288357, 0.0358976, -0.104308926, 0.04924914, 0.0045223874, -0.037851892, -0.050552357, -0.012589737, 0.087397985, -0.08268859, 0.042995803, -0.04499363, 0.005034688, 0.018157052, 0.05822268, -0.052972935, 0.009960687, -0.027011853, -0.102509096, 0.0059440127, -0.11607962, 0.009788985, -0.14181644, -4.9475744e-08, -0.058120802, -0.016148053, 0.047272827, 0.037457652, 0.08760681, -0.027965596, -0.026161551, 0.08276773, -0.024774399, -0.015249346, 0.034225732, -0.07070706, 0.077559285, 0.093325205, 0.12439429, 0.06909616, 0.012235756, 0.018456373, -0.017000642, -0.009499622, 0.052377045, -0.04663086, 0.019259779, 0.005840923, 0.042412087, -0.04504895, -0.008539758, -0.011088134, 0.004977769, 0.12612644, -0.008579689, -0.0024432766, 0.019911872, 0.011348935, -0.011405224, 0.011557491, -0.0012041815, -0.03475839, -0.041795183, -0.076369084, 0.0238288, 0.10760415, -0.03631034, -0.010407038, -0.00083520473, -0.0007071901, -0.049837895, -0.029863238, 0.028443126, 0.02367085, 0.0087653175, -0.064299025, 0.081480354, 0.019693678, 0.11721814, -0.001780461, 0.052416854, -0.02569073, -0.062441986, 0.085758954, 0.01518258, -0.04050669, 0.040961426, -0.0788511
]);