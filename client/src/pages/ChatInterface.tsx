import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { nanoid } from "nanoid";
import { apiRequest } from "@/lib/queryClient";
import { Message, Suggestion, StreamChunk } from "@/lib/types";
import WelcomeMessage from "@/components/WelcomeMessage";
import ChatInput from "@/components/ChatInput";
import SuggestionChips from "@/components/SuggestionChips";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [showWelcome, setShowWelcome] = useState(true);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  // Initialize speech synthesis
  const { speak, cancel, voiceEnabled, voiceInputUsed, markVoiceInputUsed } =
    useSpeechSynthesis();

  // Fetch chat history when component mounts
  const { data: historyData } = useQuery({
    queryKey: ["chatHistory"],
    queryFn: async () => {
      try {
        console.log("Fetching chat history from server...");
        const response = await fetch("/api/chat/history");
        if (!response.ok) {
          throw new Error("Failed to fetch chat history");
        }
        const data = await response.json();
        console.log("Received chat history:", data);
        return data;
      } catch (error) {
        console.error("Error fetching chat history:", error);
        return { messages: [] };
      }
    },
    enabled: !historyLoaded, // Only run once
  });

  // Query for initial chat state/settings - disabled to prevent API call on page load
  // const { data: chatSettings } = useQuery<ChatSettings>({
  //   queryKey: ['/api/chat/settings'],
  //   enabled: true
  // });

  // Default suggestions if API hasn't returned yet
  // These will be replaced by the server-side suggestions when the API is enabled
  const defaultSuggestions: Suggestion[] = [
    {
      id: 1,
      text: "What services do you offer?",
      icon: "question-circle",
    },
    {
      id: 2,
      text: "How do I get started?",
      icon: "rocket",
    },
    { id: 3, text: "Tell me about pricing tiers", icon: "dollar-sign" },
    {
      id: 4,
      text: "What are the benefits of your platform?",
      icon: "file-contract",
    },
    { id: 5, text: "How do I contact support?", icon: "paper-plane" },
  ];

  // Use only the default suggestions since we disabled the API call
  const suggestions = defaultSuggestions;

  // Mutation for sending regular (non-streaming) messages (currently unused)
  const { isPending } = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest("POST", "/api/chat/message", {
        message,
      });
      return response.json();
    },
    onSuccess: (data) => {
      // Add the assistant response to messages
      const assistantMessage: Message = {
        id: nanoid(),
        text: data.answer,
        sender: "assistant",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to get a response: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        variant: "destructive",
      });

      // Add a message about the error
      const errorMessage: Message = {
        id: nanoid(),
        text: "I'm sorry, I couldn't process your request. Please try again later.",
        sender: "assistant",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
      setIsProcessing(false);
    },
  });

  // Function to send a streaming message
  const sendStreamingMessage = async (message: string) => {
    setIsProcessing(true);

    try {
      // Add placeholder message for the streaming response
      const placeholderMsgId = nanoid();
      setMessages((prev) => [
        ...prev,
        {
          id: placeholderMsgId,
          text: "",
          sender: "assistant",
          timestamp: new Date(),
          isStreaming: true,
          lastUserMessage: message, // Store the user message for retry functionality
        },
      ]);

      // Create EventSource for SSE connection
      const encodedMessage = encodeURIComponent(message);
      const eventSource = new EventSource(
        `/api/chat/message/stream?message=${encodedMessage}`
      );

      // Set a timeout for the connection (30 seconds)
      const connectionTimeout = setTimeout(() => {
        // If we haven't received a response in 30 seconds, consider it a timeout
        console.error("Connection timeout after 30 seconds");

        // Update placeholder with timeout error
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === placeholderMsgId
              ? {
                  ...msg,
                  text: "Connection timeout. The server took too long to respond.",
                  isStreaming: false,
                  isError: true,
                }
              : msg
          )
        );

        // Close the connection
        eventSource.close();
        setIsProcessing(false);
      }, 30000); // 30 seconds timeout

      // Track the ongoing streaming message to update it
      let currentContent = "";

      // Handle start of streaming
      eventSource.addEventListener("message", (event) => {
        // Clear the timeout since we received a response
        clearTimeout(connectionTimeout);

        const data = JSON.parse(event.data) as StreamChunk;

        switch (data.type) {
          case "start":
            // We don't need to track the message ID anymore
            break;

          case "chunk":
            if (data.content) {
              currentContent += data.content;

              // Update the message with the current content
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === placeholderMsgId
                    ? { ...msg, text: currentContent }
                    : msg
                )
              );
            }
            break;

          case "end":
            // Complete the message
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === placeholderMsgId
                  ? {
                      ...msg,
                      text: data.fullContent || currentContent,
                      isStreaming: false,
                    }
                  : msg
              )
            );

            // Close the connection
            eventSource.close();
            setIsProcessing(false);
            break;

          case "error":
            toast({
              title: "Error",
              description:
                data.error || "An error occurred while streaming the response",
              variant: "destructive",
            });

            // Update placeholder with error
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === placeholderMsgId
                  ? {
                      ...msg,
                      text: "I'm sorry, I couldn't complete the response. Please try again.",
                      isStreaming: false,
                      isError: true,
                    }
                  : msg
              )
            );

            // Close the connection
            eventSource.close();
            setIsProcessing(false);
            break;
        }
      });

      // Handle errors
      eventSource.onerror = (error) => {
        // Clear the timeout since we received an error response
        clearTimeout(connectionTimeout);

        console.error("EventSource error:", error);

        // Update placeholder with error
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === placeholderMsgId
              ? {
                  ...msg,
                  text: "Connection error. The server is not responding.",
                  isStreaming: false,
                  isError: true,
                }
              : msg
          )
        );

        // Close the connection
        eventSource.close();
        setIsProcessing(false);
      };
    } catch (error) {
      console.error("Error setting up streaming:", error);

      toast({
        title: "Error",
        description: `Failed to start streaming: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        variant: "destructive",
      });

      setIsProcessing(false);
    }
  };

  // Function to retry a failed message
  const handleRetry = (lastUserMessage: string) => {
    if (!lastUserMessage || isProcessing) return;

    // Add the message to the server-side session first
    apiRequest("POST", "/api/chat/add-message", {
      message: lastUserMessage,
      role: "user",
    }).catch((error) => {
      console.error("Error adding message to session:", error);
    });

    // Send the message again
    sendStreamingMessage(lastUserMessage);
  };

  // Add a useEffect to detect page refresh
  useEffect(() => {
    // Simpler approach - just reset the chat state on component mount
    // This will effectively reset the chat when the page is refreshed or when the logo is clicked
    console.log("Component mounted, resetting chat state");
    setMessages([]);
    setShowWelcome(true);
    setHistoryLoaded(false);

    // Clear the session cookie by making a request to a new endpoint
    fetch("/api/chat/clear-session", { method: "POST" })
      .then((response) => {
        if (response.ok) {
          console.log("Session cleared successfully");
        } else {
          console.error("Failed to clear session");
        }
      })
      .catch((error) => {
        console.error("Error clearing session:", error);
      });
  }, []);

  // Process chat history when it's loaded
  useEffect(() => {
    console.log("History data changed or checking history loaded state");

    if (historyData) {
      console.log("History data available:", historyData);
    }

    if (
      historyData &&
      historyData.messages &&
      historyData.messages.length > 0 &&
      !historyLoaded
    ) {
      console.log(
        "Processing chat history with messages:",
        historyData.messages
      );

      // Convert timestamps from strings to Date objects
      const processedMessages = historyData.messages.map((msg: any) => {
        console.log("Processing message:", msg);
        return {
          ...msg,
          timestamp: new Date(msg.timestamp),
        };
      });

      console.log(
        "Setting messages state with processed messages:",
        processedMessages
      );
      setMessages(processedMessages);
      setShowWelcome(false); // Hide welcome message if we have history
      setHistoryLoaded(true); // Mark history as loaded
      console.log("Loaded chat history:", processedMessages.length, "messages");
    } else if (historyData && !historyLoaded) {
      // Even if no messages, mark as loaded
      console.log("No messages in history data, marking as loaded");
      setHistoryLoaded(true);
    }
  }, [historyData, historyLoaded]);

  // Scroll to bottom of messages when new ones arrive and handle text-to-speech
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }

    // Read the latest assistant message if voice input was used
    const latestMessage = messages[messages.length - 1];
    if (
      latestMessage &&
      latestMessage.sender === "assistant" &&
      !latestMessage.isStreaming &&
      !latestMessage.isError &&
      voiceEnabled &&
      voiceInputUsed
    ) {
      // Cancel any ongoing speech
      cancel();
      // Read the new message
      speak(latestMessage.text);
    }
  }, [messages, voiceEnabled, voiceInputUsed, speak, cancel]);

  const handleSendMessage = (text: string) => {
    // Hide welcome message when first message is sent
    if (showWelcome) {
      setShowWelcome(false);
    }

    // Add user message to state
    const userMessage: Message = {
      id: nanoid(),
      text,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    // Add the message to the server-side session first
    apiRequest("POST", "/api/chat/add-message", {
      message: text,
      role: "user",
    }).catch((error) => {
      console.error("Error adding message to session:", error);
    });

    // Use streaming API instead of regular message API
    sendStreamingMessage(text);
  };

  const handleSuggestionClick = (suggestionText: string) => {
    handleSendMessage(suggestionText);
  };

  // Function to render a cursor for streaming messages
  const renderStreamingCursor = () => {
    return (
      <span className="inline-flex ml-1">
        <span
          className="h-2 w-2 rounded-full bg-primary opacity-75 mx-0.5 animate-pulse"
          style={{ animationDelay: "0ms" }}
        ></span>
        <span
          className="h-2 w-2 rounded-full bg-primary opacity-75 mx-0.5 animate-pulse"
          style={{ animationDelay: "300ms" }}
        ></span>
        <span
          className="h-2 w-2 rounded-full bg-primary opacity-75 mx-0.5 animate-pulse"
          style={{ animationDelay: "600ms" }}
        ></span>
      </span>
    );
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-[calc(100vh-64px)] relative">
      <div className="glow-effect left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2"></div>

      <div className="w-full max-w-3xl mx-auto relative z-10">
        {showWelcome ? (
          <WelcomeMessage />
        ) : (
          <div className="mb-8 space-y-6 max-h-[calc(100vh-250px)] overflow-y-auto pr-4">
            {messages.map((message, index) => (
              <motion.div
                key={message.id}
                className={`relative ${
                  message.sender === "user"
                    ? "ml-12 flex justify-end"
                    : "mr-12 flex justify-start"
                }`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <div
                  className={`p-5 rounded-2xl shadow-sm ${
                    message.sender === "user"
                      ? "bg-primary/15 border border-primary/30 text-right"
                      : message.isError
                      ? "bg-destructive/5 border border-destructive/20 error-message"
                      : "bg-card/90 border border-border/70"
                  }`}
                >
                  {message.sender === "assistant" && (
                    <div className="flex items-center mb-2">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center mr-2">
                        <span className="text-primary text-xs font-semibold">
                          AI
                        </span>
                      </div>
                      <span className="text-sm font-heading font-medium text-primary/80">
                        AI assistant
                      </span>
                    </div>
                  )}
                  <div
                    className={`${
                      message.sender === "user" ? "font-medium" : "font-normal"
                    } ${
                      message.isError
                        ? "text-destructive/90"
                        : "text-foreground"
                    } whitespace-pre-line leading-relaxed`}
                  >
                    {message.text}
                    {message.isStreaming && renderStreamingCursor()}
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <p className="text-xs text-muted-foreground font-light">
                      {message.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>

                    {message.isError && message.lastUserMessage && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs py-1 h-7 border-destructive/30 hover:bg-destructive/10 text-destructive"
                        onClick={() => handleRetry(message.lastUserMessage!)}
                        disabled={isProcessing}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="mr-1"
                        >
                          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                          <path d="M3 3v5h5"></path>
                        </svg>
                        Retry
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        <ChatInput
          onSendMessage={handleSendMessage}
          isProcessing={isProcessing || isPending}
          onVoiceUsed={markVoiceInputUsed}
        />

        {showWelcome && (
          <SuggestionChips
            suggestions={suggestions}
            onSuggestionClick={handleSuggestionClick}
          />
        )}
      </div>
    </div>
  );
}
