import React from "react";
import { useVoice } from "@/contexts/VoiceContext";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, X, Loader } from "lucide-react";
import { motion } from "framer-motion";

const VoiceModal: React.FC = () => {
  const {
    isVoiceModalOpen,
    closeVoiceModal,
    startCall,
    stopCall,
    isCallActive,
    isMuted,
    toggleMute,
    volumeLevel,
    isAssistantSpeaking,
    isWaitingForFirstMessage,
  } = useVoice();

  // We no longer need to start the call here as it's started directly when the button is clicked

  // Handle modal close
  const handleClose = () => {
    if (isCallActive) {
      console.log("Modal closing - stopping active call");
      stopCall();
    } else {
      console.log("Modal closing - no active call to stop");
    }
    closeVoiceModal();
  };

  return (
    <Dialog
      open={isVoiceModalOpen}
      onOpenChange={(open) => !open && handleClose()}
    >
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-card/95 backdrop-blur-sm border border-border/70 shadow-lg">
        <DialogTitle className="sr-only">Voice Assistant</DialogTitle>
        <div className="flex flex-col items-center justify-center p-6 relative">
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
            onClick={handleClose}
          >
            <X size={18} />
          </Button>

          {/* Voice visualization */}
          <div className="w-32 h-32 relative mb-6">
            {/* Outer pulse animation */}
            <motion.div
              className="absolute inset-0 rounded-full bg-primary/10"
              animate={{
                scale: isAssistantSpeaking ? [1, 1.2, 1] : [1, 1.05, 1],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />

            {/* Inner circle with dynamic scaling based on volume */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                scale: isCallActive ? 0.8 + volumeLevel * 0.4 : 1,
              }}
            >
              <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                {isWaitingForFirstMessage ? (
                  <motion.div
                    className="text-primary"
                    animate={{ y: [0, -8, 0] }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <Loader size={32} className="animate-spin" />
                  </motion.div>
                ) : isCallActive ? (
                  <div className="text-primary">
                    {isMuted ? (
                      <MicOff size={32} />
                    ) : (
                      <Mic
                        size={32}
                        className={isAssistantSpeaking ? "" : "animate-pulse"}
                      />
                    )}
                  </div>
                ) : (
                  <div className="text-muted-foreground animate-pulse">
                    <Mic size={32} />
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Status text */}
          <h3 className="text-xl font-medium mb-2">
            {isWaitingForFirstMessage
              ? "Waiting for assistant..."
              : isCallActive
              ? isAssistantSpeaking
                ? "Listening..."
                : "Speak now..."
              : "Starting voice assistant..."}
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            {isWaitingForFirstMessage
              ? "The assistant is connecting soon..."
              : isCallActive
              ? "Your voice assistant is ready. Speak clearly into your microphone."
              : "Connecting to voice service..."}
          </p>

          {/* Control buttons */}
          <div className="flex gap-4">
            {isCallActive && (
              <Button
                variant="outline"
                className={`rounded-full px-6 ${
                  isMuted
                    ? "bg-destructive/10 text-destructive border-destructive/30"
                    : ""
                }`}
                disabled={isWaitingForFirstMessage}
                onClick={toggleMute}
              >
                {isMuted ? (
                  <>
                    <MicOff size={16} className="mr-2" />
                    Unmute
                  </>
                ) : (
                  <>
                    <Mic size={16} className="mr-2" />
                    Mute
                  </>
                )}
              </Button>
            )}
            <Button
              variant={isCallActive ? "destructive" : "default"}
              className="rounded-full px-6"
              disabled={isWaitingForFirstMessage}
              onClick={() => {
                if (isCallActive) {
                  console.log("End Call button clicked - stopping call");
                  stopCall();
                  closeVoiceModal(); // Close the modal when ending the call
                } else {
                  console.log("Start Call button clicked");
                  startCall();
                }
              }}
            >
              {isCallActive ? "End Call" : "Start Call"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VoiceModal;
