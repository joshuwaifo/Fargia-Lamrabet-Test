import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface WebSocketMessage {
  type: string;
  content?: string;
  referencedDocuments?: string[];
}

// ElevenLabs voice synthesis function
async function speakWithElevenLabs(text: string) {
  try {
    const response = await fetch('/api/voice/synthesize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      console.warn('ElevenLabs synthesis failed, falling back to browser speech');
      fallbackToWebSpeech(text);
      return;
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      window.dispatchEvent(new CustomEvent('ai-speech-end'));
    };
    
    await audio.play();
  } catch (error) {
    console.error('ElevenLabs synthesis error:', error);
    fallbackToWebSpeech(text);
  }
}

// Fallback to browser speech synthesis
function fallbackToWebSpeech(text: string) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.1;
    utterance.volume = 0.8;
    window.speechSynthesis.speak(utterance);
  }
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      console.log("WebSocket connected");
    };

    socket.onclose = () => {
      setIsConnected(false);
      console.log("WebSocket disconnected");
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      setIsConnected(false);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'ai_response') {
          // Invalidate messages query to refresh the chat
          queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
          
          // Trigger avatar speaking animation
          window.dispatchEvent(new CustomEvent('ai-speaking'));
          
          // Speak the AI response out loud using ElevenLabs
          if (data.message?.content) {
            speakWithElevenLabs(data.message.content);
          }
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    return () => {
      socket.close();
    };
  }, [queryClient]);

  const sendMessage = (message: WebSocketMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket not connected");
    }
  };

  return {
    isConnected,
    sendMessage,
  };
}
