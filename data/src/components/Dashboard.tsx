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

  // 1. KPI Calculations
  const emergencyCount = cases.filter(c => c.c_section_nature === 'emergency').length;
  const electiveCount = cases.filter(c => c.c_section_nature === 'elective').length;
  
  const emergencyPercent = total > 0 ? ((emergencyCount / total) * 100).toFixed(1) : '0.0';
  const bookedCount = cases.filter(c => c.booking_status === 'booked').length;
  const unbookedCount = cases.filter(c => c.booking_status === 'unbooked').length;
  const bookedPercent = total > 0 ? ((bookedCount / total) * 100).toFixed(1) : '0.0';

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

  return (
    <div className="dashboard-container animation-slide-down">
      
      {/* 1. TOP LEVEL KPI CARDS (UPGRADED RADIAL GRADIENT SAAS LOOK) */}
      <div className="dashboard-kpi-grid">
        
        <div className="kpi-card premium total-cases-kpi">
          <div className="kpi-icon-overlay">
            <Users size={70} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label text-white-muted">Study Sample (N)</span>
            <span className="kpi-value text-white">{total}</span>
            <span className="kpi-subtext text-white-muted">Multigravida Patients</span>
          </div>
        </div>

        <div className="kpi-card premium emergency-kpi">
          <div className="kpi-icon-overlay">
            <TrendingUp size={70} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label text-white-muted">Clinical Urgency Ratio</span>
            <span className="kpi-value text-white">{emergencyPercent}%</span>
            <span className="kpi-subtext text-white-muted">
              {emergencyCount} Emergency / {electiveCount} Elective
            </span>
          </div>
        </div>

        <div className="kpi-card premium booking-kpi">
          <div className="kpi-icon-overlay">
            <Milestone size={70} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label text-white-muted">Antenatal Care booking</span>
            <span className="kpi-value text-white">{bookedPercent}%</span>
            <span className="kpi-subtext text-white-muted">
              {bookedCount} Booked / {unbookedCount} Unbooked
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
          <div className="recharts-wrapper-box" style={{ width: '100%', height: 300 }}>
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
                margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
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
                margin={{ top: 10, right: 20, left: -25, bottom: 5 }}
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
                margin={{ top: 10, right: 10, left: -15, bottom: 5 }}
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
        <div className="card chart-card">
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
      </div>

    </div>
  );
}
