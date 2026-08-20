# Project Context (PROJECT_CONTEXT.md)

This file contains only confirmed high-level facts, constraints, and business directions for the **DeutschFlow** project.

## Core Product Vision
*   **Product Name:** DeutschFlow.
*   **Objective:** Progressively upgrade DeutschFlow from a basic vocabulary-focused trainer into a structured **German Learning System**.
*   **Educational Strategy:** Features and curriculum additions must be justified by concrete educational purpose, requirement definitions, and acceptance criteria—not proposed arbitrarily.
*   **Core Process:** The system will evolve objectively through an audit of existing assets, detailed requirements planning, implementation, and systematic testing.

## Language and Educational Requirements
*   **Target Language:** German.
*   **Support Languages:** English and Arabic hold equal educational importance for meanings, definitions, and grammatical explanations.
*   **Scoring & Evaluation Rules:**
    *   **German-English** vocabulary retrieval participates in performance scoring.
    *   **Arabic** must **NOT** affect scored-answer evaluation (i.e. Arabic spelling or input variations must not penalize the user).
    *   Arabic remains fully accessible for explanations, context, and auxiliary definitions.
    *   Translations must respect complexity: Do not force a single, literal Arabic translation for German words with multiple contextual meanings.

## Learning Scope and Content Integration
*   **Scope:** The future application will cover Vocabulary, Grammar, Sentence Context, Listening, Exercises, Progress tracking, and Course Structure.
*   **Grammar System:** Grammar must eventually become a structured, interactive learning component, moving beyond simple static free-text explanations.
*   **Audio and Curriculum Sources:** Audio files and textbook structures from *Netzwerk A1*, *Netzwerk A2*, and *Netzwerk Neu A2* are available learning sources and will be integrated into the system at a later phase.

## Legacy Code & Data Constraints
*   **Legacy Preservation:** The existing vocabulary/review application and its user database must be preserved.
*   **Legacy Trust Level:** Existing legacy data and code must not be trusted blindly; they are considered legacy/current-source material and must undergo a thorough audit before any migration or integration.
