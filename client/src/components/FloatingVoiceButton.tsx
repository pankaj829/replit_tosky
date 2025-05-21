import React from "react";
import { Button } from "@/components/ui/button";
import { Mic } from "lucide-react";
import { useVoice } from "@/contexts/VoiceContext";
import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FloatingVoiceButtonProps {
  className?: string;
}

const FloatingVoiceButton: React.FC<FloatingVoiceButtonProps> = ({
  className,
}) => {
  const { openVoiceModal, isCallActive, startCall } = useVoice();

  return (
    <TooltipProvider>
      <motion.div
        className="fixed bottom-6 right-6 z-50"
        initial={{ scale: 0, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div
              className="relative"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {/* Outer ring - always visible */}
              <div className="absolute -inset-3 rounded-full border-2 border-primary/30 opacity-70"></div>

              {/* Middle animated ring */}
              <motion.div
                className="absolute -inset-1.5 rounded-full border border-primary/40"
                animate={{
                  scale: isCallActive ? [0.9, 1.1, 0.9] : [0.95, 1.05, 0.95],
                  opacity: isCallActive ? [0.7, 0.9, 0.7] : [0.5, 0.7, 0.5],
                }}
                transition={{
                  duration: isCallActive ? 1.5 : 2.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />

              {/* Main button with enhanced styling */}
              <Button
                onClick={() => {
                  openVoiceModal();
                  // Start the call immediately when the button is clicked
                  startCall();
                }}
                size="icon"
                className={`h-14 w-14 rounded-full shadow-lg ${
                  isCallActive
                    ? "bg-primary hover:bg-primary/90 shadow-primary/20"
                    : "bg-card hover:bg-card/90 border-2 border-primary/50 shadow-lg"
                } ${className} transition-all duration-300 relative z-10`}
                aria-label="Voice Assistant"
              >
                <div className="relative flex items-center justify-center w-full h-full">
                  {/* Active call animation */}
                  {isCallActive && (
                    <motion.div
                      className="absolute inset-0 rounded-full bg-primary/20"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                  )}

                  {/* Inactive subtle pulse animation */}
                  {!isCallActive && (
                    <motion.div
                      className="absolute inset-0 rounded-full bg-primary/10"
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                  )}

                  {/* Glow effect */}
                  <div
                    className={`absolute inset-0 rounded-full ${
                      isCallActive
                        ? "bg-primary/10 shadow-[0_0_15px_rgba(var(--primary),0.5)]"
                        : ""
                    }`}
                  ></div>

                  <Mic
                    size={24}
                    className={
                      isCallActive ? "text-primary-foreground" : "text-primary"
                    }
                  />
                </div>
              </Button>

              {/* Outer pulse animation for active calls */}
              {isCallActive && (
                <motion.div
                  className="absolute -inset-6 rounded-full border border-primary/20"
                  animate={{
                    scale: [0.9, 1.1, 0.9],
                    opacity: [0.3, 0.6, 0.3],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              )}
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="left" sideOffset={16}>
            <p>
              {isCallActive ? "Voice call active" : "Start voice assistant"}
            </p>
          </TooltipContent>
        </Tooltip>
      </motion.div>
    </TooltipProvider>
  );
};

export default FloatingVoiceButton;
