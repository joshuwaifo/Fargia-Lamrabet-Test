import { useQuery } from "@tanstack/react-query";
import DocumentUpload from "@/components/document-upload";
import AvatarSection from "@/components/avatar-section";
import ChatInterface from "@/components/chat-interface";
import ProcessingStatus from "@/components/processing-status";
import { Brain, Settings, Circle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { data: documentsData } = useQuery({
    queryKey: ["/api/documents"],
  });

  const { data: messagesData } = useQuery({
    queryKey: ["/api/messages"],
  });

  const documents = documentsData?.documents || [];
  const messages = messagesData?.messages || [];

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
                <Brain className="text-white" size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-neutral-900">AI Strategy Advisor</h1>
                <p className="text-sm text-neutral-600">Document Intelligence Platform</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-2 text-sm text-neutral-600">
                <Circle className="w-2 h-2 fill-accent text-accent animate-pulse" />
                <span>Gemini 2.5 Pro Active</span>
              </div>
              <button className="p-2 text-neutral-600 hover:text-neutral-900 transition-colors">
                <Settings size={20} />
              </button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.location.href = "/api/logout"}
                className="flex items-center space-x-2"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Document Upload */}
          <div className="lg:col-span-1 space-y-6">
            <DocumentUpload documents={documents} />
            <ProcessingStatus documents={documents} />
          </div>

          {/* Right Column - Avatar and Chat */}
          <div className="lg:col-span-2 space-y-6">
            <AvatarSection />
            <ChatInterface messages={messages} documents={documents} />
          </div>
        </div>
      </div>
    </div>
  );
}
