# @glide/headroom

Role-based pre-execution analysis ("Headroom meeting").

## Public API

- `runHeadroom({ campaignDir, objective, roles })` → `HeadroomResult`
  - loads or creates the campaign, runs role analysis, writes `artifacts/{risk_log,architecture,todo_registry,role_analysis.json}`
  - returns `{ campaign, riskLog, architecture, todoRegistry, driftDetected, roleSignals }`
- `runRoleAnalysis(objective, roles, campaignDir)` — per-role assessment, signals, risks, improvements, todos
- `HeadroomResult` / `HeadroomInput` / `RoleAnalysis` types

## Drift detection

Compares the objective against generated artifacts; `driftDetected: true` when the
objective no longer appears in outputs — a signal to re-run the meeting.
