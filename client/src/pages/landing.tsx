import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, FileText, MessageSquare, Sparkles } from "lucide-react";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
            AI Document Assistant
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            Upload your documents and chat with an intelligent AI assistant that analyzes 
            and provides insights from your files with advanced voice capabilities.
          </p>
          <Button 
            onClick={handleLogin}
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg"
          >
            Get Started
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="text-center">
            <CardHeader>
              <FileText className="w-12 h-12 text-blue-600 mx-auto mb-4" />
              <CardTitle>Document Upload</CardTitle>
              <CardDescription>
                Upload PDFs, Word docs, presentations, and spreadsheets
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <Bot className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <CardTitle>AI Analysis</CardTitle>
              <CardDescription>
                Advanced AI powered by Gemini analyzes your documents
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <MessageSquare className="w-12 h-12 text-purple-600 mx-auto mb-4" />
              <CardTitle>Voice Chat</CardTitle>
              <CardDescription>
                Chat with your documents using voice or text interface
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Card className="max-w-4xl mx-auto">
          <CardHeader className="text-center">
            <Sparkles className="w-8 h-8 text-yellow-500 mx-auto mb-4" />
            <CardTitle className="text-2xl">Key Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div>
                    <h4 className="font-semibold">Intelligent Document Processing</h4>
                    <p className="text-gray-600 dark:text-gray-300">
                      Automatically extracts and analyzes content from various file formats
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <h4 className="font-semibold">Voice Synthesis</h4>
                    <p className="text-gray-600 dark:text-gray-300">
                      High-quality AI voice responses with natural speech patterns
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                  <div>
                    <h4 className="font-semibold">Real-time Chat</h4>
                    <p className="text-gray-600 dark:text-gray-300">
                      Instant responses with document context and references
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                  <div>
                    <h4 className="font-semibold">Secure & Private</h4>
                    <p className="text-gray-600 dark:text-gray-300">
                      Your documents and conversations are kept secure and private
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}