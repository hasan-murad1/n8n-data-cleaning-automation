# Automated Data Cleaning & Quality Report System (n8n)

An AI-free, rule-based automation built in **n8n** that validates, cleans, and standardizes spreadsheet data, applies configurable business rules, and generates a professional data quality report — all without any AI/API cost.

Upload a messy CSV/XLS/XLSX file → get back a cleaned spreadsheet + a detailed quality report, delivered by email, in seconds.

---

## Why this exists

Manually cleaning spreadsheets — fixing formats, removing duplicates, catching bad data — takes hours and mistakes still slip through. This workflow does it end-to-end, deterministically, with a full audit trail of what was changed.

---

## Features

- **Multi-format input**: CSV, XLS, XLSX
- **File validation**: extension, MIME type, size checks before processing; invalid files trigger a separate error-alert workflow
- **Core cleaning**: trims whitespace, strips stray HTML tags, standardizes missing-value placeholders, converts numbers/booleans, removes exact duplicates
- **Date handling**: calendar-validated parser that correctly resolves ambiguous formats (e.g. `3/18/2015` vs `20/03/2024`) instead of guessing and silently dropping valid dates
- **Contact validation**: auto-fixes common email typos (missing `@`, double `@@`, missing domain extension), normalizes phone numbers while preserving leading zeros
- **Configurable business rules**: industry-specific validation (see [Business Rules](#business-rules--swappable-by-industry) below) — flags issues like negative values or unrecognized categories **without silently altering the original data**
- **Quality scoring**: before/after score (0–100) with a scoring formula immune to a common bug where duplicate-removal artificially inflates the "missing %" metric
- **Transparent reporting**: every change is labeled **Corrected**, **Standardized**, or **Flagged** — flagged issues are never claimed as fixed
- **Batch processing**: large files are split into batches to stay memory-safe
- **Zero AI/API cost**: the "executive summary" is rule-based text generation, not an LLM call
- **Error handling**: a separate Error Workflow catches failures and emails an alert automatically

---

## Architecture

```
[Form/Webhook Trigger]
        ↓
[Code - File Validation] → invalid → [Stop And Error] → (Error Workflow)
        ↓ valid
[Switch - Route File Type] → [Extract From File: CSV / XLSX / XLS]
        ↓
[Code - Normalize Extracted Rows]
        ↓
[Code - Data Profiling]              (before-cleaning score)
        ↓
[Code - Create Row Batches]
        ↓
┌─── Loop Over Items (Split in Batches) ───────────────────┐
│  [Code - Clean Batch]                                     │
│  [Code - Data Formatting]      ← dates, emails, phones     │
│  [Code - Validation & Find Replace]                        │
│  [Code - Business Rules]       ← swap this per industry    │
└─────────────────────────────────────────────────────────┘
        ↓ (done)
[Code - Quality Analysis]            (after-cleaning score, dynamic breakdown)
        │
        ├──→ [Code - Prepare Clean Rows for File] → [Convert to File: XLSX]
        │
        └──→ [Code - Generate Summary (No AI)] → [Code - Report Generator]
        ↓
[Merge] → [Gmail - Send Clean File + Report]

Separate workflow:
[Error Trigger] → [Code - Format Error Message] → [Gmail - Send Error Alert]
```

All node code lives in [`/nodes`](./nodes) as individual `.js` files, in pipeline order.

---

## Business rules — swappable by industry

The **Business Rules** node is the only piece that's industry-specific. It supplies two things the rest of the pipeline reads dynamically — no other node needs to change:

- `actionMeta` — tells the Report Generator how to **label** each action (e.g. `"Negative Salaries Flagged"`, type `Flagged`)
- `flaggedIssues` — tells Quality Analysis what to show in the **Validation Issues Breakdown** table

[`08-business-rules-hr-example.js`](./nodes/08-business-rules-hr-example.js) is the included example, built for HR/employee data: validates Salary (flags negative values, unchanged), Department (typo/abbreviation-aware standardization), Gender, and Status.

To adapt this for a different industry (e.g. retail/grocery — price, stock quantity, category, stock status), write a new Business Rules node following the same `actionMeta` / `flaggedIssues` contract. Everything downstream (scoring, breakdown tables, report labels) picks it up automatically.

---

## Sample data

[`sample-data/sample-messy-input.csv`](./sample-data/sample-messy-input.csv) is a small synthetic dataset (fabricated names/data, no real records) demonstrating the issues this pipeline catches: missing values, an exact duplicate row, mixed date formats, a negative salary, email/phone typos, an embedded HTML tag, and an unrecognized department — useful for a quick end-to-end test.

---

## Tech stack

- [n8n](https://n8n.io) (workflow orchestration)
- JavaScript (Code nodes — no external npm dependencies required)
- HTML/CSS (report rendering, print-to-PDF friendly)

---

## Notes

- This repository contains the **Code node logic only** (the portable, readable part of the workflow). The full n8n workflow (triggers, credentials, node wiring) is not included since it contains environment-specific configuration.
- No real client data, credentials, or API keys are included anywhere in this repo.
