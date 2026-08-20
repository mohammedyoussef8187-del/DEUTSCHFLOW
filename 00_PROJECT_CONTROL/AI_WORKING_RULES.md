# AI Working Rules (AI_WORKING_RULES.md)

These rules are shared across all AI agents (including Antigravity, Claude Code, and OpenAI Codex) to maintain integrity, stability, and continuity.

## Core Rules & Safety
1.  **Strict Modification Boundaries:** Never modify, delete, or rewrite existing application files or legacy source data without an explicit implementation task approved by the user.
2.  **Audit Before Action:** Complete a detailed audit and analysis of current implementations before initiating any redesign or migration.
3.  **Data Preservation:** Preserve user progress records, configurations, and source material. Do not silently correct, overwrite, or delete learning logs or historical database records.
4.  **No Preemptive Assumptions:** Do not claim a component or file is "missing" or "broken" until you have checked all relevant legacy directories and source code.
5.  **Separate Issues Clearly:** Separate confirmed structural errors from speculative/potential issues or improvement suggestions. Keep them categorized clearly in reports.

## Execution and Performance Rules
6.  **Sequential Execution:** Work sequentially. Do not start multiple tasks or parallelize edits unless explicitly instructed by the user.
7.  **Selective File Loading:** Minimize full-project text scans. Only read and open files that are directly related to the current task.
8.  **Single Source of Truth:** Keep status tracking localized strictly within the canonical files in `00_PROJECT_CONTROL/`. Do not create competing progress files or independent task lists.

## Hand-off and Continuity
9.  **Work Status Updates:** You MUST update `CURRENT_WORK_STATUS.md` at the end of every completed task with changes made, timestamp, and next steps.
10. **Record Decisions:** Record all approved architectural, product, and design changes in `DECISION_LOG.md` immediately upon agreement. Never silently alter an approved decision.
11. **Tool Agnosticism:** Ensure that all agents (Claude Code, Codex, Antigravity, etc.) leave the project structure and context files in a state that allows another agent to pick up immediately.
