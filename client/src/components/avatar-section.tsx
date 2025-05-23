import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, Mic, Square, Circle } from "lucide-react";
import { useVoice } from "@/hooks/use-voice";

export default function AvatarSection() {
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { startListening, stopListening, isListening } = useVoice();

  // Simulate speaking animation when audio is playing
  useEffect(() => {
    const handleSpeech = () => {
      setIsSpeaking(true);
      setTimeout(() => setIsSpeaking(false), 3000); // 3 second speaking animation
    };

    // Listen for custom events from the chat interface
    const handleAISpeech = () => handleSpeech();
    window.addEventListener('ai-speaking', handleAISpeech);

    return () => {
      window.removeEventListener('ai-speaking', handleAISpeech);
    };
  }, []);

  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="p-6 border-b border-neutral-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Circle className={`w-3 h-3 rounded-full ${isSpeaking ? 'fill-accent text-accent animate-pulse' : 'fill-gray-400 text-gray-400'}`} />
              <h2 className="text-lg font-semibold text-neutral-900">AI Strategy Advisor</h2>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsVideoEnabled(!isVideoEnabled)}
                className="text-neutral-600 hover:text-neutral-900"
              >
                <Video size={20} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleVoiceToggle}
                className={`text-neutral-600 hover:text-neutral-900 ${isListening ? 'bg-red-100 text-red-600' : ''}`}
              >
                <Mic size={20} />
              </Button>
            </div>
          </div>
        </div>

        {/* Avatar Video Container */}
        <div className="relative bg-gradient-to-br from-neutral-100 to-neutral-200 aspect-video">
          {isVideoEnabled ? (
            <img
              src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=600"
              alt="AI Strategy Advisor Avatar"
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white text-2xl font-bold">AI</span>
                </div>
                <p className="text-neutral-600">Video disabled</p>
              </div>
            </div>
          )}

          {/* Speaking Indicator */}
          {isSpeaking && (
            <div className="absolute bottom-4 left-4 bg-black/20 backdrop-blur-sm rounded-full px-3 py-2">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-1 h-4 bg-white rounded-full animate-pulse" />
                  <div className="w-1 h-6 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.1s' }} />
                  <div className="w-1 h-3 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                  <div className="w-1 h-5 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
                </div>
                <span className="text-white text-xs font-medium">Speaking...</span>
              </div>
            </div>
          )}

          {/* Voice Controls Overlay */}
          <div className="absolute bottom-4 right-4 flex space-x-2">
            <Button
              size="icon"
              className={`w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm border-0 text-white hover:bg-white/30 ${
                isListening ? 'bg-red-500/20 hover:bg-red-500/30' : ''
              }`}
              onClick={handleVoiceToggle}
            >
              {isListening ? <Square size={20} /> : <Mic size={20} />}
            </Button>
          </div>

          {/* Listening Indicator */}
          {isListening && (
            <div className="absolute top-4 left-4 bg-red-500/20 backdrop-blur-sm rounded-full px-3 py-2">
              <div className="flex items-center space-x-2">
                <Circle className="w-2 h-2 fill-red-500 text-red-500 animate-pulse" />
                <span className="text-white text-xs font-medium">Listening...</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
