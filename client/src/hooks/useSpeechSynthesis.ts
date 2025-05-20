import { useState, useCallback, useEffect } from "react";

/**
 * A custom hook to handle text-to-speech functionality
 */
export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [utterance, setUtterance] = useState<SpeechSynthesisUtterance | null>(
    null
  );
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceInputUsed, setVoiceInputUsed] = useState(false);

  // Check if speech synthesis is supported
  const supported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  // Cancel any ongoing speech when component unmounts
  useEffect(() => {
    return () => {
      if (supported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [supported]);

  // Handle speech synthesis events
  useEffect(() => {
    if (!utterance) return;

    const handleEnd = () => {
      setIsSpeaking(false);
      setUtterance(null);
    };

    const handleStart = () => {
      setIsSpeaking(true);
    };

    const handlePause = () => {
      setIsPaused(true);
    };

    const handleResume = () => {
      setIsPaused(false);
    };

    utterance.addEventListener("end", handleEnd);
    utterance.addEventListener("start", handleStart);
    utterance.addEventListener("pause", handlePause);
    utterance.addEventListener("resume", handleResume);

    return () => {
      utterance.removeEventListener("end", handleEnd);
      utterance.removeEventListener("start", handleStart);
      utterance.removeEventListener("pause", handlePause);
      utterance.removeEventListener("resume", handleResume);
    };
  }, [utterance]);

  // Speak text function
  const speak = useCallback(
    (text: string) => {
      if (!supported || !voiceEnabled) return;

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const newUtterance = new SpeechSynthesisUtterance(text);

      // Set voice preferences - using a timeout to ensure voices are loaded
      setTimeout(() => {
        const voices = window.speechSynthesis.getVoices();
        const englishVoices = voices.filter(
          (voice) =>
            voice.lang.includes("en-") &&
            (voice.name.includes("Google") ||
              voice.name.includes("Samantha") ||
              voice.name.includes("Female"))
        );

        if (englishVoices.length > 0) {
          newUtterance.voice = englishVoices[0];
        }

        // Set other speech properties
        newUtterance.rate = 1.0;
        newUtterance.pitch = 1.0;
        newUtterance.volume = 1.0;

        setUtterance(newUtterance);
        window.speechSynthesis.speak(newUtterance);
      }, 100);
    },
    [supported, voiceEnabled]
  );

  // Stop speaking
  const cancel = useCallback(() => {
    if (!supported) return;

    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setUtterance(null);
  }, [supported]);

  // Pause speaking
  const pause = useCallback(() => {
    if (!supported || !isSpeaking) return;

    window.speechSynthesis.pause();
    setIsPaused(true);
  }, [supported, isSpeaking]);

  // Resume speaking
  const resume = useCallback(() => {
    if (!supported || !isPaused) return;

    window.speechSynthesis.resume();
    setIsPaused(false);
  }, [supported, isPaused]);

  // Mark that voice input was used
  const markVoiceInputUsed = useCallback(() => {
    setVoiceInputUsed(true);
    setVoiceEnabled(true);
  }, []);

  return {
    speak,
    cancel,
    pause,
    resume,
    isSpeaking,
    isPaused,
    voiceEnabled,
    supported,
    markVoiceInputUsed,
    voiceInputUsed,
  };
}
