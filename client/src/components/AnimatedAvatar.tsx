import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Volume2, Loader2 } from "lucide-react";

// Import local avatars
import financeAvatar from "@/assets/avatars/avatar-finance.png";
import engineeringAvatar from "@/assets/avatars/avatar-engineering.png";
import marketingAvatar from "@/assets/avatars/avatar-marketing.png";
import hrAvatar from "@/assets/avatars/avatar-hr.png";
import salesAvatar from "@/assets/avatars/avatar-sales.png";
import complianceAvatar from "@/assets/avatars/avatar-compliance.png";
import techAvatar from "@/assets/avatars/avatar-tech.png";
import legalAvatar from "@/assets/avatars/avatar-legal.png";

interface AvatarProps {
  department: string;
  textToSpeak?: string;
  onSpeakEnd?: () => void;
}

const departmentAvatars: Record<string, string> = {
  "Finance": financeAvatar,
  "Human Resources": hrAvatar,
  "Engineering": engineeringAvatar,
  "Marketing": marketingAvatar,
  "Sales": salesAvatar,
  "Governance, Risk, and Compliance": complianceAvatar,
  "Consumer Business": hrAvatar, // Fallback
  "Legal and Regulatory": legalAvatar,
  "Technology & Digital Innovation": techAvatar,
  "Corporate Communications & Sustainability": marketingAvatar, // Fallback
  "Data Analytics and AI": techAvatar // Fallback
};

export function AnimatedAvatar({ department, textToSpeak, onSpeakEnd }: AvatarProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const avatarUrl = departmentAvatars[department] || engineeringAvatar;
  
  const handleSpeak = async () => {
    if (!textToSpeak || isSpeaking) return;
    
    setIsSpeaking(true);
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToSpeak })
      });
      
      if (!response.ok) throw new Error("TTS request failed");
      
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onplay = () => setIsSpeaking(true);
      audio.onended = () => {
        setIsSpeaking(false);
        onSpeakEnd?.();
        URL.revokeObjectURL(audioUrl);
      };
      
      await audio.play();
    } catch (err) {
      console.error("Speak Error:", err);
      setIsSpeaking(false);
      
      // Fallback to speech synthesis if API fails
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        onSpeakEnd?.();
      };
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-48 h-48 rounded-full overflow-hidden border-4 border-primary/20 bg-muted flex items-center justify-center shadow-xl">
        {avatarUrl ? (
          <motion.img 
            src={avatarUrl} 
            alt="Department Avatar"
            className="w-full h-full object-cover"
            animate={isSpeaking ? {
              scale: [1, 1.05, 1],
              rotate: [0, 1, -1, 0]
            } : {}}
            transition={{ repeat: Infinity, duration: 0.5 }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-4 text-center">
            <div className="text-4xl mb-2 opacity-20">👤</div>
            <div className="text-[10px] text-muted-foreground leading-tight">Avatar not available</div>
          </div>
        )}
        
        {isSpeaking && (
          <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
            <div className="w-full h-full border-4 border-primary rounded-full animate-ping opacity-20" />
          </div>
        )}
      </div>
      
      {textToSpeak && (
        <Button 
          variant="default" 
          size="sm" 
          onClick={handleSpeak}
          disabled={isSpeaking}
          className="gap-2 rounded-full px-6 hover-elevate shadow-md"
        >
          {isSpeaking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
          {isSpeaking ? "Speaking..." : "Listen to Avatar"}
        </Button>
      )}
    </div>
  );
}
