import { Save, RotateCcw, RotateCw, Type, Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, ListTodo, Link as LinkIcon, Image as ImageIcon, Table, Code, Calendar, Paperclip, ChevronDown, Menu, X } from 'lucide-react';
import { useState } from 'react';

interface EditorViewProps {
  onClose?: () => void;
}

export function EditorView({ onClose }: EditorViewProps) {
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [activeTab, setActiveTab] = useState<'blocks' | 'outline'>('blocks');

  const highlightColors = [
    { name: 'Yellow', color: 'bg-yellow-300', active: true },
    { name: 'Lime', color: 'bg-lime-300' },
    { name: 'Green', color: 'bg-green-300' },
    { name: 'Pink', color: 'bg-pink-300' },
    { name: 'Purple', color: 'bg-purple-300' },
    { name: 'Blue', color: 'bg-blue-300' },
  ];

  return (
    <div className="flex-1 bg-white overflow-hidden flex flex-col">
      {/* Top Bar */}
      <div className="bg-white border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm">Article 21</h3>
          </div>
          <button className="p-1 hover:bg-gray-100 rounded transition-colors">
            <RotateCcw className="w-4 h-4 text-gray-500" />
          </button>
          <button className="p-1 hover:bg-gray-100 rounded transition-colors">
            <RotateCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-2 text-sm text-green-600">
            <Save className="w-4 h-4" />
            Saved
          </span>
          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Document Title & Toolbar */}
      <div className="bg-white border-b border-border px-8 py-4 shrink-0">
        <h1 className="mb-4">Article 14 — Equality Before Law</h1>

        {/* Toolbar */}
        <div className="flex items-center gap-1 flex-wrap">
          <button className="px-3 py-1.5 hover:bg-gray-100 rounded transition-colors text-sm">
            <span className="font-medium">H1</span>
          </button>
          <button className="px-3 py-1.5 hover:bg-gray-100 rounded transition-colors text-sm">
            <span className="font-medium">H2</span>
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
            <Bold className="w-5 h-5" />
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
            <Italic className="w-5 h-5" />
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
            <UnderlineIcon className="w-5 h-5" />
          </button>

          <div className="w-px h-6 bg-border mx-1" />

          <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
            <ListOrdered className="w-5 h-5" />
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
            <List className="w-5 h-5" />
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
            <ListTodo className="w-5 h-5" />
          </button>

          <div className="w-px h-6 bg-border mx-1" />

          <div className="relative">
            <button
              onClick={() => setShowHighlightPicker(!showHighlightPicker)}
              className="p-1.5 hover:bg-gray-100 rounded transition-colors"
            >
              <div className="w-5 h-5 bg-yellow-300 rounded"></div>
            </button>

            {showHighlightPicker && (
              <div className="absolute top-full mt-2 left-0 bg-white border border-border rounded-lg shadow-lg p-3 z-10">
                <div className="flex gap-2">
                  {highlightColors.map((color) => (
                    <button
                      key={color.name}
                      className={`w-7 h-7 ${color.color} rounded hover:ring-2 hover:ring-primary transition-all ${
                        color.active ? 'ring-2 ring-primary' : ''
                      }`}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
            <LinkIcon className="w-5 h-5" />
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
            <ImageIcon className="w-5 h-5" />
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
            <Calendar className="w-5 h-5" />
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
            <Paperclip className="w-5 h-5" />
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
            <Table className="w-5 h-5" />
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
            <Code className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex">
        {/* Editor */}
        <div className="flex-1 overflow-y-auto px-8 py-8 bg-background">
          <div className="max-w-4xl mx-auto bg-white rounded-lg p-8 min-h-full">
            <div className="space-y-6">
              <section>
                <h2 className="mb-4">Key Points</h2>
                <ul className="space-y-3 list-disc list-inside text-gray-700">
                  <li>
                    No person shall be deprived{' '}
                    <span className="bg-yellow-200">of his life or personal liberty except according to procedure established by law.</span>
                  </li>
                  <li>Interpreted widely by the judiciary.</li>
                  <li>
                    Includes <span className="bg-green-200">right to live with dignity.</span>
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="mb-4">Important Cases</h2>
                <ul className="space-y-3 list-disc list-inside text-gray-700">
                  <li>Maneka Gandhi v. Union of India</li>
                  <li>Olga Tellis v. Bombay Municipal Corp.</li>
                  <li>Puttaswamy Judgment (Privacy)</li>
                </ul>
              </section>

              <section>
                <h2 className="mb-4">Checklist</h2>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 text-gray-700 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300" />
                    <span>Read Article 14 text</span>
                  </label>
                  <label className="flex items-center gap-3 text-gray-700 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300" checked readOnly />
                    <span>Review key cases</span>
                  </label>
                  <label className="flex items-center gap-3 text-gray-700 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300" />
                    <span>Practice previous year questions</span>
                  </label>
                </div>
              </section>
            </div>
          </div>
        </div>

        {/* Outline Sidebar */}
        <div className="w-80 bg-white border-l border-border shrink-0 flex flex-col">
          <div className="border-b border-border flex">
            <button
              onClick={() => setActiveTab('blocks')}
              className={`flex-1 px-4 py-3 text-sm transition-colors ${
                activeTab === 'blocks'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Blocks
            </button>
            <button
              onClick={() => setActiveTab('outline')}
              className={`flex-1 px-4 py-3 text-sm transition-colors ${
                activeTab === 'outline'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Outline
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {activeTab === 'blocks' && (
              <>
                <div className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-gray-400 text-xs">H1</span>
                    <span className="text-sm truncate">Protection of Life and...</span>
                  </div>
                  <Menu className="w-4 h-4 text-gray-400 shrink-0" />
                </div>
                <div className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-gray-400 text-xs">H2</span>
                    <span className="text-sm">Key Points</span>
                  </div>
                  <Menu className="w-4 h-4 text-gray-400 shrink-0" />
                </div>
                <div className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-gray-400 text-xs">H2</span>
                    <span className="text-sm">Important Cases</span>
                  </div>
                  <Menu className="w-4 h-4 text-gray-400 shrink-0" />
                </div>
                <div className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-gray-400 text-xs">H2</span>
                    <span className="text-sm">Checklist</span>
                  </div>
                  <Menu className="w-4 h-4 text-gray-400 shrink-0" />
                </div>
              </>
            )}
            {activeTab === 'outline' && (
              <>
                <div className="px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                  <div className="text-sm">Article 14 — Equality...</div>
                  <div className="text-xs text-gray-400 mt-1">H1</div>
                </div>
                <div className="pl-6 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                  <div className="text-sm">Key Points</div>
                  <div className="text-xs text-gray-400 mt-1">H2</div>
                </div>
                <div className="pl-6 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                  <div className="text-sm">Important Cases</div>
                  <div className="text-xs text-gray-400 mt-1">H2</div>
                </div>
                <div className="pl-6 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                  <div className="text-sm">Checklist</div>
                  <div className="text-xs text-gray-400 mt-1">H2</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Toolbar */}
      <div className="bg-white border-t border-border px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <Type className="w-4 h-4" />
            <span>Aa</span>
          </button>
          <button className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <span>100%</span>
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">Words: 1234</span>
        </div>
      </div>
    </div>
  );
}
