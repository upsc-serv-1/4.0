import { FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { exportToExcel, exportToWord } from '../utils/exporters';
import { type CaseData } from '../types';

interface DataExporterProps {
  cases: CaseData[];
}

export function DataExporter({ cases }: DataExporterProps) {
  
  const handleExportExcel = () => {
    if (cases.length === 0) {
      alert("No data available to export. Save some cases first.");
      return;
    }
    exportToExcel(cases);
  };

  const handleExportWord = () => {
    if (cases.length === 0) {
      alert("No data available to export. Save some cases first.");
      return;
    }
    exportToWord(cases);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="card export-card">
      <div className="card-header">
        <h3>Database Export & Reports</h3>
        <p className="card-subtitle">Generate statistical spreadsheets for SPSS/R or print physical records for your guide</p>
      </div>
      <div className="export-grid">
        <button onClick={handleExportExcel} className="btn-export excel">
          <FileSpreadsheet className="export-icon" size={24} />
          <div className="export-text">
            <span className="export-title">Download Excel (.xlsx)</span>
            <span className="export-description">SPSS / R compatible master data sheet</span>
          </div>
        </button>

        <button onClick={handleExportWord} className="btn-export word">
          <FileText className="export-icon" size={24} />
          <div className="export-text">
            <span className="export-title">Download Word (.docx)</span>
            <span className="export-description">Formatted case summaries and tables</span>
          </div>
        </button>

        <button onClick={handlePrint} className="btn-export print">
          <Printer className="export-icon" size={24} />
          <div className="export-text">
            <span className="export-title">Print / Save PDF</span>
            <span className="export-description">Print clean case proformas directly</span>
          </div>
        </button>
      </div>
    </div>
  );
}
