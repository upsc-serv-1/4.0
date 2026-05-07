  const renderQuestionBlock = ({ item, index }: { item: Question, index: number }) => {
    if (!item) return null;
    const answerData = currentAnswers[item.id] || { selectedAnswer: null, confidence: null, difficulty: null, errorCategory: null, note: '' };
    const showExplanation = arenaMode === 'learning' && revealedExplanations[item.id];

    const normalizedExplanations = buildCanonicalExplanations(item);

    // Standardised single-line metadata: "INSTITUTE NAME – PROGRAM NAME – YEAR"
    // Hide any segment that is empty (per spec).
    const formatMetaLine = (e: any): string => {
      const segs = [
        String(e?.source || '').toUpperCase().trim(),
        normalizeProgramLabel(String(e?.program || '')).toUpperCase().trim(),
        String(e?.year || '').trim(),
      ].filter(Boolean);
      return segs.join(' – ');
    };

    const inferredInstitutes = (() => {
      const list = Array.isArray((item as any)._institutes)
        ? (item as any)._institutes
        : [];
      const normalized = list
        .map((value: any) => normalizeInstituteLabel(value))
        .filter(Boolean);
      const primary = normalizeInstituteLabel(item.tests?.institute || item.source?.institute || '');
      if (primary && !normalized.includes(primary)) normalized.push(primary);
      return Array.from(new Set(normalized));
    })();

    const availableExplSourceMap = new Map<string, string>();
    normalizedExplanations.forEach((e: any) => {
      availableExplSourceMap.set(e.sourceKey, e.source);
    });
    inferredInstitutes.forEach((label: string) => {
      const key = String(label || '').toLowerCase();
      if (key && !availableExplSourceMap.has(key)) {
        availableExplSourceMap.set(key, label);
      }
    });

    const availableExplSources = Array.from(availableExplSourceMap.entries()).map(([key, label]) => ({ key, label }));

    const selectedExplSourceRaw = activeExplSource[item.id] || 'all';
    // Accept 'all' + the institute keys + the two virtual sources we drive
    // from the unified chip switcher: 'ai' (Gemini-generated) and 'vitamin'
    // (the user's saved best answer for this question).
    const selectedExplSource = (
      selectedExplSourceRaw === 'all'
      || selectedExplSourceRaw === 'ai'
      || selectedExplSourceRaw === 'vitamin'
      || availableExplSourceMap.has(selectedExplSourceRaw)
    ) ? selectedExplSourceRaw : 'all';

    const sourceFilteredExplanations = selectedExplSource === 'all'
      ? normalizedExplanations
      : normalizedExplanations.filter((e: any) => e.sourceKey === selectedExplSource);

    const displayExplanations = sourceFilteredExplanations.length > 0
      ? sourceFilteredExplanations
      : (selectedExplSource !== 'all'
          ? [{
              source: availableExplSourceMap.get(selectedExplSource) || selectedExplSource,
              sourceKey: selectedExplSource,
              program: String(item.tests?.program_name || '').trim(),
              year: String(item.exam_year || '').trim(),
              answer: String(item.correct_answer || '').trim().toUpperCase(),
              text: '',
            }]
          : normalizedExplanations);

    const rawIdx = activeExplIndex[item.id] ?? -1;
    const safeIdx = rawIdx >= 0 && rawIdx < displayExplanations.length ? rawIdx : -1;
    let activeExplanationText: string = safeIdx === -1
      ? (displayExplanations.length > 1
          ? displayExplanations
              .map((e: any) => `**${formatMetaLine(e) || e.source}${e.answer ? ' · Ans: ' + e.answer : ''}:**\n\n${e.text || '*No explanation provided.*'}`)
              .join('\n\n---\n\n')
          : (displayExplanations[0]?.text || item.explanation_markdown || 'No explanation available.'))
      : (displayExplanations[safeIdx]
          ? (displayExplanations[safeIdx].text || '*No explanation provided by this source.*')
          : (item.explanation_markdown || 'No explanation available.'));

    // Unified explanation viewer — when an AI/Vitamin chip is selected,
    // override the text and tell the renderer to use renderAIText (inline
    // **bold** / __underline__) instead of the Markdown component.
    let viewerKind: 'markdown' | 'ai' | 'vitamin' = 'markdown';
    if (selectedExplSource === 'ai') {
      activeExplanationText = aiExplanations[item.id] || '';
      viewerKind = 'ai';
    } else if (selectedExplSource === 'vitamin') {
      activeExplanationText = bestAnswers[item.id]?.answer_text || '';
      viewerKind = 'vitamin';
    }

    // Lazy-load best answer the first time we render a question card.
    ensureBestAnswerLoaded(item.id);
    const savedBest = bestAnswers[item.id] || null;

    const activeExplanationMeta = safeIdx >= 0 && displayExplanations[safeIdx]
      ? formatMetaLine(displayExplanations[safeIdx])
      : '';


    return (
      <View style={[styles.questionCard, { backgroundColor: isZenMode ? 'transparent' : colors.surface, borderColor: isZenMode ? 'rgba(67, 52, 34, 0.1)' : colors.border, borderWidth: isZenMode ? 0 : 1 }]}>
        <View style={styles.qHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <View style={[styles.qNumberBadge, { backgroundColor: isZenMode ? '#433422' : colors.primary }]}>
                <Text style={[styles.qNumberText, { color: isZenMode ? '#F4ECD8' : colors.buttonText }]}>{index + 1}</Text>
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            {(() => {
              const pyq = getPYQCategorization(item);
              const hasTags = showPYQTags && (pyq.hasPYQData || item.is_ncert || item.exam_info?.is_ncert || item.source?.is_ncert);
              if (!hasTags) return null;

              const chips: { label: string; bg: string; fg: string; border: string }[] = [];
              if (pyq.hasPYQData && pyq.isUPSC) chips.push({ label: `${pyq.groupName} ${pyq.year}`.trim(), bg: isZenMode ? 'rgba(67, 52, 34, 0.05)' : '#dcfce7', fg: isZenMode ? '#433422' : '#15803d', border: isZenMode ? 'rgba(67, 52, 34, 0.2)' : '#22c55e' });
              if (pyq.hasPYQData && pyq.isAllied) chips.push({ label: `${pyq.groupName} ${pyq.year}`.trim(), bg: isZenMode ? 'rgba(67, 52, 34, 0.05)' : '#fef9c3', fg: isZenMode ? '#433422' : '#a16207', border: isZenMode ? 'rgba(67, 52, 34, 0.2)' : '#eab308' });
              if (pyq.hasPYQData && pyq.isOther) chips.push({ label: `${pyq.groupName} ${pyq.year}`.trim(), bg: isZenMode ? 'rgba(67, 52, 34, 0.05)' : '#f1f5f9', fg: isZenMode ? '#433422' : '#475569', border: isZenMode ? 'rgba(67, 52, 34, 0.2)' : '#94a3b8' });
              if (pyq.hasPYQData && pyq.isGenericPYQ) chips.push({ label: `${pyq.groupName} ${pyq.year}`.trim(), bg: isZenMode ? 'rgba(67, 52, 34, 0.05)' : colors.primary + '10', fg: isZenMode ? '#433422' : colors.primary, border: isZenMode ? 'rgba(67, 52, 34, 0.2)' : colors.primary });
              if (item.is_ncert || item.exam_info?.is_ncert || item.source?.is_ncert || item.micro_topic === 'NCERT') chips.push({ label: 'NCERT', bg: isZenMode ? 'rgba(67, 52, 34, 0.05)' : '#e0f2fe', fg: isZenMode ? '#433422' : '#0369a1', border: isZenMode ? 'rgba(67, 52, 34, 0.2)' : '#0ea5e9' });

              if (chips.length === 0) return null;

              // NOTE: Institute chips intentionally omitted here. Institute/program/year
              // metadata is rendered as a single canonical line inside the explanation
              // card (see formatMetaLine usage below) to avoid multi-layer duplication.

              return (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {chips.map((chip, idx) => (
                    <View key={`chip-${item.id}-${idx}`} style={[styles.inlineBadge, { backgroundColor: chip.bg, borderColor: chip.border, paddingHorizontal: 6, paddingVertical: 2, height: 20 }]}> 
                      <Text style={{ color: chip.fg, fontWeight: '900', fontSize: 9 }}>{chip.label}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}
            
            <TouchableOpacity 
              onPress={() => store.setMetadata(item.id, { isReview: !answerData.isReview }, arenaMode === 'exam')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: answerData.isReview ? (isZenMode ? '#43342220' : '#fef9c3') : 'transparent' }}
            >
               <Flag size={18} color={answerData.isReview ? (isZenMode ? '#433422' : '#eab308') : (isZenMode ? '#43342240' : colors.textTertiary)} fill={answerData.isReview ? (isZenMode ? '#433422' : '#eab308') : 'transparent'} />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => {
                const activeText = activeExplanationText || item.explanation_markdown || '';
                setNoteDraftBullets([markdownToHtml(activeText || '')]); 
                setCustomSubheading(item.micro_topic || '');
                setNotebookModalVisible(true);
                fetchHierarchy();
              }}
            >
               <BookOpen 
                 size={20} 
                 color={isZenMode ? '#43342240' : colors.textTertiary} 
               />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => handleAddToFlashcards(item)}
              disabled={savingFlashcard[item.id]}
            >
               {savingFlashcard[item.id] ? (
                 <ActivityIndicator size="small" color={colors.primary} />
               ) : (
                 <Zap 
                   size={20} 
                   color={flashcardedIds.has(item.id) ? (isZenMode ? '#433422' : colors.primary) : (isZenMode ? '#43342240' : colors.textTertiary)} 
                   fill={flashcardedIds.has(item.id) ? (isZenMode ? '#433422' : colors.primary) : 'transparent'} 
                 />
               )}
            </TouchableOpacity>
            {!!item.test_id && params.testId !== item.test_id && (
              <TouchableOpacity
                testID={`engine-view-source-header-${item.id}`}
                onPress={() => handleViewSource(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                 <ExternalLink
                   size={20}
                   color={isZenMode ? '#43342240' : colors.textTertiary}
                 />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Markdown style={mdStyles} rules={mdRules}>
          {item.statement_line || item.question_text}
        </Markdown>


        <View style={styles.optionsContainer}>
          {Object.entries(item.options || {}).map(([label, text]) => {
            const isSelected = answerData.selectedAnswer === label;
            const isCorrect = label.toLowerCase() === item.correct_answer?.toLowerCase();
            const isWrong = isSelected && !isCorrect;
            return (
              <OptionButton
                key={label}
                label={label}
                text={text}
                isSelected={isSelected}
                isCorrect={isCorrect}
                isWrong={isWrong}
                showResult={arenaMode === 'learning' && !!answerData.selectedAnswer}
                onSelect={() => handleOptionSelect(item.id, label)}
                disabled={arenaMode === 'learning' && showExplanation}
                fontSize={fontSize}
              />
            );
          })}
        </View>

        {arenaMode === 'learning' && !showExplanation && (
          <TouchableOpacity 
            style={[styles.revealBtn, { borderColor: colors.primary }]}
            onPress={() => { setRevealedExplanations(prev => ({ ...prev, [item.id]: true })); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          >
            <Lightbulb size={16} color={colors.primary} />
            <Text style={[styles.revealBtnText, { color: colors.primary }]}>Show Answer & Explanation</Text>
          </TouchableOpacity>
        )}

        <View style={[styles.controls, { borderTopColor: colors.border }]}>
          {arenaMode === 'exam' && (
            <>
              <View style={styles.controlRow}>
                <Text style={[styles.controlLabel, { color: colors.textTertiary }]}>CONFIDENCE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                  {CONFIDENCE_LEVELS.map(level => (
                    <TouchableOpacity
                      key={level.value}
                      onPress={() => toggleGuess(item.id, answerData.selectedAnswer, level.value)}
                      style={[styles.chip, { backgroundColor: colors.bg, borderColor: colors.border }, answerData.confidence === level.value && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                    >
                      <Text style={[styles.chipText, { color: answerData.confidence === level.value ? colors.buttonText : colors.textSecondary }]}>{level.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.controlRow}>
                <Text style={[styles.controlLabel, { color: colors.textTertiary }]}>DIFFICULTY</Text>
                <View style={styles.difficultyRow}>
                  {DIFFICULTIES.map(diff => (
                    <TouchableOpacity
                      key={diff.value}
                      onPress={() => toggleDifficulty(item.id, diff.value)}
                      style={[styles.difficultyBtn, { borderColor: colors.border }, answerData.difficulty === diff.value && { backgroundColor: diff.color + '20', borderColor: diff.color }]}
                    >
                      <Text style={[styles.difficultyText, { color: answerData.difficulty === diff.value ? diff.color : colors.textSecondary }]}>{diff.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}

          <View style={styles.controlRow}>
            <Text style={[styles.controlLabel, { color: colors.textTertiary }]}>STUDY TAGS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
              {[...userStudyTags].sort((a, b) => {
                const aSelected = (answerData.studyTags || []).includes(a);
                const bSelected = (answerData.studyTags || []).includes(b);
                if (aSelected && !bSelected) return -1;
                if (!aSelected && bSelected) return 1;
                return 0;
              }).map(tag => (
                <TouchableOpacity
                  key={tag}
                  onPress={() => toggleStudyTag(item.id, answerData.studyTags || [], tag)}
                  style={[styles.chip, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }, (answerData.studyTags || []).includes(tag) && { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
                >
                  <Text style={[styles.chipText, { color: (answerData.studyTags || []).includes(tag) ? colors.primary : colors.textSecondary }]}>{tag}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity 
                onPress={() => setIsAddingTag(true)}
                style={[styles.chip, { backgroundColor: colors.surfaceStrong, borderColor: colors.border, borderStyle: 'dashed' }]}
              >
                <Plus size={14} color={colors.textTertiary} />
              </TouchableOpacity>
            </ScrollView>
          </View>

          {arenaMode === 'learning' && showExplanation && (
            <>
              <View style={[styles.explanationBox, { backgroundColor: colors.bg, marginBottom: 16 }]}>
                <View style={styles.explanationHeader}>
                   <Info size={16} color={colors.primary} />
                   <Text style={[styles.explanationTitle, { color: colors.primary }]}>EXPLANATION</Text>
                </View>

                {/* ── Unified explanation chips ───────────────────────
                    [⭐ My Vitamin] (first, only if saved)
                    [All Institutes]
                    [Institute 1] [Institute 2] …
                    [+ AI Explain] / [🧠 AI] (last)
                    Always visible whenever an AI / Vitamin chip is in play
                    or when the question has more than one institute source. */}
                {(availableExplSources.length > 0 || aiExplanations[item.id] || savedBest) && (
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>

                    {/* My Vitamin — only when a saved best answer exists */}
                    {savedBest && (
                      <TouchableOpacity
                        onPress={() => {
                          setActiveExplSource(prev => ({ ...prev, [item.id]: 'vitamin' }));
                          setActiveExplIndex(prev => ({ ...prev, [item.id]: -1 }));
                        }}
                        activeOpacity={0.7}
                        testID={`vitamin-chip-${item.id}`}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 5,
                          paddingHorizontal: 14, paddingVertical: 6,
                          borderRadius: 20, borderWidth: 1.5,
                          backgroundColor: selectedExplSource === 'vitamin' ? '#f59e0b' : '#f59e0b18',
                          borderColor:     selectedExplSource === 'vitamin' ? '#f59e0b' : '#f59e0b40',
                        }}
                      >
                        <Star size={11} color={selectedExplSource === 'vitamin' ? '#fff' : '#f59e0b'} fill={selectedExplSource === 'vitamin' ? '#fff' : '#f59e0b'} />
                        <Text style={{ fontSize: 10, fontWeight: '900', color: selectedExplSource === 'vitamin' ? '#fff' : '#f59e0b' }}>
                          MY VITAMIN
                        </Text>
                      </TouchableOpacity>
                    )}

                    {/* All Institutes */}
                    <TouchableOpacity
                      onPress={() => {
                        setActiveExplSource(prev => ({ ...prev, [item.id]: 'all' }));
                        setActiveExplIndex(prev => ({ ...prev, [item.id]: -1 }));
                      }}
                      activeOpacity={0.7}
                      style={{
                        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                        backgroundColor: selectedExplSource === 'all' ? colors.primary : colors.surfaceStrong,
                        borderWidth: 1, borderColor: colors.border,
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '900', color: selectedExplSource === 'all' ? '#fff' : colors.textTertiary }}>
                        ALL INSTITUTES
                      </Text>
                    </TouchableOpacity>

                    {/* Each institute */}
                    {availableExplSources.map(({ key, label }: any) => (
                      <TouchableOpacity
                        key={`src-${item.id}-${key}`}
                        onPress={() => {
                          setActiveExplSource(prev => ({ ...prev, [item.id]: key }));
                          setActiveExplIndex(prev => ({ ...prev, [item.id]: -1 }));
                        }}
                        activeOpacity={0.7}
                        style={{
                          paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                          backgroundColor: selectedExplSource === key ? colors.primary : colors.surfaceStrong,
                          borderWidth: 1, borderColor: colors.border,
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '900', color: selectedExplSource === key ? '#fff' : colors.textTertiary }}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    ))}

                    {/* AI Explain — always last */}
                    <TouchableOpacity
                      onPress={() => handleAiExplain(item)}
                      activeOpacity={0.7}
                      testID={`ai-explain-chip-${item.id}`}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 5,
                        paddingHorizontal: 12, paddingVertical: 6,
                        borderRadius: 20, borderWidth: 1,
                        backgroundColor: selectedExplSource === 'ai' ? '#7c3aed' : '#7c3aed18',
                        borderColor:     selectedExplSource === 'ai' ? '#7c3aed' : '#7c3aed40',
                      }}
                    >
                      {aiLoading[item.id]
                        ? <ActivityIndicator size="small" color={selectedExplSource === 'ai' ? '#fff' : '#7c3aed'} />
                        : <Sparkles size={11} color={selectedExplSource === 'ai' ? '#fff' : '#7c3aed'} />
                      }
                      <Text style={{ fontSize: 10, fontWeight: '900', color: selectedExplSource === 'ai' ? '#fff' : '#7c3aed' }}>
                        {aiExplanations[item.id] ? '🧠 AI' : '+ AI EXPLAIN'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {displayExplanations.length > 1 && (
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border + '30', flexWrap: 'wrap' }}>
                    <TouchableOpacity
                      onPress={() => setActiveExplIndex(prev => ({ ...prev, [item.id]: -1 }))}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 20,
                        backgroundColor: safeIdx === -1 ? colors.primary : colors.surfaceStrong,
                        borderWidth: 1,
                        borderColor: colors.border
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '900', color: safeIdx === -1 ? '#fff' : colors.textTertiary }}>
                        COMBINED ({displayExplanations.length})
                      </Text>
                    </TouchableOpacity>
                    {displayExplanations.map((expl: any, idx: number) => (
                      <TouchableOpacity
                        key={`expl-${item.id}-${idx}`}
                        onPress={() => setActiveExplIndex(prev => ({ ...prev, [item.id]: idx }))}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 20,
                          backgroundColor: safeIdx === idx ? colors.primary : colors.surfaceStrong,
                          borderWidth: 1,
                          borderColor: colors.border
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '900', color: safeIdx === idx ? '#fff' : colors.textTertiary }}>
                          {formatMetaLine(expl) || expl.source || `Source ${idx + 1}`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* ── Unified explanation viewer ─────────────────────
                    Markdown renderer for institute / "all" sources.
                    renderAIText for AI / Vitamin so **bold** and __underline__
                    appear correctly without pulling the heavyweight Markdown
                    component into AI output (which never has headings,
                    fences or images — just inline emphasis). */}
                {viewerKind === 'markdown' ? (
                  <Markdown style={mdStyles} rules={mdRules}>
                    {activeExplanationText}
                  </Markdown>
                ) : viewerKind === 'ai' && aiLoading[item.id] && !aiExplanations[item.id] ? (
                  <View style={{ paddingVertical: 28, alignItems: 'center', gap: 10 }}>
                    <ActivityIndicator size="small" color="#7c3aed" />
                    <Text style={{ fontSize: 11, color: colors.textTertiary, fontWeight: '700', letterSpacing: 0.6 }}>
                      GEMINI IS THINKING…
                    </Text>
                  </View>
                ) : (
                  <Text style={{ fontSize: fontSize, color: colors.textPrimary, lineHeight: fontSize * 1.6, fontWeight: '500' }}>
                    {renderAIText(activeExplanationText, { fontSize: fontSize, color: colors.textPrimary, lineHeight: fontSize * 1.6, fontWeight: '500' })}
                  </Text>
                )}

                {/* ── Save / Modify / Edit / Delete actions ────────────
                    Shown only when the active source is AI or My Vitamin. */}
                {(viewerKind === 'ai' || viewerKind === 'vitamin') && !!activeExplanationText && !modifyOpen[item.id] && (
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                    {viewerKind === 'ai' && !savedBest && (
                      <>
                        <TouchableOpacity
                          onPress={() => handleSaveBest(item)}
                          disabled={!!savingBest[item.id]}
                          activeOpacity={0.7}
                          testID={`best-save-${item.id}`}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 5,
                            paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10,
                            backgroundColor: savedFlash[item.id] ? '#22c55e22' : colors.surfaceStrong,
                            borderWidth: 1, borderColor: savedFlash[item.id] ? '#22c55e' : colors.border,
                          }}
                        >
                          {savingBest[item.id] ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                          ) : (
                            <SaveIcon size={12} color={savedFlash[item.id] ? '#22c55e' : colors.textSecondary} />
                          )}
                          <Text style={{ fontSize: 11, fontWeight: '800', color: savedFlash[item.id] ? '#22c55e' : colors.textSecondary }}>
                            {savedFlash[item.id] ? 'Saved ✓' : '★ Save to MyVitamin'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleOpenModify(item)}
                          activeOpacity={0.7}
                          testID={`best-modify-${item.id}`}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 5,
                            paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10,
                            backgroundColor: colors.surfaceStrong,
                            borderWidth: 1, borderColor: colors.border,
                          }}
                        >
                          <Edit2 size={12} color={colors.textSecondary} />
                          <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textSecondary }}>
                            Modify & Save
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}
                    {/* When AI regenerates but MyVitamin already exists — show Update button */}
                    {viewerKind === 'ai' && savedBest && (
                      <>
                        <TouchableOpacity
                          onPress={() => handleSaveBest(item)}
                          disabled={!!savingBest[item.id]}
                          activeOpacity={0.7}
                          testID={`best-update-${item.id}`}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 5,
                            paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10,
                            backgroundColor: savedFlash[item.id] ? '#22c55e22' : '#f59e0b18',
                            borderWidth: 1, borderColor: savedFlash[item.id] ? '#22c55e' : '#f59e0b40',
                          }}
                        >
                          {savingBest[item.id] ? (
                            <ActivityIndicator size="small" color="#f59e0b" />
                          ) : (
                            <RotateCcw size={12} color={savedFlash[item.id] ? '#22c55e' : '#f59e0b'} />
                          )}
                          <Text style={{ fontSize: 11, fontWeight: '800', color: savedFlash[item.id] ? '#22c55e' : '#f59e0b' }}>
                            {savedFlash[item.id] ? 'Updated ✓' : '↻ Update MyVitamin'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleOpenModify(item)}
                          activeOpacity={0.7}
                          testID={`best-modify-ai-${item.id}`}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 5,
                            paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10,
                            backgroundColor: colors.surfaceStrong,
                            borderWidth: 1, borderColor: colors.border,
                          }}
                        >
                          <Edit2 size={12} color={colors.textSecondary} />
                          <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textSecondary }}>
                            Modify & Save
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}
                    {viewerKind === 'vitamin' && savedBest && (
                      <>
                        <TouchableOpacity
                          onPress={() => handleOpenModify(item)}
                          activeOpacity={0.7}
                          testID={`best-edit-${item.id}`}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 5,
                            paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10,
                            backgroundColor: '#f59e0b18',
                            borderWidth: 1, borderColor: '#f59e0b40',
                          }}
                        >
                          <Edit2 size={12} color="#f59e0b" />
                          <Text style={{ fontSize: 11, fontWeight: '800', color: '#f59e0b' }}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteBest(item)}
                          activeOpacity={0.7}
                          testID={`best-delete-${item.id}`}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 5,
                            paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10,
                            backgroundColor: colors.surfaceStrong,
                            borderWidth: 1, borderColor: colors.border,
                          }}
                        >
                          <Trash2 size={12} color={colors.textTertiary} />
                          <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textTertiary }}>Delete</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                )}

                {/* ── Modify & Save inline edit panel ─────────────────── */}
                {(viewerKind === 'ai' || viewerKind === 'vitamin') && modifyOpen[item.id] && (
                  <View style={{ marginTop: 12, padding: 12, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, gap: 8 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, letterSpacing: 1 }}>
                      EDIT YOUR BEST ANSWER
                    </Text>
                    <View style={{ position: 'relative' }}>
                      <TextInput
                        value={modifyText[item.id] || ''}
                        onChangeText={(v) => setModifyText(prev => ({ ...prev, [item.id]: v }))}
                        multiline
                        textAlignVertical="top"
                        editable={!improving[item.id]}
                        style={{
                          minHeight: 200,
                          padding: 12,
                          fontSize: 13, color: colors.textPrimary, lineHeight: 20,
                          backgroundColor: colors.bg,
                          borderRadius: 10, borderWidth: 1, borderColor: colors.border,
                        }}
                        testID={`best-edit-input-${item.id}`}
                      />
                      {improving[item.id] && (
                        <View style={{
                          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                          backgroundColor: '#7c3aed18',
                          borderRadius: 10,
                          alignItems: 'center', justifyContent: 'center', gap: 8,
                        }}>
                          <ActivityIndicator size="small" color="#7c3aed" />
                          <Text style={{ fontSize: 11, fontWeight: '800', color: '#7c3aed', letterSpacing: 0.5 }}>
                            REWRITING…
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Improve with AI prompt strip */}
                    {improvePromptOpen[item.id] && (
                      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#7c3aed10', borderRadius: 10, padding: 6 }}>
                        <Sparkles size={13} color="#7c3aed" />
                        <TextInput
                          value={improvePromptText[item.id] || ''}
                          onChangeText={(v) => setImprovePromptText(prev => ({ ...prev, [item.id]: v }))}
                          placeholder="e.g. shorten to 3 lines, add more facts..."
                          placeholderTextColor={colors.textTertiary}
                          onSubmitEditing={() => handleImproveSubmit(item)}
                          editable={!improving[item.id]}
                          style={{ flex: 1, fontSize: 12, color: colors.textPrimary, paddingHorizontal: 4, paddingVertical: 6 }}
                          testID={`improve-input-${item.id}`}
                        />
                        <TouchableOpacity
                          onPress={() => handleImproveSubmit(item)}
                          disabled={!!improving[item.id] || !(improvePromptText[item.id] || '').trim()}
                          activeOpacity={0.7}
                          testID={`improve-submit-${item.id}`}
                          style={{
                            paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
                            backgroundColor: '#7c3aed',
                            opacity: improving[item.id] || !(improvePromptText[item.id] || '').trim() ? 0.5 : 1,
                            flexDirection: 'row', alignItems: 'center', gap: 4,
                          }}
                        >
                          <Send size={11} color="#fff" />
                          <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>Send</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Bottom row — Cancel · Improve with AI · Save */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                      <TouchableOpacity
                        onPress={() => setModifyOpen(prev => ({ ...prev, [item.id]: false }))}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textTertiary, paddingHorizontal: 8, paddingVertical: 6 }}>
                          Cancel
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setImprovePromptOpen(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                        activeOpacity={0.7}
                        testID={`improve-toggle-${item.id}`}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 4,
                          paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8,
                          backgroundColor: improvePromptOpen[item.id] ? '#7c3aed' : '#7c3aed18',
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '800', color: improvePromptOpen[item.id] ? '#fff' : '#7c3aed' }}>
                          🤖 Improve with AI
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleSaveBest(item)}
                        disabled={!!savingBest[item.id]}
                        activeOpacity={0.7}
                        testID={`best-modify-save-${item.id}`}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 5,
                          paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
                          backgroundColor: '#7c3aed',
                          opacity: savingBest[item.id] ? 0.6 : 1,
                        }}
                      >
                        {savingBest[item.id]
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <SaveIcon size={11} color="#fff" />
                        }
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#fff' }}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* ── Key Points ─────────────────────────────────────────
                    Shown alongside any source the user is viewing — helpful
                    revision summary. Vitamin pulls saved key_points first;
                    AI generates on demand. */}
                {(viewerKind === 'ai' || viewerKind === 'vitamin') && !!activeExplanationText && (
                  (() => {
                    const summaryText = aiSummaries[item.id] || (viewerKind === 'vitamin' ? (savedBest?.key_points || '') : '');
                    return (
                      <View style={{ marginTop: 14 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                          <Text style={{ fontSize: 10, fontWeight: '800', color: '#f59e0b', letterSpacing: 1.2 }}>
                            ✨ KEY POINTS
                          </Text>
                          {summaryText ? (
                            <TouchableOpacity
                              onPress={() => handleAiSummarize(item)}
                              disabled={!!aiSumLoading[item.id]}
                              activeOpacity={0.7}
                              testID={`keypoints-regen-${item.id}`}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                              {aiSumLoading[item.id]
                                ? <ActivityIndicator size="small" color="#f59e0b" />
                                : <RotateCcw size={12} color={colors.textTertiary} />
                              }
                            </TouchableOpacity>
                          ) : null}
                        </View>
                        {summaryText ? (
                          <View style={{ padding: 12, backgroundColor: '#fef3c720', borderRadius: 10, borderWidth: 1, borderColor: '#f59e0b25' }}>
                            <Text style={{ fontSize: 12, color: colors.textPrimary, lineHeight: 22 }}>
                              {renderAIText(summaryText, { fontSize: 12, color: colors.textPrimary, lineHeight: 22 })}
                            </Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            onPress={() => handleAiSummarize(item)}
                            disabled={!!aiSumLoading[item.id]}
                            activeOpacity={0.7}
                            testID={`keypoints-gen-${item.id}`}
                            style={{
                              alignSelf: 'flex-start',
                              flexDirection: 'row', alignItems: 'center', gap: 6,
                              paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
                              backgroundColor: '#f59e0b18', borderWidth: 1, borderColor: '#f59e0b30',
                            }}
                          >
                            {aiSumLoading[item.id]
                              ? <ActivityIndicator size="small" color="#f59e0b" />
                              : <Sparkles size={12} color="#f59e0b" />
                            }
                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#f59e0b' }}>
                              Generate Key Points
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })()
                )}
              </View>

              <View style={styles.actionRow}>
                 <TouchableOpacity 
                   style={[styles.actionBtn, { backgroundColor: colors.primary + '15' }]}
                   onPress={() => {
                     // FIX 7 — pre-fill from whichever chip is active.
                     // For Vitamin we also append the saved key_points so the
                     // notebook captures the full revision packet.
                     const activeText = (() => {
                       if (selectedExplSource === 'vitamin' && savedBest) {
                         const kp = savedBest.key_points ? `\n\n**✨ Key Points**\n\n${savedBest.key_points}` : '';
                         return `${savedBest.answer_text}${kp}`;
                       }
                       return activeExplanationText || item.explanation_markdown || '';
                     })();
                     openNotebookFromQuestion(item, activeText);
                   }}
                 >
                    <BookOpen size={16} color={colors.primary} />
                    <Text style={[styles.actionBtnText, { color: colors.primary }]}>Notebook</Text>
                 </TouchableOpacity>
                 <TouchableOpacity
                   style={[styles.actionBtn, { backgroundColor: colors.primary + '15' }]}
                   onPress={() => {
                     const activeText = (() => {
                       if (selectedExplSource === 'vitamin' && savedBest) {
                         const kp = savedBest.key_points ? `\n\n**✨ Key Points**\n\n${savedBest.key_points}` : '';
                         return `${savedBest.answer_text}${kp}`;
                       }
                       return activeExplanationText || item.explanation_markdown || '';
                     })();
                     openHardnoteFromQuestion(item, activeText);
                   }}
                   data-testid={`engine-hardnotes-btn-${item.id}`}
                 >
                    <PenTool size={16} color={colors.primary} />
                    <Text style={[styles.actionBtnText, { color: colors.primary }]}>Hardnotes</Text>
                 </TouchableOpacity>
                 <TouchableOpacity 
                   style={[styles.actionBtn, { backgroundColor: colors.primary + '15' }]}
                   onPress={() => {
                     // FIX 8 — hardwire whatever the user is reading right
                     // now (institute / AI / Vitamin) into the flashcard's
                     // answer_text, so the card is permanent and survives
                     // any future change to the source question.
                     const activeText = (() => {
                       if (selectedExplSource === 'vitamin' && savedBest) {
                         const kp = savedBest.key_points ? `\n\n**✨ Key Points**\n\n${savedBest.key_points}` : '';
                         return `${savedBest.answer_text}${kp}`;
                       }
                       return activeExplanationText || item.explanation_markdown || '';
                     })();
                     handleAddToFlashcards(item, activeText);
                   }}
                   disabled={savingFlashcard[item.id]}
                 >
                    {savingFlashcard[item.id] ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Zap size={16} color={colors.primary} />
                        <Text style={[styles.actionBtnText, { color: colors.primary }]}>Flashcard</Text>
                      </>
                    )}
                 </TouchableOpacity>
                 <TouchableOpacity 
                   style={[styles.actionBtn, { backgroundColor: colors.surfaceStrong }]}
                   onPress={() => handleQuickSave(item)}
                 >
                    <Save size={16} color={colors.textPrimary} />
                    <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>Save</Text>
                 </TouchableOpacity>
                 {!!item.test_id && params.testId !== item.test_id && (
                   <TouchableOpacity
                     testID={`engine-view-source-action-${item.id}`}
                     style={[styles.actionBtn, { backgroundColor: colors.surfaceStrong }]}
                     onPress={() => handleViewSource(item)}
                   >
                      <ExternalLink size={16} color={colors.textPrimary} />
                      <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>View Source</Text>
                   </TouchableOpacity>
                 )}
              </View>

              <View style={[styles.noteSection, { marginTop: 24, padding: 20, borderRadius: 24, backgroundColor: colors.surfaceStrong + '50', borderWidth: 1, borderColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ width: 3, height: 16, backgroundColor: colors.primary, marginRight: 8, borderRadius: 2 }} />
                    <Text style={{ fontSize: 11, fontWeight: '900', color: colors.primary, letterSpacing: 1 }}>YOUR INSIGHTS</Text>
                  </View>

                  <View style={[styles.controlRow, { marginBottom: 16 }]}>
                    <Text style={[styles.controlLabel, { color: colors.textTertiary }]}>MISTAKE TYPE</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                      {ERROR_TYPES.map(type => (
                        <TouchableOpacity
                          key={type}
                          onPress={() => toggleMistakeType(item.id, type)}
                          style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }, answerData.errorCategory === type && { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
                        >
                          <Text style={[styles.chipText, { color: answerData.errorCategory === type ? colors.primary : colors.textSecondary }]}>{type}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  <View style={[styles.noteInputWrapper, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 16, borderStyle: 'dashed' }]}>
                      <TextInput
                        style={[styles.noteInput, { color: colors.textPrimary, padding: 16, minHeight: 80 }]}
                        placeholder="Double-tap to record your strategy..."
                        multiline
                        placeholderTextColor={colors.textSecondary || '#6B7280'}
                        value={answerData.note || ''}
                        onChangeText={(val) => store.setMetadata(item.id, { note: val }, false)}
                      />
                  </View>
                  <TouchableOpacity 
                    onPress={() => handleCommitToMemory(item.id)}
                    style={{ marginTop: 16 }}
                  >
                    <LinearGradient 
                      colors={['#FF6B6B', '#7B2CBF']} 
                      locations={[0, 1]}
                      start={{ x: 0, y: 0 }} 
                      end={{ x: 1, y: 0 }} 
                      style={{ height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, shadowColor: '#7B2CBF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 }}
                    >
                       <Save size={20} color="#fff" />
                       <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>Commit to Memory</Text>
                    </LinearGradient>
                  </TouchableOpacity>
              </View>

              <View style={{ marginTop: 32, padding: 16, borderTopWidth: 1, borderTopColor: colors.border + '50' }}>
                 {(() => {
                   // Single-layer canonical metadata: INSTITUTE – PROGRAM – YEAR
                   const primaryEntry = displayExplanations[0] || {
                     source: normalizeInstituteLabel(item.tests?.institute || ''),
                     program: normalizeProgramLabel(String(item.tests?.program_name || '').trim()),
                     year: String(item.exam_year || '').trim(),
                   };
                   const line = formatMetaLine(primaryEntry);
                   if (!line) return null;
                   return (
                     <Text style={{ fontSize: 10, color: colors.textTertiary, textAlign: 'center', lineHeight: 16, fontWeight: '700', letterSpacing: 0.5 }}>
                        {line}
                     </Text>
                   );
                 })()}
              </View>
            </>
          )}
        </View>
      </View>
    );
  };

  // ============================================================
  // SIMULATED EXAM MODE — "PAPER" VIEW
  // 6 questions per page on tablets in a 2-column grid (printed-paper feel).
  // Falls back to 1 column on phones (< 768 logical px).
  // Tap on the explanation pill opens a centered modal (see render below).
  // ============================================================
  const isPaperWide = width >= 768; // iPad / large screen → 2 columns
  const totalPaperPages = Math.max(1, Math.ceil(questions.length / paperPageSize));

  const renderPaperQuestion = (item: Question, globalIdx: number) => {
    if (!item) return null;
    const answerData = currentAnswers[item.id] || { selectedAnswer: null, confidence: null, difficulty: null, errorCategory: null, note: '' };
    return (
      <View
        key={`paper-q-${item.id}`}
        style={[
          stylesPaper.qCard,
          {
            backgroundColor: isZenMode ? 'transparent' : colors.surface,
            borderColor: isZenMode ? 'rgba(67,52,34,0.15)' : colors.border,
          },
        ]}
        testID={`paper-question-${globalIdx}`}
      >
        {/* Q number badge + per-question icons row */}
        <View style={stylesPaper.qHeaderRow}>
          <View style={[stylesPaper.qNum, { backgroundColor: isZenMode ? '#433422' : colors.primary }]}>
            <Text style={{ color: isZenMode ? '#F4ECD8' : colors.buttonText, fontWeight: '900', fontSize: 12 }}>
              {globalIdx + 1}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => store.setMetadata(item.id, { isReview: !answerData.isReview }, arenaMode === 'exam')}
              testID={`paper-review-${item.id}`}
            >
              <Flag size={16} color={answerData.isReview ? '#eab308' : colors.textTertiary} fill={answerData.isReview ? '#eab308' : 'transparent'} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handlePaperAddToFlashcards(item)}
              disabled={savingFlashcard[item.id]}
              testID={`paper-flashcard-${item.id}`}
            >
              {savingFlashcard[item.id] ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Zap size={16} color={flashcardedIds.has(item.id) ? colors.primary : colors.textTertiary} fill={flashcardedIds.has(item.id) ? colors.primary : 'transparent'} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Question stem */}
        <Markdown style={mdStylesZen} rules={mdRulesZen}>
          {item.statement_line || item.question_text}
        </Markdown>

        {/* Options — compact */}
        <View style={{ marginTop: 8 }}>
          {Object.entries(item.options || {}).map(([label, text]) => {
            const isSelected = answerData.selectedAnswer === label;
            const isCorrect = label.toLowerCase() === item.correct_answer?.toLowerCase();
            const isWrong = isSelected && !isCorrect;
            return (
              <OptionButton
                key={label}
                label={label}
                text={text}
                isSelected={isSelected}
                isCorrect={isCorrect}
                isWrong={isWrong}
                showResult={arenaMode === 'learning' && !!answerData.selectedAnswer}
                onSelect={() => handleOptionSelect(item.id, label)}
                disabled={false}
                fontSize={fontSize}
              />
            );
          })}
        </View>

        {/* Inline chips: Confidence (Guess), Difficulty, Study Tags, Mistake type */}
        <View style={{ marginTop: 10, gap: 6 }}>
          {/* Confidence */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 9, fontWeight: '900', color: colors.textTertiary, letterSpacing: 0.5, marginRight: 4 }}>GUESS</Text>
            {CONFIDENCE_LEVELS.map(level => (
              <TouchableOpacity
                key={level.value}
                onPress={() => toggleGuess(item.id, answerData.selectedAnswer, level.value)}
                style={[stylesPaper.miniChip, { borderColor: colors.border, backgroundColor: colors.bg }, answerData.confidence === level.value && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: answerData.confidence === level.value ? colors.buttonText : colors.textSecondary }}>{level.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Difficulty */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 9, fontWeight: '900', color: colors.textTertiary, letterSpacing: 0.5, marginRight: 4 }}>DIFFICULTY</Text>
            {DIFFICULTIES.map(diff => (
              <TouchableOpacity
                key={diff.value}
                onPress={() => toggleDifficulty(item.id, diff.value)}
                style={[stylesPaper.miniChip, { borderColor: colors.border }, answerData.difficulty === diff.value && { backgroundColor: diff.color + '20', borderColor: diff.color }]}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: answerData.difficulty === diff.value ? diff.color : colors.textSecondary }}>{diff.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Study Tags (Revision tags) */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 9, fontWeight: '900', color: colors.textTertiary, letterSpacing: 0.5, marginRight: 4 }}>TAGS</Text>
            {[...userStudyTags].slice(0, 6).map(tag => {
              const selected = (answerData.studyTags || []).includes(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  onPress={() => toggleStudyTag(item.id, answerData.studyTags || [], tag)}
                  style={[stylesPaper.miniChip, { borderColor: colors.border, backgroundColor: colors.surfaceStrong }, selected && { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
                >
                  <Text style={{ fontSize: 10, fontWeight: '700', color: selected ? colors.primary : colors.textSecondary }}>{tag}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Show Explanation pill — opens centered modal */}
        {arenaMode === 'learning' && (
          <TouchableOpacity
            style={[stylesPaper.explBtn, { borderColor: colors.primary }]}
            onPress={() => {
              setExplanationModalQId(item.id);
              setRevealedExplanations(prev => ({ ...prev, [item.id]: true }));
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            }}
            testID={`paper-explanation-btn-${item.id}`}
          >
            <Lightbulb size={14} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12 }}>Explanation</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

