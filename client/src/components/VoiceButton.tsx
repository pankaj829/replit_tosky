import React from 'react';
import { Button } from '@/components/ui/button';
import { Mic } from 'lucide-react';
import { useVoice } from '@/contexts/VoiceContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface VoiceButtonProps {
  className?: string;
}

const VoiceButton: React.FC<VoiceButtonProps> = ({ className }) => {
  const { openVoiceModal, isCallActive } = useVoice();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={openVoiceModal}
            className={`text-muted-foreground hover:text-foreground ${isCallActive ? 'text-primary' : ''} ${className}`}
            aria-label="Voice Assistant"
          >
            <Mic size={18} className={isCallActive ? 'animate-pulse text-primary' : ''} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Voice Assistant</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default VoiceButton;
