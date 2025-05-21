import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import Vapi from "@vapi-ai/web";

// Define the context type
interface VoiceContextType {
  isVoiceModalOpen: boolean;
  openVoiceModal: () => void;
  closeVoiceModal: () => void;
  vapi: Vapi | null;
  isCallActive: boolean;
  startCall: () => Promise<void>;
  stopCall: () => void;
  isMuted: boolean;
  toggleMute: () => void;
  volumeLevel: number;
  isAssistantSpeaking: boolean;
  isWaitingForFirstMessage: boolean;
  sendMessage: (message: string) => void;
}

// Create the context with default values
const VoiceContext = createContext<VoiceContextType>({
  isVoiceModalOpen: false,
  openVoiceModal: () => {},
  closeVoiceModal: () => {},
  vapi: null,
  isCallActive: false,
  startCall: async () => {},
  stopCall: () => {},
  isMuted: false,
  toggleMute: () => {},
  volumeLevel: 0,
  isAssistantSpeaking: false,
  isWaitingForFirstMessage: false,
  sendMessage: () => {},
});

// Define props for the provider component
interface VoiceProviderProps {
  children: ReactNode;
  onUserMessage?: (message: string) => void;
  vapiPublicKey: string;
  assistantId?: string;
}

// Create the provider component
export const VoiceProvider: React.FC<VoiceProviderProps> = ({
  children,
  onUserMessage,
  vapiPublicKey,
  assistantId,
}) => {
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [vapi, setVapi] = useState<Vapi | null>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [isWaitingForFirstMessage, setIsWaitingForFirstMessage] =
    useState(false);

  // Initialize Vapi instance
  useEffect(() => {
    if (!vapiPublicKey) return;

    const vapiInstance = new Vapi(vapiPublicKey);

    // Set up event listeners
    vapiInstance.on("call-start", () => {
      console.log("Vapi call started");
      setIsCallActive(true);
    });

    vapiInstance.on("call-end", () => {
      console.log("Vapi call ended");
      setIsCallActive(false);
    });

    vapiInstance.on("speech-start", () => {
      setIsAssistantSpeaking(true);
      // When the assistant starts speaking, we've received the first message
      setIsWaitingForFirstMessage(false);
    });

    vapiInstance.on("speech-end", () => {
      setIsAssistantSpeaking(false);
    });

    vapiInstance.on("volume-level", (volume) => {
      setVolumeLevel(volume);
    });

    vapiInstance.on("message", (message) => {
      // Handle messages from the assistant
      if (message.type === "transcript" && message.transcript?.text) {
        // If there's a transcript, pass it to the parent component
        onUserMessage?.(message.transcript.text);
      }

      // Any message from the assistant means we're no longer waiting for the first message
      setIsWaitingForFirstMessage(false);
    });

    vapiInstance.on("error", (error) => {
      console.error("Vapi error:", error);
    });

    setVapi(vapiInstance);

    // Cleanup on unmount
    return () => {
      if (vapiInstance) {
        vapiInstance.stop();
      }
    };
  }, [vapiPublicKey, onUserMessage]);

  const openVoiceModal = () => {
    setIsVoiceModalOpen(true);
    // When opening the modal, set waiting for first message to true
    setIsWaitingForFirstMessage(true);
  };

  const closeVoiceModal = () => {
    setIsVoiceModalOpen(false);
    if (isCallActive) {
      stopCall();
    }
    // Reset waiting state when closing
    setIsWaitingForFirstMessage(false);
  };

  const startCall = async () => {
    if (!vapi) return;

    try {
      if (assistantId) {
        await vapi.start(assistantId);
      } else {
        // Default configuration if no assistantId is provided
        await vapi.start({
          transcriber: {
            provider: "deepgram",
            model: "nova-2",
            language: "en-US",
          },
          model: {
            provider: "openai",
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content:
                  "You are a helpful assistant. Keep your responses concise and clear.",
              },
            ],
          },
          voice: {
            provider: "playht",
            voiceId: "jennifer",
          },
          name: "Voice Assistant",
        });
      }
    } catch (error) {
      console.error("Failed to start call:", error);
    }
  };

  const stopCall = () => {
    if (vapi) {
      vapi.stop();
      // Explicitly set isCallActive to false to ensure UI updates immediately
      setIsCallActive(false);
      // Reset waiting state when stopping the call
      setIsWaitingForFirstMessage(false);
      console.log("Call stopped");
    }
  };

  const toggleMute = () => {
    if (vapi) {
      const newMuteState = !isMuted;
      vapi.setMuted(newMuteState);
      setIsMuted(newMuteState);
    }
  };

  const sendMessage = (message: string) => {
    if (vapi && isCallActive) {
      vapi.send({
        type: "add-message",
        message: {
          role: "system",
          content: message,
        },
      });
    }
  };

  const value = {
    isVoiceModalOpen,
    openVoiceModal,
    closeVoiceModal,
    vapi,
    isCallActive,
    startCall,
    stopCall,
    isMuted,
    toggleMute,
    volumeLevel,
    isAssistantSpeaking,
    isWaitingForFirstMessage,
    sendMessage,
  };

  return (
    <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>
  );
};

// Create a custom hook to use the voice context
export const useVoice = () => useContext(VoiceContext);
