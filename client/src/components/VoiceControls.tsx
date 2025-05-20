import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";

interface VoiceControlsProps {
  onSpeechResult: (text: string) => void;
  disabled?: boolean;
  onVoiceUsed?: () => void;
}

interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionAlternative {
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface RecognitionType {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
}

export default function VoiceControls({
  onSpeechResult,
  disabled = false,
  onVoiceUsed,
}: VoiceControlsProps) {
  const [isListening, setIsListening] = useState(false);
  const [speechRecognition, setSpeechRecognition] =
    useState<RecognitionType | null>(null);

  // Initialize speech recognition
  useEffect(() => {
    if (
      !("webkitSpeechRecognition" in window) &&
      !("SpeechRecognition" in window)
    ) {
      console.warn("Speech recognition not supported in this browser");
      return;
    }

    // Create speech recognition instance
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionAPI() as RecognitionType;

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      onSpeechResult(transcript);
      setIsListening(false); // Stop listening after getting a result

      // Notify parent that voice was used
      if (onVoiceUsed) {
        onVoiceUsed();
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    setSpeechRecognition(recognition);

    return () => {
      if (recognition) {
        recognition.abort();
      }
    };
  }, [onSpeechResult]);

  // Toggle speech recognition
  const toggleListening = useCallback(() => {
    if (!speechRecognition) return;

    if (isListening) {
      speechRecognition.stop();
      setIsListening(false);
    } else {
      speechRecognition.start();
      setIsListening(true);
    }
  }, [isListening, speechRecognition]);

  return (
    <div className="flex items-center">
      <Button
        variant="outline"
        size="icon"
        className={`rounded-full ${
          isListening ? "bg-red-100 dark:bg-red-900 text-red-500" : ""
        }`}
        onClick={toggleListening}
        disabled={disabled || !speechRecognition}
        title={isListening ? "Stop listening" : "Start voice input"}
      >
        {isListening ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}

// Add types for the Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}
