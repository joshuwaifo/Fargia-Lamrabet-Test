import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, Mic, Square, Circle } from "lucide-react";
import { useVoice } from "@/hooks/use-voice";
import avatarImage from "@assets/image_1747988403393.png";

export default function AvatarSection() {
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [mouthState, setMouthState] = useState(0); // 0 = closed, 1 = open
  const audioRef = useRef<HTMLAudioElement>(null);
  const { startListening, stopListening, isListening } = useVoice();
  const animationRef = useRef<number>();

  // Animate lip sync when speaking
  useEffect(() => {
    if (isSpeaking) {
      const animateLips = () => {
        // Create realistic mouth movement pattern
        const time = Date.now() * 0.01;
        const mouthMovement = Math.sin(time) * 0.5 + 0.5; // 0 to 1
        setMouthState(mouthMovement);
        animationRef.current = requestAnimationFrame(animateLips);
      };
      animateLips();
    } else {
      setMouthState(0); // Close mouth when not speaking
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isSpeaking]);

  // Handle speaking events
  useEffect(() => {
    const handleSpeechStart = () => {
      setIsSpeaking(true);
      // Set a realistic duration for the animation (will be adjusted by actual audio)
      setTimeout(() => setIsSpeaking(false), 5000);
    };

    const handleSpeechEnd = () => {
      setIsSpeaking(false);
    };

    // Listen for custom events from the chat interface
    window.addEventListener('ai-speaking', handleSpeechStart);
    window.addEventListener('ai-speech-end', handleSpeechEnd);

    return () => {
      window.removeEventListener('ai-speaking', handleSpeechStart);
      window.removeEventListener('ai-speech-end', handleSpeechEnd);
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
        <div className="relative bg-gradient-to-br from-neutral-100 to-neutral-200 aspect-video overflow-hidden">
          {isVideoEnabled ? (
            <div className="relative w-full h-full">
              {/* Base Avatar Image */}
              <img
                src={avatarImage}
                alt="AI Strategy Advisor Avatar"
                className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-75"
                style={{
                  transform: isSpeaking ? `scale(${1 + mouthState * 0.02})` : 'scale(1)',
                }}
              />
              
              {/* Animated Mouth Overlay for Lip Sync */}
              {isSpeaking && (
                <div 
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: `radial-gradient(ellipse ${20 + mouthState * 15}px ${8 + mouthState * 12}px at 50% 75%, 
                      rgba(0,0,0,${0.3 + mouthState * 0.4}) 0%, 
                      transparent 70%)`,
                  }}
                />
              )}
              
              {/* Subtle face glow when speaking */}
              {isSpeaking && (
                <div 
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: `radial-gradient(circle at 50% 40%, 
                      rgba(99, 102, 241, ${0.1 + mouthState * 0.1}) 0%, 
                      transparent 50%)`,
                  }}
                />
              )}
            </div>
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
