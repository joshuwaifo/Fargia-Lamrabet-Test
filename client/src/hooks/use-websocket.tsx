import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface WebSocketMessage {
  type: string;
  content?: string;
  referencedDocuments?: string[];
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
          
          // Speak the AI response out loud
          if (data.message?.content && 'speechSynthesis' in window) {
            // Cancel any ongoing speech
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(data.message.content);
            utterance.rate = 0.9;
            utterance.pitch = 1.1;
            utterance.volume = 0.8;
            
            // Use a female voice if available
            const voices = window.speechSynthesis.getVoices();
            const femaleVoice = voices.find(voice => 
              voice.name.toLowerCase().includes('female') ||
              voice.name.toLowerCase().includes('samantha') ||
              voice.name.toLowerCase().includes('alex') ||
              (voice.lang.startsWith('en-') && voice.localService)
            );
            
            if (femaleVoice) {
              utterance.voice = femaleVoice;
            }
            
            window.speechSynthesis.speak(utterance);
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
