import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CloudUpload, FileText, X, File } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Document {
  id: number;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  processed: boolean;
}

interface DocumentUploadProps {
  documents: Document[];
}

export default function DocumentUpload({ documents }: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('documents', file);
      });
      
      const response = await apiRequest('POST', '/api/documents/upload', formData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      toast({
        title: "Upload successful",
        description: "Documents have been uploaded and are ready for processing.",
      });
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      toast({
        title: "Document deleted",
        description: "Document has been removed successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const processMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/documents/process');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      toast({
        title: "Processing started",
        description: "Documents are being analyzed with Gemini AI.",
      });
    },
    onError: (error) => {
      toast({
        title: "Processing failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = (files: FileList) => {
    if (documents.length + files.length > 5) {
      toast({
        title: "Too many files",
        description: "Maximum 5 documents allowed.",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate(files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const handleFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.docx,.ppt,.pptx';
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        handleFileUpload(files);
      }
    };
    input.click();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) return <File className="text-red-600" size={16} />;
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return <FileText className="text-blue-600" size={16} />;
    if (mimeType.includes('word')) return <FileText className="text-blue-600" size={16} />;
    return <FileText className="text-gray-600" size={16} />;
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-900">Strategy Documents</h2>
          <span className="text-sm text-neutral-600">{documents.length}/5</span>
        </div>

        {/* Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragging ? 'border-primary bg-primary/5' : 'border-neutral-300 hover:border-primary'
          }`}
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onClick={handleFileSelect}
        >
          <div className="flex flex-col items-center space-y-3">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <CloudUpload className="text-primary" size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-900">
                {uploadMutation.isPending ? 'Uploading...' : 'Drop files here or click to browse'}
              </p>
              <p className="text-xs text-neutral-600 mt-1">PDF, DOCX, PPT up to 10MB each</p>
            </div>
          </div>
        </div>

        {/* Uploaded Documents List */}
        {documents.length > 0 && (
          <div className="mt-6 space-y-3">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white rounded flex items-center justify-center border">
                    {getFileIcon(doc.mimeType)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{doc.originalName}</p>
                    <p className="text-xs text-neutral-600">{formatFileSize(doc.size)}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${doc.processed ? 'bg-accent' : 'bg-yellow-500'}`} />
                  <button
                    className="text-neutral-400 hover:text-red-500 transition-colors"
                    onClick={() => deleteMutation.mutate(doc.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Process Button */}
        {documents.length > 0 && (
          <Button
            className="w-full mt-4"
            onClick={() => processMutation.mutate()}
            disabled={processMutation.isPending || documents.every(d => d.processed)}
          >
            <Brain className="mr-2" size={16} />
            {processMutation.isPending ? 'Processing...' : 'Process with Gemini AI'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
