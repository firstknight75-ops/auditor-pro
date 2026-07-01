# AuditCore — Gap Analysis vs. Original Specification

> Generated against the Arabic spec the user provided. Status as of commit `284a6af`.

## Summary

| Spec section | What's built | Status |
|---|---|---|
| **Phase 1** Foundation | DB schema, Rule 1 triggers, Trust Index, file upload, advisor shell, dashboard shell | ✅ 100% |
| **Phase 2** Financial engine | Liquidity, profitability, cash flow, collection cycle | ✅ 100% |
| **Phase 2** Commercial engine | CAC, LTV, LTV:CAC, retention, concentration | ✅ 100% |
| **Phase 2** Compliance engine | License/tax expiry tracking | ✅ 100% |
| **Phase 2** Smart Bridge | Duplicate detection + cross-department contradictions | ✅ ~80% |
| **Phase 3** Operational engine | Production efficiency, waste, on-time delivery | ❌ **MISSING** |
| **Phase 3** Administrative KPIs | Turnover, productivity, cycle time (§3.1) | ❌ **MISSING** |
| **Phase 4** Human Performance | Performance review, attendance variance | ❌ **MISSING** (privacy-sensitive) |
| **§5.3** Multi-source linking | Match supplier invoice ↔ payment voucher | ❌ **MISSING** |
| **§5.5** Predictive analysis | Predict next-period deviations from history | ❌ **MISSING** |
| **§8** Access control | Owner / manager / audit team / employee roles | ❌ **CRITICAL** |
| **§9 Phase 5** Recalibration | Real threshold recalibration from company history | ⚠️ 30% (just stamps a timestamp) |
| **Rule 3** PDF/OCR upload | PDF + scanned image support | ❌ (Excel/CSV only) |

## Critical gaps being fixed in this commit

### 1. Access control (§8) — CRITICAL
**Why critical:** Without it, every browser sees every company's data. Multi-tenant isolation is a hard requirement. The spec defines four tiers with explicit restrictions.

**Implementation:**
- `core/access.ts` — role definitions and capability matrix
- `core/session.ts` — current-user resolution (browser session only, no real auth)
- Role-gated sidebar sections (Owner sees all, Manager sees only their company, Auditor sees assigned companies, Employee sees nothing)
- Sensitive dimension gating: Human Performance restricted to Owner + authorized HR only

### 2. Operational audit engine (§3.2)
**Why:** Phase 2/4 lists Operational as a primary dimension, alongside Financial and Commercial. Currently has 0 deviations of this type, leaving a gap in the Smart Bridge cross-checks.

**Implementation:**
- `core/audit/operational.ts` with KPIs: production efficiency, waste %, on-time delivery, inventory turnover
- Findings: high-waste, late-delivery, stockout, idle-capacity

### 3. Administrative KPIs (§3.1)
**Why:** Spec explicitly defines quantitative indicators for the Administrative dimension that were missing from my Phase 1 plan. Currently the dimension has no engine at all.

**Implementation:**
- `core/audit/administrative.ts` with: turnover rate, revenue-per-employee, cycle time
- Findings: high-turnover, under-productivity, slow-decisions

### 4. Real threshold recalibration (§9 Phase 5)
**Why:** The current `recalibrateThresholds` only sets `lastRecalibrated_at`. Spec says: "the system needs a historical storage structure that allows periodic re-calibration of thresholds based on the company's own data."

**Implementation:**
- `core/recalibration.ts` — computes p50/p75/p90 of historical deviation financial impact per company
- Updates `dimension_thresholds_json` based on the company's own data
- Wire into existing `recalibrateThresholds` server function

## Gaps deliberately deferred (out of scope for this commit)

- **§5.5 Predictive analysis** — needs historical deviation data over time; would require building first
- **§5.3 Multi-source linking** — needs reconciliation key extraction (supplier ID, invoice no.); nice-to-have
- **Human Performance dimension** — privacy-sensitive (§8); needs proper auth before exposing
- **PDF / OCR upload** — needs tesseract.js + pdf-parse + canvas dependency work
- **Real auth** — the spec assumes authenticated users; the sandbox has no auth provider. Session-only role switching is a pragmatic interim.
