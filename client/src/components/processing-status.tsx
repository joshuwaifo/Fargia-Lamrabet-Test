import { Card, CardContent } from "@/components/ui/card";
import { Circle } from "lucide-react";

interface Document {
  id: number;
  originalName: string;
  processed: boolean;
}

interface ProcessingStatusProps {
  documents: Document[];
}

export default function ProcessingStatus({ documents }: ProcessingStatusProps) {
  const processedCount = documents.filter(d => d.processed).length;
  const totalCount = documents.length;
  const allProcessed = totalCount > 0 && processedCount === totalCount;
  const hasDocuments = totalCount > 0;

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Processing Status</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-600">Document Analysis</span>
            <div className="flex items-center space-x-2">
              <Circle className={`w-2 h-2 rounded-full ${
                hasDocuments && allProcessed ? 'fill-accent text-accent' : 'fill-gray-400 text-gray-400'
              }`} />
              <span className={`text-xs font-medium ${
                hasDocuments && allProcessed ? 'text-accent' : 'text-gray-500'
              }`}>
                {hasDocuments && allProcessed ? 'Complete' : 'Pending'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-600">Knowledge Graph</span>
            <div className="flex items-center space-x-2">
              <Circle className={`w-2 h-2 rounded-full ${
                hasDocuments && allProcessed ? 'fill-accent text-accent' : 'fill-gray-400 text-gray-400'
              }`} />
              <span className={`text-xs font-medium ${
                hasDocuments && allProcessed ? 'text-accent' : 'text-gray-500'
              }`}>
                {hasDocuments && allProcessed ? 'Complete' : 'Pending'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-600">Avatar Ready</span>
            <div className="flex items-center space-x-2">
              <Circle className="w-2 h-2 fill-accent text-accent animate-pulse" />
              <span className="text-xs text-accent font-medium">Ready</span>
            </div>
          </div>

          {hasDocuments && (
            <div className="pt-2 border-t border-neutral-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600">Progress</span>
                <span className="font-medium text-neutral-900">{processedCount}/{totalCount} documents</span>
              </div>
              <div className="mt-2 w-full bg-neutral-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-primary to-secondary h-2 rounded-full transition-all duration-500"
                  style={{ width: `${totalCount > 0 ? (processedCount / totalCount) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
