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

export default function Chat() {
    const [activeTab, setActiveTab] = useState("scraper");

    const [scrapeUrl, setScrapeUrl] = useState("")
    const [scrapeErrorMessage, setScrapeErrorMessage] = useState("")
    const [isScraping, setIsScraping] = useState(false);

    const [promptErrorMessage, setPromptErrorMessage] = useState("");
    const [userMessage, setUserMessage] = useState("")
    const [chatHistory, setChatHistory] = useState<{ role: "user" | "bot"; text: string }[]>([])
    const [isPrompting, setIsPrompting] = useState(false);

    const [error, setError] = useState("");
    const [response, setResponse] = useState("");

    const inputRef = useRef<HTMLInputElement>(null);
    const chatEndRef = useRef<null | HTMLDivElement>(null);

    //fetches api
    async function fetchInternalAPI(endpoint: string, payload: any) {
        try {
            const res = await fetch(`/api/${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) {
                console.error(`Error in ${endpoint} API:`, {
                    status: res.status,
                    statusText: res.statusText,
                    errorMessage: data.error || "Unknown error",
                    stack: data.stack || "No stack trace",
                });
                throw new Error(data.error || `API error: ${res.status} - ${res.statusText}`);
            }
            return data;
        } catch (error: any) {
            console.error(`Network or API error in ${endpoint}:`, error);
            return { error: error.message || "An unknown error occurred" };
        }
    }

    //Sends url
    const handleSendUrl = async () => {
        setResponse("");
        setError("");
        setScrapeErrorMessage("");

        if (!scrapeUrl.trim()) {
            setScrapeErrorMessage("Please enter a valid URL");
            return;
        }
        setIsScraping(true);

        const data = await fetchInternalAPI("scrape", { url: scrapeUrl });
        //const data = await fetchInternalAPI("test", {});
        if (data?.error) {
            setError(data.error);  //Mainly for showing the error in the frontend.
        } else {
            setResponse("Scraping successful!");  //Mainly for showing the success in the frontend.
            setActiveTab("chat"); // Move to chat tab
        }

        setIsScraping(false);
    };

    //Sends message
    const handleSendMessage = async () => {
        setError("");
        setPromptErrorMessage("");

        if (!userMessage.trim()) {
            setPromptErrorMessage("Please enter a valid prompt");
            return;
        }
        setIsPrompting(true);

        const currentMessage = userMessage;
        // Clears input field immediately.
        setUserMessage("");
        setChatHistory(prev => [...prev, { role: "user", text: currentMessage }]);

        const data = await fetchInternalAPI("chat", { userMessage: currentMessage });
        if (data?.error) {
            setError(data.error); //Mainly for showing the error in the frontend.
        } else {
            const relevantContext = data?.matches?.join("\n") || "No relevant data found.";

            const llmResponse = await fetchInternalAPI("chat", {
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

    useEffect(() => {
        if (scrapeErrorMessage || promptErrorMessage) {
            const timer = setTimeout(() => {
                setScrapeErrorMessage("");
                setPromptErrorMessage("");
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [scrapeErrorMessage, promptErrorMessage]);

    //brings the attention to the latest chat message
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatHistory]);

    //change active tab after scraping
    useEffect(() => {
        if (activeTab === "chat") {
            inputRef.current?.focus();
        }
    }, [activeTab]);

    return (
        <div className="flex items-center justify-center h-screen">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-[80%]">

                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="scraper">Scraper</TabsTrigger>
                    <TabsTrigger value="chat">Chat</TabsTrigger>
                </TabsList>

                {/* Scraper Tab */}
                <TabsContent value="scraper">
                    <Card>
                        <CardHeader>
                            <CardTitle>Web Scraper</CardTitle>
                            <CardDescription>
                                Paste your URL to scrape its data
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="space-y-1">
                                {/* Decide whether to remove this label later */}
                                <Label htmlFor="user_url">URL</Label>
                                {/* Displays an error message if the scrapeErrorMessage state is not empty. */}
                                <Input
                                    id="user_url"
                                    value={scrapeUrl}
                                    onChange={(e) => setScrapeUrl(e.target.value)}
                                    placeholder="https://www.google.com/robots.txt"
                                //defaultValue="https://www.google.com/robots.txt"
                                />
                                {scrapeErrorMessage && <p className="text-red-500 text-sm">{scrapeErrorMessage}</p>}
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col items-end gap-2">
                            {/* Disables the button during scraping. */}
                            <Button
                                onClick={handleSendUrl}
                                disabled={isScraping}
                            >
                                {isScraping ? "Scraping..." : "Scrape"}
                            </Button>
                            {response && <p className="text-green-500">{response}</p>}
                            {error && <p className="text-red-500">{error}</p>}
                        </CardFooter>
                    </Card>
                </TabsContent>

                {/* Chat Tab */}
                <TabsContent value="chat">
                    <Card>
                        <CardHeader>
                            <CardTitle>Chat Bot</CardTitle>
                            <CardDescription>
                                Chat with the RAG Agent that has the scraped data.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {/* Chat History Display */}
                            <div className="h-48 overflow-y-auto p-2 border border-gray-300 rounded flex flex-col gap-2">
                                {
                                    chatHistory.map((msg, index) => (
                                        <div key={index} className={`p-2 rounded-lg max-w-[80%] ${msg.role === "user" ? "bg-blue-100 self-end text-right" : "bg-gray-100 self-start text-left"}`}>
                                            <strong>{msg.role === "user" ? "You: " : "Bot: "}</strong>
                                            {msg.text}
                                        </div>
                                    ))}
                            </div>
                            <div className="space-y-1">

                                <Input
                                    id="user_input"
                                    value={userMessage}
                                    ref={inputRef}
                                    onChange={(e) => setUserMessage(e.target.value)}
                                    placeholder="What did you find in the url?"
                                />
                                {promptErrorMessage && <p className="text-red-500 text-sm">{promptErrorMessage}</p>}
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col items-end gap-2">
                            <Button
                                onClick={handleSendMessage}
                                disabled={isPrompting}
                            >
                                {isPrompting ? "Thinking..." : "Prompt"}
                            </Button>
                            {error && <p className="text-red-500">{error}</p>}
                        </CardFooter>
                    </Card>
                </TabsContent>
            </Tabs>
            <div ref={chatEndRef} />
        </div>
    )
}
