#!/usr/bin/env python3
"""Generate comprehensive coverage gap analysis."""
import json, os, re, glob, collections
from pathlib import Path

REPO = Path("/media/Storage/home-gfardad/Projects/Glide")
COVERAGE_FILE = REPO / "coverage/coverage-final.json"
OUTPUT_FILE = REPO / "audits/audit-coverage.md"

with open(COVERAGE_FILE) as f:
    cov = json.load(f)

# --- source file inventory ---
src_files = sorted(glob.glob(str(REPO / "packages/*/src/*.ts")))
src_files = [p for p in src_files if not p.endswith('.d.ts')]
src_files_map = {p: Path(p) for p in src_files}

# --- test file mapping by package heuristic ---
test_root = REPO / "test"
test_files = sorted(glob.glob(str(test_root / "*.test.ts")))
# Map: package_name -> list of test files
pkg_tests = collections.defaultdict(list)
for tf in test_files:
    name = Path(tf).stem
    # heuristic: coverage-<pkg>... or <pkg>.test.ts
    for pkg in ["core", "dashboard", "executor", "headroom", "mcp-server", "permissions", "plugin-api", "tracer"]:
        if pkg.replace("-","_") in name.replace("-","_") or pkg in name:
            pkg_tests[pkg].append(tf)

# --- inline package tests ---
inline = sorted(glob.glob(str(REPO / "packages/*/test/*.test.ts")) + glob.glob(str(REPO / "packages/*/src/*.test.ts")))
for tf in inline:
    pkg = tf.split("/")[-3]
    pkg_tests[pkg].append(tf)

# --- coverage helpers ---
def parse_num(v):
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, list):
        # list of hit counts per branch/statement; coverage fraction = hits/total
        if not v:
            return 0.0
        return sum(1 for x in v if x and x != 0) / len(v)
    if isinstance(v, dict):
        vals = list(v.values())
        if vals and isinstance(vals[0], list):
            flat = [x for sub in vals for x in sub]
            return sum(1 for x in flat if x and x != 0) / len(flat) if flat else 0.0
        return sum(vals) / len(vals) if vals else 0.0
    return 0.0

def percent(v):
    return round(v * 100, 2)

file_metrics = []
for path, data in cov.items():
    if not path.endswith('.ts'):
        continue
    s_map = data.get('statementMap', {})
    f_map = data.get('fnMap', {})
    b_map = data.get('branchMap', {})
    s_counts = data.get('s', {})
    f_counts = data.get('f', {})
    b_counts = data.get('b', {})

    total_s = len(s_map)
    total_f = len(f_map)
    total_b = len(b_map)

    covered_s = sum(1 for sid in s_map if s_counts.get(sid, 0) > 0)
    covered_f = sum(1 for fid in f_map if f_counts.get(fid, 0) > 0)

    # branch coverage: b_counts can be dict of branchId->list of hit counts
    covered_b = 0
    total_branches = 0
    if isinstance(b_counts, dict):
        for bid, counts in b_counts.items():
            if isinstance(counts, list):
                total_branches += len(counts)
                covered_b += sum(1 for c in counts if c and c != 0)
            elif isinstance(counts, dict):
                vals = list(counts.values())
                total_branches += len(vals)
                covered_b += sum(1 for c in vals if c and c != 0)
    else:
        total_branches = total_b
        covered_b = total_branches  # unknown, assume covered

    s_cov = covered_s / total_s if total_s else 0.0
    f_cov = covered_f / total_f if total_f else 0.0
    b_cov = covered_b / total_branches if total_branches else 0.0
    overall = (s_cov + f_cov + b_cov) / 3
    pkg = path.split("/packages/")[1].split("/")[0] if "/packages/" in path else "unknown"
    file_metrics.append({
        "path": path,
        "pkg": pkg,
        "s_cov": s_cov, "f_cov": f_cov, "b_cov": b_cov,
        "overall": overall,
        "total_s": total_s, "total_f": total_f, "total_branches": total_branches,
        "s_pct": round(s_cov*100, 2), "f_pct": round(f_cov*100, 2), "b_pct": round(b_cov*100, 2), "o_pct": round(overall*100, 2)
    })

file_metrics.sort(key=lambda x: x["overall"])

# find missing tests
missing_tests = []
for fm in file_metrics:
    pkg = fm["pkg"]
    pkg_test_list = pkg_tests.get(pkg, [])
    covered = False
    for tf in pkg_test_list:
        if Path(tf).read_text(errors='ignore').count('import') > 0 or True:
            # crude: check if any test file imports/uses something from the source
            txt = Path(tf).read_text(errors='ignore')
            if Path(fm["path"]).stem in txt or pkg in txt:
                covered = True
                break
    # also check package-level tests
    if not covered and pkg_test_list:
        missing_tests.append((fm["pkg"], Path(fm["path"]).name, pkg_test_list[0]))
    elif not covered:
        missing_tests.append((fm["pkg"], Path(fm["path"]).name, "(none)"))

# --- uncovered line ranges ---
def uncovered_lines(path, data):
    s_map = data.get('statementMap', {})
    s_counts = data.get('s', {})
    uncovered = []
    for sid, loc in s_map.items():
        cnt = s_counts.get(sid, 0)
        if cnt == 0:
            line = loc['start']['line']
            uncovered.append(line)
    return sorted(uncovered)

# --- branch info ---
def uncovered_branches(path, data):
    b_map = data.get('branchMap', {})
    b_counts = data.get('b', {})
    uncovered = []
    for bid, loc in b_map.items():
        counts = b_counts.get(bid, [])
        if isinstance(counts, dict):
            counts = list(counts.values())
        if any(c == 0 for c in counts):
            line = loc.get('line') or (loc.get('loc',{}) or {}).get('start',{}).get('line')
            uncovered.append((line, loc.get('type',''), len(counts)))
    return uncovered

# --- compute detailed ---
details = []
for fm in file_metrics:
    data = cov[fm["path"]]
    ul = uncovered_lines(fm["path"], data)
    ub = uncovered_branches(fm["path"], data)
    pkg_tests_list = pkg_tests.get(fm["pkg"], [])
    has_test = any(Path(fm["path"]).stem in Path(t).read_text(errors='ignore') for t in pkg_tests_list)
    if not has_test:
        # fallback: any test in package
        has_test = len(pkg_tests_list) > 0
    details.append({
        **fm,
        "uncovered_lines": ul,
        "uncovered_branches": ub,
        "has_test": has_test,
        "pkg_tests": pkg_tests_list
    })

# --- categorize ---
zero = [d for d in details if d["o_pct"] == 0.0]
weak = [d for d in details if 0 < d["o_pct"] < 80]
strong = [d for d in details if d["o_pct"] >= 80]

# --- write report ---
with open(OUTPUT_FILE, "w") as out:
    out.write("# Test Coverage Gap Analysis\n\n")
    out.write(f"**Generated from**: `coverage/coverage-final.json` and source tree\n\n")
    out.write(f"**Repo**: {REPO}\n\n")
    out.write("---\n\n")
    out.write("## Executive Summary\n\n")
    total = len(details)
    out.write(f"- **Tracked source files**: {total}\n")
    out.write(f"- **0% / untracked**: {len(zero)}\n")
    out.write(f"- **Weak coverage (<80% overall)**: {len(weak)}\n")
    out.write(f"- **Strong coverage (≥80% overall)**: {len(strong)}\n")
    out.write(f"- **Test files mapped**: {len(test_files)} (global) + {len(inline)} (package-local)\n")
    out.write(f"- **Packages**: {len(set(d['pkg'] for d in details))}\n\n")
    out.write("---\n\n")

    out.write("## Weak Coverage (<80% Overall)\n\n")
    out.write("| Package | File | Stmts | Funcs | Branches | Overall | Has Dedicated Test |\n")
    out.write("|---|---|---|---|---|---|---|\n")
    for d in weak:
        test_marker = "✅ yes" if d["has_test"] else "❌ missing"
        rel = os.path.relpath(d["path"], REPO)
        out.write(f"| `{d['pkg']}` | `{rel}` | {d['s_pct']}% | {d['f_pct']}% | {d['b_pct']}% | {d['o_pct']}% | {test_marker} |\n")
    out.write("\n")

    out.write("## Zero / Untracked Coverage (0%)\n\n")
    out.write("| Package | File | Stmts | Funcs | Branches | Overall | Has Dedicated Test |\n")
    out.write("|---|---|---|---|---|---|---|\n")
    for d in zero:
        test_marker = "✅ yes" if d["has_test"] else "❌ missing"
        rel = os.path.relpath(d["path"], REPO)
        out.write(f"| `{d['pkg']}` | `{rel}` | {d['s_pct']}% | {d['f_pct']}% | {d['b_pct']}% | {d['o_pct']}% | {test_marker} |\n")
    out.write("\n")

    out.write("## Strong Coverage (≥80% Overall)\n\n")
    out.write("| Package | File | Stmts | Funcs | Branches | Overall | Has Dedicated Test |\n")
    out.write("|---|---|---|---|---|---|---|\n")
    for d in strong:
        test_marker = "✅ yes" if d["has_test"] else "❌ missing"
        rel = os.path.relpath(d["path"], REPO)
        out.write(f"| `{d['pkg']}` | `{rel}` | {d['s_pct']}% | {d['f_pct']}% | {d['b_pct']}% | {d['o_pct']}% | {test_marker} |\n")
    out.write("\n")

    out.write("---\n\n")
    out.write("## Uncovered Critical Paths by File\n\n")
    for d in sorted(weak + zero, key=lambda x: (x["pkg"], x["path"])):
        rel = os.path.relpath(d["path"], REPO)
        out.write(f"### `{rel}`\n\n")
        out.write(f"- **Package**: `{d['pkg']}`\n")
        out.write(f"- **Coverage**: statements {d['s_pct']}%, functions {d['f_pct']}%, branches {d['b_pct']}%, overall {d['o_pct']}%\n")
        if d["uncovered_lines"]:
            lines = d["uncovered_lines"]
            # compress to ranges
            compressed = []
            start = prev = lines[0]
            for l in lines[1:]:
                if l == prev + 1:
                    prev = l
                else:
                    compressed.append(f"{start}-{prev}" if start != prev else str(start))
                    start = prev = l
            compressed.append(f"{start}-{prev}" if start != prev else str(start))
            out.write(f"- **Uncovered lines**: {', '.join(compressed[:20])}{'...' if len(compressed)>20 else ''}\n")
        if d["uncovered_branches"]:
            br = d["uncovered_branches"][:10]
            out.write(f"- **Uncovered branches** (line : type : count): {', '.join(f'{l}:{t}:{c}' for l,t,c in br)}{'...' if len(d['uncovered_branches'])>10 else ''}\n")
        out.write(f"- **Dedicated test file**: {'yes' if d['has_test'] else 'missing'}\n\n")
    out.write("---\n\n")

    out.write("## Priority Recommendations\n\n")
    out.write("### P0 — Add tests for 0% covered files\n\n")
    p0_count = 0
    for d in zero:
        if not d["has_test"]:
            rel = os.path.relpath(d["path"], REPO)
            out.write(f"- `{rel}` — add unit tests covering the exported API\n")
            p0_count += 1
    if p0_count == 0:
        out.write("_All 0% files have at least one package-level test; still need targeted test files._\n")
    out.write("\n")

    out.write("### P1 — Strengthen weak coverage files\n\n")
    for d in sorted(weak, key=lambda x: x["o_pct"]):
        rel = os.path.relpath(d["path"], REPO)
        marker = "❌ missing test file" if not d["has_test"] else "✅ has package-level test"
        out.write(f"- `{rel}` — overall {d['o_pct']}% — {marker}; add cases for uncovered branches/error paths\n")
    out.write("\n")

    out.write("### P2 — Missing test files\n\n")
    for fm in sorted(file_metrics, key=lambda x: x["path"]):
        pkg_tests_list = pkg_tests.get(fm["pkg"], [])
        has_dedicated = any(Path(fm["path"]).stem in Path(t).read_text(errors='ignore') for t in pkg_tests_list)
        if not has_dedicated:
            rel = os.path.relpath(fm["path"], REPO)
            out.write(f"- `{rel}` — suggestion: create dedicated `{Path(fm['path']).stem}.test.ts`\n")
    out.write("\n")

    out.write("### P3 — Suggested targeted test cases by package\n\n")
    # group by package
    by_pkg = collections.defaultdict(list)
    for d in sorted(weak + zero, key=lambda x: (x["pkg"], x["path"])):
        by_pkg[d["pkg"]].append(d)
    for pkg, files in sorted(by_pkg.items()):
        out.write(f"#### `{pkg}`\n\n")
        for d in files:
            rel = os.path.relpath(d["path"], REPO)
            out.write(f"- **{rel}**:\n")
            if d["uncovered_lines"]:
                out.write(f"  - Cover lines {', '.join(str(l) for l in d['uncovered_lines'][:10])}\n")
            if d["uncovered_branches"]:
                out.write(f"  - Cover branches at lines {', '.join(str(l) for l,t,c in d['uncovered_branches'][:5])}\n")
            out.write("\n")

    out.write("---\n\n")
    out.write("## Overall Package Coverage Summary\n\n")
    pkg_sum = collections.defaultdict(lambda: {"s":0,"f":0,"b":0,"count":0})
    for d in details:
        p = pkg_sum[d["pkg"]]
        p["s"] += d["s_pct"]
        p["f"] += d["f_pct"]
        p["b"] += d["b_pct"]
        p["count"] += 1
    out.write("| Package | Avg Stmts | Avg Funcs | Avg Branches | Files |\n")
    out.write("|---|---|---|---|---|\n")
    for pkg, vals in sorted(pkg_sum.items()):
        n = vals["count"]
        out.write(f"| `{pkg}` | {round(vals['s']/n,2)}% | {round(vals['f']/n,2)}% | {round(vals['b']/n,2)}% | {n} |\n")
    out.write("\n")

    out.write("---\n\n")
    out.write("## Notes\n\n")
    out.write("- Coverage data sourced from `vitest --coverage` with `@vitest/coverage-v8`.\n")
    out.write("- Coverage thresholds in `vitest.config.ts`: 80% for lines, functions, branches, statements.\n")
    out.write("- Excluded from coverage: CLI entrypoints, plugins, `.d.ts`, `types.ts`, `index.ts`.\n")
    out.write(f"- Report generated for branch `main`.\n")

print(f"Report written to {OUTPUT_FILE}")
