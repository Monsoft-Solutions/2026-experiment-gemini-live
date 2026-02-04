import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TextInputProps {
  onSend: (text: string) => void;
}

export function TextInput({ onSend }: TextInputProps) {
  const [value, setValue] = useState("");

  const handleSend = () => {
    const text = value.trim();
    if (!text) return;
    onSend(text);
    setValue("");
  };

  return (
    <div className="mt-3 flex gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSend()}
        placeholder="Type a message..."
        className="flex-1"
      />
      <Button onClick={handleSend} size="sm" className="gap-1.5">
        <Send className="size-3.5" />
        Send
      </Button>
    </div>
  );
}
