import { useState } from 'react';
import { TrendingUp, AlertCircle, BarChart3, PieChart as PieIcon, Users, Milestone, Calendar } from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  LabelList
} from 'recharts';
import { type CaseData } from '../types';

interface DashboardProps {
  cases: CaseData[];
}

export function Dashboard({ cases }: DashboardProps) {
  const total = cases.length;

  const [activeAuditCard, setActiveAuditCard] = useState<'sample' | 'incidence' | 'urgency' | 'booking' | null>(null);

  // Hospital Baseline state (saved in localStorage for persistence)
  const [baseline, setBaseline] = useState<number>(() => {
    const saved = localStorage.getItem('thesis_hospital_baseline');
    return saved ? parseInt(saved, 10) : 1000;
  });

  const handleBaselineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10) || 0;
    setBaseline(val);
    localStorage.setItem('thesis_hospital_baseline', val.toString());
  };

  // 1. KPI Calculations
  // Filter strictly for true primary C-sections in multigravida (Gravida >= 2 and No previous LSCS)
  const truePrimaryCsCases = cases.filter(c => {
    const grav = typeof c.gravida === 'number' ? c.gravida : parseInt(String(c.gravida || '0'), 10);
    return grav >= 2 && c.prev_delivery_lscs !== true;
  });

  const truePrimaryCount = truePrimaryCsCases.length;

  const emergencyCount = cases.filter(c => c.c_section_nature === 'emergency').length;
  const electiveCount = cases.filter(c => c.c_section_nature === 'elective').length;
  
  const emergencyPercent = total > 0 ? ((emergencyCount / total) * 100).toFixed(1) : '0.0';
  const electivePercent = total > 0 ? ((electiveCount / total) * 100).toFixed(1) : '0.0';

  const bookedCount = cases.filter(c => c.booking_status === 'booked').length;
  const unbookedCount = cases.filter(c => c.booking_status === 'unbooked').length;
  const bookedPercent = total > 0 ? ((bookedCount / total) * 100).toFixed(1) : '0.0';

  // Primary CS Incidence Rate against total hospital deliveries
  const incidenceRate = baseline > 0 ? ((truePrimaryCount / baseline) * 100).toFixed(2) : '0.00';

  // 2. Indications count
  const indicationsMap: Record<string, number> = {};
  cases.forEach(c => {
    const ind = (c.c_section_indication || 'Unspecified').trim();
    if (ind) {
      indicationsMap[ind] = (indicationsMap[ind] || 0) + 1;
    }
  });

  const sortedIndications = Object.entries(indicationsMap)
    .sort((a, b) => b[1] - a[1]);

  const indicationsData = sortedIndications.map(([name, value]) => ({
    name: name.length > 25 ? `${name.slice(0, 25)}...` : name,
    value
  }));

  // 3. Maternal Complications count
  const maternalComps = {
    pph: cases.filter(c => c.maternal_pph).length,
    transfusion: cases.filter(c => c.maternal_blood_transfusion).length,
    wound_infection: cases.filter(c => c.maternal_wound_infection).length,
    pyrexia: cases.filter(c => c.maternal_puerperal_pyrexia).length,
    icu: cases.filter(c => c.maternal_icu_admission).length,
    morbidity: cases.filter(c => c.maternal_morbidity).length,
    mortality: cases.filter(c => c.maternal_mortality).length,
  };

  const maternalData = [
    { name: 'PPH', count: maternalComps.pph },
    { name: 'Transfusion', count: maternalComps.transfusion },
    { name: 'Infection', count: maternalComps.wound_infection },
    { name: 'Pyrexia', count: maternalComps.pyrexia },
    { name: 'ICU Stay', count: maternalComps.icu },
    { name: 'Morbidity', count: maternalComps.morbidity },
    { name: 'Mortality', count: maternalComps.mortality },
  ];

  // 4. Neonatal Complications count
  const neonatalComps = {
    nicu: cases.filter(c => c.neonatal_nicu_admission).length,
    rds: cases.filter(c => c.neonatal_comp_rds).length,
    sepsis: cases.filter(c => c.neonatal_comp_sepsis).length,
    asphyxia: cases.filter(c => c.neonatal_comp_asphyxia).length,
    death: cases.filter(c => c.neonatal_early_death).length,
  };

  const neonatalData = [
    { name: 'NICU Adm.', count: neonatalComps.nicu },
    { name: 'RDS', count: neonatalComps.rds },
    { name: 'Sepsis', count: neonatalComps.sepsis },
    { name: 'Asphyxia', count: neonatalComps.asphyxia },
    { name: 'Early Death', count: neonatalComps.death },
  ];

  // Neonatal Birth Weight Categories
  const weightDistribution = {
    under1_5: 0,
    between1_5_2_5: 0,
    between2_5_3_5: 0,
    above3_5: 0
  };
  cases.forEach(c => {
    const weightVal = c.neonatal_birth_weight;
    const val = typeof weightVal === 'number' 
      ? weightVal 
      : parseFloat(String(weightVal || ''));
    if (!isNaN(val)) {
      if (val < 1.5) weightDistribution.under1_5++;
      else if (val >= 1.5 && val <= 2.5) weightDistribution.between1_5_2_5++;
      else if (val > 2.5 && val <= 3.5) weightDistribution.between2_5_3_5++;
      else if (val > 3.5) weightDistribution.above3_5++;
    }
  });

  const weightData = [
    { name: '< 1.5 kg', count: weightDistribution.under1_5 },
    { name: '1.5-2.5 kg', count: weightDistribution.between1_5_2_5 },
    { name: '2.5-3.5 kg', count: weightDistribution.between2_5_3_5 },
    { name: '> 3.5 kg', count: weightDistribution.above3_5 },
  ];

  // 5. Demographic Distributions
  const ageDistribution = {
    under20: cases.filter(c => typeof c.age === 'number' && c.age < 20).length,
    twenty29: cases.filter(c => typeof c.age === 'number' && c.age >= 20 && c.age <= 29).length,
    thirty39: cases.filter(c => typeof c.age === 'number' && c.age >= 30 && c.age <= 39).length,
    fortyPlus: cases.filter(c => typeof c.age === 'number' && c.age >= 40).length,
  };

  const ageData = [
    { name: '< 20 yrs', count: ageDistribution.under20 },
    { name: '20-29 yrs', count: ageDistribution.twenty29 },
    { name: '30-39 yrs', count: ageDistribution.thirty39 },
    { name: '≥ 40 yrs', count: ageDistribution.fortyPlus },
  ];

  const gestationDistribution = {
    preterm: cases.filter(c => typeof c.gestation_weeks === 'number' && c.gestation_weeks < 37).length,
    term: cases.filter(c => typeof c.gestation_weeks === 'number' && c.gestation_weeks >= 37 && c.gestation_weeks <= 40).length,
    postterm: cases.filter(c => typeof c.gestation_weeks === 'number' && c.gestation_weeks > 40).length,
  };

  const gestationData = [
    { name: 'Preterm (<37w)', count: gestationDistribution.preterm },
    { name: 'Term (37-40w)', count: gestationDistribution.term },
    { name: 'Postterm (>40w)', count: gestationDistribution.postterm },
  ];

  // 6. Cross Tabulations: Complications by Booking Status
  const getComplicationByBooking = (compField: keyof CaseData) => {
    const bookedWithComp = cases.filter(c => c.booking_status === 'booked' && c[compField] === true).length;
    const unbookedWithComp = cases.filter(c => c.booking_status === 'unbooked' && c[compField] === true).length;
    return { booked: bookedWithComp, unbooked: unbookedWithComp };
  };

  const crossTabBooking = [
    { label: "Postpartum Hemorrhage (PPH)", ...getComplicationByBooking('maternal_pph') },
    { label: "Blood Transfusion", ...getComplicationByBooking('maternal_blood_transfusion') },
    { label: "Wound Sepsis / Infection", ...getComplicationByBooking('maternal_wound_infection') },
    { label: "Puerperal Pyrexia", ...getComplicationByBooking('maternal_puerperal_pyrexia') },
    { label: "Maternal ICU Admission", ...getComplicationByBooking('maternal_icu_admission') },
    { label: "Neonatal NICU Admission", ...getComplicationByBooking('neonatal_nicu_admission') },
    { label: "Early Neonatal Death", ...getComplicationByBooking('neonatal_early_death') },
  ];

  // 7. Indication vs. Complication Matrix Rows
  const standardIndicationsList = [
    'Fetal Distress',
    'Severe Preeclampsia / Eclampsia',
    'Antepartum Hemorrhage (APH)',
    'Failed Induction',
    'Breech / Malpresentation',
    'CPD / Obstructed Labour',
    'Previous LSCS complications',
    'Others'
  ];

  const getCasesByIndicationGroup = (indGroup: string) => {
    if (indGroup === 'Others') {
      return cases.filter(c => {
        const ind = (c.c_section_indication || '').toLowerCase();
        return !standardIndicationsList.slice(0, 7).some(std => {
          const term = std.split(' ')[0].toLowerCase();
          return ind.includes(term);
        });
      });
    }
    const term = indGroup.split(' ')[0].toLowerCase();
    return cases.filter(c => (c.c_section_indication || '').toLowerCase().includes(term));
  };

  const indicationMatrixRows = standardIndicationsList.map(ind => {
    const matchedCases = getCasesByIndicationGroup(ind);
    const pph = matchedCases.filter(c => c.maternal_pph).length;
    const transfusion = matchedCases.filter(c => c.maternal_blood_transfusion).length;
    const sepsis = matchedCases.filter(c => c.maternal_wound_infection || c.maternal_puerperal_pyrexia).length;
    const icu = matchedCases.filter(c => c.maternal_icu_admission).length;
    return {
      indication: ind,
      pph,
      transfusion,
      sepsis,
      icu,
      total: matchedCases.length
    };
  });

  if (total === 0) {
    return (
      <div className="card text-center" style={{ padding: '60px 24px' }}>
        <BarChart3 size={48} className="text-muted" style={{ margin: '0 auto 16px auto', opacity: 0.5 }} />
        <h3>Thesis Statistics Dashboard</h3>
        <p className="text-muted mt-2">No patient case logs found. Upload case records via the intake vault or editor to generate real-time metrics.</p>
      </div>
    );
  }

  // Colors Palette
  const CHART_COLORS = ['#3b82f6', '#0d9488', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'];
  const AGE_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];
  const GESTATION_COLORS = ['#f59e0b', '#3b82f6', '#a855f7'];

  // Urgency ratio data for mini pie chart inside KPI card
  const urgencyData = [
    { name: 'Emergency', value: emergencyCount },
    { name: 'Elective', value: electiveCount }
  ];

  return (
    <div className="dashboard-container animation-slide-down">

      {/* Hospital Baseline interactive input row */}
      <div className="baseline-input-row" style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-card)', padding: '16px 24px', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
        <label htmlFor="baseline-input" style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>Hospital Baseline: Multigravida Deliveries with History of Previous NVD:</label>
        <input
          id="baseline-input"
          type="number"
          value={baseline}
          onChange={handleBaselineChange}
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 16px', width: '130px', color: 'var(--text-main)', fontWeight: 800, fontSize: '1rem', textAlign: 'center' }}
        />
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Used to dynamically calculate primary CS incidence rate against the total count of multigravida women with a history of previous vaginal deliveries.</span>
      </div>
      
      {/* 1. TOP LEVEL KPI CARDS (UPGRADED RADIAL GRADIENT SAAS LOOK) */}
      <div className="dashboard-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        
        <div 
          onClick={() => setActiveAuditCard('sample')}
          className="kpi-card premium total-cases-kpi" 
          style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', cursor: 'pointer' }}
          title="Click to view sample details"
        >
          <div className="kpi-icon-overlay">
            <Users size={70} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label text-white-muted">Study Sample (N)</span>
            <span className="kpi-value text-white">{total}</span>
            <span className="kpi-subtext text-white-muted" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Multigravida Patients</span>
              <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.15)', padding: '1px 6px', borderRadius: '4px', display: 'inline-block', fontWeight: 700 }}>ℹ Audit</span>
            </span>
          </div>
        </div>

        <div 
          onClick={() => setActiveAuditCard('incidence')}
          className="kpi-card premium total-cases-kpi" 
          style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)', cursor: 'pointer' }}
          title="Click to view calculation breakdown"
        >
          <div className="kpi-icon-overlay">
            <TrendingUp size={70} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label text-white-muted">Incidence of Primary CS</span>
            <span className="kpi-value text-white">{incidenceRate}%</span>
            <span className="kpi-subtext text-white-muted" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>({truePrimaryCount} of {baseline} Deliveries)</span>
              <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.15)', padding: '1px 6px', borderRadius: '4px', display: 'inline-block', fontWeight: 700 }}>ℹ Audit</span>
            </span>
          </div>
        </div>

        <div 
          onClick={() => setActiveAuditCard('urgency')}
          className="kpi-card premium emergency-kpi"
          style={{ cursor: 'pointer' }}
          title="Click to view urgency breakdown"
        >
          <div className="kpi-icon-overlay" style={{ right: '70px' }}>
            <TrendingUp size={70} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div className="kpi-content">
              <span className="kpi-label text-white-muted">Clinical Urgency Ratio</span>
              <span className="kpi-value text-white">{emergencyPercent}%</span>
              <span className="kpi-subtext text-white-muted" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{emergencyCount} Em. / {electiveCount} El.</span>
                <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.15)', padding: '1px 6px', borderRadius: '4px', display: 'inline-block', fontWeight: 700 }}>ℹ Audit</span>
              </span>
            </div>
            {/* Urgency Doughnut Chart */}
            <div style={{ width: 60, height: 60, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={urgencyData}
                    innerRadius={15}
                    outerRadius={25}
                    dataKey="value"
                    startAngle={90}
                    endAngle={-270}
                  >
                    <Cell fill="#ef4444" />
                    <Cell fill="#10b981" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div 
          onClick={() => setActiveAuditCard('booking')}
          className="kpi-card premium booking-kpi"
          style={{ cursor: 'pointer' }}
          title="Click to view ANC registration details"
        >
          <div className="kpi-icon-overlay">
            <Milestone size={70} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label text-white-muted">Antenatal Care booking</span>
            <span className="kpi-value text-white">{bookedPercent}%</span>
            <span className="kpi-subtext text-white-muted" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{bookedCount} Booked / {unbookedCount} Unbooked</span>
              <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.15)', padding: '1px 6px', borderRadius: '4px', display: 'inline-block', fontWeight: 700 }}>ℹ Audit</span>
            </span>
          </div>
        </div>

      </div>

      {/* 2. MAIN CHARTS SECTION */}
      <div className="dashboard-charts-grid">
        
        {/* Doughnut Chart: Indications */}
        <div className="card chart-card flex-col">
          <div className="chart-header">
            <h3><PieIcon size={18} className="text-accent" /> Indications for Primary C-Section</h3>
            <p className="card-subtitle">Etiological distribution of multigravida caesarean indicators</p>
          </div>
          <div className="recharts-wrapper-box" style={{ width: '100%', height: 200 }}>
            {indicationsData.length === 0 ? (
              <p className="text-muted text-center pt-16">No indications documented yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={indicationsData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {indicationsData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      background: 'rgba(30, 41, 59, 0.9)', 
                      borderColor: 'rgba(148, 163, 184, 0.2)', 
                      borderRadius: '8px',
                      color: '#ffffff'
                    }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {/* Custom Interactive HTML Legend displaying counts explicitly on iPads */}
          <div className="custom-legend-grid mt-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', fontSize: '0.78rem', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
            {indicationsData.map((item, index) => {
              const color = CHART_COLORS[index % CHART_COLORS.length];
              const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0';
              return (
                <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color, display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-main)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.name}>{item.name}:</span>
                  <span style={{ color: 'var(--text-accent)', fontWeight: 700 }}>{item.value} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Vertical Bar Chart: Maternal Complications */}
        <div className="card chart-card flex-col">
          <div className="chart-header">
            <h3><BarChart3 size={18} className="text-accent" /> Maternal Morbidity Profile</h3>
            <p className="card-subtitle">Count of specific post-caesarean maternal complications</p>
          </div>
          <div className="recharts-wrapper-box" style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={maternalData}
                margin={{ top: 15, right: 10, left: -25, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.12)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ 
                    background: 'rgba(30, 41, 59, 0.9)', 
                    borderColor: 'rgba(148, 163, 184, 0.2)', 
                    borderRadius: '8px',
                    color: '#ffffff'
                  }} 
                />
                <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]}>
                  {maternalData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill="#10b981" />
                  ))}
                  <LabelList dataKey="count" position="top" fontSize={10} fill="var(--text-muted)" offset={4} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Vertical Bar Chart: Neonatal Outcomes */}
        <div className="card chart-card flex-col col-span-2">
          <div className="chart-header">
            <h3><AlertCircle size={18} className="text-accent" /> Neonatal Morbidity Outcomes</h3>
            <p className="card-subtitle">Neonatal complications and ICU admission rates</p>
          </div>
          <div className="recharts-wrapper-box" style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={neonatalData}
                margin={{ top: 15, right: 20, left: -25, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.12)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ 
                    background: 'rgba(30, 41, 59, 0.9)', 
                    borderColor: 'rgba(148, 163, 184, 0.2)', 
                    borderRadius: '8px',
                    color: '#ffffff'
                  }} 
                />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={50}>
                  <LabelList dataKey="count" position="top" fontSize={10} fill="var(--text-muted)" offset={4} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart: Birth Weight */}
        <div className="card chart-card flex-col">
          <div className="chart-header">
            <h3><AlertCircle size={18} className="text-accent" /> Neonatal Birth Weight Distribution</h3>
            <p className="card-subtitle">Classification of birth weight profile in kilograms</p>
          </div>
          <div className="recharts-wrapper-box" style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={weightData}
                margin={{ top: 15, right: 10, left: -25, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.12)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ 
                    background: 'rgba(30, 41, 59, 0.9)', 
                    borderColor: 'rgba(148, 163, 184, 0.2)', 
                    borderRadius: '8px',
                    color: '#ffffff'
                  }} 
                />
                <Bar dataKey="count" fill="#ec4899" radius={[4, 4, 0, 0]}>
                  {weightData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[(index + 3) % CHART_COLORS.length]} />
                  ))}
                  <LabelList dataKey="count" position="top" fontSize={10} fill="var(--text-muted)" offset={4} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Horizontal Bar Chart: Age profile */}
        <div className="card chart-card">
          <div className="chart-header">
            <h3><Calendar size={18} className="text-accent" /> Maternal Age Profile</h3>
            <p className="card-subtitle">Histogram breakdown of age demographics in the cohort</p>
          </div>
          <div className="recharts-wrapper-box" style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={ageData}
                layout="vertical"
                margin={{ top: 10, right: 15, left: -15, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.12)" horizontal={false} />
                <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <YAxis type="category" dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ 
                    background: 'rgba(30, 41, 59, 0.9)', 
                    borderColor: 'rgba(148, 163, 184, 0.2)', 
                    borderRadius: '8px',
                    color: '#ffffff'
                  }} 
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={25}>
                  {ageData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={AGE_COLORS[index % AGE_COLORS.length]} />
                  ))}
                  <LabelList dataKey="count" position="right" fontSize={10} fill="var(--text-muted)" offset={4} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart: Gestational Weeks Profile */}
        <div className="card chart-card col-span-2">
          <div className="chart-header">
            <h3><Calendar size={18} className="text-accent" /> Gestational Age Distribution</h3>
            <p className="card-subtitle">Maturity classification of pregnancy cohort at admission</p>
          </div>
          <div className="recharts-wrapper-box" style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={gestationData}
                  cx="50%"
                  cy="45%"
                  outerRadius={70}
                  dataKey="count"
                  label={({ name, percent, value }) => `${name ? String(name).slice(0, 8) : ''}: ${value !== undefined ? value : 0} (${percent ? (Number(percent) * 100).toFixed(0) : 0}%)`}
                >
                  {gestationData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={GESTATION_COLORS[index % GESTATION_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ 
                    background: 'rgba(30, 41, 59, 0.9)', 
                    borderColor: 'rgba(148, 163, 184, 0.2)', 
                    borderRadius: '8px',
                    color: '#ffffff'
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* 3. CROSS-TABULATION MATRIX TABLE (MODERN ZEBRA STRIPED WITH PILLS) */}
      <div className="dashboard-tables-grid mt-4">
        
        <div className="card table-card">
          <div className="card-header">
            <h3>Maternal & Fetal Complications cross-tabulated by Booking Status</h3>
            <p className="card-subtitle">Dynamic matrix assessing the statistical impact of antenatal registration (SPSS/R thesis-ready table)</p>
          </div>
          <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table className="cases-table dashboard-table clean-striped-table">
              <thead>
                <tr>
                  <th className="sticky-header">Clinical Outcome Indicator</th>
                  <th className="sticky-header">Booked Cases (N={bookedCount})</th>
                  <th className="sticky-header">Unbooked Cases (N={unbookedCount})</th>
                  <th className="sticky-header text-right">Cumulative Frequency</th>
                </tr>
              </thead>
              <tbody>
                {crossTabBooking.map((row) => {
                  const totalComp = row.booked + row.unbooked;
                  const bookedPct = bookedCount > 0 ? ((row.booked / bookedCount) * 100).toFixed(1) : '0.0';
                  const unbookedPct = unbookedCount > 0 ? ((row.unbooked / unbookedCount) * 100).toFixed(1) : '0.0';
                  
                  return (
                    <tr key={row.label}>
                      <td><span className="font-semibold text-accent">{row.label}</span></td>
                      <td>
                        <div className="outcome-rate-badge">
                          <span className="count-num">{row.booked}</span>
                          <span className="pill-pct booked-pill">{bookedPct}%</span>
                        </div>
                      </td>
                      <td>
                        <div className="outcome-rate-badge">
                          <span className="count-num">{row.unbooked}</span>
                          <span className="pill-pct unbooked-pill">{unbookedPct}%</span>
                        </div>
                      </td>
                      <td className="text-right">
                        <span className="badge warning font-bold total-comp-pill">{totalComp}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* NEW MATRIX TABLE: INDICATION VS COMPLICATION */}
        <div className="card table-card mt-6">
          <div className="card-header">
            <h3>Indication vs. Maternal Complication Cross-Tabulation Matrix</h3>
            <p className="card-subtitle">Incidence count of maternal complications mapped against the primary surgical indications</p>
          </div>
          <div className="table-responsive" style={{ maxHeight: '450px', overflowY: 'auto' }}>
            <table className="cases-table dashboard-table clean-striped-table">
              <thead>
                <tr>
                  <th className="sticky-header">Primary Surgical Indication</th>
                  <th className="sticky-header text-center">PPH</th>
                  <th className="sticky-header text-center">Blood Transfusion</th>
                  <th className="sticky-header text-center">Wound Sepsis</th>
                  <th className="sticky-header text-center">ICU Admission</th>
                  <th className="sticky-header text-right">Total Cases with Indication</th>
                </tr>
              </thead>
              <tbody>
                {indicationMatrixRows.map((row) => (
                  <tr key={row.indication}>
                    <td><span className="font-semibold text-accent">{row.indication}</span></td>
                    <td className="text-center">
                      <span className={`pill-pct ${row.pph > 0 ? 'unbooked-pill' : 'booked-pill'}`} style={{ minWidth: '40px' }}>{row.pph}</span>
                    </td>
                    <td className="text-center">
                      <span className={`pill-pct ${row.transfusion > 0 ? 'unbooked-pill' : 'booked-pill'}`} style={{ minWidth: '40px' }}>{row.transfusion}</span>
                    </td>
                    <td className="text-center">
                      <span className={`pill-pct ${row.sepsis > 0 ? 'unbooked-pill' : 'booked-pill'}`} style={{ minWidth: '40px' }}>{row.sepsis}</span>
                    </td>
                    <td className="text-center">
                      <span className={`pill-pct ${row.icu > 0 ? 'unbooked-pill' : 'booked-pill'}`} style={{ minWidth: '40px' }}>{row.icu}</span>
                    </td>
                    <td className="text-right">
                      <span className="badge warning font-bold total-comp-pill">{row.total}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Dynamic Audit & Breakdown Modal */}
      {activeAuditCard !== null && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(15, 23, 42, 0.82)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div className="card" style={{
            maxWidth: '700px',
            width: '100%',
            maxHeight: '85vh',
            overflowY: 'auto',
            padding: '30px',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-card)',
            boxShadow: 'var(--shadow-lg)',
            animation: 'slideInDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📊 {activeAuditCard === 'sample' && 'Study Sample (N) Audit'}
                {activeAuditCard === 'incidence' && 'Incidence of Primary CS Audit'}
                {activeAuditCard === 'urgency' && 'Clinical Urgency Ratio Audit'}
                {activeAuditCard === 'booking' && 'Antenatal Care Booking Audit'}
              </h3>
              <button 
                onClick={() => setActiveAuditCard(null)}
                className="btn btn-secondary"
                style={{ padding: '4px 10px', borderRadius: '6px', minWidth: 'auto', border: '1px solid var(--border-color)' }}
              >
                ✕
              </button>
            </div>

            {/* Formula Block */}
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ color: 'var(--text-accent)', marginBottom: '8px' }}>The Formula</h4>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '0.92rem', color: '#a78bfa', textAlign: 'center', fontWeight: 700 }}>
                {activeAuditCard === 'sample' && 'N = Total multigravida C-sections entered in the thesis database'}
                {activeAuditCard === 'incidence' && '(True Primary Multigravida CS Cases / Hospital Baseline NVD) * 100'}
                {activeAuditCard === 'urgency' && 'Emergency Rate = (Emergency / N) * 100 | Elective Rate = (Elective / N) * 100'}
                {activeAuditCard === 'booking' && 'Booked Rate = (Booked / N) * 100 | Unbooked Rate = (Unbooked / N) * 100'}
              </div>
            </div>

            {/* Active Math Calculation Block */}
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ color: 'var(--text-accent)', marginBottom: '8px' }}>Active Calculation</h4>
              <div style={{ background: 'rgba(0,0,0,0.12)', padding: '16px', borderRadius: '8px', fontSize: '0.95rem', color: 'var(--text-main)', border: '1px solid var(--border-color)', lineHeight: '1.6' }}>
                {activeAuditCard === 'sample' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                    <span>Total Patients Sample Size (N):</span>
                    <span style={{ color: 'var(--text-accent)' }}>{total} records</span>
                  </div>
                )}
                {activeAuditCard === 'incidence' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span>Numerator (True Primary Multigravida CS):</span>
                      <strong>{truePrimaryCount} cases</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span>Denominator (Hospital Baseline NVD):</span>
                      <strong>{baseline} deliveries</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-color)', paddingTop: '8px', marginTop: '8px', fontWeight: 700 }}>
                      <span>Resulting Incidence Rate:</span>
                      <span style={{ color: 'var(--text-accent)' }}>({truePrimaryCount} / {baseline}) * 100 = {incidenceRate}%</span>
                    </div>
                  </>
                )}
                {activeAuditCard === 'urgency' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span>Emergency CS rate:</span>
                      <strong>({emergencyCount} / {total}) * 100 = {emergencyPercent}%</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span>Elective CS rate:</span>
                      <strong>({electiveCount} / {total}) * 100 = {electivePercent}%</strong>
                    </div>
                  </>
                )}
                {activeAuditCard === 'booking' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span>Booked (Registered) rate:</span>
                      <strong>({bookedCount} / {total}) * 100 = {bookedPercent}%</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span>Unbooked (Emergency referral) rate:</span>
                      <strong>({unbookedCount} / {total}) * 100 = {(total > 0 ? ((unbookedCount / total) * 100).toFixed(1) : '0.0')}%</strong>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Numerical Variable Breakdown Block */}
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ color: 'var(--text-accent)', marginBottom: '12px' }}>Audit Details</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem' }}>
                {activeAuditCard === 'sample' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '6px' }}>
                      <span>Total Logged Cases:</span>
                      <strong>{total}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '6px' }}>
                      <span>Primary CS Candidates (Included in incidence count):</span>
                      <strong style={{ color: '#10b981' }}>{truePrimaryCount}</strong>
                    </div>
                  </>
                )}
                {activeAuditCard === 'incidence' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(16, 185, 129, 0.08)', padding: '10px 14px', borderRadius: '6px' }}>
                      <span style={{ color: '#10b981' }}>✓ True Primary Multigravida C-Sections (Included):</span>
                      <strong style={{ color: '#10b981' }}>{truePrimaryCount}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(239, 68, 68, 0.05)', padding: '10px 14px', borderRadius: '6px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>✗ Primigravidas (G1) Excluded:</span>
                      <strong style={{ color: 'var(--text-muted)' }}>{cases.filter(c => (typeof c.gravida === 'number' ? c.gravida : parseInt(String(c.gravida || '0'), 10)) < 2).length}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(239, 68, 68, 0.05)', padding: '10px 14px', borderRadius: '6px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>✗ Repeat C-Sections (History of prior LSCS) Excluded:</span>
                      <strong style={{ color: 'var(--text-muted)' }}>{cases.filter(c => c.prev_delivery_lscs === true).length}</strong>
                    </div>
                  </>
                )}
                {activeAuditCard === 'urgency' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(239, 68, 68, 0.08)', padding: '10px 14px', borderRadius: '6px' }}>
                      <span style={{ color: '#ef4444' }}>🚨 Emergency Operations:</span>
                      <strong style={{ color: '#ef4444' }}>{emergencyCount}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(16, 185, 129, 0.08)', padding: '10px 14px', borderRadius: '6px' }}>
                      <span style={{ color: '#10b981' }}>📅 Elective Operations (Planned):</span>
                      <strong style={{ color: '#10b981' }}>{electiveCount}</strong>
                    </div>
                  </>
                )}
                {activeAuditCard === 'booking' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(16, 185, 129, 0.08)', padding: '10px 14px', borderRadius: '6px' }}>
                      <span style={{ color: '#10b981' }}>✓ Registered (Booked at Tertiary Center):</span>
                      <strong style={{ color: '#10b981' }}>{bookedCount}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(245, 158, 11, 0.08)', padding: '10px 14px', borderRadius: '6px' }}>
                      <span style={{ color: '#f59e0b' }}>⚠️ Unbooked (Referred in Emergency/Labor):</span>
                      <strong style={{ color: '#f59e0b' }}>{unbookedCount}</strong>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Patients list panel */}
            <div>
              <h4 style={{ color: 'var(--text-accent)', marginBottom: '12px' }}>
                {activeAuditCard === 'sample' && `Patient Study Sample (N=${total})`}
                {activeAuditCard === 'incidence' && `True Primary CS Patient List (N=${truePrimaryCount})`}
                {activeAuditCard === 'urgency' && 'Patient Urgency Breakdown'}
                {activeAuditCard === 'booking' && 'Patient Booking Breakdown'}
              </h4>
              {total === 0 ? (
                <p className="text-muted text-small">No patients currently saved in database.</p>
              ) : (
                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'rgba(0,0,0,0.15)', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '8px' }}>Reg No</th>
                        <th style={{ padding: '8px' }}>Patient Name</th>
                        {activeAuditCard === 'sample' && <th style={{ padding: '8px' }}>Gravida/Para</th>}
                        {activeAuditCard === 'incidence' && <th style={{ padding: '8px' }}>Gravida</th>}
                        {activeAuditCard === 'urgency' && <th style={{ padding: '8px' }}>Urgency</th>}
                        {activeAuditCard === 'booking' && <th style={{ padding: '8px' }}>Booking Status</th>}
                        <th style={{ padding: '8px', textAlign: 'right' }}>Admission Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Render list of cases accordingly */}
                      {cases.map((c, i) => {
                        // For incidence card, only show true primary cases
                        if (activeAuditCard === 'incidence') {
                          const grav = typeof c.gravida === 'number' ? c.gravida : parseInt(String(c.gravida || '0'), 10);
                          const isPrimary = grav >= 2 && c.prev_delivery_lscs !== true;
                          if (!isPrimary) return null;
                        }

                        return (
                          <tr key={c.id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '8px' }}>{c.reg_no || 'N/A'}</td>
                            <td style={{ padding: '8px', fontWeight: 600 }}>{c.patient_name || 'Anonymous'}</td>
                            {activeAuditCard === 'sample' && <td style={{ padding: '8px' }}>G{c.gravida || 0} P{c.para || 0}</td>}
                            {activeAuditCard === 'incidence' && <td style={{ padding: '8px' }}>G{c.gravida}</td>}
                            {activeAuditCard === 'urgency' && (
                              <td style={{ padding: '8px' }}>
                                <span className={`pill-pct ${c.c_section_nature === 'emergency' ? 'unbooked-pill' : 'booked-pill'}`} style={{ fontSize: '0.72rem', padding: '2px 6px' }}>
                                  {c.c_section_nature === 'emergency' ? 'Emergency' : 'Elective'}
                                </span>
                              </td>
                            )}
                            {activeAuditCard === 'booking' && (
                              <td style={{ padding: '8px' }}>
                                <span className={`pill-pct ${c.booking_status === 'booked' ? 'booked-pill' : 'unbooked-pill'}`} style={{ fontSize: '0.72rem', padding: '2px 6px' }}>
                                  {c.booking_status === 'booked' ? 'Booked' : 'Unbooked'}
                                </span>
                              </td>
                            )}
                            <td style={{ padding: '8px', textAlign: 'right' }}>
                              {c.date_of_admission ? (() => {
                                const pureDate = c.date_of_admission.split('T')[0];
                                if (/^\d{4}-\d{2}-\d{2}$/.test(pureDate)) {
                                  const [y, m, d] = pureDate.split('-');
                                  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', { dateStyle: 'medium' });
                                }
                                return new Date(c.date_of_admission).toLocaleDateString();
                              })() : 'N/A'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setActiveAuditCard(null)}
                className="btn btn-primary"
                style={{ padding: '8px 20px', borderRadius: '8px' }}
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
