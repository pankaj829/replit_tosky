import { useState, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUp } from "lucide-react";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isProcessing: boolean;
}

export default function ChatInput({
  onSendMessage,
  isProcessing,
}: ChatInputProps) {
  const [inputValue, setInputValue] = useState("");

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim() && !isProcessing) {
      handleSendMessage();
    }
  };

  const handleSendMessage = () => {
    if (inputValue.trim() && !isProcessing) {
      onSendMessage(inputValue.trim());
      setInputValue("");
    }
  };

  return (
    <div className="w-full mb-8">
      <div className="relative rounded-xl bg-card border border-border overflow-hidden shadow-sm transition-all hover:shadow-md">
        <Input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent py-6 px-5 pr-14 text-foreground placeholder-muted-foreground border-none focus-visible:ring-1 focus-visible:ring-primary/50 font-heading text-base"
          placeholder="Ask a question..."
          disabled={isProcessing}
        />
        <Button
          onClick={handleSendMessage}
          disabled={!inputValue.trim() || isProcessing}
          size="icon"
          variant={inputValue.trim() ? "default" : "ghost"}
          className={`absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full transition-all ${
            inputValue.trim()
              ? "text-primary-foreground bg-primary hover:bg-primary/90"
              : "text-primary hover:text-primary hover:bg-primary/10"
          }`}
        >
          <ArrowUp size={18} />
        </Button>
      </div>
    </div>
  );
}
