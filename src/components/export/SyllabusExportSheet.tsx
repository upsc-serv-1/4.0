import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Switch, ActivityIndicator, Alert,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { X, FileDown, Check, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme';

export interface SyllabusExportSheetProps {
  visible: boolean;
  onClose: () => void;
  progress: Record<string, any>;
  syllabus: Record<string, Record<string, string[]>>;
  title?: string;
}

export const SyllabusExportSheet = ({ visible, onClose, progress, syllabus, title = 'Syllabus Completion Report' }: SyllabusExportSheetProps) => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [includeMicroTopics, setIncludeMicroTopics] = useState(true);
  const [includeUnattempted, setIncludeUnattempted] = useState(true);
  const [exportMode, setExportMode] = useState<'single' | 'multi'>('multi');

  // Reset loading state whenever modal is opened
  React.useEffect(() => {
    if (visible) setLoading(false);
  }, [visible]);

  const generatePdf = async () => {
    try {
      setLoading(true);
      
      let html = `
        <html>
        <head>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #1f2937; }
            h1 { color: #111827; text-align: center; }
            .header-info { margin-bottom: 30px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
            .subject-block { margin-bottom: 40px; page-break-inside: avoid; }
            .subject-title { font-size: 20px; font-weight: bold; color: #111827; margin-bottom: 10px; border-left: 5px solid #2563eb; padding-left: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background-color: #f3f4f6; text-align: left; padding: 8px; font-size: 12px; border: 1px solid #e5e7eb; }
            td { padding: 8px; font-size: 11px; border: 1px solid #e5e7eb; }
            .status-badge { padding: 2px 6px; borderRadius: 4px; font-size: 10px; font-weight: bold; }
            .completed { background-color: #dcfce7; color: #166534; }
            .pending { background-color: #fee2e2; color: #991b1b; }
            .stats-row { display: flex; justify-content: space-between; margin-bottom: 20px; background: #f9fafb; padding: 15px; borderRadius: 8px; }
            .stat-item { text-align: center; }
            .stat-val { font-size: 18px; font-weight: 800; display: block; }
            .stat-label { font-size: 10px; color: #6b7280; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <div class="header-info">
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
          </div>
      `;

      // Aggregate overall stats
      let total = 0;
      let completed = 0;

      Object.entries(syllabus).forEach(([sub, groups]) => {
        Object.entries(groups).forEach(([group, topics]) => {
          topics.forEach(topic => {
            const path = `${sub}.${group}.${topic}`;
            total++;
            if (progress[path]?.mastered) completed++;
          });
        });
      });

      html += `
        <div class="stats-row">
          <div class="stat-item">
            <span class="stat-val">${total}</span>
            <span class="stat-label">Total Topics</span>
          </div>
          <div class="stat-item">
            <span class="stat-val">${completed}</span>
            <span class="stat-label">Mastered</span>
          </div>
          <div class="stat-item">
            <span class="stat-val">${Math.round((completed/total)*100)}%</span>
            <span class="stat-label">Total Progress</span>
          </div>
        </div>

        <div class="subject-block" style="margin-top: 20px;">
          <div class="subject-title">Subject-wise Mastery Summary</div>
          <table>
            <thead>
              <tr>
                <th style="width: 40%;">Subject</th>
                <th>Completion Progress</th>
                <th style="width: 15%; text-align: center;">%</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(syllabus).map(([sub, groups]) => {
                let sTotal = 0;
                let sCompleted = 0;
                Object.values(groups).forEach(topics => {
                  topics.forEach(topic => {
                    sTotal++;
                    const path = `${sub}.${Object.keys(groups).find(k => groups[k] === topics)}.${topic}`;
                    if (progress[path]?.mastered) sCompleted++;
                  });
                });
                const percent = Math.round((sCompleted/sTotal)*100);
                return `
                  <tr>
                    <td style="font-weight: bold;">${sub}</td>
                    <td style="vertical-align: middle;">
                      <div style="width: 100%; height: 12px; background: #e5e7eb; border-radius: 6px; overflow: hidden;">
                        <div style="width: ${percent}%; height: 100%; background: #2563eb;"></div>
                      </div>
                    </td>
                    <td style="text-align: center; font-weight: bold; color: #2563eb;">${percent}%</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        <div style="page-break-after: always;"></div>
      `;

      // Subject-wise details
      Object.entries(syllabus).forEach(([sub, groups]) => {
        let subTotal = 0;
        let subCompleted = 0;
        
        Object.entries(groups).forEach(([_, topics]) => {
          topics.forEach(topic => {
            subTotal++;
            const path = `${sub}.${_}.${topic}`;
            if (progress[path]?.mastered) subCompleted++;
          });
        });

        html += `
          <div class="subject-block">
            <div class="subject-title">${sub} (${Math.round((subCompleted/subTotal)*100)}%)</div>
            <table>
              <thead>
                <tr>
                  <th style="width: 25%;">Section</th>
                  <th>Topic</th>
                  ${exportMode === 'multi' ? `
                    <th style="width: 12%;">NCERT</th>
                    <th style="width: 12%;">PYQs</th>
                  ` : ''}
                  <th style="width: 15%;">Mastery</th>
                </tr>
              </thead>
              <tbody>
        `;

        Object.entries(groups).forEach(([group, topics]) => {
          topics.forEach((topic, idx) => {
            const path = `${sub}.${group}.${topic}`;
            const p = progress[path] || {};
            
            if (!includeUnattempted && !p.mastered && !p.ncert && !p.pyqs) return;

            html += `
              <tr>
                <td>${idx === 0 ? group : ''}</td>
                <td>${topic}</td>
                ${exportMode === 'multi' ? `
                  <td><span class="status-badge ${p.ncert ? 'completed' : 'pending'}">${p.ncert ? 'DONE' : 'PENDING'}</span></td>
                  <td><span class="status-badge ${p.pyqs ? 'completed' : 'pending'}">${p.pyqs ? 'DONE' : 'PENDING'}</span></td>
                ` : ''}
                <td><span class="status-badge ${p.mastered ? 'completed' : 'pending'}">${p.mastered ? 'MASTERED' : 'IN PROGRESS'}</span></td>
              </tr>
            `;
          });
        });

        html += `
              </tbody>
            </table>
          </div>
        `;
      });

      html += `</body></html>`;

      const { uri } = await Print.printToFileAsync({ html });
      setLoading(false); // Reset button as soon as PDF is ready
      try {
        const sharePromise = Sharing.shareAsync(uri);
        const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 8000)); // 8 second timeout
        await Promise.race([sharePromise, timeoutPromise]).catch(() => {
          console.warn('[SyllabusExport] Share operation timed out or was dismissed');
        });
      } catch (shareErr) {
        console.error('[SyllabusExport] Sharing error:', shareErr);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to generate PDF');
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={[styles.content, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Syllabus Export Options</Text>
            <TouchableOpacity onPress={onClose}>
              <X color={colors.textSecondary} size={24} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body}>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>CONTENT OPTIONS</Text>
              
              <View style={styles.row}>
                <View>
                  <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>Include Micro-topics</Text>
                  <Text style={[styles.rowSub, { color: colors.textTertiary }]}>Detailed topic-wise breakdown</Text>
                </View>
                <Switch value={includeMicroTopics} onValueChange={setIncludeMicroTopics} />
              </View>

              <View style={styles.row}>
                <View>
                  <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>Show Unattempted Topics</Text>
                  <Text style={[styles.rowSub, { color: colors.textTertiary }]}>Include pending areas in report</Text>
                </View>
                <Switch value={includeUnattempted} onValueChange={setIncludeUnattempted} />
              </View>

              <View style={[styles.modeToggle, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                 <TouchableOpacity 
                   onPress={() => setExportMode('single')}
                   style={[styles.modeBtn, exportMode === 'single' && { backgroundColor: colors.primary }]}
                 >
                   <Text style={[styles.modeBtnText, { color: exportMode === 'single' ? '#fff' : colors.textTertiary }]}>SINGLE (Mastery Only)</Text>
                 </TouchableOpacity>
                 <TouchableOpacity 
                   onPress={() => setExportMode('multi')}
                   style={[styles.modeBtn, exportMode === 'multi' && { backgroundColor: colors.primary }]}
                 >
                   <Text style={[styles.modeBtnText, { color: exportMode === 'multi' ? '#fff' : colors.textTertiary }]}>MULTI (All Details)</Text>
                 </TouchableOpacity>
              </View>
            </View>

            <View style={styles.infoCard}>
              <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 20 }}>
                This report will generate a comprehensive PDF of your curriculum completion, including NCERT status, PYQ coverage, and final mastery levels.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity 
              style={[styles.btn, { backgroundColor: colors.primary }]}
              onPress={generatePdf}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <FileDown color="#fff" size={20} />
                  <Text style={styles.btnText}>GENERATE SYLLABUS PDF</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    width: '100%',
    height: '60%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
  },
  body: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  rowSub: {
    fontSize: 12,
    marginTop: 2,
  },
  infoCard: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
  },
  footer: {
    paddingTop: 16,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
  },
  btnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  modeToggle: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  modeBtnText: {
    fontSize: 10,
    fontWeight: '800',
  }
});
