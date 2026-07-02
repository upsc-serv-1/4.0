import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { PageHeader } from '../components/shared/PageHeader';
import { DataTable } from '../components/shared/DataTable';
import { usePagination } from '../hooks/usePagination';
import {
  ShieldCheck, Tags, Package, Users, Plus, Pencil, Trash2, Search,
  X, Check, Save, AlertTriangle, ToggleLeft, ToggleRight, Layers,
  Building2, BookOpen, Ban, Sparkles, DollarSign, Calendar, RefreshCw
} from 'lucide-react';
import type {
  AccessFeature, AccessPlan, PlanFeature, PlanInstitute, PlanCourse,
  UserSubscription, UserFeatureOverride, ColumnDef
} from '../lib/types';

// ==========================================================================
// TAB COMPONENTS
// ==========================================================================

// ── HELPERS ──
const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const formatCurrency = (n: number, c: string) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n);

// ── TABS DEFINITION ──
const TABS = [
  { key: 'features', label: 'Features', icon: Tags },
  { key: 'plans', label: 'Plans', icon: Package },
  { key: 'subscriptions', label: 'Subscriptions', icon: Users },
  { key: 'overrides', label: 'Overrides', icon: Ban },
  { key: 'audit', label: 'Audit Log', icon: AlertTriangle },
] as const;

type TabKey = (typeof TABS)[number]['key'];

// ==========================================================================
// MAIN PAGE
// ==========================================================================

export default function AccessControlPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('features');

  return (
    <div className="p-8">
      <PageHeader title="Access Control" subtitle="Manage features, plans, subscriptions & user overrides">
        <div className="flex items-center gap-1 bg-panel border border-border rounded-lg p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${
                  isActive
                    ? 'bg-primary text-black shadow-sm'
                    : 'text-muted hover:text-ink hover:bg-border/40'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </PageHeader>

      {activeTab === 'features' && <FeaturesTab />}
      {activeTab === 'plans' && <PlansTab />}
      {activeTab === 'subscriptions' && <SubscriptionsTab />}
      {activeTab === 'overrides' && <OverridesTab />}
      {activeTab === 'audit' && <AuditLogTab />}
    </div>
  );
}

// ==========================================================================
// TAB 1: FEATURES MANAGER
// ==========================================================================

function FeaturesTab() {
  const [features, setFeatures] = useState<AccessFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AccessFeature | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const pagination = usePagination(50);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('access_features').select('*', { count: 'exact' }).order('sort_order');
    if (search) query = query.ilike('name', `%${search}%`);
    const { data, count } = await query
      .range((pagination.page - 1) * pagination.perPage, pagination.page * pagination.perPage - 1);
    setFeatures((data || []) as AccessFeature[]);
    pagination.setTotal(count || 0);
    setLoading(false);
  }, [search, pagination.page, pagination.perPage]);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (f: AccessFeature) => {
    await supabase.from('access_features').update({ is_active: !f.is_active }).eq('id', f.id);
    load();
  };

  const save = async () => {
    if (!editing) return;
    if (editing.id === 'new') {
      await supabase.from('access_features').insert({
        key: editing.key,
        name: editing.name,
        description: editing.description,
        category: editing.category,
        sort_order: editing.sort_order,
      });
    } else {
      await supabase.from('access_features').update({
        key: editing.key,
        name: editing.name,
        description: editing.description,
        category: editing.category,
        sort_order: editing.sort_order,
      }).eq('id', editing.id);
    }
    setEditing(null);
    setShowAdd(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this feature? This will remove it from all plans.')) return;
    await supabase.from('access_features').delete().eq('id', id);
    load();
  };

  const columns: ColumnDef[] = [
    { key: 'sort_order', label: '#', width: '5%' },
    { key: 'key', label: 'Key', width: '15%', render: (v: string) => <code className="text-xs bg-border/40 px-1.5 py-0.5 rounded font-mono">{v}</code> },
    { key: 'name', label: 'Name', width: '20%' },
    { key: 'category', label: 'Category', width: '12%', render: (v: string) => <span className="text-xs capitalize bg-border/30 px-2 py-0.5 rounded-full">{v}</span> },
    { key: 'description', label: 'Description', width: '25%', render: (v: string) => <span className="text-muted text-sm">{v || '—'}</span> },
    { key: 'is_active', label: 'Active', width: '8%', render: (_: any, row: AccessFeature) => (
      <button onClick={() => toggleActive(row)} className="p-1 hover:bg-border/40 rounded">
        {row.is_active ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} className="text-muted" />}
      </button>
    )},
    { key: 'actions', label: '', width: '15%', render: (_: any, row: AccessFeature) => (
      <div className="flex gap-1">
        <button onClick={() => { setEditing(row); setShowAdd(true); }} className="p-1.5 hover:bg-border/40 rounded text-muted hover:text-ink">
          <Pencil size={14} />
        </button>
        <button onClick={() => remove(row.id)} className="p-1.5 hover:bg-red-500/10 rounded text-muted hover:text-red-500">
          <Trash2 size={14} />
        </button>
      </div>
    )},
  ];

  const emptyFeature = (): AccessFeature => ({
    id: 'new', key: '', name: '', description: '', category: 'feature', is_active: true, sort_order: features.length + 1, created_at: '',
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 bg-panel border border-border rounded px-3 py-2">
          <Search size={16} className="text-muted" />
          <input className="bg-transparent text-sm outline-none" placeholder="Search features..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => { setEditing(emptyFeature()); setShowAdd(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-black rounded-lg text-sm font-bold hover:opacity-90">
          <Plus size={16} /> Add Feature
        </button>
      </div>

      <DataTable columns={columns} data={features} keyField="id" loading={loading} pagination={pagination} />

      {/* Add/Edit Modal */}
      {showAdd && editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-panel border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-bold text-lg">{editing.id === 'new' ? 'Add Feature' : 'Edit Feature'}</h3>
              <button onClick={() => { setShowAdd(false); setEditing(null); }} className="p-1 hover:bg-border/40 rounded"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wide">Feature Key</label>
                <input className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" value={editing.key} onChange={e => setEditing({ ...editing, key: e.target.value })} placeholder="e.g. pyq" />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wide">Name</label>
                <input className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Previous Year Questions" />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wide">Description</label>
                <input className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wide">Category</label>
                  <select className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value as any })}>
                    <option value="feature">Feature</option>
                    <option value="institute">Institute</option>
                    <option value="course">Course</option>
                    <option value="test">Test</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wide">Sort Order</label>
                  <input type="number" className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" value={editing.sort_order} onChange={e => setEditing({ ...editing, sort_order: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
              <button onClick={() => { setShowAdd(false); setEditing(null); }} className="px-4 py-2 text-sm font-bold text-muted hover:text-ink">Cancel</button>
              <button onClick={save} disabled={!editing.key || !editing.name} className="flex items-center gap-2 px-4 py-2 bg-primary text-black rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50">
                <Save size={16} /> Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================================================
// TAB 2: PLANS MANAGER
// ==========================================================================

function PlansTab() {
  const [plans, setPlans] = useState<AccessPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AccessPlan | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [planFeatures, setPlanFeatures] = useState<Record<string, boolean>>({});
  const [planInstitutes, setPlanInstitutes] = useState<string[]>([]);
  const [planCourses, setPlanCourses] = useState<string[]>([]);
  const [allFeatures, setAllFeatures] = useState<AccessFeature[]>([]);
  const [availableInstitutes, setAvailableInstitutes] = useState<string[]>([]);
  const [availableCourses, setAvailableCourses] = useState<string[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'features' | 'institutes' | 'courses'>('features');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('access_plans').select('*').order('sort_order');
    setPlans((data || []) as AccessPlan[]);

    // Load all features
    const { data: feats } = await supabase.from('access_features').select('*').order('sort_order');
    setAllFeatures((feats || []) as AccessFeature[]);

    // Load distinct institutes from tests table
    const { data: insts } = await supabase.from('tests').select('institute');
    const uniqueInsts = [...new Set((insts || []).map((r: any) => r.institute).filter(Boolean))].sort();
    setAvailableInstitutes(uniqueInsts);

    // Load distinct courses from tests table
    const { data: courses } = await supabase.from('tests').select('course');
    const uniqueCourses = [...new Set((courses || []).map((r: any) => r.course).filter(Boolean))].sort();
    setAvailableCourses(uniqueCourses);

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openPlanDetail = async (plan: AccessPlan) => {
    setEditing(plan);
    setSelectedPlanId(plan.id);
    setDetailTab('features');

    // Load plan features
    const { data: pfs } = await supabase.from('plan_features').select('*').eq('plan_id', plan.id);
    const featMap: Record<string, boolean> = {};
    (pfs || []).forEach((pf: PlanFeature) => { featMap[pf.feature_id] = pf.is_granted; });
    setPlanFeatures(featMap);

    // Load plan institutes
    const { data: pis } = await supabase.from('plan_institutes').select('institute_name').eq('plan_id', plan.id);
    setPlanInstitutes((pis || []).map((pi: any) => pi.institute_name));

    // Load plan courses
    const { data: pcs } = await supabase.from('plan_courses').select('course_name').eq('plan_id', plan.id);
    setPlanCourses((pcs || []).map((pc: any) => pc.course_name));
  };

  const toggleFeature = async (featureId: string, granted: boolean) => {
    if (!selectedPlanId) return;
    const existing = planFeatures[featureId];
    if (existing !== undefined) {
      await supabase.from('plan_features').update({ is_granted: granted }).eq('plan_id', selectedPlanId).eq('feature_id', featureId);
    } else {
      await supabase.from('plan_features').insert({ plan_id: selectedPlanId, feature_id: featureId, is_granted: granted });
    }
    setPlanFeatures(prev => ({ ...prev, [featureId]: granted }));
  };

  const toggleInstitute = async (institute: string) => {
    if (!selectedPlanId) return;
    const has = planInstitutes.includes(institute);
    if (has) {
      await supabase.from('plan_institutes').delete().eq('plan_id', selectedPlanId).eq('institute_name', institute);
      setPlanInstitutes(prev => prev.filter(i => i !== institute));
    } else {
      await supabase.from('plan_institutes').insert({ plan_id: selectedPlanId, institute_name: institute });
      setPlanInstitutes(prev => [...prev, institute]);
    }
  };

  const toggleCourse = async (course: string) => {
    if (!selectedPlanId) return;
    const has = planCourses.includes(course);
    if (has) {
      await supabase.from('plan_courses').delete().eq('plan_id', selectedPlanId).eq('course_name', course);
      setPlanCourses(prev => prev.filter(c => c !== course));
    } else {
      await supabase.from('plan_courses').insert({ plan_id: selectedPlanId, course_name: course });
      setPlanCourses(prev => [...prev, course]);
    }
  };

  const togglePlanActive = async (p: AccessPlan) => {
    await supabase.from('access_plans').update({ is_active: !p.is_active }).eq('id', p.id);
    load();
  };

  const removePlan = async (id: string) => {
    if (!confirm('Delete this plan? Users assigned to it will lose access.')) return;
    await supabase.from('access_plans').delete().eq('id', id);
    load();
  };

  const savePlan = async () => {
    if (!editing) return;
    if (editing.id === 'new') {
      const { data } = await supabase.from('access_plans').insert({
        name: editing.name, description: editing.description, price: editing.price,
        currency: editing.currency, interval: editing.interval, sort_order: editing.sort_order,
      }).select().single();
      if (data) {
        setSelectedPlanId(data.id);
        setEditing(data as AccessPlan);
      }
    } else {
      await supabase.from('access_plans').update({
        name: editing.name, description: editing.description, price: editing.price,
        currency: editing.currency, interval: editing.interval, sort_order: editing.sort_order,
      }).eq('id', editing.id);
    }
    setShowAdd(false);
    load();
  };

  const columns: ColumnDef[] = [
    { key: 'sort_order', label: '#', width: '5%' },
    { key: 'name', label: 'Name', width: '18%', render: (v: string, row: AccessPlan) => (
      <button onClick={() => openPlanDetail(row)} className="font-bold text-primary hover:underline text-left">{v}</button>
    )},
    { key: 'description', label: 'Description', width: '20%', render: (v: string) => <span className="text-muted text-sm">{v || '—'}</span> },
    { key: 'price', label: 'Price', width: '12%', render: (v: number, row: AccessPlan) => (
      <span className="font-bold">{v === 0 ? 'Free' : formatCurrency(v, row.currency)}</span>
    )},
    { key: 'interval', label: 'Interval', width: '10%', render: (v: string) => <span className="capitalize text-sm">{v}</span> },
    { key: 'is_active', label: 'Active', width: '8%', render: (_: any, row: AccessPlan) => (
      <button onClick={() => togglePlanActive(row)} className="p-1 hover:bg-border/40 rounded">
        {row.is_active ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} className="text-muted" />}
      </button>
    )},
    { key: 'actions', label: '', width: '12%', render: (_: any, row: AccessPlan) => (
      <div className="flex gap-1">
        <button onClick={() => { setEditing(row); setShowAdd(true); }} className="p-1.5 hover:bg-border/40 rounded text-muted hover:text-ink"><Pencil size={14} /></button>
        <button onClick={() => removePlan(row.id)} className="p-1.5 hover:bg-red-500/10 rounded text-muted hover:text-red-500"><Trash2 size={14} /></button>
      </div>
    )},
  ];

  const emptyPlan = (): AccessPlan => ({
    id: 'new', name: '', description: '', price: 0, currency: 'INR', interval: 'month', is_active: true, sort_order: plans.length + 1, created_at: '',
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted">{plans.length} plans configured</span>
        <button onClick={() => { setEditing(emptyPlan()); setShowAdd(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-black rounded-lg text-sm font-bold hover:opacity-90">
          <Plus size={16} /> Add Plan
        </button>
      </div>

      <DataTable columns={columns} data={plans} keyField="id" loading={loading} />

      {/* Add/Edit Plan Modal */}
      {showAdd && editing && editing.id === 'new' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-panel border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-bold text-lg">Add Plan</h3>
              <button onClick={() => { setShowAdd(false); setEditing(null); }} className="p-1 hover:bg-border/40 rounded"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wide">Name</label>
                  <input className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Pro Monthly" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wide">Price</label>
                  <input type="number" className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" value={editing.price} onChange={e => setEditing({ ...editing, price: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wide">Description</label>
                <input className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wide">Currency</label>
                  <select className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" value={editing.currency} onChange={e => setEditing({ ...editing, currency: e.target.value })}>
                    <option value="INR">INR</option><option value="USD">USD</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wide">Interval</label>
                  <select className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" value={editing.interval} onChange={e => setEditing({ ...editing, interval: e.target.value as any })}>
                    <option value="month">Monthly</option><option value="year">Yearly</option>
                    <option value="lifetime">Lifetime</option><option value="one_time">One Time</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wide">Sort Order</label>
                  <input type="number" className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" value={editing.sort_order} onChange={e => setEditing({ ...editing, sort_order: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
              <button onClick={() => { setShowAdd(false); setEditing(null); }} className="px-4 py-2 text-sm font-bold text-muted hover:text-ink">Cancel</button>
              <button onClick={savePlan} disabled={!editing.name} className="flex items-center gap-2 px-4 py-2 bg-primary text-black rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50">
                <Save size={16} /> Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan Detail Panel (slide-over) */}
      {selectedPlanId && editing && editing.id !== 'new' && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <div className="bg-panel border-l border-border w-full max-w-2xl overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-panel z-10">
              <div>
                <h3 className="font-bold text-lg">{editing.name}</h3>
                <p className="text-sm text-muted">
                  {editing.price === 0 ? 'Free' : formatCurrency(editing.price, editing.currency)} / {editing.interval}
                </p>
              </div>
              <button onClick={() => { setSelectedPlanId(null); setEditing(null); }} className="p-1 hover:bg-border/40 rounded"><X size={18} /></button>
            </div>

            {/* Detail Tabs */}
            <div className="flex gap-1 px-6 py-3 border-b border-border bg-surface/50">
              {(['features', 'institutes', 'courses'] as const).map((tab) => {
                const Icon = tab === 'features' ? Layers : tab === 'institutes' ? Building2 : BookOpen;
                return (
                  <button key={tab} onClick={() => setDetailTab(tab)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                      detailTab === tab ? 'bg-primary text-black' : 'text-muted hover:text-ink hover:bg-border/40'
                    }`}>
                    <Icon size={14} /> {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                );
              })}
            </div>

            <div className="p-6">
              {detailTab === 'features' && (
                <div className="space-y-1">
                  <p className="text-xs text-muted mb-3 font-bold uppercase tracking-wide">Toggle which features this plan includes</p>
                  {allFeatures.map((feat) => {
                    const granted = planFeatures[feat.id];
                    const isSet = granted !== undefined;
                    return (
                      <div key={feat.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-border/20 transition-colors">
                        <div className="flex items-center gap-3">
                          {isSet ? (
                            <button onClick={() => { const newFeats = { ...planFeatures }; delete newFeats[feat.id]; setPlanFeatures(newFeats); supabase.from('plan_features').delete().eq('plan_id', selectedPlanId).eq('feature_id', feat.id); }} className="p-1 hover:bg-border/40 rounded">
                              <X size={14} className="text-muted" />
                            </button>
                          ) : (
                            <div className="w-6" />
                          )}
                          <div>
                            <div className="text-sm font-semibold">{feat.name}</div>
                            <code className="text-[10px] text-muted font-mono">{feat.key}</code>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isSet ? (
                            <button
                              onClick={() => toggleFeature(feat.id, !granted)}
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                granted ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-500'
                              }`}
                            >
                              {granted ? 'Granted' : 'Revoked'}
                            </button>
                          ) : (
                            <button onClick={() => toggleFeature(feat.id, true)}
                              className="px-3 py-1 rounded-lg text-xs font-bold bg-border/40 text-muted hover:bg-primary/20 hover:text-primary transition-all">
                              + Add
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {detailTab === 'institutes' && (
                <div>
                  <p className="text-xs text-muted mb-3 font-bold uppercase tracking-wide">Select institutes this plan grants access to</p>
                  <div className="grid grid-cols-2 gap-2">
                    {availableInstitutes.map((inst) => {
                      const has = planInstitutes.includes(inst);
                      return (
                        <button key={inst} onClick={() => toggleInstitute(inst)}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                            has ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-border/20 text-muted hover:bg-border/40 border border-transparent'
                          }`}>
                          {has ? <Check size={14} /> : <Building2 size={14} />}
                          {inst}
                        </button>
                      );
                    })}
                  </div>
                  {availableInstitutes.length === 0 && <p className="text-sm text-muted">No institutes found in tests table.</p>}
                </div>
              )}

              {detailTab === 'courses' && (
                <div>
                  <p className="text-xs text-muted mb-3 font-bold uppercase tracking-wide">Select courses this plan grants access to</p>
                  <div className="grid grid-cols-2 gap-2">
                    {availableCourses.map((course) => {
                      const has = planCourses.includes(course);
                      return (
                        <button key={course} onClick={() => toggleCourse(course)}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                            has ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-border/20 text-muted hover:bg-border/40 border border-transparent'
                          }`}>
                          {has ? <Check size={14} /> : <BookOpen size={14} />}
                          {course}
                        </button>
                      );
                    })}
                  </div>
                  {availableCourses.length === 0 && <p className="text-sm text-muted">No courses found in tests table.</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================================================
// TAB 3: USER SUBSCRIPTIONS
// ==========================================================================

function SubscriptionsTab() {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [plans, setPlans] = useState<AccessPlan[]>([]);
  const [showAssign, setShowAssign] = useState(false);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignPlanId, setAssignPlanId] = useState('');
  const [assignExpires, setAssignExpires] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const pagination = usePagination(50);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('user_subscriptions')
      .select('*, access_plans!inner(name), users!inner(email)');
    if (search) query = query.or(`users.email.ilike.%${search}%,access_plans.name.ilike.%${search}%`);
    const { data, count } = await query
      .order('created_at', { ascending: false })
      .range((pagination.page - 1) * pagination.perPage, pagination.page * pagination.perPage - 1);
    setSubscriptions(data || []);
    pagination.setTotal(count || 0);

    const { data: p } = await supabase.from('access_plans').select('*').order('sort_order');
    setPlans((p || []) as AccessPlan[]);
    setLoading(false);
  }, [search, pagination.page, pagination.perPage]);

  useEffect(() => { load(); }, [load]);

  const assignSubscription = async () => {
    if (!assignUserId || !assignPlanId) return;
    const { error } = await supabase.from('user_subscriptions').insert({
      user_id: assignUserId,
      plan_id: assignPlanId,
      expires_at: assignExpires || null,
      notes: assignNotes,
    });
    if (error) {
      console.error('Failed to assign subscription:', error);
      alert(`Failed to assign subscription: ${error.message}`);
      return;
    }
    setShowAssign(false);
    setAssignUserId('');
    setAssignPlanId('');
    setAssignExpires('');
    setAssignNotes('');
    load();
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase.from('user_subscriptions').update({ is_active: !isActive }).eq('id', id);
    if (error) { alert(`Error: ${error.message}`); return; }
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this subscription?')) return;
    const { error } = await supabase.from('user_subscriptions').delete().eq('id', id);
    if (error) { alert(`Error: ${error.message}`); return; }
    load();
  };

  const columns: ColumnDef[] = [
    { key: 'user_id', label: 'User', width: '20%', render: (_: any, row: any) => {
      const email = row.users?.email || row.user_id?.substring(0, 12);
      return <span className="text-sm">{email}</span>;
    }},
    { key: 'plan_id', label: 'Plan', width: '15%', render: (_: any, row: any) => (
      <span className="font-semibold">{row.access_plans?.name || '—'}</span>
    )},
    { key: 'is_active', label: 'Status', width: '10%', render: (_: any, row: any) => {
      const expired = row.expires_at && new Date(row.expires_at) < new Date();
      const status = !row.is_active ? 'Inactive' : expired ? 'Expired' : 'Active';
      const colors = !row.is_active ? 'bg-gray-500/20 text-gray-500' : expired ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-600';
      return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${colors}`}>{status}</span>;
    }},
    { key: 'starts_at', label: 'Starts', width: '12%', render: (v: string) => <span className="text-sm">{formatDate(v)}</span> },
    { key: 'expires_at', label: 'Expires', width: '12%', render: (v: string) => <span className="text-sm">{formatDate(v)}</span> },
    { key: 'notes', label: 'Notes', width: '15%', render: (v: string) => <span className="text-sm text-muted">{v || '—'}</span> },
    { key: 'actions', label: '', width: '16%', render: (_: any, row: any) => (
      <div className="flex gap-1">
        <button onClick={() => toggleActive(row.id, row.is_active)} className="p-1.5 hover:bg-border/40 rounded text-muted hover:text-ink">
          {row.is_active ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
        </button>
        <button onClick={() => remove(row.id)} className="p-1.5 hover:bg-red-500/10 rounded text-muted hover:text-red-500">
          <Trash2 size={14} />
        </button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 bg-panel border border-border rounded px-3 py-2">
          <Search size={16} className="text-muted" />
          <input className="bg-transparent text-sm outline-none" placeholder="Search by user or plan..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setShowAssign(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-black rounded-lg text-sm font-bold hover:opacity-90">
          <Plus size={16} /> Assign Plan
        </button>
      </div>

      <DataTable columns={columns} data={subscriptions} keyField="id" loading={loading} pagination={pagination} />

      {/* Assign Plan Modal */}
      {showAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-panel border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-bold text-lg">Assign Plan to User</h3>
              <button onClick={() => setShowAssign(false)} className="p-1 hover:bg-border/40 rounded"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wide">User ID (UUID)</label>
                <input className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary font-mono"
                  value={assignUserId} onChange={e => setAssignUserId(e.target.value)} placeholder="Paste user UUID here..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wide">Plan</label>
                <select className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                  value={assignPlanId} onChange={e => setAssignPlanId(e.target.value)}>
                  <option value="">Select a plan...</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name} ({p.price === 0 ? 'Free' : formatCurrency(p.price, p.currency)})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wide">Expires At (optional)</label>
                <input type="date" className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                  value={assignExpires} onChange={e => setAssignExpires(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wide">Notes (optional)</label>
                <input className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                  value={assignNotes} onChange={e => setAssignNotes(e.target.value)} placeholder="e.g. Free trial, promo, etc." />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
              <button onClick={() => setShowAssign(false)} className="px-4 py-2 text-sm font-bold text-muted hover:text-ink">Cancel</button>
              <button onClick={assignSubscription} disabled={!assignUserId || !assignPlanId}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-black rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50">
                <Sparkles size={16} /> Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================================================
// TAB 4: FEATURE OVERRIDES
// ==========================================================================

function OverridesTab() {
  const [overrides, setOverrides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [features, setFeatures] = useState<AccessFeature[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newFeatureKey, setNewFeatureKey] = useState('');
  const [newGranted, setNewGranted] = useState(true);
  const [newReason, setNewReason] = useState('');
  const pagination = usePagination(50);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('user_feature_overrides').select('*, users!inner(email)');
    if (search) query = query.or(`users.email.ilike.%${search}%,feature_key.ilike.%${search}%`);
    const { data, count } = await query
      .order('created_at', { ascending: false })
      .range((pagination.page - 1) * pagination.perPage, pagination.page * pagination.perPage - 1);
    setOverrides(data || []);
    pagination.setTotal(count || 0);

    const { data: f } = await supabase.from('access_features').select('*').order('sort_order');
    setFeatures((f || []) as AccessFeature[]);
    setLoading(false);
  }, [search, pagination.page, pagination.perPage]);

  useEffect(() => { load(); }, [load]);

  const addOverride = async () => {
    if (!newUserId || !newFeatureKey) return;
    await supabase.from('user_feature_overrides').insert({
      user_id: newUserId,
      feature_key: newFeatureKey,
      is_granted: newGranted,
      reason: newReason,
    });
    setShowAdd(false);
    setNewUserId('');
    setNewFeatureKey('');
    setNewGranted(true);
    setNewReason('');
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this override?')) return;
    await supabase.from('user_feature_overrides').delete().eq('id', id);
    load();
  };

  const columns: ColumnDef[] = [
    { key: 'user_id', label: 'User', width: '20%', render: (_: any, row: any) => (
      <span className="text-sm">{row.users?.email || row.user_id?.substring(0, 12)}</span>
    )},
    { key: 'feature_key', label: 'Feature', width: '15%', render: (v: string) => <code className="text-xs bg-border/40 px-1.5 py-0.5 rounded font-mono">{v}</code> },
    { key: 'is_granted', label: 'Access', width: '10%', render: (v: boolean) => (
      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${v ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-500'}`}>
        {v ? 'Granted' : 'Revoked'}
      </span>
    )},
    { key: 'reason', label: 'Reason', width: '25%', render: (v: string) => <span className="text-sm text-muted">{v || '—'}</span> },
    { key: 'created_at', label: 'Created', width: '15%', render: (v: string) => <span className="text-sm">{formatDate(v)}</span> },
    { key: 'actions', label: '', width: '15%', render: (_: any, row: any) => (
      <button onClick={() => remove(row.id)} className="p-1.5 hover:bg-red-500/10 rounded text-muted hover:text-red-500">
        <Trash2 size={14} />
      </button>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 bg-panel border border-border rounded px-3 py-2">
          <Search size={16} className="text-muted" />
          <input className="bg-transparent text-sm outline-none" placeholder="Search by user or feature..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-black rounded-lg text-sm font-bold hover:opacity-90">
          <Plus size={16} /> Add Override
        </button>
      </div>

      <DataTable columns={columns} data={overrides} keyField="id" loading={loading} pagination={pagination} />

      {/* Add Override Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-panel border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-bold text-lg">Add Feature Override</h3>
              <button onClick={() => setShowAdd(false)} className="p-1 hover:bg-border/40 rounded"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wide">User ID (UUID)</label>
                <input className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary font-mono"
                  value={newUserId} onChange={e => setNewUserId(e.target.value)} placeholder="Paste user UUID here..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wide">Feature</label>
                <select className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                  value={newFeatureKey} onChange={e => setNewFeatureKey(e.target.value)}>
                  <option value="">Select a feature...</option>
                  {features.map(f => <option key={f.id} value={f.key}>{f.name} ({f.key})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wide">Access Type</label>
                <div className="flex gap-2">
                  <button onClick={() => setNewGranted(true)}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-all ${newGranted ? 'bg-green-500/20 text-green-600 border border-green-500/30' : 'bg-border/20 text-muted border border-transparent'}`}>
                    Grant Access
                  </button>
                  <button onClick={() => setNewGranted(false)}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-all ${!newGranted ? 'bg-red-500/20 text-red-500 border border-red-500/30' : 'bg-border/20 text-muted border border-transparent'}`}>
                    Revoke Access
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wide">Reason (optional)</label>
                <input className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                  value={newReason} onChange={e => setNewReason(e.target.value)} placeholder="e.g. Beta tester, special access, etc." />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm font-bold text-muted hover:text-ink">Cancel</button>
              <button onClick={addOverride} disabled={!newUserId || !newFeatureKey}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-black rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50">
                <Save size={16} /> Add Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================================================
// TAB 5: AUDIT LOG
// ==========================================================================

function AuditLogTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const pagination = usePagination(100);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, count } = await supabase
      .from('access_audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((pagination.page - 1) * pagination.perPage, pagination.page * pagination.perPage - 1);
    setLogs(data || []);
    pagination.setTotal(count || 0);
    setLoading(false);
  }, [pagination.page, pagination.perPage]);

  useEffect(() => { load(); }, [load]);

  const actionColors: Record<string, string> = {
    subscription_created: 'bg-green-500/20 text-green-600',
    subscription_deactivated: 'bg-red-500/20 text-red-500',
    subscription_expired: 'bg-amber-500/20 text-amber-600',
    override_created: 'bg-blue-500/20 text-blue-600',
    override_deleted: 'bg-red-500/20 text-red-500',
    plan_created: 'bg-purple-500/20 text-purple-600',
    plan_updated: 'bg-purple-500/20 text-purple-600',
    feature_created: 'bg-teal-500/20 text-teal-600',
    feature_updated: 'bg-teal-500/20 text-teal-600',
  };

  const columns: ColumnDef[] = [
    { key: 'created_at', label: 'Time', width: '15%', render: (v: string) => (
      <span className="text-sm">{new Date(v).toLocaleString('en-IN')}</span>
    )},
    { key: 'action', label: 'Action', width: '18%', render: (v: string) => (
      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${actionColors[v] || 'bg-border/40 text-muted'}`}>
        {v.replace(/_/g, ' ')}
      </span>
    )},
    { key: 'target_type', label: 'Target', width: '12%', render: (v: string) => (
      <span className="text-sm capitalize">{v}</span>
    )},
    { key: 'target_id', label: 'Target ID', width: '20%', render: (v: string) => (
      <code className="text-xs font-mono">{v?.substring(0, 16) || '—'}...</code>
    )},
    { key: 'details', label: 'Details', width: '25%', render: (v: any) => (
      <span className="text-xs text-muted">{v ? JSON.stringify(v).substring(0, 60) : '—'}</span>
    )},
    { key: 'actor_id', label: 'Actor', width: '10%', render: (v: string) => (
      <code className="text-xs font-mono">{v?.substring(0, 8) || 'system'}...</code>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted">{pagination.total} audit log entries</span>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-panel border border-border rounded-lg text-sm font-bold hover:bg-border/40">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>
      <DataTable columns={columns} data={logs} keyField="id" loading={loading} pagination={pagination} />
    </div>
  );
}
