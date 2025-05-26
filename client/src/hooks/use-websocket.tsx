// import { useEffect, useRef, useState } from "react";
// import { useQueryClient } from "@tanstack/react-query";

// interface WebSocketMessage {
//   type: string;
//   content?: string;
//   referencedDocuments?: string[];
// }

// // ElevenLabs voice synthesis function
// async function speakWithElevenLabs(text: string) {
//   try {
//     const response = await fetch('/api/voice/synthesize', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({ text }),
//     });

//     if (!response.ok) {
//       console.warn('ElevenLabs synthesis failed, falling back to browser speech');
//       fallbackToWebSpeech(text);
//       return;
//     }

//     const audioBlob = await response.blob();
//     const audioUrl = URL.createObjectURL(audioBlob);
//     const audio = new Audio(audioUrl);

//     audio.onended = () => {
//       URL.revokeObjectURL(audioUrl);
//       window.dispatchEvent(new CustomEvent('ai-speech-end'));
//     };

//     await audio.play();
//   } catch (error) {
//     console.error('ElevenLabs synthesis error:', error);
//     fallbackToWebSpeech(text);
//   }
// }

// // Fallback to browser speech synthesis
// function fallbackToWebSpeech(text: string) {
//   if ('speechSynthesis' in window) {
//     window.speechSynthesis.cancel();
//     const utterance = new SpeechSynthesisUtterance(text);
//     utterance.rate = 0.9;
//     utterance.pitch = 1.1;
//     utterance.volume = 0.8;
//     window.speechSynthesis.speak(utterance);
//   }
// }

// export function useWebSocket() {
//   const [isConnected, setIsConnected] = useState(false);
//   const socketRef = useRef<WebSocket | null>(null);
//   const queryClient = useQueryClient();

//   useEffect(() => {
//     const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
//     const wsUrl = `${protocol}//${window.location.host}/ws`;

//     const socket = new WebSocket(wsUrl);
//     socketRef.current = socket;

//     socket.onopen = () => {
//       setIsConnected(true);
//       console.log("WebSocket connected");
//     };

//     socket.onclose = () => {
//       setIsConnected(false);
//       console.log("WebSocket disconnected");
//     };

//     socket.onerror = (error) => {
//       console.error("WebSocket error:", error);
//       setIsConnected(false);
//     };

//     socket.onmessage = (event) => {
//       try {
//         const data = JSON.parse(event.data);

//         if (data.type === 'ai_response') {
//           // Invalidate messages query to refresh the chat
//           queryClient.invalidateQueries({ queryKey: ['/api/messages'] });

//           // Trigger avatar speaking animation
//           window.dispatchEvent(new CustomEvent('ai-speaking'));

//           // Speak the AI response out loud using ElevenLabs
//           if (data.message?.content) {
//             speakWithElevenLabs(data.message.content);
//           }
//         }
//       } catch (error) {
//         console.error("Failed to parse WebSocket message:", error);
//       }
//     };

//     return () => {
//       socket.close();
//     };
//   }, [queryClient]);

//   const sendMessage = (message: WebSocketMessage) => {
//     if (socketRef.current?.readyState === WebSocket.OPEN) {
//       socketRef.current.send(JSON.stringify(message));
//     } else {
//       console.warn("WebSocket not connected");
//     }
//   };

//   return {
//     isConnected,
//     sendMessage,
//   };
// }

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
    // Dispatch 'ai-speaking' optimistically, or move after successful fetch if preferred
    // For smoother UI, dispatching here can be okay if API is fast.
    // window.dispatchEvent(new CustomEvent('ai-speaking'));

    const response = await fetch("/api/voice/synthesize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      console.warn(
        "ElevenLabs synthesis failed, falling back to browser speech",
      );
      // If dispatched optimistically above, ensure to dispatch 'ai-speech-end' if fallback occurs before audio plays
      // window.dispatchEvent(new CustomEvent('ai-speech-end')); // Or handle in fallback
      fallbackToWebSpeech(text); // Fallback will handle its own events
      return;
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);

    let speakingEventDispatched = false;

    audio.oncanplaythrough = () => {
      if (!speakingEventDispatched) {
        window.dispatchEvent(new CustomEvent("ai-speaking"));
        speakingEventDispatched = true;
      }
    };

    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      window.dispatchEvent(new CustomEvent("ai-speech-end"));
    };

    // Fallback dispatch if oncanplaythrough is not reliable or takes too long
    audio.onplaying = () => {
      if (!speakingEventDispatched) {
        window.dispatchEvent(new CustomEvent("ai-speaking"));
        speakingEventDispatched = true;
      }
    };

    try {
      await audio.play();
      // If neither oncanplaythrough nor onplaying fires quickly, this is a last resort,
      // but it might be slightly before actual sound.
      if (!speakingEventDispatched) {
        window.dispatchEvent(new CustomEvent("ai-speaking"));
        speakingEventDispatched = true;
      }
    } catch (playError) {
      console.error("Audio play error:", playError);
      if (speakingEventDispatched) {
        // If speaking was dispatched but play failed
        window.dispatchEvent(new CustomEvent("ai-speech-end")); // Clean up state
      }
      fallbackToWebSpeech(text); // Attempt fallback if play fails
    }
  } catch (error) {
    console.error("ElevenLabs synthesis error:", error);
    // Ensure speech end is dispatched if speaking was optimistically set
    // window.dispatchEvent(new CustomEvent('ai-speech-end')); // Or handle in fallback
    fallbackToWebSpeech(text); // Fallback will handle its own events
  }
}

// Fallback to browser speech synthesis
function fallbackToWebSpeech(text: string) {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel(); // Cancel any previous speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.1;
    utterance.volume = 0.8;
    utterance.onstart = () => {
      window.dispatchEvent(new CustomEvent("ai-speaking"));
    };
    utterance.onend = () => {
      window.dispatchEvent(new CustomEvent("ai-speech-end"));
    };
    utterance.onerror = () => {
      // Ensure end event on error too
      window.dispatchEvent(new CustomEvent("ai-speech-end"));
    };
    window.speechSynthesis.speak(utterance);
  } else {
    // If even browser speech is not available, ensure UI cleans up
    window.dispatchEvent(new CustomEvent("ai-speech-end"));
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
        const data = JSON.parse(event.data as string);

        if (data.type === "ai_response") {
          // Invalidate messages query to refresh the chat
          queryClient.invalidateQueries({ queryKey: ["/api/messages"] });

          // Speak the AI response out loud using ElevenLabs
          if (data.message?.content) {
            speakWithElevenLabs(data.message.content);
          } else {
            // If no content, but response received, ensure UI doesn't hang in speaking state
            window.dispatchEvent(new CustomEvent("ai-speech-end"));
          }
        } else if (data.type === "error") {
          console.error("WebSocket server error:", data.message);
          // Potentially show a toast to the user
          window.dispatchEvent(new CustomEvent("ai-speech-end")); // Clean up UI
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
        window.dispatchEvent(new CustomEvent("ai-speech-end")); // Clean up UI
      }
    };

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [queryClient]);

  const sendMessage = (message: WebSocketMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket not connected, message not sent:", message);
      // Optionally, queue message or notify user
    }
  };

  return {
    isConnected,
    sendMessage,
  };
}
