import { Bell, Share2, Upload, MoreVertical, ChevronLeft } from 'lucide-react';
import { useState, useEffect } from 'react';
import { fetchNotebookContent, CapsuleNotebookContent } from '../../repositories/capsuleRepo';

interface GlanceViewProps {
  onBack?: () => void;
  onOpenEditor?: () => void;
  noteId?: string;
  noteDbId?: string | null;
  noteTitle?: string;
}

export function GlanceView({ onBack, onOpenEditor, noteId, noteDbId, noteTitle }: GlanceViewProps) {
  const [content, setContent] = useState<CapsuleNotebookContent | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (noteDbId) {
      setLoading(true);
      console.log('[GlanceView] Fetching content for noteDbId:', noteDbId);
      fetchNotebookContent(noteDbId)
        .then(res => {
          console.log('[GlanceView] Received res:', res);
          setContent(res);
          setLoading(false);
        })
        .catch((err) => {
          console.error('[GlanceView] Fetch error:', err);
          setLoading(false);
        });
    } else {
      console.warn('[GlanceView] No noteDbId passed!');
      setContent(null);
    }
  }, [noteDbId]);

  const activeTitle = noteTitle || "Article 14 — Equality Before Law";

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <p className="text-gray-500 mt-4 text-sm font-medium">Loading note content from Supabase...</p>
        </div>
      );
    }

    if (noteDbId) {
      if (!content || !content.blocks || content.blocks.length === 0) {
        return (
          <div className="text-center py-24 px-6 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
            <p className="text-gray-500 font-medium">This notebook is currently empty.</p>
            <p className="text-gray-400 text-xs mt-2 max-w-sm mx-auto">
              You can start adding structured blocks of notes, flashcards, or study guides by opening it in the editor.
            </p>
            <button
              onClick={onOpenEditor}
              className="mt-6 px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors text-sm font-semibold shadow-sm"
            >
              Start Writing
            </button>
          </div>
        );
      }

      return (
        <div className="space-y-5 text-gray-700 leading-relaxed">
          {content.blocks.map((block) => {
            switch (block.type) {
              case 'heading':
                return (
                  <h2 key={block.id} className="text-xl font-extrabold mt-8 mb-3 text-gray-900 border-b border-gray-100 pb-2">
                    {block.text}
                  </h2>
                );
              case 'bullet':
                return (
                  <ul key={block.id} className="list-disc list-inside pl-4 space-y-1.5 text-gray-700">
                    <li className="text-base">{block.text}</li>
                  </ul>
                );
              case 'code':
                return (
                  <pre key={block.id} className="bg-gray-50 p-4 rounded-xl font-mono text-sm overflow-x-auto border border-border">
                    <code>{block.text}</code>
                  </pre>
                );
              case 'image':
                return (
                  <img
                    key={block.id}
                    src={block.text}
                    alt="Note attachment"
                    className="rounded-xl max-h-96 object-cover mx-auto my-6 shadow-sm border border-border"
                  />
                );
              case 'flashcard':
                return (
                  <div key={block.id} className="bg-blue-50/40 border border-blue-100 rounded-2xl p-6 my-6 shadow-sm">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 mb-3">
                      Flashcard
                    </span>
                    <p className="font-bold text-gray-800 text-base">{block.text}</p>
                    {block.metadata?.back && (
                      <div className="mt-3 text-sm text-gray-600 border-t border-blue-100/60 pt-3 italic">
                        {block.metadata.back}
                      </div>
                    )}
                  </div>
                );
              default:
                return (
                  <p key={block.id} className="text-base text-gray-700 leading-relaxed">
                    {block.text}
                  </p>
                );
            }
          })}
        </div>
      );
    }

    // Static Fallback for testing / standalone browser
    return (
      <article className="prose prose-slate max-w-none">
        <div className="mb-8">
          <div className="flex items-start justify-between mb-6">
            <h1 className="mb-0 text-3xl font-extrabold tracking-tight text-gray-900">Article 14 — Equality Before Law</h1>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 shrink-0 ml-4">
              Key Point
            </span>
          </div>
          <p className="text-lg text-gray-600">
            A comprehensive study guide on Article 14 of the Indian Constitution, covering the fundamental
            right to equality, its interpretation, exceptions, and landmark judicial pronouncements.
          </p>
        </div>

        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4 text-gray-900 border-b border-gray-100 pb-2">Introduction to Equality Before Law</h2>
          <ul className="space-y-4 text-gray-700">
            <li>
              <p>
                Article 14 of the Indian Constitution guarantees the{' '}
                <span className="bg-yellow-100 px-1 rounded">Right to Equality</span>. It states: "The State shall not deny to
                any person equality before the law or the equal protection of the laws within the territory of
                India." This foundational principle establishes a bedrock for justice and fairness in Indian democracy.
              </p>
            </li>
            <li>
              <p>
                The article embodies two fundamental concepts — <span className="bg-yellow-100 px-1 rounded">Equality before Law</span>{' '}
                (derived from British common law) and <span className="bg-yellow-100 px-1 rounded">Equal Protection of Laws</span>{' '}
                (borrowed from the American Constitution).
              </p>
            </li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4 text-gray-900 border-b border-gray-100 pb-2">Doctrine of Reasonable Classification</h2>
          <p className="text-gray-700">
            Article 14 does not prohibit all classifications but only unreasonable or arbitrary classifications. 
            For a classification to be valid, it must satisfy two conditions: (1) It must be founded on an 
            <strong> intelligible differentia</strong>, and (2) The differentia must have a 
            <strong> rational relation</strong> to the object sought to be achieved.
          </p>
        </section>
      </article>
    );
  };

  return (
    <div className="flex-1 bg-background overflow-y-auto flex flex-col">
      {/* Sticky Header */}
      <div className="bg-white border-b border-border px-6 py-4 shrink-0 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-extrabold tracking-tight text-gray-900 truncate max-w-md">
              {activeTitle}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Bell className="w-5 h-5 text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Share2 className="w-5 h-5 text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Upload className="w-5 h-5 text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <MoreVertical className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Content Container */}
      <div className="flex-1 px-8 py-8">
        <div className="max-w-4xl mx-auto">
          {renderContent()}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="bg-white border-t border-border px-6 py-3 shrink-0 shadow-sm">
        <div className="flex items-center justify-center">
          <button
            onClick={onOpenEditor}
            className="px-6 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors text-sm font-semibold shadow-sm"
          >
            Open in Editor
          </button>
        </div>
      </div>
    </div>
  );
}
