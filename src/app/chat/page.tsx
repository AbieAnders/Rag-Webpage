"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"

// All apis dealt with in the backend(prevents client from seeing api keys).
// No env variable is prefixed with NEXT_PUBLIC_ as a precaution.
export default function Chat() {
    const [activeTab, setActiveTab] = useState("scraper");

    const [scrapeUrl, setScrapeUrl] = useState("")
    const [isScraping, setIsScraping] = useState(false);  // For button

    const [userMessage, setUserMessage] = useState("")
    const [chatHistory, setChatHistory] = useState<{ role: "user" | "bot"; text: string }[]>([])
    const [isPrompting, setIsPrompting] = useState(false);  // For button

    const [uiErrorMessage, setUiErrorMessage] = useState("");
    const [uiSuccessMessage, setUiSuccessMessage] = useState("");

    const [isScrapedTabVisible, setIsScrapedTabVisible] = useState(false);
    const [isChatTabVisible, setIsChatTabVisible] = useState(false);

    const [fullyScrapedContent, setFullyScrapedContent] = useState<string | null>(null);

    const inputRef = useRef<HTMLInputElement>(null);
    const chatEndRef = useRef<null | HTMLDivElement>(null);

    // Fetches all backend api's in a neat way
    // method can be hard coded to POST because its the only request being made right now.
    // payload is optional because of GET requests.
    async function fetchInternalAPI(endpoint: string, method: any, payload?: any) {
        try {
            const res = await fetch(`/api/${endpoint}`, {
                method: method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) {
                console.error(`Error in ${endpoint} API:`, {
                    status: res.status,
                    statusText: res.statusText,
                    errorMessage: data.error,
                    stack: data.stack || "No stack trace",
                });
                throw new Error(data.error || `API error: ${res.status} - ${res.statusText}`);
            }
            return data;
        } catch (error: any) {
            console.error(`Network or API error in /${endpoint} endpoint:`, {
                message: error.message,
                stack: error.stack || "No stack trace",
            });
            return { error: error.message || "An unknown error occurred" };
        }
    }

    // Sends the url for scraping, embedding and storage. 
    const handleSendUrl = async () => {
        setUiSuccessMessage("");
        setUiErrorMessage("");
        if (!scrapeUrl.trim()) {
            //setScrapeErrorMessage("Please enter a valid URL");
            setUiErrorMessage("Please enter a valid URL");
            return;
        }
        setIsScraping(true);

        const data = await fetchInternalAPI("scrape", "POST", { url: scrapeUrl });
        if (data?.error) {
            setUiErrorMessage(data.error);  // For showing the error in the frontend.
        } else {
            setUiSuccessMessage("Scraping successful!");  // For showing the success in the frontend.
            setIsChatTabVisible(true);
            setActiveTab("chat"); // Moves to the chat tab

            const fullscrape = await fetchInternalAPI("fullscraper", "POST", { url: scrapeUrl });
            try {
                //console.log("Raw Fullscrape Response:", fullscrape);
                if (fullscrape?.error) {
                    setUiErrorMessage(fullscrape.error);
                } else if (fullscrape?.content) {
                    setFullyScrapedContent(fullscrape.content);
                    setIsScrapedTabVisible(true);
                } else {
                    setUiErrorMessage("Unexpected API response format");
                }
            } catch (e) {
                setUiErrorMessage("Failed to process Fullscrape API response");
            }
        }
        setIsScraping(false);
    };

    // Sends the users message for similarity matching and then for LLM prompting.
    const handleSendMessage = async () => {
        setUiErrorMessage("");
        if (!userMessage.trim()) {
            setUiErrorMessage("Please enter a valid prompt");
            return;
        }
        setIsPrompting(true);

        const currentMessage = userMessage;
        setUserMessage(""); // Clears the input field
        setChatHistory(prev => [...prev, { role: "user", text: currentMessage }]);

        const response = await fetchInternalAPI("chat", "POST", { userMessage: currentMessage });
        //console.log(response?.matches[0]?.url)
        if (response?.error) {
            setUiErrorMessage(response.error);
        } else {
            const relevantContext = response?.matches?.map((match: any) => match.content).join("\n"); // Extracts only the `content` field
            //console.log(relevantContext)
            const llmResponse = await fetchInternalAPI("llm", "POST", {
                userMessage: currentMessage,
                context: relevantContext
            });

            setChatHistory(prev => [
                ...prev,
                { role: "bot", text: llmResponse?.llm_reply || "Failed to fetch LLM API." }
            ]);
        }

        setIsPrompting(false);
    };

    // Removes error and success messages after 3 seconds
    useEffect(() => {
        if (uiSuccessMessage || uiErrorMessage) {
            const timer = setTimeout(() => {
                setUiSuccessMessage("");
                setUiErrorMessage("");
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [uiSuccessMessage, uiErrorMessage]);

    // Brings the attention to the latest chat message
    useEffect(() => {
        if (chatEndRef.current) {
            setTimeout(() => {
                chatEndRef.current?.scrollTo({ top: chatEndRef.current.scrollHeight, behavior: "smooth" });
            }, 100);
        }
    }, [chatHistory]);

    // Changes active tab to chat after scraping
    useEffect(() => {
        if (activeTab === "chat") {
            inputRef.current?.focus();
        }
    }, [activeTab]);

    return (
        <div className="flex items-center justify-center h-screen">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full max-w-6xl mx-auto">
                <TabsList className="flex flex-wrap w-full space-x-2 justify-center">
                    <TabsTrigger value="scraper">Scraper</TabsTrigger>
                    {isChatTabVisible && (
                        <TabsTrigger value="chat">Chat</TabsTrigger>
                    )}
                    {isScrapedTabVisible && (
                        <TabsTrigger value="scraped">Scraped</TabsTrigger>
                    )}
                </TabsList>

                {/* Scraper Tab */}
                <TabsContent value="scraper">
                    <Card className="p-4 flex flex-col gap-4 w-full max-w-6xl h-[705px]">
                        <CardHeader>
                            <CardTitle>Web Scraper</CardTitle>
                            <CardDescription>Paste your URL to scrape its data</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow overflow-y-auto">
                            <div className="mt-4 space-y-4">
                                <Label htmlFor="user_url">URL</Label>
                                <Input
                                    id="user_url"
                                    value={scrapeUrl}
                                    onChange={(e) => setScrapeUrl(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleSendUrl()}
                                    placeholder="https://www.google.com/robots.txt"
                                    //defaultValue="https://www.google.com/robots.txt"
                                    className="text-base p-3"
                                />
                                {uiSuccessMessage && <p className="text-green-500 text-sm">{uiSuccessMessage}</p>}
                                {uiErrorMessage && <p className="text-red-500 text-sm">{uiErrorMessage}</p>}
                            </div>
                        </CardContent>
                        <CardFooter className="mt-auto flex justify-end">
                            {/* Disables the button during scraping. */}
                            <Button onClick={handleSendUrl} disabled={isScraping} className="h-14 w-full md:w-1/3">
                                {isScraping ? "Scraping..." : "Scrape"}
                            </Button>
                        </CardFooter>
                    </Card>
                </TabsContent>

                {/* Chat Tab */}
                <TabsContent value="chat">
                    <Card className="p-4 flex flex-col gap-4 w-full max-w-6xl h-[705px]">
                        <CardHeader>
                            <CardTitle>Chat Bot</CardTitle>
                            <CardDescription>Chat with the RAG Agent that has the scraped data</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow overflow-y-auto">
                            {/* Chat History Display */}
                            <div ref={chatEndRef} className="h-[300px] lg:h-[400px] overflow-y-auto p-2 border border-gray-300 rounded flex flex-col gap-2">
                                {chatHistory.map((msg, index) => (
                                    <div key={index} className={`p-2 rounded-lg max-w-[80%] text-sm md:text-base ${msg.role === "user" ? "bg-blue-100 self-end text-right" : "bg-green-100 self-start text-left"}`}>
                                        <strong>{msg.role === "user" ? "You: " : "Gemini: "}</strong>
                                        <pre className="whitespace-pre-wrap">{msg.text}</pre>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 space-y-4">
                                <Input
                                    id="user_input"
                                    value={userMessage}
                                    ref={inputRef}
                                    onChange={(e) => setUserMessage(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                                    placeholder="What did you find in the url?"
                                    className="text-base p-3"
                                />
                                {uiSuccessMessage && <p className="text-green-500 text-sm">{uiSuccessMessage}</p>}
                                {uiErrorMessage && <p className="text-red-500 text-sm">{uiErrorMessage}</p>}
                            </div>
                        </CardContent>
                        <CardFooter className="mt-auto flex justify-end">
                            <Button onClick={handleSendMessage} disabled={isPrompting} className="h-14 w-full md:w-1/3">
                                {isPrompting ? "Thinking..." : "Prompt"}
                            </Button>
                        </CardFooter>
                    </Card>
                </TabsContent>

                {/* Scraped Tab */}
                <TabsContent value="scraped">
                    <Card className="p-4 flex flex-col gap-4 w-full max-w-6xl h-[705px]">
                        <CardHeader>
                            <CardTitle>Scraped Content</CardTitle>
                            <CardDescription>
                                Content that was just scraped from the url you pasted
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow overflow-y-auto">
                            <div className="flex-grow h-full overflow-y-auto p-4 border border-gray-300 rounded">
                                <pre className="whitespace-pre-wrap">{fullyScrapedContent}</pre>
                            </div>
                        </CardContent>
                        <CardFooter className="mt-auto flex justify-end">
                            <Button onClick={() => setActiveTab("chat")} className="h-14 w-full md:w-1/3">
                                Go to Chat
                            </Button>
                        </CardFooter>
                    </Card>
                </TabsContent>
            </Tabs>
            <div ref={chatEndRef} />
        </div>
    )
}
