import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { PageHeader } from '../shared/PageHeader';
import { StatCard } from '../shared/StatCard';
import { FileQuestion, FileText, Users, Trophy, Activity, BookOpen } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({
    questions: 0, tests: 0, attempts: 0, users: 0,
    avgAcc: 0, cards: 0
  });

  useEffect(() => {
    (async () => {
      const [
        { count: q }, { count: t }, { count: a }, { count: u },
        { data: perfRows }, { count: c }
      ] = await Promise.all([
        supabase.from('questions').select('*', { count: 'exact', head: true }),
        supabase.from('tests').select('*', { count: 'exact', head: true }),
        supabase.from('test_attempts').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('admin_user_performance').select('accuracy_pct').limit(500),
        supabase.from('cards').select('*', { count: 'exact', head: true }),
      ]);
      const avgAcc = perfRows?.length
        ? Math.round(perfRows.reduce((s: number, r: any) => s + (r.accuracy_pct || 0), 0) / perfRows.length)
        : 0;
      setStats({
        questions: q || 0, tests: t || 0, attempts: a || 0,
        users: u || 0, avgAcc, cards: c || 0
      });
    })();
  }, []);

  return (
    <div className="p-8">
      <PageHeader title="Dashboard" subtitle="Platform overview" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard icon={<FileQuestion className="text-primary" />} value={stats.questions} label="Total Questions" />
        <StatCard icon={<FileText className="text-primary" />} value={stats.tests} label="Test Papers" />
        <StatCard icon={<BookOpen className="text-primary" />} value={stats.cards} label="Flashcards" />
        <StatCard icon={<Users className="text-primary" />} value={stats.attempts} label="Total Attempts" />
        <StatCard icon={<Trophy className="text-primary" />} value={`${stats.avgAcc}%`} label="Avg Accuracy" />
        <StatCard icon={<Activity className="text-primary" />} value={stats.users} label="Registered Users" />
      </div>
    </div>
  );
}