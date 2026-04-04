# Import Replacement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace absolute imports from `@privacy-shield/core` with relative imports in `packages/core/src`.

**Architecture:** Update import statements in `ui/` and `ui/primitives/` to use relative paths to the `shared` directory.

**Tech Stack:** TypeScript, pnpm, tsc

---

### Task 1: Replace imports in `ui/primitives/`

**Files:**
- Modify: `packages/core/src/ui/primitives/*.tsx`

**Step 1: Replace imports**
Run: Use `replace` or `run_shell_command` with `sed` (if available) or batch edit files to change `from "@privacy-shield/core"` to `from "../../shared"`.

**Step 2: Verify changes with grep**
Run: `grep -r "@privacy-shield/core" packages/core/src/ui/primitives/`
Expected: No output (or only matches in comments if any, but ideally none).

### Task 2: Replace imports in `ui/`

**Files:**
- Modify: `packages/core/src/ui/*.tsx`

**Step 1: Replace imports**
Run: Use `replace` or batch edit files to change `from "@privacy-shield/core"` to `from "../shared"` in direct children of `ui/`.

**Step 2: Verify changes with grep**
Run: `grep -r "@privacy-shield/core" packages/core/src/ui/*.tsx`
Expected: No matches found.

### Task 3: Final Type Check

**Step 1: Run TSC**
Run: `pnpm exec tsc --noEmit` from root.
Expected: PASS
