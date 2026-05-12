// ==========================================================================
// useDataHealth — run quality scans across database tables
// ==========================================================================

import { useState, useCallback } from 'react';
import { runHealthCheck } from '../lib/queryUtils';
import type { DataHealthReport } from '../lib/types';

export function useDataHealth() {
  const [reports, setReports] = useState<DataHealthReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scan = useCallback(async (type?: string) => {
    setLoading(true);
    setError(null);

    const types = type ? [type] : [
      'missing_correct_answer',
      'empty_option',
      'blank_question_text',
      'no_explanation',
      'duplicate_questions',
      'orphan_cards',
      'unlinked_test',
      'cancelled_questions',
    ] as const;

    const results: DataHealthReport[] = [];

    for (const t of types) {
      try {
        const { count } = await runHealthCheck(t);
        const severity: DataHealthReport['severity'] =
          count > 100 ? 'critical' : count > 10 ? 'warning' : 'info';

        const labels: Record<string, string> = {
          missing_correct_answer: 'Questions missing correct_answer',
          empty_option: 'Questions with empty options',
          blank_question_text: 'Questions with blank text',
          no_explanation: 'Questions without explanations',
          duplicate_questions: 'Potential duplicate questions',
          orphan_cards: 'Cards without linked questions',
          unlinked_test: 'Questions without a test',
          cancelled_questions: 'Cancelled questions',
        };

        results.push({
          type: t as DataHealthReport['type'],
          label: labels[t] || t,
          count,
          severity,
          query: t,
        });
      } catch (err) {
        console.error(`Health scan "${t}" failed:`, err);
      }
    }

    setReports(results);
    setLoading(false);
  }, []);

  return { reports, loading, error, scan };
}