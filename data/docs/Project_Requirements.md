# Project Requirements Document - Thesis Data Collector

## Project Overview

**Name:** Thesis Data Collector
**Mission:** A clinical data entry web application for the thesis: *"Study of incidence of primary c section and maternal fetal outcomes in multigravida at tertiary care centre"*. It supports interchangeable AI voice dictation pasting (Workflow A) and manual data entry (Workflow B), saving records directly to Supabase and allowing Excel, Word, and PDF exports.
**Tech Stack:** Vite + React + TypeScript + Vanilla CSS + Supabase

---

## Functional Requirements

| FR ID | Description | User Story | Status |
| :--- | :--- | :--- | :--- |
| FR-001 | **Intake Vault (Smart Paste Box)** | As a researcher, I want to paste raw AI-generated text containing JSON so that the form is automatically filled out, even if the text contains markdown backticks or conversational text. | MUS |
| FR-002 | **Dual-Purpose Form** | As a researcher, I want a structured digital form matching the case proforma so that I can review auto-populated values or type data manually from scratch. | MUS |
| FR-003 | **Prompt Generator** | As a researcher, I want to copy a master system prompt to my clipboard so that I can paste it into ChatGPT/Gemini to guide the voice dictation structure. | MUS |
| FR-004 | **Supabase Storage** | As a researcher, I want each submitted case to save directly as a single row in Supabase so that my records are securely stored. | MUS |
| FR-005 | **Export Module** | As a researcher, I want to download all collected data as Excel, Word, or PDF documents so that I can present them to my academic guide and run SPSS/R statistical analysis. | MUS |

---

## User Flows

### Workflow A: The AI Voice Route
1. Click **Copy Master Prompt** in the application interface.
2. Open ChatGPT or Gemini (app or web).
3. Paste the prompt once to prime the assistant.
4. Speak naturally for 30–60 seconds, describing the clinical case.
5. Copy the JSON response from ChatGPT/Gemini.
6. Paste the response into the **Intake Vault** in the web app.
7. The web app extracts the JSON safely, populates the form, and updates fields.
8. Review the form fields, make corrections or fill in missing fields manually, and click **Save Case**.

### Workflow B: The Manual Route
1. Open the web app.
2. Directly type or check values in the form fields.
3. Click **Save Case**.
