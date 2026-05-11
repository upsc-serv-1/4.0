# Project Requirements Document: Interactive Revision Mode

## Project Overview

**Name:** Interactive Revision Mode
**Mission:** Transform static test analysis reports into interactive "Re-attempt" practice sessions with a history toggle.
**Tech Stack:** React Native (Expo), TypeScript, Lucide Icons, Reanimated.

## Functional Requirements

| FR ID | Description | User Story | Status |
| :--- | :--- | :--- | :--- |
| FR-101 | Interactive Option Selection | As a user, I want to click options in the review screen so I can re-attempt the question for practice. | MUS |
| FR-102 | Show Mistakes Toggle | As a user, I want a master toggle to switch between "Fresh Practice" and "Show My History". | MUS |
| FR-103 | Historical Accuracy Indicators | As a user, I want to see Red/Green highlights and "Skipped" badges for my original attempt when the toggle is ON. | MUS |
| FR-104 | Re-attempt Reset | As a user, I want my temporary re-attempt selections to be visual only and not affect my historical data. | MUS |
| FR-105 | Persistent State Sync | As a user, I want the toggle state to remain consistent as I scroll through the analysis report. | Future |
