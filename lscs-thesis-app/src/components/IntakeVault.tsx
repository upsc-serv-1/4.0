import { useState } from 'react';
import { Sparkles, AlertCircle, CheckCircle } from 'lucide-react';
import { extractAndParseJSON, mapParsedDataToCaseForm } from '../utils/parser';

interface IntakeVaultProps {
  defaultCaseState: Record<string, any>;
  onAutoFill: (mappedData: Record<string, any>) => void;
}

export function IntakeVault({ defaultCaseState, onAutoFill }: IntakeVaultProps) {
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: ''
  });

  const handleParse = () => {
    if (!inputText.trim()) {
      setStatus({
        type: 'error',
        message: 'Please paste some text first.'
      });
      return;
    }

    const parsedJson = extractAndParseJSON(inputText);
    
    if (!parsedJson) {
      setStatus({
        type: 'error',
        message: 'Failed to extract valid JSON. Make sure you copy the entire JSON object from your AI assistant.'
      });
      return;
    }

    const { mapped, count } = mapParsedDataToCaseForm(parsedJson, defaultCaseState);
    
    if (count === 0) {
      setStatus({
        type: 'error',
        message: 'Parsed JSON successfully, but no matching case variables were found. Please check keys.'
      });
      return;
    }

    // Success
    onAutoFill(mapped);
    setStatus({
      type: 'success',
      message: `Form successfully populated! Mapped ${count} fields. Review the form below.`
    });
    setInputText('');
    
    // Clear status after 5s
    setTimeout(() => {
      setStatus({ type: 'idle', message: '' });
    }, 6000);
  };

  return (
    <div className="card intake-card">
      <div className="card-header">
        <h3>Workflow A: The Intake Vault</h3>
        <p className="card-subtitle">Paste the raw JSON response from Gemini or ChatGPT here to auto-fill the case form.</p>
      </div>
      
      <div className="intake-body">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste AI JSON output here... (e.g. { &quot;patient_name&quot;: &quot;Sunita&quot;, ... })"
          className="intake-textarea"
          rows={5}
        />
        
        <div className="intake-actions">
          <button onClick={handleParse} className="btn-primary btn-auto-fill">
            <Sparkles size={18} />
            <span>Auto-Fill Medical Form</span>
          </button>
        </div>

        {status.type !== 'idle' && (
          <div className={`alert-toast ${status.type}`}>
            {status.type === 'success' ? (
              <CheckCircle size={20} className="alert-icon" />
            ) : (
              <AlertCircle size={20} className="alert-icon" />
            )}
            <span className="alert-message">{status.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
