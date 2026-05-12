import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { X } from 'lucide-react-native';
import type { WidgetData } from '../../hooks/useWidgetData';
import { useTheme } from '../../context/ThemeContext';
import {
  DailyGoalWidget, ExamCountdownWidget, QuestionsTodayWidget,
  StudyTimeWidget, WeeklyActivityWidget, AccuracyTrendWidget,
  TodayScoreWidget, WeakestSubjectWidget, SpeedMeterWidget,
  StudyHeatmapWidget,
} from './CoreWidgets';
import {
  DueCardsWidget, MasteryRingWidget, PYQCoverageWidget,
  RecentNotesWidget, TaggedCountWidget, QuickPracticeWidget,
  LastTestWidget, TestScoresWidget,
} from '../ExtraWidgets';


interface Props {
  activeWidgets: string[];
  data: WidgetData;
  config?: any;
  colors: any;
  isEditMode?: boolean;
  onRemove?: (id: string) => void;
}

function renderWidget(id: string, data: WidgetData, config: any, colors: any) {
  switch (id) {
    case 'daily_goal':       return <DailyGoalWidget data={data} colors={colors} dailyGoal={config.dailyGoal} />;
    case 'exam_countdown':   return <ExamCountdownWidget colors={colors} examDate={config.examDate} />;
    case 'questions_today':  return <QuestionsTodayWidget data={data} colors={colors} />;
    case 'study_time_today': return <StudyTimeWidget data={data} colors={colors} />;
    case 'weekly_streak':    return <WeeklyActivityWidget data={data} colors={colors} />;
    case 'accuracy_trend':   return <AccuracyTrendWidget data={data} colors={colors} />;
    case 'correct_incorrect':return <TodayScoreWidget data={data} colors={colors} />;
    case 'weakest_subject':  return <WeakestSubjectWidget data={data} colors={colors} />;
    case 'speed_meter':      return <SpeedMeterWidget data={data} colors={colors} />;
    case 'due_cards':        return <DueCardsWidget data={data} colors={colors} />;
    case 'mastery_ring':     return <MasteryRingWidget data={data} colors={colors} config={config} />;
    case 'pyq_coverage':     return <PYQCoverageWidget data={data} colors={colors} />;
    case 'recent_notes':     return <RecentNotesWidget data={data} colors={colors} />;
    case 'tagged_count':     return <TaggedCountWidget data={data} colors={colors} />;
    case 'quick_practice':   return <QuickPracticeWidget colors={colors} />;
    case 'last_test':        return <LastTestWidget data={data} colors={colors} />;
    case 'test_scores':      return <TestScoresWidget data={data} colors={colors} />;
    case 'study_heatmap':    return <StudyHeatmapWidget data={data} colors={colors} />;
    default: return null;
  }
}

// Half-width widgets that can be paired in a row
const HALF_WIDTH_KEYS = new Set([
  'daily_goal', 'exam_countdown', 'questions_today', 'study_time_today',
  'correct_incorrect', 'speed_meter', 'due_cards', 'mastery_ring', 'tagged_count'
]);

export function WidgetGrid({ activeWidgets, data, config, colors, isEditMode, onRemove }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const isTablet = windowWidth >= 768;

  // On tablet, render in a 2-column grid (half-width + half-width pairs)
  if (isTablet) {
    const fullWidth: string[] = [];
    const halfWidth: string[] = [];
    (activeWidgets || []).forEach(id => {
      if (HALF_WIDTH_KEYS.has(id)) halfWidth.push(id);
      else fullWidth.push(id);
    });

    // Pair half-width widgets
    const pairs: string[][] = [];
    for (let i = 0; i < halfWidth.length; i += 2) {
      pairs.push(halfWidth.slice(i, i + 2));
    }

    return (
      <View style={{ gap: 12 }}>
        {fullWidth.map(id => (
          <View key={id} style={{ width: '100%', position: 'relative' }}>
            {renderWidget(id, data, config || {}, colors)}
            {isEditMode && onRemove && (
              <TouchableOpacity 
                style={rs.removeBtn} 
                onPress={() => onRemove(id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X color="#fff" size={14} />
              </TouchableOpacity>
            )}
          </View>
        ))}
        {pairs.map((pair, idx) => (
          <View key={`pair-${idx}`} style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
            {pair.map(id => (
              <View key={id} style={{ flex: 1, position: 'relative' }}>
                {renderWidget(id, data, config || {}, colors)}
                {isEditMode && onRemove && (
                  <TouchableOpacity 
                    style={rs.removeBtn} 
                    onPress={() => onRemove(id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <X color="#fff" size={14} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {/* If odd number, add a spacer */}
            {pair.length < 2 && <View style={{ flex: 1 }} />}
          </View>
        ))}
      </View>
    );
  }

  // Phone layout: stacked vertically
  return (
    <View style={{ gap: 12 }}>
      {(activeWidgets || []).map(id => (
        <View key={id} style={{ width: '100%', position: 'relative' }}>
          {renderWidget(id, data, config || {}, colors)}
          {isEditMode && onRemove && (
            <TouchableOpacity 
              style={rs.removeBtn} 
              onPress={() => onRemove(id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X color="#fff" size={14} />
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );
}

const rs = StyleSheet.create({
  pairRow: { flexDirection: 'row', gap: 12, width: '100%' },
  fullRow: { width: '100%' },
  removeBtn: {
    position: 'absolute', top: -6, right: -6, zIndex: 100,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
});

// 🆕 WidgetRenderer — used by DraggableFlatList in dashboard
export function WidgetRenderer({ widgetKey, data, onArchive, isEditMode, config }: {
  widgetKey: string;
  data?: WidgetData;
  onArchive?: () => void;
  isEditMode?: boolean;
  config?: any;
}) {
  const { colors } = useTheme();
  const content = renderWidget(widgetKey, data as WidgetData, config || {}, colors);
  return (
    <View style={{ position: 'relative' }}>
      {content}
      {isEditMode && onArchive && (
        <TouchableOpacity
          onPress={onArchive}
          style={rs.removeBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X color="#fff" size={12} />
        </TouchableOpacity>
      )}
    </View>
  );
}