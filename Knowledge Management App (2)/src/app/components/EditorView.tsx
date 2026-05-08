import { Save, ChevronLeft, Heading1, Heading2, AlignLeft, List, Code as CodeIcon, Sparkles, Trash2, Plus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { fetchNotebookContent, saveNotebookContent, CapsuleBlock, CapsuleNotebookContent } from '../../repositories/capsuleRepo';

interface EditorViewProps {
  onClose?: () => void;
  noteId?: string;
  noteDbId?: string | null;
  noteTitle?: string;
  onRefresh?: () => void;
}

export function EditorView({ onClose, noteId, noteDbId, noteTitle, onRefresh }: EditorViewProps) {
  const [blocks, setBlocks] = useState<CapsuleBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    if (noteDbId) {
      setLoading(true);
      fetchNotebookContent(noteDbId)
        .then(res => {
          setBlocks(res.blocks || []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      setBlocks([]);
    }
  }, [noteDbId]);

  const handleSave = async () => {
    if (!noteDbId) return;
    setSaving(true);
    const content: CapsuleNotebookContent = {
      blocks,
      highlights: [],
      version: 1
    };
    const success = await saveNotebookContent(noteDbId, content);
    if (success) {
      setHasUnsavedChanges(false);
      if (onRefresh) onRefresh();
    }
    setSaving(false);
  };

  const handleBlockChange = (id: string, newText: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, text: newText } : b));
    setHasUnsavedChanges(true);
  };

  const handleBlockMetadataChange = (id: string, backText: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, metadata: { ...b.metadata, back: backText } } : b));
    setHasUnsavedChanges(true);
  };

  const addBlock = (type: 'paragraph' | 'heading' | 'bullet' | 'code' | 'flashcard') => {
    const newBlock: CapsuleBlock = {
      id: `block_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      text: '',
      metadata: type === 'flashcard' ? { back: '' } : undefined
    };
    setBlocks(prev => [...prev, newBlock]);
    setHasUnsavedChanges(true);
  };

  const deleteBlock = (id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
    setHasUnsavedChanges(true);
  };

  const activeTitle = noteTitle || "Untitled Notebook";

  return (
    <div className="flex-1 bg-gray-50 overflow-hidden flex flex-col h-full">
      {/* Top Bar */}
      <div className="bg-white border-b border-border px-6 py-4 flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex flex-col">
            <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Editing Note</span>
            <h3 className="text-base font-extrabold text-gray-900 truncate max-w-sm">{activeTitle}</h3>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hasUnsavedChanges ? (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all text-sm font-bold shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          ) : (
            <span className="flex items-center gap-2 text-sm text-green-600 font-bold bg-green-50 px-3 py-1.5 rounded-xl border border-green-100">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span>Saved to Supabase</span>
            </span>
          )}
        </div>
      </div>

      {/* Editor Content Area */}
      <div className="flex-1 overflow-y-auto px-8 py-8 flex flex-col justify-start">
        <div className="max-w-4xl w-full mx-auto bg-white rounded-2xl shadow-sm border border-border p-8 min-h-[500px] flex flex-col">
          
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-24">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
              <p className="text-gray-500 mt-4 text-sm font-semibold">Loading editor...</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              <h1 className="text-2xl font-black text-gray-900 mb-8 pb-4 border-b border-gray-100">{activeTitle}</h1>

              {blocks.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/50 mb-8">
                  <p className="text-gray-400 font-medium">Your notebook is empty.</p>
                  <p className="text-gray-400 text-xs mt-1">Use the quick buttons below to add your first block of notes!</p>
                </div>
              ) : (
                <div className="space-y-6 mb-12">
                  {blocks.map((block) => (
                    <div key={block.id} className="group relative flex items-start gap-4 p-2 -mx-2 rounded-xl hover:bg-gray-50/50 transition-colors">
                      <div className="flex-1">
                        {block.type === 'heading' && (
                          <input
                            type="text"
                            value={block.text}
                            onChange={(e) => handleBlockChange(block.id, e.target.value)}
                            placeholder="Enter heading text..."
                            className="w-full text-lg font-extrabold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-100 focus:border-primary focus:outline-none pb-1"
                          />
                        )}

                        {block.type === 'paragraph' && (
                          <textarea
                            value={block.text}
                            onChange={(e) => handleBlockChange(block.id, e.target.value)}
                            placeholder="Type a paragraph..."
                            rows={2}
                            className="w-full text-base text-gray-700 bg-transparent border border-transparent hover:border-gray-100 focus:border-primary focus:outline-none rounded-lg p-2 resize-none leading-relaxed"
                          />
                        )}

                        {block.type === 'bullet' && (
                          <div className="flex items-center gap-3">
                            <span className="text-gray-400">•</span>
                            <input
                              type="text"
                              value={block.text}
                              onChange={(e) => handleBlockChange(block.id, e.target.value)}
                              placeholder="List item..."
                              className="w-full text-base text-gray-700 bg-transparent border-b border-transparent hover:border-gray-100 focus:border-primary focus:outline-none pb-1"
                            />
                          </div>
                        )}

                        {block.type === 'code' && (
                          <textarea
                            value={block.text}
                            onChange={(e) => handleBlockChange(block.id, e.target.value)}
                            placeholder="Paste your code block..."
                            rows={3}
                            className="w-full font-mono text-sm text-gray-800 bg-gray-50 border border-border hover:border-gray-300 focus:border-primary focus:outline-none rounded-xl p-3 resize-none"
                          />
                        )}

                        {block.type === 'flashcard' && (
                          <div className="bg-blue-50/40 border border-blue-100 rounded-2xl p-4 space-y-3">
                            <div>
                              <label className="block text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">Flashcard Question (Front)</label>
                              <input
                                type="text"
                                value={block.text}
                                onChange={(e) => handleBlockChange(block.id, e.target.value)}
                                placeholder="Enter flashcard front..."
                                className="w-full text-sm font-semibold text-gray-800 bg-white border border-blue-100 focus:border-blue-300 focus:outline-none rounded-lg px-3 py-2"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">Answer (Back)</label>
                              <input
                                type="text"
                                value={block.metadata?.back || ''}
                                onChange={(e) => handleBlockMetadataChange(block.id, e.target.value)}
                                placeholder="Enter flashcard answer..."
                                className="w-full text-sm text-gray-600 bg-white border border-blue-100 focus:border-blue-300 focus:outline-none rounded-lg px-3 py-2 italic"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => deleteBlock(block.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all shrink-0 self-center"
                        title="Delete Block"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick Toolbar (Sticky at bottom of container) */}
              <div className="mt-auto pt-6 border-t border-gray-100 flex items-center justify-center gap-2 flex-wrap shrink-0">
                <button
                  onClick={() => addBlock('heading')}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors text-xs font-bold"
                >
                  <Heading1 className="w-4 h-4 text-gray-500" />
                  <span>+ Heading</span>
                </button>
                <button
                  onClick={() => addBlock('paragraph')}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors text-xs font-bold"
                >
                  <AlignLeft className="w-4 h-4 text-gray-500" />
                  <span>+ Paragraph</span>
                </button>
                <button
                  onClick={() => addBlock('bullet')}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors text-xs font-bold"
                >
                  <List className="w-4 h-4 text-gray-500" />
                  <span>+ Bullet List</span>
                </button>
                <button
                  onClick={() => addBlock('code')}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors text-xs font-bold"
                >
                  <CodeIcon className="w-4 h-4 text-gray-500" />
                  <span>+ Code</span>
                </button>
                <button
                  onClick={() => addBlock('flashcard')}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-50/60 text-blue-700 border border-blue-100 rounded-xl hover:bg-blue-100/50 transition-colors text-xs font-extrabold"
                >
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  <span>+ Flashcard</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
