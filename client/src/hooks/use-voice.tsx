// import { useState, useEffect, useRef } from "react";
// import { useToast } from "@/hooks/use-toast";

// interface SpeechRecognitionResult {
//   transcript: string;
//   confidence: number;
// }

// interface SpeechRecognitionEvent {
//   results: SpeechRecognitionResult[][];
//   resultIndex: number;
// }

// interface SpeechRecognition extends EventTarget {
//   continuous: boolean;
//   interimResults: boolean;
//   lang: string;
//   start(): void;
//   stop(): void;
//   abort(): void;
//   onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
//   onend: ((this: SpeechRecognition, ev: Event) => any) | null;
//   onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
//   onerror: ((this: SpeechRecognition, ev: any) => any) | null;
// }

// declare global {
//   interface Window {
//     SpeechRecognition: new () => SpeechRecognition;
//     webkitSpeechRecognition: new () => SpeechRecognition;
//   }
// }

// export function useVoice() {
//   const [isListening, setIsListening] = useState(false);
//   const [transcript, setTranscript] = useState("");
//   const [isSupported, setIsSupported] = useState(false);
//   const recognitionRef = useRef<SpeechRecognition | null>(null);
//   const { toast } = useToast();

//   useEffect(() => {
//     if (typeof window !== 'undefined') {
//       const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

//       if (SpeechRecognition) {
//         setIsSupported(true);
//         const recognition = new SpeechRecognition();

//         recognition.continuous = false;
//         recognition.interimResults = false;
//         recognition.lang = 'en-US';

//         recognition.onstart = () => {
//           setIsListening(true);
//         };

//         recognition.onend = () => {
//           setIsListening(false);
//         };

//         recognition.onresult = (event: SpeechRecognitionEvent) => {
//           const result = event.results[0];
//           if (result && result[0]) {
//             setTranscript(result[0].transcript);
//           }
//         };

//         recognition.onerror = (event: any) => {
//           console.error('Speech recognition error:', event.error);
//           setIsListening(false);

//           if (event.error === 'not-allowed') {
//             toast({
//               title: "Microphone access denied",
//               description: "Please allow microphone access to use voice input.",
//               variant: "destructive",
//             });
//           } else if (event.error === 'no-speech') {
//             toast({
//               title: "No speech detected",
//               description: "Please try speaking again.",
//               variant: "destructive",
//             });
//           }
//         };

//         recognitionRef.current = recognition;
//       }
//     }
//   }, [toast]);

//   const startListening = () => {
//     if (!isSupported) {
//       toast({
//         title: "Voice input not available",
//         description: "Speech recognition isn't supported in this environment. You can still type your messages and hear AI responses!",
//         variant: "destructive",
//       });
//       return;
//     }

//     if (recognitionRef.current && !isListening) {
//       setTranscript("");
//       try {
//         recognitionRef.current.start();
//       } catch (error) {
//         console.error("Speech recognition error:", error);
//         toast({
//           title: "Voice input failed",
//           description: "Unable to start voice recognition. Please use text input instead.",
//           variant: "destructive",
//         });
//       }
//     }
//   };

//   const stopListening = () => {
//     if (recognitionRef.current && isListening) {
//       recognitionRef.current.stop();
//     }
//   };

//   const speak = (text: string) => {
//     if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
//       // Cancel any ongoing speech
//       window.speechSynthesis.cancel();

//       const utterance = new SpeechSynthesisUtterance(text);
//       utterance.rate = 0.9;
//       utterance.pitch = 1.1;
//       utterance.volume = 0.8;

//       utterance.onstart = () => {
//         window.dispatchEvent(new CustomEvent('ai-speaking'));
//       };

//       window.speechSynthesis.speak(utterance);
//     }
//   };

//   return {
//     isListening,
//     transcript,
//     isSupported,
//     startListening,
//     stopListening,
//     speak,
//   };
// }

import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  speakText as utilitySpeakText,
  stopSpeaking as utilityStopSpeaking,
  isSpeaking as utilityIsSpeaking,
  VoiceSettings,
  findBestVoice,
} from "@/lib/voice-utils";

interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResult[][];
  resultIndex: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult:
    | ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any)
    | null;
  onerror: ((this: SpeechRecognition, ev: any) => any) | null; // 'any' because SpeechRecognitionErrorEvent is not standard
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition; // Optional for environments without it
    webkitSpeechRecognition?: new () => SpeechRecognition; // Optional
  }
}

export function useVoice() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSpeechRecognitionSupported, setIsSpeechRecognitionSupported] =
    useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognitionAPI =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      if (SpeechRecognitionAPI) {
        setIsSpeechRecognitionSupported(true);
        const recognitionInstance = new SpeechRecognitionAPI();

        recognitionInstance.continuous = false; // Stop after first recognized phrase
        recognitionInstance.interimResults = true; // Get interim results for faster feedback if needed, but we use final
        recognitionInstance.lang = "en-US";

        recognitionInstance.onstart = () => {
          setIsListening(true);
          setTranscript(""); // Clear previous transcript on start
        };

        recognitionInstance.onend = () => {
          setIsListening(false);
          // Transcript is set by onresult, no need to do anything with it here unless forcing stop.
        };

        recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
          let finalTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            }
          }
          if (finalTranscript) {
            setTranscript(finalTranscript);
          }
        };

        recognitionInstance.onerror = (event: any) => {
          // Using 'any' for SpeechRecognitionError
          console.error(
            "Speech recognition error:",
            event.error,
            event.message,
          );
          setIsListening(false);

          let title = "Voice Input Error";
          let description =
            "An unknown error occurred with speech recognition.";

          if (
            event.error === "not-allowed" ||
            event.error === "permission-denied"
          ) {
            title = "Microphone Access Denied";
            description =
              "Please allow microphone access in your browser settings to use voice input.";
          } else if (event.error === "no-speech") {
            title = "No Speech Detected";
            description =
              "Please try speaking again. Make sure your microphone is working.";
          } else if (event.error === "audio-capture") {
            title = "Microphone Issue";
            description =
              "Could not capture audio. Check your microphone connection and settings.";
          } else if (event.error === "network") {
            title = "Network Error";
            description =
              "A network error occurred during speech recognition. Check your connection.";
          } else if (event.error === "aborted") {
            // This can happen if stopListening() is called, or user clicks stop. Usually not an "error" to show.
            console.log("Speech recognition aborted.");
            return; // Don't show a toast for user-initiated abort
          }

          toast({
            title: title,
            description: description,
            variant: "destructive",
          });
        };

        recognitionRef.current = recognitionInstance;
      } else {
        setIsSpeechRecognitionSupported(false);
        console.warn("SpeechRecognition API not supported in this browser.");
      }
    }

    // Cleanup function
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort(); // Stop any recognition on unmount
        recognitionRef.current.onstart = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
      }
    };
  }, [toast]); // toast dependency for error handling

  const startListening = () => {
    if (!isSpeechRecognitionSupported) {
      toast({
        title: "Voice Input Not Supported",
        description:
          "Your browser doesn't support speech recognition. You can still type messages.",
        variant: "destructive",
      });
      return;
    }

    if (recognitionRef.current && !isListening) {
      setTranscript(""); // Clear any old transcript
      try {
        recognitionRef.current.start();
      } catch (error: any) {
        console.error("Error starting speech recognition:", error);
        setIsListening(false); // Ensure state is correct
        toast({
          title: "Could Not Start Voice Input",
          description:
            error.message ||
            "Please check microphone permissions and try again.",
          variant: "destructive",
        });
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop(); // This will trigger 'onend'
      } catch (error) {
        console.error("Error stopping speech recognition:", error);
        setIsListening(false); // Force state if stop fails
      }
    }
  };

  // This `speak` function uses the utility from voice-utils.ts
  // It is kept for compatibility if other parts of the app call `useVoice().speak()`
  // However, the primary speech synthesis is now handled by `useWebSocket` via ElevenLabs.
  const speak = (text: string, settings?: Partial<VoiceSettings>) => {
    if (
      typeof window !== "undefined" &&
      ("speechSynthesis" in window || process.env.ELEVENLABS_API_KEY)
    ) {
      // For this hook, we'll use the browser's TTS as a fallback or direct call if ElevenLabs isn't the main path
      // The main ElevenLabs flow is in useWebSocket. This is more of a utility.
      const voice = settings?.voice || findBestVoice();
      utilitySpeakText(
        text,
        { ...settings, voice },
        () => window.dispatchEvent(new CustomEvent("ai-speaking")), // Generic events
        () => window.dispatchEvent(new CustomEvent("ai-speech-end")),
      );
    } else {
      toast({
        title: "Speech Output Not Available",
        description:
          "Text-to-speech isn't supported or configured in this environment.",
        variant: "destructive",
      });
      // Ensure UI cleans up if speech can't happen
      window.dispatchEvent(new CustomEvent("ai-speech-end"));
    }
  };

  return {
    isListening,
    transcript, // The recognized speech text
    isSpeechRecognitionSupported, // Specifically for browser's STT
    startListening,
    stopListening,
    speak, // Uses utilitySpeakText for TTS
    // Expose utility functions directly if needed elsewhere, though speak should suffice
    // stopBrowserTTS: utilityStopSpeaking,
    // isBrowserSpeaking: utilityIsSpeaking,
  };
}
