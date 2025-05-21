import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ChatInterface from "@/pages/ChatInterface";
import NotFound from "@/pages/not-found";
import Header from "@/components/Header";
import { VoiceProvider } from "@/contexts/VoiceContext";
import VoiceModal from "@/components/VoiceModal";
import FloatingVoiceButton from "@/components/FloatingVoiceButton";
import { useState, useEffect } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={ChatInterface} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Get Vapi configuration from environment variables
  // These are injected during build time or can be fetched from the server
  const [vapiConfig, setVapiConfig] = useState({
    publicKey: "",
    assistantId: "",
  });

  // Fetch Vapi configuration from the server
  useEffect(() => {
    fetch("/api/chat/settings")
      .then((response) => response.json())
      .then((data) => {
        if (data.vapiPublicKey) {
          setVapiConfig({
            publicKey: data.vapiPublicKey,
            assistantId: data.vapiAssistantId || "",
          });
        }
      })
      .catch((error) => {
        console.error("Error fetching Vapi configuration:", error);
      });
  }, []);

  // Function to handle user messages from voice assistant
  const handleVoiceMessage = (message: string) => {
    // Find the ChatInterface component and call its handleSendMessage function
    // This is handled through the VoiceContext
    const event = new CustomEvent("voice-message", { detail: { message } });
    window.dispatchEvent(event);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <VoiceProvider
          vapiPublicKey={vapiConfig.publicKey}
          assistantId={vapiConfig.assistantId}
          onUserMessage={handleVoiceMessage}
        >
          <div className="flex flex-col min-h-screen bg-background">
            <Header />
            <main className="flex-1">
              <Router />
            </main>
            <FloatingVoiceButton />
            <VoiceModal />
            <Toaster />
          </div>
        </VoiceProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
