-- ==================================================
-- 1. EXTENSIONS
-- ==================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==================================================
-- 2. CREATE TABLES (Base Columns Only)
-- ==================================================
CREATE TABLE IF NOT EXISTS access_features ( id uuid NOT NULL DEFAULT gen_random_uuid(), key text NOT NULL, name text NOT NULL, description text DEFAULT ''::text, category text NOT NULL DEFAULT 'feature'::text, is_active boolean DEFAULT true, sort_order integer DEFAULT 0, created_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS access_plans ( id uuid NOT NULL DEFAULT gen_random_uuid(), name text NOT NULL, description text DEFAULT ''::text, price numeric DEFAULT 0, currency text DEFAULT 'INR'::text, interval text DEFAULT 'month'::text, is_active boolean DEFAULT true, sort_order integer DEFAULT 0, created_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS admin_users ( id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, role text DEFAULT 'editor'::text, created_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS ai_settings ( id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, ai_provider character varying(50) DEFAULT 'gemini'::character varying, enable_conversation_history boolean DEFAULT true, updated_at timestamp without time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS card_folder_map ( id uuid NOT NULL DEFAULT gen_random_uuid(), card_id uuid NOT NULL, folder_id uuid NOT NULL );
CREATE TABLE IF NOT EXISTS card_reviews ( id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, card_id uuid NOT NULL, reviewed_at timestamp with time zone DEFAULT now(), quality smallint NOT NULL, prev_interval integer, new_interval integer, prev_ef numeric, new_ef numeric, rating text, learning_step smallint, prev_minutes integer, new_minutes integer );
CREATE TABLE IF NOT EXISTS cards ( id uuid NOT NULL DEFAULT gen_random_uuid(), question_id text NOT NULL, test_id text NOT NULL, question_text text NOT NULL DEFAULT ''::text, answer_text text NOT NULL DEFAULT ''::text, correct_answer text, subject text, section_group text, microtopic text, provider text, source jsonb DEFAULT '{}'::jsonb, explanation_markdown text DEFAULT ''::text, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), front_text text, back_text text, front_image_url text, back_image_url text, card_type text DEFAULT 'qa'::text, institutes jsonb DEFAULT '[]'::jsonb, merged_from jsonb DEFAULT '[]'::jsonb, primary_institute text, is_deleted boolean DEFAULT false );
CREATE TABLE IF NOT EXISTS conversation_history ( id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, question_id character varying(100) NOT NULL, message_role character varying(20) NOT NULL, message_content text NOT NULL, template_used character varying(100), created_at timestamp without time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS courses ( id uuid NOT NULL DEFAULT gen_random_uuid(), name text NOT NULL, code text NOT NULL, display_name text NOT NULL, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS draft_attempts ( id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, test_id text, payload jsonb DEFAULT '{}'::jsonb, updated_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS flashcard_branch_cards ( id uuid NOT NULL DEFAULT gen_random_uuid(), branch_id uuid NOT NULL, card_id uuid NOT NULL, created_at timestamp with time zone DEFAULT now(), user_id uuid );
CREATE TABLE IF NOT EXISTS flashcard_branches ( id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, name text NOT NULL, parent_id uuid, is_archived boolean DEFAULT false, is_deleted boolean DEFAULT false, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), sort_order integer DEFAULT 0, is_folder boolean DEFAULT false );
CREATE TABLE IF NOT EXISTS folder_algorithm_settings ( user_id uuid NOT NULL, folder_key text NOT NULL, settings jsonb NOT NULL DEFAULT '{}'::jsonb, inherit boolean NOT NULL DEFAULT true, updated_at timestamp with time zone NOT NULL DEFAULT now() );
CREATE TABLE IF NOT EXISTS folders ( id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, name text NOT NULL, microtopic text, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS lscs_thesis_cases ( id uuid NOT NULL DEFAULT gen_random_uuid(), created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), case_no text, reg_no text, patient_name text, wo_name text, age integer, religion text, residence text, date_of_admission date, date_of_delivery date, booking_status text DEFAULT 'unbooked'::text, complaint_labour_pains boolean DEFAULT false, complaint_leaking_pv boolean DEFAULT false, complaint_bleeding_pv boolean DEFAULT false, complaint_headache boolean DEFAULT false, complaint_blurring_vision boolean DEFAULT false, complaint_epigastric_pain boolean DEFAULT false, complaint_nausea boolean DEFAULT false, complaint_vomiting boolean DEFAULT false, complaints_other text, gravida integer DEFAULT 0, para integer DEFAULT 0, abortion integer DEFAULT 0, living integer DEFAULT 0, prev_pregnancy_details text, prev_delivery_vaginal boolean DEFAULT false, prev_delivery_instrumental boolean DEFAULT false, prev_delivery_lscs boolean DEFAULT false, prev_obstetric_complications boolean DEFAULT false, prev_obstetric_complications_details text, lmp date, edd date, gestation_weeks text, menstrual_history_details text, past_history_htn boolean DEFAULT false, past_history_tb boolean DEFAULT false, past_history_asthma boolean DEFAULT false, past_history_epilepsy boolean DEFAULT false, past_history_heart_disease boolean DEFAULT false, past_history_diabetes boolean DEFAULT false, past_history_surgery boolean DEFAULT false, past_history_surgery_details text, past_history_infertility_treated boolean DEFAULT false, infertility_treatment_details text, family_history text, personal_history text, general_physical_examination text, investigations text, exam_per_abdomen text, exam_per_vaginal text, c_section_type text DEFAULT 'primary_lscs'::text, c_section_nature text, c_section_indication text, surgery_date_time timestamp with time zone, anesthesia_type text DEFAULT 'spinal'::text, intraoperative_findings text, intraoperative_complications text, maternal_pph boolean DEFAULT false, maternal_blood_transfusion boolean DEFAULT false, maternal_wound_infection boolean DEFAULT false, maternal_puerperal_pyrexia boolean DEFAULT false, maternal_icu_admission boolean DEFAULT false, maternal_hospital_stay_days integer, maternal_morbidity boolean DEFAULT false, maternal_morbidity_details text, maternal_mortality boolean DEFAULT false, neonatal_baby_count text DEFAULT 'singleton'::text, neonatal_sex text, neonatal_birth_weight numeric, neonatal_apgar_1min integer, neonatal_apgar_5min integer, neonatal_nicu_admission boolean DEFAULT false, neonatal_nicu_indication text, neonatal_comp_rds boolean DEFAULT false, neonatal_comp_sepsis boolean DEFAULT false, neonatal_comp_asphyxia boolean DEFAULT false, neonatal_comp_others text, neonatal_early_death boolean DEFAULT false, additional_clinical_notes text, time_of_admission text, time_of_delivery text );
CREATE TABLE IF NOT EXISTS mains_answers ( id text NOT NULL, question_id text NOT NULL, institute text NOT NULL, answer_text text NOT NULL, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS mains_case_studies ( id uuid NOT NULL DEFAULT gen_random_uuid(), paper text, subject text, section_group text, microtopic text, subtopic text, title text, content_markdown text, core_values text[], hierarchy_path text[], status text DEFAULT 'published'::text, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS mains_data_facts ( id uuid NOT NULL DEFAULT gen_random_uuid(), paper text, subject text, section_group text, parameter text NOT NULL, card_title text NOT NULL, content_markdown text NOT NULL, source text, hierarchy_path text[], created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), status text NOT NULL DEFAULT 'draft'::text );
CREATE TABLE IF NOT EXISTS mains_essay_value_add ( id uuid NOT NULL DEFAULT gen_random_uuid(), paper text, subject text, section_group text, microtopic text, subtopic text, title text NOT NULL, category text NOT NULL, entry_type text NOT NULL DEFAULT 'anecdote'::text, content text NOT NULL, author text, usage_guide text, hierarchy_path text[], created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), status text NOT NULL DEFAULT 'draft'::text );
CREATE TABLE IF NOT EXISTS mains_ethics_value_add ( id uuid NOT NULL DEFAULT gen_random_uuid(), ethics_type text NOT NULL, paper text DEFAULT 'GS-IV'::text, subject text DEFAULT 'ETHICS, INTEGRITY & APTITUDE'::text, section_group text, microtopic text, subtopic text, title text NOT NULL, content_markdown text NOT NULL, diagram_image_path text, officer_name text, initiative text, impact text, core_values text, pyqs text[], hierarchy_path text[], created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), status text NOT NULL DEFAULT 'draft'::text );
CREATE TABLE IF NOT EXISTS mains_frameworks ( id uuid NOT NULL DEFAULT gen_random_uuid(), framework_name text NOT NULL, diagram_image_path text, breakdown_markdown text NOT NULL, hierarchies jsonb NOT NULL DEFAULT '[]'::jsonb, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), hierarchy_1_path text[], hierarchy_2_path text[], hierarchy_3_path text[], hierarchy_4_path text[], hierarchy_5_path text[], status text NOT NULL DEFAULT 'draft'::text );
CREATE TABLE IF NOT EXISTS mains_intro_conclusions ( id uuid NOT NULL DEFAULT gen_random_uuid(), paper text, subject text, section_group text, microtopic text, subtopic text, card_title text NOT NULL, body text NOT NULL, hierarchy_path text[], created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), status text NOT NULL DEFAULT 'draft'::text );
CREATE TABLE IF NOT EXISTS mains_keywords ( id uuid NOT NULL DEFAULT gen_random_uuid(), paper text, subject text, section_group text, microtopic text, subtopic text, title text, content_markdown text, core_values text[], hierarchy_path text[], status text DEFAULT 'published'::text, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS mains_mnemonics ( id uuid NOT NULL DEFAULT gen_random_uuid(), paper text, subject text, section_group text, microtopic text, subtopic text, mnemonic_number_title text NOT NULL, mnemonic_keyword text NOT NULL, formula_expansion jsonb NOT NULL DEFAULT '[]'::jsonb, explanation_examples text NOT NULL, hierarchy_path text[], created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), status text NOT NULL DEFAULT 'draft'::text );
CREATE TABLE IF NOT EXISTS mains_question_states ( id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, question_id text NOT NULL, confidence text, difficulty_level text, review_tags jsonb DEFAULT '[]'::jsonb, note text, updated_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS mains_questions ( id text NOT NULL, question_number integer, question_text text NOT NULL, marks integer, exam_year integer, paper text, subject text, section_group text, microtopic text, subtopic text, nanotopic text, hierarchy_path text[], macrotag text, microtag text, is_pyq boolean DEFAULT false, source_attribution_label text, exam_info jsonb, stage text, exam text, exam_group text, is_upsc_cse boolean DEFAULT false, is_allied boolean DEFAULT false, is_others boolean DEFAULT false, exam_category text, course text, institute text, program_id text, program_name text, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), status text NOT NULL DEFAULT 'draft'::text );
CREATE TABLE IF NOT EXISTS mains_sc_judgments ( id uuid NOT NULL DEFAULT gen_random_uuid(), paper text, subject text, section_group text, microtopic text, subtopic text, title text, content_markdown text, core_values text[], hierarchy_path text[], status text DEFAULT 'published'::text, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS mains_user_revision ( id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, question_id text NOT NULL, institute text, revised_at timestamp with time zone DEFAULT now(), confidence text DEFAULT 'medium'::text );
CREATE TABLE IF NOT EXISTS pilot_v2_ai_history ( id uuid NOT NULL DEFAULT uuid_generate_v4(), user_id uuid, question_id text NOT NULL, messages jsonb NOT NULL DEFAULT '[]'::jsonb, metadata jsonb DEFAULT '{}'::jsonb, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS pilot_v2_explanations ( id uuid NOT NULL DEFAULT uuid_generate_v4(), user_id uuid, question_id text NOT NULL, variant_name text NOT NULL, content_html text NOT NULL, content_blocks jsonb NOT NULL DEFAULT '[]'::jsonb, metadata jsonb DEFAULT '{}'::jsonb, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS plan_courses ( id uuid NOT NULL DEFAULT gen_random_uuid(), plan_id uuid NOT NULL, course_name text NOT NULL );
CREATE TABLE IF NOT EXISTS plan_features ( id uuid NOT NULL DEFAULT gen_random_uuid(), plan_id uuid NOT NULL, feature_id uuid NOT NULL, is_granted boolean DEFAULT true, max_count integer );
CREATE TABLE IF NOT EXISTS plan_institutes ( id uuid NOT NULL DEFAULT gen_random_uuid(), plan_id uuid NOT NULL, institute_name text NOT NULL );
CREATE TABLE IF NOT EXISTS posts ( id uuid, user_id uuid, content text );
CREATE TABLE IF NOT EXISTS prompt_templates ( id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, template_name character varying(100) NOT NULL, template_key character varying(100) NOT NULL, button_label character varying(50) NOT NULL, button_emoji character varying(10), prompt_text text NOT NULL, category character varying(50) NOT NULL, is_active boolean DEFAULT true, display_order integer DEFAULT 0, created_at timestamp without time zone DEFAULT now(), updated_at timestamp without time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS question_states ( id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, question_id text NOT NULL, test_id text, selected_answer text, confidence text, note text, highlight_text text, saved_folders jsonb DEFAULT '[]'::jsonb, review_tags jsonb DEFAULT '[]'::jsonb, question_type_tags jsonb DEFAULT '[]'::jsonb, review_difficulty text, is_incorrect_last_attempt boolean DEFAULT false, marked_tough boolean DEFAULT false, marked_must_revise boolean DEFAULT false, attempts_history jsonb DEFAULT '[]'::jsonb, spaced_revision jsonb DEFAULT '{}'::jsonb, updated_at timestamp with time zone DEFAULT now(), attempt_hour integer, difficulty_level text, error_category text, user_tags text[], time_spent_seconds integer DEFAULT 0, attempt_id text, deleted boolean DEFAULT false );
CREATE TABLE IF NOT EXISTS questions ( id text NOT NULL, test_id text NOT NULL, question_number integer, question_text text NOT NULL DEFAULT ''::text, statement_lines jsonb DEFAULT '[]'::jsonb, question_blocks jsonb DEFAULT '[]'::jsonb, options jsonb DEFAULT '{}'::jsonb, correct_answer text, explanation_markdown text DEFAULT ''::text, source_attribution_label text, source jsonb DEFAULT '{}'::jsonb, subject text, section_group text, micro_topic text, is_pyq boolean DEFAULT false, is_ncert boolean DEFAULT false, is_upsc_cse boolean DEFAULT false, is_allied boolean DEFAULT false, is_others boolean DEFAULT false, is_cancelled boolean DEFAULT false, exam text, exam_group text, exam_year integer, exam_category text, specific_exam text, exam_stage text, exam_paper text, updated_at timestamp with time zone DEFAULT now(), course text DEFAULT 'Civil Services'::text, sub_topic text, is_upsc_cms boolean DEFAULT false, is_neetpg boolean DEFAULT false, is_inicet boolean DEFAULT false );
CREATE TABLE IF NOT EXISTS soft_notebooks ( id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, name text NOT NULL, cover_color text NOT NULL DEFAULT '#fde68a'::text, paper_style text NOT NULL DEFAULT 'plain'::text, archived boolean NOT NULL DEFAULT false, pinned boolean NOT NULL DEFAULT false, created_at timestamp with time zone NOT NULL DEFAULT now(), updated_at timestamp with time zone NOT NULL DEFAULT now() );
CREATE TABLE IF NOT EXISTS soft_pages ( id uuid NOT NULL DEFAULT gen_random_uuid(), notebook_id uuid NOT NULL, order_index integer NOT NULL, width integer NOT NULL DEFAULT 800, height integer NOT NULL DEFAULT 1131, paper_style text NOT NULL DEFAULT 'plain'::text, created_at timestamp with time zone NOT NULL DEFAULT now(), updated_at timestamp with time zone NOT NULL DEFAULT now() );
CREATE TABLE IF NOT EXISTS soft_strokes ( id uuid NOT NULL DEFAULT gen_random_uuid(), page_id uuid NOT NULL, tool text NOT NULL, color text NOT NULL, width numeric NOT NULL, opacity numeric NOT NULL, raw_points jsonb NOT NULL, bezier_points jsonb, bounding_box jsonb, z_index integer NOT NULL DEFAULT 0, created_at timestamp with time zone NOT NULL DEFAULT now() );
CREATE TABLE IF NOT EXISTS soft_text_boxes ( id uuid NOT NULL DEFAULT gen_random_uuid(), page_id uuid NOT NULL, x numeric NOT NULL, y numeric NOT NULL, width numeric NOT NULL, height numeric NOT NULL, content text NOT NULL, font_size numeric NOT NULL, font_family text, color text NOT NULL, z_index integer NOT NULL DEFAULT 0, created_at timestamp with time zone NOT NULL DEFAULT now(), updated_at timestamp with time zone NOT NULL DEFAULT now() );
CREATE TABLE IF NOT EXISTS study_sessions ( id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, date date NOT NULL DEFAULT CURRENT_DATE, cards_reviewed integer NOT NULL DEFAULT 0, cards_correct integer NOT NULL DEFAULT 0, duration_seconds integer DEFAULT 0, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS test_attempts ( id text NOT NULL, user_id uuid NOT NULL, test_id text, title text, provider text, subject text, explanation_mode text, timer_mode text, timer_minutes integer, started_at timestamp with time zone, submitted_at timestamp with time zone DEFAULT now(), score numeric, attempt_payload jsonb DEFAULT '{}'::jsonb, custom_test_name text, updated_at timestamp with time zone DEFAULT now(), deleted boolean DEFAULT false );
CREATE TABLE IF NOT EXISTS tests ( id text NOT NULL, title text NOT NULL, provider text, institute text, program_id text, program_name text, launch_year integer, series text, level text, year integer, subject text, subject_test text, section_group text, paper_type text, question_count integer DEFAULT 0, default_minutes integer, source_mode text, is_demo_available boolean DEFAULT false, exam_year integer, updated_at timestamp with time zone DEFAULT now(), course text DEFAULT 'Civil Services'::text );
CREATE TABLE IF NOT EXISTS user_best_answers ( id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid, question_id text NOT NULL, answer_text text NOT NULL, key_points text, custom_prompt text, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS user_cards ( id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, card_id uuid NOT NULL, status text NOT NULL DEFAULT 'active'::text, repetitions integer NOT NULL DEFAULT 0, interval_days integer NOT NULL DEFAULT 0, ease_factor double precision NOT NULL DEFAULT 2.5, next_review timestamp with time zone NOT NULL DEFAULT now(), last_reviewed timestamp with time zone, learning_status text NOT NULL DEFAULT 'not_studied'::text, again_count integer NOT NULL DEFAULT 0, user_note text DEFAULT ''::text, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), last_quality smallint, lapses integer DEFAULT 0, client_updated_at timestamp with time zone DEFAULT now(), dirty boolean DEFAULT false, times_seen integer DEFAULT 0, learning_step smallint, interval_minutes integer NOT NULL DEFAULT 0, question_id text, is_relearning boolean DEFAULT false, deleted boolean DEFAULT false );
CREATE TABLE IF NOT EXISTS user_feature_overrides ( id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, feature_key text NOT NULL, is_granted boolean NOT NULL, reason text DEFAULT ''::text, created_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS user_note_nodes ( id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, parent_id uuid, type text NOT NULL, title text NOT NULL, metadata jsonb DEFAULT '{}'::jsonb, note_id uuid, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), is_pinned boolean DEFAULT false, color text, icon text, is_archived boolean NOT NULL DEFAULT false );
CREATE TABLE IF NOT EXISTS user_notes ( id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, subject text NOT NULL, title text NOT NULL, checklist_notes text DEFAULT ''::text, items jsonb DEFAULT '[]'::jsonb, highlights jsonb DEFAULT '[]'::jsonb, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), content text, content_html text, deleted boolean DEFAULT false );
CREATE TABLE IF NOT EXISTS user_settings ( user_id uuid NOT NULL, full_name text, display_name text, deck_intervals jsonb DEFAULT '{"easy": 7, "good": 3, "hard": 1, "again": 0}'::jsonb, permissions jsonb DEFAULT '{"isAdmin": false, "accessPdf": true, "accessTags": true, "accessNotes": true, "accessFlashcards": true}'::jsonb, custom_tags jsonb DEFAULT '[]'::jsonb, folders jsonb DEFAULT '[]'::jsonb, updated_at timestamp with time zone DEFAULT now(), analytics_layout jsonb NOT NULL DEFAULT '{"review": ["summary", "outcomes", "subject_accuracy", "fatigue", "difficulty", "mistake_types", "confidence", "weak_areas", "insights"], "overall": ["smart_insight", "repeated_weaknesses", "performance_trajectory", "subject_proficiency", "elimination_zone", "theme_heatmap", "fatigue_difficulty", "mistake_categorization"]}'::jsonb, selected_course text DEFAULT 'Civil Services'::text );
CREATE TABLE IF NOT EXISTS user_subscriptions ( id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, plan_id uuid NOT NULL, is_active boolean DEFAULT true, starts_at timestamp with time zone DEFAULT now(), expires_at timestamp with time zone, auto_renew boolean DEFAULT false, payment_ref text DEFAULT ''::text, notes text DEFAULT ''::text, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), course_name text );
CREATE TABLE IF NOT EXISTS user_syllabus_progress ( id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid, path text NOT NULL, status jsonb NOT NULL, updated_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS user_widgets ( id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, widget_key text NOT NULL, position integer NOT NULL DEFAULT 0, is_archived boolean NOT NULL DEFAULT false, created_at timestamp with time zone DEFAULT now(), size text NOT NULL DEFAULT 'half'::text );
CREATE TABLE IF NOT EXISTS users ( id uuid NOT NULL, email text, created_at timestamp without time zone );
CREATE TABLE IF NOT EXISTS v_deck_summary ( user_id uuid, subject text, section_group text, microtopic text, new_count bigint, learning_count bigint, mastered_count bigint, leech_count bigint, due_count bigint, total_count bigint );
CREATE TABLE IF NOT EXISTS vitamin_versions ( id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, question_id character varying(100) NOT NULL, explanation_content text NOT NULL, template_used character varying(100), rating integer DEFAULT 0, is_primary boolean DEFAULT false, created_at timestamp without time zone DEFAULT now() );

-- ==================================================
-- 3. PRIMARY KEYS
-- ==================================================
ALTER TABLE questions ADD PRIMARY KEY (id);
ALTER TABLE tests ADD PRIMARY KEY (id);
ALTER TABLE user_notes ADD PRIMARY KEY (id);
ALTER TABLE user_note_nodes ADD PRIMARY KEY (id);
ALTER TABLE folders ADD PRIMARY KEY (id);
ALTER TABLE cards ADD PRIMARY KEY (id);
ALTER TABLE user_cards ADD PRIMARY KEY (id);
ALTER TABLE card_folder_map ADD PRIMARY KEY (id);
ALTER TABLE test_attempts ADD PRIMARY KEY (id);
ALTER TABLE draft_attempts ADD PRIMARY KEY (id);
ALTER TABLE study_sessions ADD PRIMARY KEY (id);
ALTER TABLE admin_users ADD PRIMARY KEY (id);
ALTER TABLE question_states ADD PRIMARY KEY (id);
ALTER TABLE user_syllabus_progress ADD PRIMARY KEY (id);
ALTER TABLE card_reviews ADD PRIMARY KEY (id);
ALTER TABLE user_widgets ADD PRIMARY KEY (id);
ALTER TABLE flashcard_branches ADD PRIMARY KEY (id);
ALTER TABLE flashcard_branch_cards ADD PRIMARY KEY (id);
ALTER TABLE user_best_answers ADD PRIMARY KEY (id);
ALTER TABLE prompt_templates ADD PRIMARY KEY (id);
ALTER TABLE conversation_history ADD PRIMARY KEY (id);
ALTER TABLE vitamin_versions ADD PRIMARY KEY (id);
ALTER TABLE ai_settings ADD PRIMARY KEY (id);
ALTER TABLE soft_notebooks ADD PRIMARY KEY (id);
ALTER TABLE soft_pages ADD PRIMARY KEY (id);
ALTER TABLE soft_strokes ADD PRIMARY KEY (id);
ALTER TABLE soft_text_boxes ADD PRIMARY KEY (id);
ALTER TABLE pilot_v2_ai_history ADD PRIMARY KEY (id);
ALTER TABLE pilot_v2_explanations ADD PRIMARY KEY (id);
ALTER TABLE courses ADD PRIMARY KEY (id);
ALTER TABLE users ADD PRIMARY KEY (id);
ALTER TABLE access_features ADD PRIMARY KEY (id);
ALTER TABLE access_plans ADD PRIMARY KEY (id);
ALTER TABLE plan_features ADD PRIMARY KEY (id);
ALTER TABLE plan_institutes ADD PRIMARY KEY (id);
ALTER TABLE plan_courses ADD PRIMARY KEY (id);
ALTER TABLE user_subscriptions ADD PRIMARY KEY (id);
ALTER TABLE user_feature_overrides ADD PRIMARY KEY (id);
ALTER TABLE mains_user_revision ADD PRIMARY KEY (id);
ALTER TABLE mains_data_facts ADD PRIMARY KEY (id);
ALTER TABLE mains_ethics_value_add ADD PRIMARY KEY (id);
ALTER TABLE mains_mnemonics ADD PRIMARY KEY (id);
ALTER TABLE mains_frameworks ADD PRIMARY KEY (id);
ALTER TABLE mains_essay_value_add ADD PRIMARY KEY (id);
ALTER TABLE mains_intro_conclusions ADD PRIMARY KEY (id);
ALTER TABLE mains_questions ADD PRIMARY KEY (id);
ALTER TABLE mains_answers ADD PRIMARY KEY (id);
ALTER TABLE mains_question_states ADD PRIMARY KEY (id);
ALTER TABLE lscs_thesis_cases ADD PRIMARY KEY (id);
ALTER TABLE mains_keywords ADD PRIMARY KEY (id);
ALTER TABLE mains_case_studies ADD PRIMARY KEY (id);
ALTER TABLE mains_sc_judgments ADD PRIMARY KEY (id);
ALTER TABLE folder_algorithm_settings ADD PRIMARY KEY (user_id, folder_key);

-- ==================================================
-- 4. INDEXES
-- ==================================================
CREATE INDEX idx_tests_course ON public.tests USING btree (course);
CREATE INDEX idx_user_note_nodes_user ON public.user_note_nodes USING btree (user_id);
CREATE UNIQUE INDEX flashcard_branch_cards_branch_id_card_id_key ON public.flashcard_branch_cards USING btree (branch_id, card_id);
CREATE INDEX idx_flashcard_branch_cards_branch ON public.flashcard_branch_cards USING btree (branch_id);
CREATE INDEX idx_flashcard_branch_cards_card ON public.flashcard_branch_cards USING btree (card_id);
CREATE UNIQUE INDEX flashcard_branch_cards_user_id_card_id_key ON public.flashcard_branch_cards USING btree (user_id, card_id);
CREATE UNIQUE INDEX user_widgets_user_id_widget_key_key ON public.user_widgets USING btree (user_id, widget_key);
CREATE INDEX idx_user_widgets_user_pos ON public.user_widgets USING btree (user_id, is_archived, "position");
CREATE INDEX idx_flashcard_branches_user ON public.flashcard_branches USING btree (user_id);
CREATE INDEX idx_flashcard_branches_parent ON public.flashcard_branches USING btree (parent_id);
CREATE INDEX idx_question_states_user_question ON public.question_states USING btree (user_id, question_id);
CREATE INDEX idx_question_states_attempt_id ON public.question_states USING btree (attempt_id);
CREATE INDEX idx_question_states_test_id ON public.question_states USING btree (test_id);
CREATE INDEX idx_qstates_user_err ON public.question_states USING btree (user_id, error_category) WHERE (error_category IS NOT NULL);
CREATE INDEX idx_question_states_updated_at ON public.question_states USING btree (updated_at);
CREATE UNIQUE INDEX user_syllabus_progress_user_id_path_key ON public.user_syllabus_progress USING btree (user_id, path);
CREATE INDEX idx_card_reviews_user_card ON public.card_reviews USING btree (user_id, card_id, reviewed_at DESC);
CREATE INDEX idx_user_cards_card_id ON public.user_cards USING btree (card_id);
CREATE INDEX idx_user_cards_user_next_review ON public.user_cards USING btree (user_id, next_review) WHERE (status = 'active'::text);
CREATE INDEX idx_user_cards_user_learning_status ON public.user_cards USING btree (user_id, learning_status) WHERE (status = 'active'::text);
CREATE UNIQUE INDEX uq_user_cards_user_card ON public.user_cards USING btree (user_id, card_id);
CREATE INDEX idx_user_cards_updated_at ON public.user_cards USING btree (updated_at);
CREATE INDEX idx_test_attempts_user_submitted ON public.test_attempts USING btree (user_id, submitted_at DESC);
CREATE INDEX idx_test_attempts_updated_at ON public.test_attempts USING btree (updated_at);
CREATE UNIQUE INDEX user_best_answers_user_id_question_id_key ON public.user_best_answers USING btree (user_id, question_id);
CREATE INDEX user_best_answers_user_idx ON public.user_best_answers USING btree (user_id);
CREATE INDEX user_best_answers_question_idx ON public.user_best_answers USING btree (user_id, question_id);
CREATE INDEX idx_cards_subject_section_microtopic ON public.cards USING btree (subject, section_group, microtopic);
CREATE INDEX idx_cards_is_deleted ON public.cards USING btree (is_deleted);
CREATE INDEX idx_user_notes_updated_at ON public.user_notes USING btree (updated_at);
CREATE INDEX idx_user_notes_user ON public.user_notes USING btree (user_id);
CREATE UNIQUE INDEX access_features_key_key ON public.access_features USING btree (key);
CREATE UNIQUE INDEX plan_features_plan_id_feature_id_key ON public.plan_features USING btree (plan_id, feature_id);
CREATE UNIQUE INDEX plan_institutes_plan_id_institute_name_key ON public.plan_institutes USING btree (plan_id, institute_name);
CREATE UNIQUE INDEX plan_courses_plan_id_course_name_key ON public.plan_courses USING btree (plan_id, course_name);
CREATE UNIQUE INDEX user_feature_overrides_user_id_feature_key_key ON public.user_feature_overrides USING btree (user_id, feature_key);
CREATE INDEX idx_user_subscriptions_user ON public.user_subscriptions USING btree (user_id);
CREATE INDEX idx_user_subscriptions_active ON public.user_subscriptions USING btree (user_id, is_active);
CREATE UNIQUE INDEX prompt_templates_user_id_template_key_key ON public.prompt_templates USING btree (user_id, template_key);
CREATE UNIQUE INDEX ai_settings_user_id_key ON public.ai_settings USING btree (user_id);
CREATE INDEX idx_soft_notebooks_user ON public.soft_notebooks USING btree (user_id);
CREATE INDEX idx_soft_pages_notebook ON public.soft_pages USING btree (notebook_id);
CREATE INDEX idx_soft_strokes_page ON public.soft_strokes USING btree (page_id);
CREATE INDEX idx_soft_text_boxes_page ON public.soft_text_boxes USING btree (page_id);
CREATE UNIQUE INDEX unique_user_question_revision ON public.mains_user_revision USING btree (user_id, question_id, institute);
CREATE INDEX idx_mains_revision_user ON public.mains_user_revision USING btree (user_id);
CREATE INDEX idx_mains_revision_question ON public.mains_user_revision USING btree (question_id);
CREATE INDEX idx_pilot_v2_ai_history_question ON public.pilot_v2_ai_history USING btree (question_id, user_id);
CREATE INDEX idx_pilot_v2_explanations_question ON public.pilot_v2_explanations USING btree (question_id, user_id);
CREATE INDEX idx_mains_ethics_path ON public.mains_ethics_value_add USING gin (hierarchy_path);
CREATE INDEX idx_mains_data_facts_path ON public.mains_data_facts USING gin (hierarchy_path);
CREATE INDEX idx_mains_mnemonics_path ON public.mains_mnemonics USING gin (hierarchy_path);
CREATE UNIQUE INDEX courses_name_key ON public.courses USING btree (name);
CREATE UNIQUE INDEX courses_code_key ON public.courses USING btree (code);
CREATE INDEX idx_mains_intro_conclusions_path ON public.mains_intro_conclusions USING gin (hierarchy_path);
CREATE INDEX idx_questions_test_id ON public.questions USING btree (test_id);
CREATE INDEX idx_questions_course ON public.questions USING btree (course);
CREATE INDEX idx_questions_is_upsc_cms ON public.questions USING btree (is_upsc_cms);
CREATE INDEX idx_questions_is_neetpg ON public.questions USING btree (is_neetpg);
CREATE INDEX idx_questions_is_inicet ON public.questions USING btree (is_inicet);
CREATE UNIQUE INDEX unique_user_mains_question ON public.mains_question_states USING btree (user_id, question_id);
CREATE INDEX idx_mains_qstates_user_q ON public.mains_question_states USING btree (user_id, question_id);
CREATE INDEX idx_mains_questions_subject ON public.mains_questions USING btree (subject);
CREATE INDEX idx_mains_questions_paper ON public.mains_questions USING btree (paper);
CREATE INDEX idx_mains_answers_question_id ON public.mains_answers USING btree (question_id);
CREATE INDEX idx_mains_answers_institute ON public.mains_answers USING btree (institute);

-- ==================================================
-- 5. FOREIGN KEYS
-- ==================================================
ALTER TABLE questions ADD CONSTRAINT fk_questions_tests FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE;
ALTER TABLE question_states ADD CONSTRAINT fk_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE;
ALTER TABLE user_cards ADD CONSTRAINT fk_user_cards_cards FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE;
ALTER TABLE flashcard_branches ADD CONSTRAINT flashcard_branches_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES flashcard_branches(id) ON DELETE CASCADE;
ALTER TABLE flashcard_branch_cards ADD CONSTRAINT flashcard_branch_cards_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES flashcard_branches(id) ON DELETE CASCADE;
ALTER TABLE flashcard_branch_cards ADD CONSTRAINT flashcard_branch_cards_card_id_fkey FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE;
ALTER TABLE soft_pages ADD CONSTRAINT soft_pages_notebook_id_fkey FOREIGN KEY (notebook_id) REFERENCES soft_notebooks(id) ON DELETE CASCADE;
ALTER TABLE soft_strokes ADD CONSTRAINT soft_strokes_page_id_fkey FOREIGN KEY (page_id) REFERENCES soft_pages(id) ON DELETE CASCADE;
ALTER TABLE soft_text_boxes ADD CONSTRAINT soft_text_boxes_page_id_fkey FOREIGN KEY (page_id) REFERENCES soft_pages(id) ON DELETE CASCADE;
ALTER TABLE plan_features ADD CONSTRAINT plan_features_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES access_plans(id) ON DELETE CASCADE;
ALTER TABLE plan_features ADD CONSTRAINT plan_features_feature_id_fkey FOREIGN KEY (feature_id) REFERENCES access_features(id) ON DELETE CASCADE;
ALTER TABLE plan_institutes ADD CONSTRAINT plan_institutes_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES access_plans(id) ON DELETE CASCADE;
ALTER TABLE plan_courses ADD CONSTRAINT plan_courses_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES access_plans(id) ON DELETE CASCADE;
ALTER TABLE user_subscriptions ADD CONSTRAINT user_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE user_subscriptions ADD CONSTRAINT user_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES access_plans(id) ON DELETE CASCADE;
ALTER TABLE user_feature_overrides ADD CONSTRAINT user_feature_overrides_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE user_feature_overrides ADD CONSTRAINT user_feature_overrides_feature_key_fkey FOREIGN KEY (feature_key) REFERENCES access_features(key) ON DELETE CASCADE;
ALTER TABLE mains_user_revision ADD CONSTRAINT mains_user_revision_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE mains_answers ADD CONSTRAINT mains_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES mains_questions(id) ON DELETE CASCADE;
ALTER TABLE mains_question_states ADD CONSTRAINT mains_question_states_question_id_fkey FOREIGN KEY (question_id) REFERENCES mains_questions(id) ON DELETE CASCADE;

-- ==================================================
-- 6. VIEWS, FUNCTIONS, TRIGGERS & RLS POLICIES (From Local Migrations)
-- ==================================================
-- =========================================================
-- Tag rename + management RPCs (Phase 3.B)
-- Author: Emergent AI (mobile app team)
-- Date  : 2026-01-03
-- Run in Supabase SQL editor. Idempotent.
-- =========================================================

-- Rename a tag atomically across:
--   1. question_states.review_tags (jsonb array of strings) for that user
--   2. user_settings.custom_tags    (jsonb array of strings) for that user
-- This replaces the multi-round-trip name-based update the mobile app
-- used to do and guarantees the user never sees half-renamed rows.
CREATE OR REPLACE FUNCTION rename_user_tag(
  p_old_tag text,
  p_new_tag text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid := auth.uid();
  v_old_norm  text := lower(trim(p_old_tag));
  v_new_label text := trim(p_new_tag);
  v_rows_updated int := 0;
  v_settings_updated int := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_old_norm = '' OR v_new_label = '' THEN
    RAISE EXCEPTION 'Tag name cannot be empty';
  END IF;

  -- 1. Update question_states.review_tags
  WITH updated AS (
    UPDATE question_states
       SET review_tags = (
             SELECT coalesce(
               jsonb_agg(
                 CASE
                   WHEN lower(trim(elem::text, '"')) = v_old_norm THEN to_jsonb(v_new_label)
                   ELSE elem
                 END
               ),
               '[]'::jsonb
             )
             FROM jsonb_array_elements(review_tags) elem
           )
     WHERE user_id = v_user_id
       AND review_tags @? '$[*] ? (@.type() == "string")'
       AND EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(review_tags) t
         WHERE lower(trim(t)) = v_old_norm
       )
     RETURNING id
  )
  SELECT count(*) INTO v_rows_updated FROM updated;

  -- 2. Update user_settings.custom_tags
  WITH updated AS (
    UPDATE user_settings
       SET custom_tags = (
             SELECT coalesce(
               jsonb_agg(
                 CASE
                   WHEN lower(trim(elem::text, '"')) = v_old_norm THEN to_jsonb(v_new_label)
                   ELSE elem
                 END
               ),
               '[]'::jsonb
             )
             FROM jsonb_array_elements(custom_tags) elem
           )
     WHERE user_id = v_user_id
       AND custom_tags IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(custom_tags) t
         WHERE lower(trim(t)) = v_old_norm
       )
     RETURNING user_id
  )
  SELECT count(*) INTO v_settings_updated FROM updated;

  RETURN jsonb_build_object(
    'success', true,
    'question_rows_updated', v_rows_updated,
    'settings_updated', v_settings_updated,
    'old_tag', p_old_tag,
    'new_tag', v_new_label
  );
END;
$$;

GRANT EXECUTE ON FUNCTION rename_user_tag(text, text) TO authenticated;

-- Remove a tag completely from a user's data.
CREATE OR REPLACE FUNCTION remove_user_tag(p_tag text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_norm    text := lower(trim(p_tag));
  v_rows_updated int := 0;
  v_settings_updated int := 0;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_norm = '' THEN RAISE EXCEPTION 'Tag name cannot be empty'; END IF;

  WITH updated AS (
    UPDATE question_states
       SET review_tags = (
             SELECT coalesce(jsonb_agg(elem), '[]'::jsonb)
             FROM jsonb_array_elements(review_tags) elem
             WHERE lower(trim(elem::text, '"')) <> v_norm
           )
     WHERE user_id = v_user_id
       AND EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(review_tags) t
         WHERE lower(trim(t)) = v_norm
       )
     RETURNING id
  )
  SELECT count(*) INTO v_rows_updated FROM updated;

  WITH updated AS (
    UPDATE user_settings
       SET custom_tags = (
             SELECT coalesce(jsonb_agg(elem), '[]'::jsonb)
             FROM jsonb_array_elements(custom_tags) elem
             WHERE lower(trim(elem::text, '"')) <> v_norm
           )
     WHERE user_id = v_user_id
       AND custom_tags IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(custom_tags) t
         WHERE lower(trim(t)) = v_norm
       )
     RETURNING user_id
  )
  SELECT count(*) INTO v_settings_updated FROM updated;

  RETURN jsonb_build_object(
    'success', true,
    'question_rows_updated', v_rows_updated,
    'settings_updated', v_settings_updated,
    'tag', p_tag
  );
END;
$$;

GRANT EXECUTE ON FUNCTION remove_user_tag(text) TO authenticated;

-- Add a new tag to the user's custom tag catalog (no-op if already present).
CREATE OR REPLACE FUNCTION add_user_tag(p_tag text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_label   text := trim(p_tag);
  v_norm    text := lower(v_label);
  v_already bool := false;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_label = '' THEN RAISE EXCEPTION 'Tag name cannot be empty'; END IF;

  -- Ensure a user_settings row exists
  INSERT INTO user_settings (user_id, custom_tags)
  VALUES (v_user_id, '[]'::jsonb)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT EXISTS (
    SELECT 1 FROM user_settings us,
                  jsonb_array_elements_text(coalesce(us.custom_tags, '[]'::jsonb)) t
     WHERE us.user_id = v_user_id AND lower(trim(t)) = v_norm
  ) INTO v_already;

  IF NOT v_already THEN
    UPDATE user_settings
       SET custom_tags = coalesce(custom_tags, '[]'::jsonb) || to_jsonb(v_label)
     WHERE user_id = v_user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'added', NOT v_already, 'tag', v_label);
END;
$$;

GRANT EXECUTE ON FUNCTION add_user_tag(text) TO authenticated;

-- Comment explaining the column
COMMENT ON COLUMN public.questions.course IS 
'Course identifier: UPSC CSE, Medical Science, NEET PG, etc. Defaults to UPSC CSE for backward compatibility.';

-- Comment explaining the column
COMMENT ON COLUMN public.questions.sub_topic IS 
'Level 4 of taxonomy hierarchy. Full hierarchy: subject → section_group → micro_topic → sub_topic';

COMMENT ON COLUMN public.tests.course IS 
'Course identifier for the test. Defaults to UPSC CSE.';

-- Insert default courses
INSERT INTO public.courses (name, code, display_name) VALUES
  ('UPSC CSE', 'upsc_cse', 'UPSC CSE'),
  ('Medical Science', 'medical_science', 'Medical Science')
ON CONFLICT (name) DO NOTHING;

COMMENT ON COLUMN public.user_settings.selected_course IS 
'User''s currently selected course. Stored in app context as well.';

-- Comment for documentation
comment on column public.questions.is_upsc_cms is 'Flag indicating if question is from UPSC CMS (NEET-based) exam';

comment on column public.questions.is_neetpg is 'Flag indicating if question is from NEET-PG exam';

comment on column public.questions.is_inicet is 'Flag indicating if question is from INI-CET exam';

-- ==========================================================================
-- 8. AUDIT LOG
-- ==========================================================================

CREATE TABLE IF NOT EXISTS access_audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        uuid,                      -- admin who made the change (NULL for system)
  action          text NOT NULL,              -- 'subscription_created', 'subscription_deactivated',
                                              -- 'subscription_expired', 'override_created',
                                              -- 'override_deleted', 'plan_created', 'plan_updated',
                                              -- 'feature_created', 'feature_updated'
  target_type     text NOT NULL,              -- 'user', 'subscription', 'plan', 'feature', 'override'
  target_id       text,                       -- UUID or identifier of the affected entity
  details         jsonb DEFAULT '{}'::jsonb,  -- Extra info (old/new values, reason, etc.)
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE access_audit_log ENABLE ROW LEVEL SECURITY;

-- Only super_admins can read audit logs (enforced application-side)

-- ==========================================================================
-- 9. SUBSCRIPTION EXPIRY FUNCTION
-- Auto-deactivates expired subscriptions (can be called by cron or on-demand)
-- ==========================================================================

CREATE OR REPLACE FUNCTION deactivate_expired_subscriptions()
RETURNS integer   -- Returns number of subscriptions deactivated
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deactivated_count integer;
BEGIN
  UPDATE user_subscriptions
  SET is_active = false,
      updated_at = now()
  WHERE is_active = true
    AND expires_at IS NOT NULL
    AND expires_at < now()
    AND is_active = true;  -- Only deactivate currently active ones

  GET DIAGNOSTICS deactivated_count = ROW_COUNT;

  -- Log the batch expiry
  IF deactivated_count > 0 THEN
    INSERT INTO access_audit_log (action, target_type, details)
    VALUES ('subscription_expired', 'subscription',
            jsonb_build_object('count', deactivated_count, 'batch_expiry', true));
  END IF;

  RETURN deactivated_count;
END;
$$;

-- ==========================================================================
-- ROW LEVEL SECURITY
-- ==========================================================================

ALTER TABLE access_features ENABLE ROW LEVEL SECURITY;

ALTER TABLE access_plans ENABLE ROW LEVEL SECURITY;

ALTER TABLE plan_features ENABLE ROW LEVEL SECURITY;

ALTER TABLE plan_institutes ENABLE ROW LEVEL SECURITY;

ALTER TABLE plan_courses ENABLE ROW LEVEL SECURITY;

ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

ALTER TABLE user_feature_overrides ENABLE ROW LEVEL SECURITY;

-- Public read for features/plans (the mobile app needs to check permissions)
CREATE POLICY "Public read access_features"
  ON access_features FOR SELECT USING (true);

CREATE POLICY "Public read access_plans"
  ON access_plans FOR SELECT USING (true);

CREATE POLICY "Public read plan_features"
  ON plan_features FOR SELECT USING (true);

CREATE POLICY "Public read plan_institutes"
  ON plan_institutes FOR SELECT USING (true);

CREATE POLICY "Public read plan_courses"
  ON plan_courses FOR SELECT USING (true);

-- Users can read their own subscriptions
CREATE POLICY "Users read own subscriptions"
  ON user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can read their own overrides
CREATE POLICY "Users read own overrides"
  ON user_feature_overrides FOR SELECT
  USING (auth.uid() = user_id);

-- Admin panel needs full CRUD on all access control tables
DROP POLICY IF EXISTS "Admin users can be read" ON admin_users;

CREATE POLICY "Admin users can be read"
  ON admin_users FOR SELECT
  USING (auth.role() = 'authenticated');

-- Admin panel write access for authenticated users (they're in admin_users)
DROP POLICY IF EXISTS "Auth can manage access_features" ON access_features;

CREATE POLICY "Auth can manage access_features"
  ON access_features FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth can manage access_plans" ON access_plans;

CREATE POLICY "Auth can manage access_plans"
  ON access_plans FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth can manage plan_features" ON plan_features;

CREATE POLICY "Auth can manage plan_features"
  ON plan_features FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth can manage plan_institutes" ON plan_institutes;

CREATE POLICY "Auth can manage plan_institutes"
  ON plan_institutes FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth can manage plan_courses" ON plan_courses;

CREATE POLICY "Auth can manage plan_courses"
  ON plan_courses FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth can manage user_subscriptions" ON user_subscriptions;

CREATE POLICY "Auth can manage user_subscriptions"
  ON user_subscriptions FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth can manage user_feature_overrides" ON user_feature_overrides;

CREATE POLICY "Auth can manage user_feature_overrides"
  ON user_feature_overrides FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth can read access_audit_log" ON access_audit_log;

CREATE POLICY "Auth can read access_audit_log"
  ON access_audit_log FOR SELECT USING (auth.role() = 'authenticated');

-- ==========================================================================
-- USER SUBSCRIPTIONS: add trigger to auto-set updated_at
-- ==========================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Trigger function to automatically copy new auth.users records to public.users profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at)
  VALUES (new.id, new.email, new.created_at)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================================================
-- HELPER FUNCTION: Get effective permissions for a user
-- ==========================================================================

CREATE OR REPLACE FUNCTION get_user_effective_features(p_user_id uuid)
RETURNS TABLE (
  feature_key    text,
  feature_name   text,
  is_granted     boolean,
  source         text       -- 'plan', 'override_grant', 'override_revoke'
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  -- Features from active subscriptions
  SELECT
    af.key,
    af.name,
    pf.is_granted,
    'plan'::text
  FROM user_subscriptions us
  JOIN access_plans ap ON us.plan_id = ap.id
  JOIN plan_features pf ON pf.plan_id = ap.id
  JOIN access_features af ON af.id = pf.feature_id
  WHERE us.user_id = p_user_id
    AND us.is_active = true
    AND (us.expires_at IS NULL OR us.expires_at > now())
    AND ap.is_active = true
    AND af.is_active = true

  UNION ALL

  -- Overrides (these take priority over plan features)
  SELECT
    af.key,
    af.name,
    ufo.is_granted,
    CASE WHEN ufo.is_granted THEN 'override_grant' ELSE 'override_revoke' END
  FROM user_feature_overrides ufo
  JOIN access_features af ON af.key = ufo.feature_key
  WHERE ufo.user_id = p_user_id;
END;
$$;

-- ==========================================================================
-- SEED DATA: Default Features
-- ==========================================================================

INSERT INTO access_features (key, name, description, category, sort_order) VALUES
  ('pyq', 'Previous Year Questions', 'Access to UPSC previous year question papers', 'feature', 1),
  ('flashcards', 'Flashcards', 'Spaced repetition flashcard system', 'feature', 2),
  ('analytics', 'Analytics & Performance', 'Performance tracking and analytics dashboards', 'feature', 3),
  ('notes', 'Text Notes', 'Rich text note-taking', 'feature', 4),
  ('soft_notes', 'Soft Notes (Canvas)', 'Canvas-based sketching and handwritten notes', 'feature', 5),
  ('hard_notes', 'Hard Notes', 'Hard notes feature', 'feature', 6),
  ('ai_search', 'AI Search', 'AI-powered semantic search across content', 'feature', 7),
  ('ai_settings', 'AI Settings', 'AI configuration and preferences', 'feature', 8),
  ('capsules', 'Study Capsules', 'Quick study capsule summaries', 'feature', 9),
  ('tracker', 'Study Tracker', 'Daily study progress tracking', 'feature', 10),
  ('quiz_arena', 'Quiz Arena', 'Take timed tests and practice quizzes', 'feature', 11),
  ('export_pdf', 'PDF Export', 'Export notes and content as PDF', 'feature', 12),
  ('revision', 'Revision System', 'Structured revision and review system', 'feature', 13),
  ('tags', 'Tags & Categories', 'Question tagging and categorization', 'feature', 14),
  ('pilot_v2', 'Pilot V2 Features', 'Experimental Pilot V2 features', 'feature', 15)
ON CONFLICT (key) DO NOTHING;

-- ==========================================================================
-- SEED DATA: Default Plans
-- ==========================================================================

INSERT INTO access_plans (name, description, price, currency, interval, sort_order) VALUES
  ('Free', 'Basic access to selected features', 0, 'INR', 'lifetime', 1),
  ('Pro Monthly', 'Full access to all features — monthly subscription', 499, 'INR', 'month', 2),
  ('Pro Yearly', 'Full access to all features — yearly subscription (save 40%%)', 3599, 'INR', 'year', 3),
  ('Premium', 'All features + AI & priority support — yearly', 5999, 'INR', 'year', 4)
ON CONFLICT DO NOTHING;

-- Assign features to Free plan (basic subset)
DO $$
DECLARE
  free_plan_id uuid;
  pyq_feature_id uuid;
  notes_feature_id uuid;
  tracker_feature_id uuid;
  tags_feature_id uuid;
BEGIN
  SELECT id INTO free_plan_id FROM access_plans WHERE name = 'Free' LIMIT 1;

  -- Free plan gets: PYQ (limited), Notes, Tracker, Tags
  INSERT INTO plan_features (plan_id, feature_id, is_granted, max_count)
  SELECT free_plan_id, id, true,
    CASE WHEN key = 'pyq' THEN 50 ELSE NULL END
  FROM access_features
  WHERE key IN ('pyq', 'notes', 'tracker', 'tags')
  ON CONFLICT (plan_id, feature_id) DO NOTHING;

  -- Assign ALL features to Pro Monthly, Pro Yearly, and Premium
  INSERT INTO plan_features (plan_id, feature_id, is_granted)
  SELECT ap.id, af.id, true
  FROM access_plans ap
  CROSS JOIN access_features af
  WHERE ap.name IN ('Pro Monthly', 'Pro Yearly', 'Premium')
  ON CONFLICT (plan_id, feature_id) DO NOTHING;
END $$;

COMMENT ON TABLE public.mains_essay_value_add IS 'Stores anecdotes, quotes and usage guides for essay writing.';

-- Comments for documentation
COMMENT ON TABLE public.mains_questions IS 'Stores subjective Mains and Optional questions and their syllabus hierarchy.';

COMMENT ON COLUMN public.mains_questions.hierarchy_path IS 'Syllabus path from paper down to subtopic, support dynamic depths (4-6 layers).';

COMMENT ON TABLE public.mains_answers IS 'Stores coaching institute model answers verbatim to preserve markdown formatting.';

COMMENT ON TABLE public.mains_user_revision IS 'Tracks user confidence and revision history for mains questions.';

COMMENT ON TABLE public.mains_data_facts IS 'Stores parameters, metrics and facts from the data & facts folder.';

COMMENT ON TABLE public.mains_intro_conclusions IS 'Stores readymade introduction and conclusion templates.';

COMMENT ON TABLE public.mains_ethics_value_add IS 'Stores terms, diagrams, innovations, and quotes specific to the GS4 Ethics hub.';

COMMENT ON TABLE public.mains_mnemonics IS 'Stores memory mnemonics, keywords, and expansions.';

COMMENT ON TABLE public.mains_frameworks IS 'Stores global answer writing frameworks and multi-syllabus mappings.';

-- Comments for documentation
COMMENT ON COLUMN public.mains_frameworks.hierarchy_1_path IS 'Syllabus path array for first associated syllabus mapping.';

COMMENT ON COLUMN public.mains_frameworks.hierarchy_2_path IS 'Syllabus path array for second associated syllabus mapping.';

COMMENT ON COLUMN public.mains_frameworks.hierarchy_3_path IS 'Syllabus path array for third associated syllabus mapping.';

COMMENT ON COLUMN public.mains_frameworks.hierarchy_4_path IS 'Syllabus path array for fourth associated syllabus mapping.';

COMMENT ON COLUMN public.mains_frameworks.hierarchy_5_path IS 'Syllabus path array for fifth associated syllabus mapping.';

-- Comment for documentation
COMMENT ON COLUMN public.mains_questions.marks IS 'Marks awarded for the question, changed to NUMERIC to support fractional marks.';

COMMENT ON COLUMN public.mains_questions.is_pyq IS 'Flag indicating if the question is an official PYQ or a test series question.';

COMMENT ON COLUMN public.mains_questions.source_attribution_label IS 'Descriptive text for the source/attribution of the question.';

COMMENT ON COLUMN public.mains_questions.exam_info IS 'Detailed JSON metadata block containing exam classification info.';

COMMENT ON COLUMN public.mains_questions.stage IS 'Exam stage, e.g. "prelims" or "mains".';

COMMENT ON COLUMN public.mains_questions.exam IS 'Specific exam name, e.g. "Mains".';

COMMENT ON COLUMN public.mains_questions.exam_group IS 'Exam grouping, e.g. "UPSC CSE".';

COMMENT ON COLUMN public.mains_questions.is_upsc_cse IS 'Boolean flag indicating if the exam is UPSC Civil Services Exam.';

COMMENT ON COLUMN public.mains_questions.is_allied IS 'Boolean flag indicating if the exam is an allied services exam.';

COMMENT ON COLUMN public.mains_questions.is_others IS 'Boolean flag indicating if the exam is another category.';

COMMENT ON COLUMN public.mains_questions.exam_category IS 'Exam category, e.g. "cse".';

COMMENT ON COLUMN public.mains_questions.course IS 'Course category, e.g. "Civil Services".';

COMMENT ON COLUMN public.mains_questions.institute IS 'Coaching institute name, e.g. "Forum IAS".';

COMMENT ON COLUMN public.mains_questions.program_id IS 'Program identifier, e.g. "mgp".';

COMMENT ON COLUMN public.mains_questions.program_name IS 'Program name, e.g. "MGP".';

COMMENT ON COLUMN public.mains_questions.nanotopic IS 'Syllabus layer 5 (nanotopic) below subtopic, specifically used for optional subjects like Anthropology.';

-- ==========================================================================
-- Migration: Add Admin RLS Policies and Course Field for User Subscriptions
-- Date: 2026-07-04
-- Description: Enables authenticated administrators to read all users and
-- manage user settings. Also adds course-level purchase tracking to subscriptions.
-- ==========================================================================

-- Enable RLS on users table if not already enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all users (needed by Admin Panel)
DROP POLICY IF EXISTS "Auth can read all users" ON users;

CREATE POLICY "Auth can read all users"
  ON users FOR SELECT
  USING (auth.role() = 'authenticated');

-- Enable RLS on user_settings table if not already enabled
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage all user_settings (needed by Admin Panel)
DROP POLICY IF EXISTS "Auth can manage all user_settings" ON user_settings;

CREATE POLICY "Auth can manage all user_settings"
  ON user_settings FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Comment on course_name column
COMMENT ON COLUMN user_subscriptions.course_name IS
  'The course that this subscription purchase applies to (e.g., UPSC CSE, Medical Science).';

COMMENT ON TABLE public.mains_question_states IS 'Stores user-specific states (revision tags, notes, confidence, difficulty) for Mains/Subjective questions.';

-- Enable Row Level Security (RLS)
ALTER TABLE public.mains_question_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;

-- Policies for RLS
DROP POLICY IF EXISTS "Users can manage their own mains question states" ON public.mains_question_states;
CREATE POLICY "Users can manage their own mains question states"
  ON public.mains_question_states
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own question states" ON public.question_states;
CREATE POLICY "Users can manage their own question states"
  ON public.question_states
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own notes" ON public.user_notes;
CREATE POLICY "Users can manage their own notes"
  ON public.user_notes
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own test attempts" ON public.test_attempts;
CREATE POLICY "Users can manage their own test attempts"
  ON public.test_attempts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON COLUMN public.mains_questions.hierarchy_path IS 'Syllabus path from paper down to subtopic/nanotopic.';

-- ==========================================================================
-- SQL MIGRATION: Add Prelims & Mains Features to Pro & Premium Plans
-- Run this in your Supabase SQL Editor to grant access.
-- ==========================================================================

-- 1. Insert the new features into the access_features table
INSERT INTO access_features (key, name, description, category, sort_order)
VALUES
  ('prelims', 'Prelims Hub', 'Access to Prelims Hub and question solving', 'feature', 16),
  ('mains', 'Mains Hub', 'Access to Mains Hub subjective answers and questions', 'feature', 17)
ON CONFLICT (key) DO NOTHING;

-- 2. Link these features to Pro Monthly, Pro Yearly, and Premium plans
DO $$
DECLARE
  prelims_feat_id uuid;
  mains_feat_id uuid;
  plan_rec record;
BEGIN
  -- Get feature IDs
  SELECT id INTO prelims_feat_id FROM access_features WHERE key = 'prelims';
  SELECT id INTO mains_feat_id FROM access_features WHERE key = 'mains';

  -- Loop through Pro Monthly, Pro Yearly, and Premium plans
  FOR plan_rec IN 
    SELECT id, name FROM access_plans 
    WHERE name IN ('Pro Monthly', 'Pro Yearly', 'Premium')
  LOOP
    -- Insert or update prelims mapping
    INSERT INTO plan_features (plan_id, feature_id, is_granted)
    VALUES (plan_rec.id, prelims_feat_id, true)
    ON CONFLICT (plan_id, feature_id) DO UPDATE 
    SET is_granted = true;

    -- Insert or update mains mapping
    INSERT INTO plan_features (plan_id, feature_id, is_granted)
    VALUES (plan_rec.id, mains_feat_id, true)
    ON CONFLICT (plan_id, feature_id) DO UPDATE 
    SET is_granted = true;
    
    RAISE NOTICE 'Mapped prelims and mains to plan: %', plan_rec.name;
  END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: create_user_ai_prompts
-- Stores user's AI prompt customizations (explain, summarize, search, save_sheet)
-- across all devices. Each user has one row per prompt_key.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_ai_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_key TEXT NOT NULL CHECK (prompt_key IN ('ai_prompt_explain', 'ai_prompt_summarize', 'ai_prompt_search', 'pilot-v2:save-sheet:ai-preset-prompt')),
  prompt_text TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Enforce one row per user per prompt_key
  UNIQUE (user_id, prompt_key)
);

-- Auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION update_user_ai_prompts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_ai_prompts_updated_at ON user_ai_prompts;

CREATE TRIGGER trg_user_ai_prompts_updated_at
  BEFORE UPDATE ON user_ai_prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_user_ai_prompts_updated_at();

-- Enable Row Level Security
ALTER TABLE user_ai_prompts ENABLE ROW LEVEL SECURITY;

-- Users can only read their own prompts
CREATE POLICY select_own_ai_prompts ON user_ai_prompts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own prompts
CREATE POLICY insert_own_ai_prompts ON user_ai_prompts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own prompts
CREATE POLICY update_own_ai_prompts ON user_ai_prompts
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own prompts
CREATE POLICY delete_own_ai_prompts ON user_ai_prompts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.soft_notebooks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.soft_pages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.soft_strokes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.soft_text_boxes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can manage their own notebooks" ON public.soft_notebooks;

DROP POLICY IF EXISTS "Users can manage pages of their own notebooks" ON public.soft_pages;

DROP POLICY IF EXISTS "Users can manage strokes of their own notebooks" ON public.soft_strokes;

DROP POLICY IF EXISTS "Users can manage text boxes of their own notebooks" ON public.soft_text_boxes;

-- Create unified ALL policies for complete CRUD access
CREATE POLICY "Users can manage their own notebooks" ON public.soft_notebooks
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage pages of their own notebooks" ON public.soft_pages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.soft_notebooks
      WHERE public.soft_notebooks.id = public.soft_pages.notebook_id
        AND public.soft_notebooks.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.soft_notebooks
      WHERE public.soft_notebooks.id = public.soft_pages.notebook_id
        AND public.soft_notebooks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage strokes of their own notebooks" ON public.soft_strokes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.soft_pages
      JOIN public.soft_notebooks ON public.soft_notebooks.id = public.soft_pages.notebook_id
      WHERE public.soft_pages.id = public.soft_strokes.page_id
        AND public.soft_notebooks.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.soft_pages
      JOIN public.soft_notebooks ON public.soft_notebooks.id = public.soft_pages.notebook_id
      WHERE public.soft_pages.id = public.soft_strokes.page_id
        AND public.soft_notebooks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage text boxes of their own notebooks" ON public.soft_text_boxes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.soft_pages
      JOIN public.soft_notebooks ON public.soft_notebooks.id = public.soft_pages.notebook_id
      WHERE public.soft_pages.id = public.soft_text_boxes.page_id
        AND public.soft_notebooks.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.soft_pages
      JOIN public.soft_notebooks ON public.soft_notebooks.id = public.soft_pages.notebook_id
      WHERE public.soft_pages.id = public.soft_text_boxes.page_id
        AND public.soft_notebooks.user_id = auth.uid()
    )
  );

-- 5. RLS for admin_users
alter table public.admin_users enable row level security;

drop policy if exists "admin self read" on public.admin_users;

create policy "admin self read" on public.admin_users
  for select using (auth.uid() = user_id);

-- 6. Helper view for admin user-performance dashboard
create or replace view public.admin_user_performance as
select
  ta.id              as attempt_id,
  ta.user_id,
  ta.test_id,
  t.title            as test_title,
  ta.score,
  t.question_count,
  case when t.question_count > 0
       then round(ta.score::numeric / t.question_count * 100, 1)
       else 0 end    as accuracy_pct,
  ta.started_at,
  ta.submitted_at,
  extract(epoch from (ta.submitted_at - ta.started_at))::int as duration_seconds
from public.test_attempts ta
left join public.tests t on t.id = ta.test_id
order by ta.submitted_at desc;

grant select on public.admin_user_performance to authenticated;

comment on view public.admin_user_performance is
  'Joined view of test_attempts × tests for the admin User Performance dashboard.';

create index if not exists idx_card_reviews_user_card on public.card_reviews(user_id, card_id, reviewed_at desc);

-- 4. RLS for new columns / table
alter table public.card_reviews enable row level security;

drop policy if exists "card_reviews own" on public.card_reviews;

create policy "card_reviews own" on public.card_reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ==========================================================================
--  flashcards_v3_srs_overhaul.sql
--
--  Run this in the Supabase SQL editor.
--  Idempotent: safe to run multiple times.
--
--  WHAT IT DOES
--    1. Adds learning_step / is_relearning columns to user_cards.
--    2. Creates folder_algorithm_settings (per-subject / section / microtopic
--       overrides of the SM-2 engine).
--    3. Fixes GHOST CARDS: any user_card with learning_status='not_studied'
--       whose next_review is in the past is reset to NULL (new cards should
--       only appear via the daily new-card cap, never as "due today").
--    4. De-duplicates `cards` by question_id — keeps oldest; repoints

alter table public.folder_algorithm_settings enable row level security;

drop policy if exists "folder_algorithm_settings own" on public.folder_algorithm_settings;

create policy "folder_algorithm_settings own"
  on public.folder_algorithm_settings
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. Ghost card cleanup: never leave a not_studied card flagged as due
update public.user_cards
   set next_review = null
 where learning_status in ('not_studied','new')
   and next_review is not null
   and next_review <= now();

with ranked as (
    select id,
           question_id,
           row_number() over (partition by question_id order by created_at, id) as rn,
           first_value(id) over (partition by question_id order by created_at, id) as keeper_id
    from public.cards
    where question_id is not null
      and question_id <> ''
)
update public.card_reviews cr
   set card_id = r.keeper_id
  from ranked r
 where cr.card_id = r.id
   and r.rn > 1
   and r.keeper_id <> r.id;

-- 5. Drop redundant legacy columns (data already lives in front_text/back_text)
--    NOTE: commented out by default — uncomment ONLY after verifying front_text/back_text are populated everywhere
--    in your app. Run this SELECT to double-check nothing breaks:
--
--      select count(*) filter (where coalesce(front_text,'') = '' and coalesce(question_text,'') <> '') as missing_front,
--             count(*) filter (where coalesce(back_text,'')  = '' and coalesce(answer_text,'')   <> '') as missing_back
--      from public.cards;

-- 6. Indexes
create index if not exists idx_user_cards_user_next_review
    on public.user_cards (user_id, next_review)
 where status = 'active';

comment on column public.question_states.attempt_id is 'Links per-question state snapshots to a specific test_attempts.id for clean review analytics.';

comment on column public.user_settings.analytics_layout is 'Per-user ordering preferences for review and overall analytics cards.';

