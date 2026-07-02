import { useState, useRef } from 'react';
import { Upload, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { importJsonFile } from '../../lib/jsonImportService';

interface UploadResult {
  filename: string;
  success: boolean;
  testId?: string;
  questionsUploaded?: number;
  error?: string;
  message?: string;
}

export function JsonUploadWidget({ onUploadComplete }: { onUploadComplete: () => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: File[]) => {
    const jsonFiles = files.filter(f => f.name.endsWith('.json'));
    
    if (jsonFiles.length === 0) {
      alert('Please select JSON files');
      return;
    }

    setIsUploading(true);
    setResults([]); // Clear previous results
    const uploadResults: UploadResult[] = [];

    for (const file of jsonFiles) {
      const result = await importJsonFile(file);
      console.log('Upload result:', result); // Log for debugging
      uploadResults.push({
        filename: file.name,
        success: result.success,
        testId: result.testId,
        questionsUploaded: result.questionsUploaded,
        error: result.error,
        message: result.message
      });
      setResults([...uploadResults]); // Update results in real-time
    }

    setIsUploading(false);
    
    if (uploadResults.every(r => r.success)) {
      onUploadComplete();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(Array.from(e.dataTransfer.files));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
          transition-all duration-200
          ${isDragging || isUploading ? 'bg-primary/10 border-primary' : 'bg-bg border-border hover:border-primary/50'}
          ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".json"
          onChange={handleFileSelect}
          disabled={isUploading}
          className="hidden"
        />
        
        <div className="flex flex-col items-center gap-3">
          {isUploading ? (
            <Loader size={32} className="text-primary animate-spin" />
          ) : (
            <Upload size={32} className="text-muted" />
          )}
          <div>
            <p className="font-semibold text-fg">
              {isUploading ? 'Uploading...' : 'Drag JSON files here or click to select'}
            </p>
            <p className="text-sm text-muted mt-1">
              {isUploading ? 'Processing files...' : 'Supports multiple JSON question papers'}
            </p>
          </div>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-panel border border-border rounded-xl p-4 space-y-2">
          <h3 className="font-semibold text-fg mb-3">Upload Results</h3>
          {results.map((result, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-3 p-3 rounded-lg ${
                result.success ? 'bg-success/10 border border-success/30' : 'bg-danger/10 border border-danger/30'
              }`}
            >
              {result.success ? (
                <CheckCircle size={20} className="text-success flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={20} className="text-danger flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-fg break-words">{result.filename}</p>
                {result.success ? (
                  <p className="text-sm text-muted mt-1">
                    {result.message || (
                      <>
                        ✓ Test <span className="font-mono">{result.testId}</span> • {result.questionsUploaded} questions uploaded
                      </>
                    )}
                  </p>
                ) : (
                  <div className="text-sm text-danger mt-1 break-words whitespace-pre-wrap">
                    {result.error}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
