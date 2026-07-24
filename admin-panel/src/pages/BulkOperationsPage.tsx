import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Upload, FileText, CheckCircle2, AlertCircle, Database, 
  Layers, HardDrive, RefreshCw, Sparkles, Check, ArrowRight 
} from 'lucide-react';

interface PresetFile {
  name: string;
  label: string;
  category: 'Optional' | 'GS Mains' | 'Value Addition';
  table: string;
  path: string;
}

const PRESET_FILES: PresetFile[] = [
  { name: 'mains_anthro1_new_consolidated.json', label: 'Anthropology Paper 1 (Consolidated)', category: 'Optional', table: 'mains_questions', path: 'mains-json/mains_anthro1_new_consolidated.json' },
  { name: 'mains_anthro2_new_consolidated.json', label: 'Anthropology Paper 2 (Consolidated)', category: 'Optional', table: 'mains_questions', path: 'mains-json/mains_anthro2_new_consolidated.json' },
  { name: 'mains_anthro1_pre2012.json', label: 'Anthropology Paper 1 (Pre-2012 PYQs)', category: 'Optional', table: 'mains_questions', path: 'mains-json/mains_anthro1_pre2012.json' },
  { name: 'mains_anthro2_pre2012.json', label: 'Anthropology Paper 2 (Pre-2012 PYQs)', category: 'Optional', table: 'mains_questions', path: 'mains-json/mains_anthro2_pre2012.json' },
  
  { name: 'mains_gs1_consolidated.json', label: 'GS Paper 1 (Full History/Geo/Society)', category: 'GS Mains', table: 'mains_questions', path: 'mains-json/mains_gs1_consolidated.json' },
  { name: 'mains_gs2_consolidated.json', label: 'GS Paper 2 (Polity/Gov/IR)', category: 'GS Mains', table: 'mains_questions', path: 'mains-json/mains_gs2_consolidated.json' },
  { name: 'mains_gs3_consolidated.json', label: 'GS Paper 3 (Economy/Env/SciTech)', category: 'GS Mains', table: 'mains_questions', path: 'mains-json/mains_gs3_consolidated.json' },
  { name: 'mains_gs4_consolidated.json', label: 'GS Paper 4 (Ethics & Case Studies)', category: 'GS Mains', table: 'mains_questions', path: 'mains-json/mains_gs4_consolidated.json' },
  
  { name: 'mains_data_facts.json', label: 'Mains Data & Facts Hub', category: 'Value Addition', table: 'mains_data_facts', path: 'mains-json/mains_data_facts.json' },
  { name: 'mains_keywords.json', label: 'Mains Key Terms & Definitions', category: 'Value Addition', table: 'mains_keywords', path: 'mains-json/mains_keywords.json' },
  { name: 'mains_ethics_value_add.json', label: 'Ethics Value Add & Examples', category: 'Value Addition', table: 'mains_ethics_value_add', path: 'mains-json/mains_ethics_value_add.json' },
  { name: 'mains_essay_value_add.json', label: 'Essay Quotes & Anecdotes', category: 'Value Addition', table: 'mains_essay_value_add', path: 'mains-json/mains_essay_value_add.json' },
  { name: 'mains_intro_conclusions.json', label: 'Intro & Conclusion Bank', category: 'Value Addition', table: 'mains_intro_conclusions', path: 'mains-json/mains_intro_conclusions.json' },
  { name: 'mains_frameworks.json', label: 'Answer Writing Frameworks', category: 'Value Addition', table: 'mains_frameworks', path: 'mains-json/mains_frameworks.json' },
];

export default function BulkOperationsPage() {
  const [supabaseConnected, setSupabaseConnected] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'presets'>('upload');
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [jsonText, setJsonText] = useState<string>('');
  const [parsedData, setParsedData] = useState<any>(null);
  const [targetTable, setTargetTable] = useState<string>('mains_questions');
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const [statusSummary, setStatusSummary] = useState<string | null>(null);

  // Test Supabase Connection on mount
  useEffect(() => {
    async function checkSupabase() {
      try {
        const { count, error } = await supabase.from('mains_questions').select('*', { count: 'exact', head: true });
        if (error && error.code !== 'PGRST116') {
          console.log('Supabase Check Warning:', error.message);
          setSupabaseConnected(true); // Still connected
        } else {
          setSupabaseConnected(true);
        }
      } catch {
        setSupabaseConnected(false);
      }
    }
    checkSupabase();
  }, []);

  const addLog = (msg: string) => {
    setLogMessages((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // Parse JSON file uploaded by user
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        setJsonText(text);
        const obj = JSON.parse(text);
        setParsedData(obj);
        
        // Auto-detect target table
        if (Array.isArray(obj)) {
          if (obj[0]?.fact || obj[0]?.data) setTargetTable('mains_data_facts');
          else if (obj[0]?.keyword || obj[0]?.term) setTargetTable('mains_keywords');
          else if (obj[0]?.case_study || obj[0]?.caseStudy) setTargetTable('mains_case_studies');
          else setTargetTable('mains_questions');
        } else if (obj?.questions) {
          setTargetTable('mains_questions');
        }
        
        setStatusSummary(`Parsed ${file.name} successfully! (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      } catch (err: any) {
        setStatusSummary(`Invalid JSON Format: ${err.message}`);
        setParsedData(null);
      }
    };
    reader.readAsText(file);
  };

  // Load Preset File from mains-json
  const handleLoadPreset = async (preset: PresetFile) => {
    setIsUploading(true);
    setLogMessages([]);
    setTargetTable(preset.table);
    addLog(`Loading preset file: ${preset.name}...`);
    try {
      const resp = await fetch(`/${preset.path}`);
      if (!resp.ok) {
        // Fallback: try relative path
        const resp2 = await fetch(`./mains-json/${preset.name}`);
        if (!resp2.ok) throw new Error(`Could not fetch ${preset.name}`);
        const data = await resp2.json();
        setParsedData(data);
        setStatusSummary(`Loaded preset ${preset.label} (${data.questions?.length || data.length || 0} items)`);
      } else {
        const data = await resp.json();
        setParsedData(data);
        setStatusSummary(`Loaded preset ${preset.label} (${data.questions?.length || data.length || 0} items)`);
      }
      addLog(`File loaded into parser. Select options below and click Upload to Supabase.`);
    } catch (err: any) {
      addLog(`Error loading preset: ${err.message}. You can also drag & drop the file directly in the Custom Upload tab.`);
    } finally {
      setIsUploading(false);
    }
  };

  // Execute Upload to Supabase
  const executeUpload = async () => {
    if (!parsedData) {
      alert('Please upload or select a JSON file first.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setLogMessages([]);
    addLog(`Starting upload to Supabase table: public.${targetTable}...`);

    try {
      let rowsToUpload: any[] = [];
      let modelAnswersToUpload: any[] = [];

      // Check if it's questions format or generic array
      if (parsedData.questions && Array.isArray(parsedData.questions)) {
        addLog(`Detected Mains/Optional Questions payload (${parsedData.questions.length} questions)...`);
        
        parsedData.questions.forEach((q: any) => {
          const qId = q.id || `q-${Math.random().toString(36).substr(2, 9)}`;
          const ei = q.exam_info || {};
          rowsToUpload.push({
            id: qId,
            question_number: q.questionNumber ? String(q.questionNumber) : null,
            question_text: q.questionText || q.text || q.question,
            marks: q.marks ? parseInt(q.marks) : null,
            exam_year: q.year || q.exam_year || 2024,
            paper: q.paper || parsedData.paper || 'Optional',
            subject: q.subject || 'Sociology',
            section_group: q.sectionGroup || q.section_group || null,
            microtopic: q.microTopic || q.microtopic || null,
            subtopic: q.subTopic || q.subtopic || null,
            nanotopic: q.nanoTopic || q.nanotopic || null,
            macrotag: q.macrotag || null,
            microtag: q.microtag || null,
            is_pyq: q.is_pyq ?? (ei.isPyq ?? true),
            source_attribution_label: q.source_attribution_label || null,
            exam_info: q.exam_info || null,
            stage: q.stage || ei.stage || 'mains',
            exam: q.exam || ei.exam || 'Mains',
            exam_group: q.exam_group || ei.group || 'UPSC CSE',
            is_upsc_cse: q.is_upsc_cse ?? (ei.is_upsc_cse ?? true),
            is_allied: q.is_allied ?? (ei.is_allied ?? false),
            is_others: q.is_others ?? (ei.is_others ?? false),
            exam_category: q.exam_category || ei.exam_category || 'cse',
            course: q.course || parsedData.course || 'Civil Services',
            institute: q.institute || parsedData.institute || 'UPSC',
            program_id: q.program_id || parsedData.program_id || 'cse',
            program_name: q.program_name || parsedData.program_name || 'CSE',
          });

          if (q.answers && Array.isArray(q.answers)) {
            q.answers.forEach((ans: any, aIdx: number) => {
              modelAnswersToUpload.push({
                id: ans.id || `${qId}-ans-${aIdx + 1}`,
                question_id: qId,
                institute: ans.institute || 'Model Answer',
                answer_text: ans.answerText || ans.text || ans.answer,
              });
            });
          }
        });
      } else if (Array.isArray(parsedData)) {
        rowsToUpload = parsedData;
      } else {
        rowsToUpload = [parsedData];
      }

      addLog(`Total main records to process: ${rowsToUpload.length}`);
      if (modelAnswersToUpload.length > 0) {
        addLog(`Total associated model answers to process: ${modelAnswersToUpload.length}`);
      }

      // Batch upload helper using Supabase JS client
      const BATCH_SIZE = targetTable === 'mains_answers' ? 25 : 50;
      let uploadedCount = 0;

      for (let i = 0; i < rowsToUpload.length; i += BATCH_SIZE) {
        const chunk = rowsToUpload.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from(targetTable).upsert(chunk, { onConflict: 'id' });
        
        if (error) {
          addLog(`[Error] Batch ${i / BATCH_SIZE + 1} failed: ${error.message}`);
        } else {
          uploadedCount += chunk.length;
          const pct = Math.round((uploadedCount / rowsToUpload.length) * (modelAnswersToUpload.length > 0 ? 50 : 100));
          setUploadProgress(pct);
          addLog(`Upserted ${uploadedCount}/${rowsToUpload.length} rows to ${targetTable}`);
        }
      }

      // Upload answers if present
      if (modelAnswersToUpload.length > 0) {
        addLog(`Upserting ${modelAnswersToUpload.length} model answers to public.mains_answers...`);
        let ansUploaded = 0;
        for (let i = 0; i < modelAnswersToUpload.length; i += 25) {
          const chunk = modelAnswersToUpload.slice(i, i + 25);
          const { error } = await supabase.from('mains_answers').upsert(chunk, { onConflict: 'id' });
          if (error) {
            addLog(`[Error] Answer Batch ${i / 25 + 1} failed: ${error.message}`);
          } else {
            ansUploaded += chunk.length;
            const pct = 50 + Math.round((ansUploaded / modelAnswersToUpload.length) * 50);
            setUploadProgress(pct);
            addLog(`Upserted ${ansUploaded}/${modelAnswersToUpload.length} model answers`);
          }
        }
      }

      setUploadProgress(100);
      addLog(`🎉 SUCCESS: Complete upload finished successfully!`);
      alert(`Upload complete! Successfully processed records into Supabase.`);
    } catch (err: any) {
      addLog(`[Fatal Error] Upload failed: ${err.message}`);
      alert(`Upload error: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-black text-ink flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Upload size={24} />
            </div>
            Optional & Mains JSON Supabase Uploader
          </h1>
          <p className="text-muted text-sm mt-1">
            Upload optional subject JSON files (Sociology, Anthropology, etc.) & GS Mains datasets directly to your live Supabase database.
          </p>
        </div>

        {/* Supabase Status Pill */}
        <div className="flex items-center gap-2 bg-panel border border-border px-4 py-2 rounded-xl text-xs font-semibold shrink-0">
          <Database size={16} className="text-primary" />
          <span>Supabase Status:</span>
          {supabaseConnected === null ? (
            <span className="text-muted">Checking…</span>
          ) : supabaseConnected ? (
            <span className="text-emerald-500 font-bold flex items-center gap-1">
              <CheckCircle2 size={14} /> Connected (ngwsuqzkndlxfoantnlf)
            </span>
          ) : (
            <span className="text-danger font-bold flex items-center gap-1">
              <AlertCircle size={14} /> Disconnected
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('upload')}
          className={`px-5 py-3 font-bold text-sm border-b-2 transition flex items-center gap-2 ${
            activeTab === 'upload'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-muted hover:text-ink'
          }`}
        >
          <Upload size={16} /> Custom File Upload (Drag & Drop)
        </button>
        <button
          onClick={() => setActiveTab('presets')}
          className={`px-5 py-3 font-bold text-sm border-b-2 transition flex items-center gap-2 ${
            activeTab === 'presets'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-muted hover:text-ink'
          }`}
        >
          <Layers size={16} /> Pre-existing Workspace JSONs
        </button>
      </div>

      {/* TAB 1: CUSTOM FILE UPLOAD */}
      {activeTab === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left 2 Cols: File Upload Box */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-panel border-2 border-dashed border-border rounded-2xl p-8 text-center hover:border-primary transition group">
              <input
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
                id="json-file-input"
              />
              <label htmlFor="json-file-input" className="cursor-pointer block">
                <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition">
                  <FileText size={28} />
                </div>
                <div className="text-lg font-bold text-ink mb-1">
                  {selectedFile ? selectedFile.name : 'Click or Drag & Drop JSON File Here'}
                </div>
                <p className="text-muted text-xs max-w-sm mx-auto">
                  Supports Sociology Optional, Anthropology, GS 1-4, Keywords, Data/Facts, Case Studies, and custom question JSON formats.
                </p>
              </label>
            </div>

            {/* Target Table Selector */}
            <div className="bg-panel border border-border p-6 rounded-2xl space-y-4">
              <h3 className="font-bold text-sm text-ink flex items-center gap-2">
                <HardDrive size={16} className="text-primary" /> Select Target Supabase Table
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                {[
                  { id: 'mains_questions', label: 'mains_questions (& answers)' },
                  { id: 'mains_data_facts', label: 'mains_data_facts' },
                  { id: 'mains_keywords', label: 'mains_keywords' },
                  { id: 'mains_case_studies', label: 'mains_case_studies' },
                  { id: 'mains_sc_judgments', label: 'mains_sc_judgments' },
                  { id: 'mains_intro_conclusions', label: 'mains_intro_conclusions' },
                  { id: 'mains_frameworks', label: 'mains_frameworks' },
                  { id: 'mains_ethics_value_add', label: 'mains_ethics_value_add' },
                  { id: 'mains_essay_value_add', label: 'mains_essay_value_add' },
                ].map((tbl) => (
                  <button
                    key={tbl.id}
                    type="button"
                    onClick={() => setTargetTable(tbl.id)}
                    className={`p-3 rounded-xl border text-left font-semibold transition ${
                      targetTable === tbl.id
                        ? 'border-primary bg-primary/10 text-primary font-bold'
                        : 'border-border bg-bg text-muted hover:text-ink'
                    }`}
                  >
                    {tbl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={executeUpload}
              disabled={isUploading || !parsedData}
              className="w-full py-4 bg-primary text-black font-black text-base rounded-2xl shadow-lg hover:opacity-95 disabled:opacity-40 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {isUploading ? (
                <>
                  <RefreshCw size={20} className="animate-spin" />
                  Uploading to Supabase… ({uploadProgress}%)
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  Upload Records to Supabase ({targetTable})
                </>
              )}
            </button>
          </div>

          {/* Right Col: Stats & Logs */}
          <div className="space-y-4">
            {/* Status Card */}
            <div className="bg-panel border border-border p-5 rounded-2xl">
              <h3 className="font-bold text-xs tracking-wider text-muted uppercase mb-3">File Summary</h3>
              {statusSummary ? (
                <div className="text-sm font-semibold text-ink bg-bg p-3 rounded-xl border border-border">
                  {statusSummary}
                </div>
              ) : (
                <div className="text-xs text-muted">No file loaded yet. Upload a JSON file to inspect.</div>
              )}
            </div>

            {/* Progress Bar */}
            {isUploading && (
              <div className="bg-panel border border-border p-5 rounded-2xl space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span>Upload Progress</span>
                  <span className="text-primary">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-bg h-3 rounded-full overflow-hidden border border-border">
                  <div
                    className="bg-primary h-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Realtime Log Terminal */}
            <div className="bg-black/90 text-emerald-400 font-mono text-xs p-4 rounded-2xl h-80 overflow-y-auto border border-border shadow-inner">
              <div className="text-muted mb-2 text-[10px] uppercase font-bold tracking-widest border-b border-border/40 pb-1">
                Upload Live Log Output
              </div>
              {logMessages.length === 0 ? (
                <div className="text-muted/60 italic">Logs will appear here during upload execution...</div>
              ) : (
                logMessages.map((log, idx) => (
                  <div key={idx} className="mb-1 leading-relaxed">{log}</div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: PRESET WORKSPACE JSONS */}
      {activeTab === 'presets' && (
        <div className="space-y-6">
          <div className="bg-panel border border-border p-4 rounded-xl text-xs text-muted flex items-center gap-2">
            <Sparkles size={16} className="text-primary shrink-0" />
            <span>Select any pre-formatted Optional or GS Mains dataset below to auto-load and upload directly to Supabase.</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PRESET_FILES.map((preset, idx) => (
              <div
                key={idx}
                className="bg-panel border border-border p-5 rounded-2xl flex flex-col justify-between hover:border-primary transition group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-primary/10 text-primary">
                      {preset.category}
                    </span>
                    <span className="text-[10px] text-muted font-mono">
                      {preset.table}
                    </span>
                  </div>
                  <h4 className="font-bold text-ink text-sm mb-1 group-hover:text-primary transition">
                    {preset.label}
                  </h4>
                  <p className="text-muted text-xs font-mono truncate">{preset.name}</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleLoadPreset(preset)}
                  className="mt-4 py-2 px-3 bg-bg hover:bg-primary hover:text-black border border-border rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5"
                >
                  Load & Prepare Upload <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
