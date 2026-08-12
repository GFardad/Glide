const fs = require('fs');
const path = require('path');

const repo = '/media/Storage/home-gfardad/Projects/Glide';
const coverageJsonPath = path.join(repo, 'coverage', 'coverage-final.json');
const reportPath = path.join(repo, 'coverage-gap-analysis.md');

const cov = JSON.parse(fs.readFileSync(coverageJsonPath, 'utf8'));

const files = Object.values(cov).filter(x => x.path.includes('/packages/') && x.path.includes('/src/') && !x.path.includes('/test/'));

function pct(numerator, denominator) {
  if (!denominator || denominator === 0) return null;
  if (numerator === 0 && denominator === 0) return 100;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

const rows = files.map(f => {
  const stmts = Object.keys(f.statementMap || {}).length;
  const coveredStmts = Object.values(f.s || {}).filter(v => v > 0).length;
  const branches = Object.keys(f.branchMap || {}).length;
  const coveredBranches = Object.values(f.b || {}).filter(v => Array.isArray(v) ? v.some(x => x > 0) : v > 0).length;
  const funcs = Object.keys(f.fnMap || {}).length;
  const coveredFuncs = Object.values(f.f || {}).filter(v => v > 0).length;

  const stmtPct = pct(coveredStmts, stmts);
  const branchPct = pct(coveredBranches, branches);
  const funcPct = pct(coveredFuncs, funcs);
  const overall = Number((((stmtPct || 0) + (branchPct || 0) + (funcPct || 0)) / 3).toFixed(2));

  const rel = path.relative(repo, f.path);
  const pkg = rel.split(path.sep)[1];
  const name = path.basename(f.path);

  return { pkg, name, path: rel, stmts, coveredStmts, branches, coveredBranches, funcs, coveredFuncs, stmtPct, funcPct, branchPct, overall, all: f.all };
});

const packages = {};
for (const r of rows) packages[r.pkg] = packages[r.pkg] || [];

const testFiles = [];
const walkTest = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === 'dist' || ent.name === 'coverage') continue;
      walkTest(full);
    } else if (ent.isFile() && /\.test\.(ts|tsx|js|mjs|cjs)$/.test(ent.name)) {
      testFiles.push(path.relative(repo, full));
    }
  }
};
walkTest(path.join(repo, 'packages'));

function guessTest(src) {
  const base = path.basename(src, path.extname(src));
  const dir = path.dirname(src);
  const candidates = [
    path.join(dir, '__tests__', base + '.test.ts'),
    path.join(dir, 'test', base + '.test.ts'),
    path.join(dir, 'tests', base + '.test.ts'),
    path.join(dir, base + '.test.ts'),
  ];
  const found = candidates.find(c => testFiles.includes(c));
  return found || 'missing';
}

const zero = rows.filter(r => r.overall === 0 || (r.stmtPct === null && r.funcPct === null && r.branchPct === null));
const weak = rows.filter(r => r.overall > 0 && r.overall < 80);
const strong = rows.filter(r => r.overall >= 80);
const missingTest = [...new Set(rows.filter(r => guessTest(r.path) === 'missing').map(r => r.path))];

const header = `# Test Coverage Gap Analysis

Generated from coverage-final.json and source tree.

## Summary

- Tracked source files: ${rows.length}
- 0% / untracked: ${zero.length}
- Weak coverage (<80% overall): ${weak.length}
- Strong coverage (≥80%): ${strong.length}
- Test files mapped: ${testFiles.length}
- Packages: ${Object.keys(packages).length}

`;

function table(title, list, sortKey = 'overall') {
  const sorted = [...list].sort((a, b) => a[sortKey] - b[sortKey]);
  const lines = [
    `## ${title}`,
    '| Package | File | Stmts | Funcs | Branches | Overall | Test File |',
    '|---|---|---|---|---|---|---|'
  ];
  for (const r of sorted) {
    const st = r.stmtPct === null ? '0%' : `${r.stmtPct}%`;
    const fn = r.funcPct === null ? '0%' : `${r.funcPct}%`;
    const br = r.branchPct === null ? '0%' : `${r.branchPct}%`;
    lines.push(`| ${r.pkg} | ${r.name} | ${st} | ${fn} | ${br} | ${r.overall}% | ${guessTest(r.path)} |`);
  }
  return lines.join('\n');
}

const priority = [
  `## Priority Recommendations`,

  `### P0 — Add tests for 0% covered files`,
  zero.map(r => `- \`${r.path}\` — suggestion: add unit test covering main exported symbols in ${r.path}`).join('\n') || '- None',

  `\n### P1 — Strengthen weak coverage files`,
  weak.map(r => `- \`${r.path}\` — overall ${r.overall}% — suggestion: add cases for uncovered branches/error paths`).join('\n') || '- None',

  `\n### P2 — Missing test files`,
  missingTest.map(p => `- \`${p}\` — suggestion: create \`${guessTest(p)}\``).join('\n') || '- None',

  `\n### P3 — Suggested targeted test cases by package`,
  ...Object.entries(packages).flatMap(([pkg, files]) => {
    const needs = files.filter(f => f.overall < 100).sort((a,b) => a.overall - b.overall).slice(0,5);
    if (!needs.length) return [];
    return [
      `- **${pkg}**:`,
      ...needs.map(f => `  - \`${f.path}\` — cover uncovered branches/functions`).join('\n')
    ];
  })
].join('\n');

const body = [header, table('Weak Coverage (<80%)', weak), table('Zero / Untracked Coverage', zero), table('Strong Coverage', strong, 'overall').replace('## Strong Coverage', '## Strong Coverage (≥80%)'), priority].join('\n\n') + '\n';

fs.writeFileSync(reportPath, body);
console.log('Report written to', reportPath);
