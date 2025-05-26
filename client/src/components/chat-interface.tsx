// import { useState, useRef, useEffect } from "react";
// import { useMutation, useQueryClient } from "@tanstack/react-query";
// import { Card, CardContent } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Brain, User, Send, Mic, FileText, TrendingUp, AlertTriangle, Lightbulb } from "lucide-react";
// import { useWebSocket } from "@/hooks/use-websocket";
// import { useVoice } from "@/hooks/use-voice";
// import { apiRequest } from "@/lib/queryClient";
// import { useToast } from "@/hooks/use-toast";

// interface Message {
//   id: number;
//   type: 'user' | 'assistant';
//   content: string;
//   timestamp: Date;
//   referencedDocuments?: string[];
// }

// interface Document {
//   id: number;
//   originalName: string;
//   processed: boolean;
// }

// interface ChatInterfaceProps {
//   messages: Message[];
//   documents: Document[];
// }

// export default function ChatInterface({ messages, documents }: ChatInterfaceProps) {
//   const [inputValue, setInputValue] = useState("");
//   const messagesEndRef = useRef<HTMLDivElement>(null);
//   const queryClient = useQueryClient();
//   const { toast } = useToast();
//   const { sendMessage, isConnected } = useWebSocket();
//   const { startListening, transcript, isListening } = useVoice();

//   const quickAnalysisMutation = useMutation({
//     mutationFn: async (type: string) => {
//       const response = await apiRequest('POST', `/api/analysis/${type}`);
//       return response.json();
//     },
//     onSuccess: (data) => {
//       // Trigger AI speech
//       window.dispatchEvent(new CustomEvent('ai-speaking'));

//       // Add analysis result as a message
//       const analysisMessage = {
//         type: 'assistant' as const,
//         content: data.analysis,
//         referencedDocuments: documents.filter(d => d.processed).map(d => d.originalName),
//       };

//       sendMessage({
//         type: 'chat',
//         content: `Quick analysis: ${data.analysis}`,
//         referencedDocuments: analysisMessage.referencedDocuments,
//       });
//     },
//     onError: (error) => {
//       toast({
//         title: "Analysis failed",
//         description: error.message,
//         variant: "destructive",
//       });
//     },
//   });

//   // Auto-scroll to bottom when new messages arrive
//   useEffect(() => {
//     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//   }, [messages]);

//   // Handle voice transcript
//   useEffect(() => {
//     if (transcript) {
//       setInputValue(transcript);
//     }
//   }, [transcript]);

//   const handleSendMessage = () => {
//     if (!inputValue.trim()) return;

//     sendMessage({
//       type: 'chat',
//       content: inputValue,
//       referencedDocuments: documents.filter(d => d.processed).map(d => d.originalName),
//     });

//     setInputValue("");
//   };

//   const handleKeyPress = (e: React.KeyboardEvent) => {
//     if (e.key === 'Enter' && !e.shiftKey) {
//       e.preventDefault();
//       handleSendMessage();
//     }
//   };

//   const formatTimestamp = (timestamp: Date) => {
//     const now = new Date();
//     const diffInMinutes = Math.floor((now.getTime() - new Date(timestamp).getTime()) / (1000 * 60));

//     if (diffInMinutes < 1) return 'Just now';
//     if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;

//     const diffInHours = Math.floor(diffInMinutes / 60);
//     if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;

//     return new Date(timestamp).toLocaleDateString();
//   };

//   const processedDocuments = documents.filter(d => d.processed);

//   return (
//     <>
//       {/* Chat Interface */}
//       <Card className="flex flex-col h-96">
//         <CardContent className="p-0 flex flex-col h-full">
//           {/* Chat Header */}
//           <div className="p-4 border-b border-neutral-200">
//             <div className="flex items-center justify-between">
//               <h3 className="font-semibold text-neutral-900">Document Conversation</h3>
//               <div className="flex items-center space-x-2 text-sm text-neutral-600">
//                 <FileText size={16} />
//                 <span>{processedDocuments.length} documents active</span>
//                 {!isConnected && <span className="text-red-500">(Disconnected)</span>}
//               </div>
//             </div>
//           </div>

//           {/* Messages Container */}
//           <div className="flex-1 overflow-y-auto p-4 space-y-4">
//             {messages.length === 0 ? (
//               <div className="text-center text-neutral-500 py-8">
//                 <Brain size={48} className="mx-auto mb-4 text-neutral-300" />
//                 <p>Start a conversation about your documents</p>
//                 <p className="text-sm mt-2">Upload and process documents to begin</p>
//               </div>
//             ) : (
//               messages.map((message) => (
//                 <div key={message.id} className={`flex items-start space-x-3 ${message.type === 'user' ? 'justify-end' : ''}`}>
//                   {message.type === 'assistant' && (
//                     <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center flex-shrink-0">
//                       <Brain className="text-white" size={14} />
//                     </div>
//                   )}

//                   <div className={`flex-1 max-w-md ${message.type === 'user' ? 'order-first' : ''}`}>
//                     <div className={`rounded-lg p-4 ${
//                       message.type === 'user' ? 'bg-primary text-white' : 'bg-neutral-100'
//                     }`}>
//                       <p className="text-sm">{message.content}</p>
//                     </div>
//                     <div className={`flex items-center space-x-2 mt-2 text-xs text-neutral-500 ${
//                       message.type === 'user' ? 'justify-end' : ''
//                     }`}>
//                       <span>{formatTimestamp(message.timestamp)}</span>
//                       {message.referencedDocuments && message.referencedDocuments.length > 0 && (
//                         <>
//                           <span>•</span>
//                           <span>Referenced: {message.referencedDocuments.slice(0, 2).join(', ')}</span>
//                         </>
//                       )}
//                       {message.type === 'user' && <Mic className="text-accent" size={12} />}
//                     </div>
//                   </div>

//                   {message.type === 'user' && (
//                     <div className="w-8 h-8 bg-neutral-300 rounded-full flex items-center justify-center flex-shrink-0">
//                       <User className="text-neutral-600" size={14} />
//                     </div>
//                   )}
//                 </div>
//               ))
//             )}
//             <div ref={messagesEndRef} />
//           </div>

//           {/* Input Area */}
//           <div className="p-4 border-t border-neutral-200">
//             <div className="flex items-center space-x-3">
//               <div className="flex-1 relative">
//                 <Input
//                   type="text"
//                   placeholder="Ask about your documents or click the microphone to speak..."
//                   value={inputValue}
//                   onChange={(e) => setInputValue(e.target.value)}
//                   onKeyPress={handleKeyPress}
//                   className="pr-12"
//                 />
//                 <Button
//                   variant="ghost"
//                   size="icon"
//                   className={`absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 ${
//                     isListening ? 'text-red-500' : 'text-neutral-400 hover:text-primary'
//                   }`}
//                   onClick={startListening}
//                 >
//                   <Mic size={16} />
//                 </Button>
//               </div>
//               <Button onClick={handleSendMessage} disabled={!inputValue.trim()}>
//                 <Send size={16} />
//               </Button>
//             </div>

//             {/* Voice Input Status */}
//             {isListening && (
//               <div className="mt-3 flex items-center justify-center space-x-3 text-sm text-neutral-600">
//                 <div className="flex space-x-1">
//                   <div className="w-2 h-2 bg-accent rounded-full animate-bounce" />
//                   <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
//                   <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
//                 </div>
//                 <span>Listening... Speak now</span>
//                 <Button
//                   variant="ghost"
//                   size="sm"
//                   className="text-red-500 hover:text-red-700 h-auto p-1"
//                   onClick={() => {}} // Voice hook handles stopping
//                 >
//                   Stop
//                 </Button>
//               </div>
//             )}
//           </div>
//         </CardContent>
//       </Card>

//       {/* Quick Actions */}
//       <Card>
//         <CardContent className="p-6">
//           <h3 className="text-lg font-semibold text-neutral-900 mb-4">Quick Analysis</h3>
//           <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
//             <Button
//               variant="outline"
//               className="p-3 h-auto flex flex-col items-center space-y-2 hover:border-primary hover:bg-primary/5"
//               onClick={() => quickAnalysisMutation.mutate('summary')}
//               disabled={quickAnalysisMutation.isPending || processedDocuments.length === 0}
//             >
//               <FileText className="text-primary" size={20} />
//               <span className="text-sm font-medium">Document Summary</span>
//             </Button>

//             <Button
//               variant="outline"
//               className="p-3 h-auto flex flex-col items-center space-y-2 hover:border-primary hover:bg-primary/5"
//               onClick={() => quickAnalysisMutation.mutate('financial')}
//               disabled={quickAnalysisMutation.isPending || processedDocuments.length === 0}
//             >
//               <TrendingUp className="text-primary" size={20} />
//               <span className="text-sm font-medium">Financial Analysis</span>
//             </Button>

//             <Button
//               variant="outline"
//               className="p-3 h-auto flex flex-col items-center space-y-2 hover:border-primary hover:bg-primary/5"
//               onClick={() => quickAnalysisMutation.mutate('risks')}
//               disabled={quickAnalysisMutation.isPending || processedDocuments.length === 0}
//             >
//               <AlertTriangle className="text-primary" size={20} />
//               <span className="text-sm font-medium">Risk Assessment</span>
//             </Button>

//             <Button
//               variant="outline"
//               className="p-3 h-auto flex flex-col items-center space-y-2 hover:border-primary hover:bg-primary/5"
//               onClick={() => quickAnalysisMutation.mutate('recommendations')}
//               disabled={quickAnalysisMutation.isPending || processedDocuments.length === 0}
//             >
//               <Lightbulb className="text-primary" size={20} />
//               <span className="text-sm font-medium">Recommendations</span>
//             </Button>
//           </div>

//           {processedDocuments.length === 0 && (
//             <p className="text-sm text-neutral-500 text-center mt-4">
//               Upload and process documents to enable quick analysis
//             </p>
//           )}
//         </CardContent>
//       </Card>
//     </>
//   );
// }

import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Brain,
  User,
  Send,
  Mic,
  FileText,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import { useWebSocket } from "@/hooks/use-websocket";
import { useVoice } from "@/hooks/use-voice";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: number;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
  referencedDocuments?: string[];
}

interface Document {
  id: number;
  originalName: string;
  processed: boolean;
}

interface ChatInterfaceProps {
  messages: Message[];
  documents: Document[];
}

export default function ChatInterface({
  messages,
  documents,
}: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { sendMessage, isConnected } = useWebSocket();
  const { startListening, stopListening, transcript, isListening } = useVoice(); // Added stopListening

  const quickAnalysisMutation = useMutation({
    mutationFn: async (type: string) => {
      // Ensure at least one document is processed for analysis
      const processedDocs = documents.filter((d) => d.processed);
      if (processedDocs.length === 0) {
        toast({
          title: "No Processed Documents",
          description:
            "Please upload and process documents before requesting analysis.",
          variant: "destructive",
        });
        throw new Error("No processed documents for analysis.");
      }
      const response = await apiRequest("POST", `/api/analysis/${type}`);
      return response.json();
    },
    onSuccess: (data) => {
      // Add analysis result as a message - AI response (and speech) will be handled via WebSocket flow
      const analysisUserPrompt = `Perform a quick analysis: ${data.analysisType || "general analysis"}`;

      sendMessage({
        type: "chat", // This will trigger the backend to generate an AI response based on the analysis result.
        content: `Please provide the ${data.analysisType || "general"} analysis you just performed. The key findings were: "${data.analysis.substring(0, 200)}..."`, // User-like prompt to trigger AI response
        referencedDocuments: documents
          .filter((d) => d.processed)
          .map((d) => d.originalName),
      });

      // We don't add the AI message directly here anymore.
      // The backend will send an 'ai_response' via WebSocket, which will update the chat.
      // The speech will also be triggered by the WebSocket message handler.

      toast({
        title: "Analysis Requested",
        description: `The AI is processing your request for ${data.analysisType || "analysis"}.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Analysis failed",
        description: error.message || "Could not perform quick analysis.",
        variant: "destructive",
      });
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle voice transcript
  useEffect(() => {
    if (transcript) {
      setInputValue(transcript);
    }
  }, [transcript]);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    if (!isConnected) {
      toast({
        title: "Not Connected",
        description: "WebSocket is not connected. Please try again later.",
        variant: "destructive",
      });
      return;
    }

    sendMessage({
      type: "chat",
      content: inputValue,
      referencedDocuments: documents
        .filter((d) => d.processed)
        .map((d) => d.originalName),
    });

    setInputValue("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTimestamp = (timestamp: Date | string) => {
    // Allow string for potentially unparsed dates
    const tsDate =
      typeof timestamp === "string" ? new Date(timestamp) : timestamp;
    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - tsDate.getTime()) / (1000 * 60),
    );

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60)
      return `${diffInMinutes} minute${diffInMinutes > 1 ? "s" : ""} ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24)
      return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`;

    return tsDate.toLocaleDateString();
  };

  const processedDocuments = documents.filter((d) => d.processed);

  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleQuickAnalysis = (type: string) => {
    quickAnalysisMutation.mutate(type);
  };

  return (
    <>
      {/* Chat Interface */}
      <Card className="flex flex-col h-96">
        <CardContent className="p-0 flex flex-col h-full">
          {/* Chat Header */}
          <div className="p-4 border-b border-neutral-200">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-neutral-900">
                Document Conversation
              </h3>
              <div className="flex items-center space-x-2 text-sm text-neutral-600">
                <FileText size={16} />
                <span>{processedDocuments.length} documents active</span>
                {!isConnected && (
                  <span className="text-red-500">(Disconnected)</span>
                )}
              </div>
            </div>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-neutral-500 py-8">
                <Brain size={48} className="mx-auto mb-4 text-neutral-300" />
                <p>Start a conversation about your documents</p>
                <p className="text-sm mt-2">
                  Upload and process documents to begin
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start space-x-3 ${message.type === "user" ? "justify-end" : ""}`}
                >
                  {message.type === "assistant" && (
                    <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center flex-shrink-0">
                      <Brain className="text-white" size={14} />
                    </div>
                  )}

                  <div
                    className={`flex-1 max-w-xl ${message.type === "user" ? "order-first" : ""}`}
                  >
                    {" "}
                    {/* Increased max-w */}
                    <div
                      className={`rounded-lg p-3 ${
                        // Adjusted padding
                        message.type === "user"
                          ? "bg-primary text-white"
                          : "bg-neutral-100 text-neutral-800" // Adjusted colors for better contrast
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">
                        {message.content}
                      </p>{" "}
                      {/* Added whitespace-pre-wrap */}
                    </div>
                    <div
                      className={`flex items-center space-x-2 mt-1 text-xs text-neutral-500 ${
                        // Adjusted margin
                        message.type === "user" ? "justify-end" : ""
                      }`}
                    >
                      <span>{formatTimestamp(message.timestamp)}</span>
                      {message.referencedDocuments &&
                        message.referencedDocuments.length > 0 && (
                          <>
                            <span>•</span>
                            <span
                              title={message.referencedDocuments.join(", ")}
                            >
                              Ref:{" "}
                              {message.referencedDocuments
                                .slice(0, 1)
                                .join(", ")}
                              {message.referencedDocuments.length > 1
                                ? "..."
                                : ""}
                            </span>
                          </>
                        )}
                      {/* Removed mic icon for user messages here as it's implicit with voice input */}
                    </div>
                  </div>

                  {message.type === "user" && (
                    <div className="w-8 h-8 bg-neutral-300 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="text-neutral-600" size={14} />
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-neutral-200">
            <div className="flex items-center space-x-3">
              <div className="flex-1 relative">
                <Input
                  type="text"
                  placeholder="Ask about your documents or click the microphone..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pr-12 text-sm"
                  disabled={!isConnected || isListening}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className={`absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 ${
                    isListening
                      ? "text-red-500 animate-pulse"
                      : "text-neutral-400 hover:text-primary"
                  }`}
                  onClick={handleVoiceToggle}
                  disabled={!isConnected}
                >
                  <Mic size={16} />
                </Button>
              </div>
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || !isConnected || isListening}
              >
                <Send size={16} />
              </Button>
            </div>

            {/* Voice Input Status */}
            {isListening && (
              <div className="mt-3 flex items-center justify-center space-x-3 text-sm text-neutral-600">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-accent rounded-full animate-bounce" />
                  <div
                    className="w-2 h-2 bg-accent rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  />
                  <div
                    className="w-2 h-2 bg-accent rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  />
                </div>
                <span>Listening... Speak now</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-700 h-auto p-1"
                  onClick={stopListening}
                >
                  Stop
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">
            Quick Analysis
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <Button
              variant="outline"
              className="p-3 h-auto flex flex-col items-center justify-center space-y-2 hover:border-primary hover:bg-primary/5 text-center"
              onClick={() => handleQuickAnalysis("summary")}
              disabled={
                quickAnalysisMutation.isPending ||
                processedDocuments.length === 0 ||
                !isConnected
              }
            >
              <FileText className="text-primary" size={20} />
              <span className="text-xs sm:text-sm font-medium">
                Document Summary
              </span>
            </Button>

            <Button
              variant="outline"
              className="p-3 h-auto flex flex-col items-center justify-center space-y-2 hover:border-primary hover:bg-primary/5 text-center"
              onClick={() => handleQuickAnalysis("financial")}
              disabled={
                quickAnalysisMutation.isPending ||
                processedDocuments.length === 0 ||
                !isConnected
              }
            >
              <TrendingUp className="text-primary" size={20} />
              <span className="text-xs sm:text-sm font-medium">
                Financial Analysis
              </span>
            </Button>

            <Button
              variant="outline"
              className="p-3 h-auto flex flex-col items-center justify-center space-y-2 hover:border-primary hover:bg-primary/5 text-center"
              onClick={() => handleQuickAnalysis("risks")}
              disabled={
                quickAnalysisMutation.isPending ||
                processedDocuments.length === 0 ||
                !isConnected
              }
            >
              <AlertTriangle className="text-primary" size={20} />
              <span className="text-xs sm:text-sm font-medium">
                Risk Assessment
              </span>
            </Button>

            <Button
              variant="outline"
              className="p-3 h-auto flex flex-col items-center justify-center space-y-2 hover:border-primary hover:bg-primary/5 text-center"
              onClick={() => handleQuickAnalysis("recommendations")}
              disabled={
                quickAnalysisMutation.isPending ||
                processedDocuments.length === 0 ||
                !isConnected
              }
            >
              <Lightbulb className="text-primary" size={20} />
              <span className="text-xs sm:text-sm font-medium">
                Recommendations
              </span>
            </Button>
          </div>

          {processedDocuments.length === 0 && (
            <p className="text-sm text-neutral-500 text-center mt-4">
              Upload and process documents to enable quick analysis.
            </p>
          )}
          {quickAnalysisMutation.isPending && (
            <p className="text-sm text-primary text-center mt-4 animate-pulse">
              AI is performing analysis...
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
