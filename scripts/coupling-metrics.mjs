#!/usr/bin/env node
/**
 * Coupling Metrics — Robert C. Martin Package Metrics
 *
 * Calculates per-package and per-DDD-layer:
 *   Ca  — Afferent Coupling  (how many OTHER packages import THIS package)
 *   Ce  — Efferent Coupling  (how many packages THIS package imports)
 *   I   — Instability        Ce / (Ca + Ce)  →  0 = stable, 1 = unstable
 *   A   — Abstractness       interfaces+abstract / (interfaces+abstract+concrete)
 *   D   — Distance from Main Sequence  |A + I − 1|  →  0 = on sequence
 *
 * Also reports:
 *   • Connascence types detected in @ecommerce/shared (CoN, CoT, CoV)
 *   • Layer-level Ca/Ce within each service
 *   • Architectural violations from .dependency-cruiser.cjs
 *
 * Usage:
 *   pnpm coupling:metrics
 *   pnpm coupling:metrics --json > coupling-report.json
 */

import { execSync } from 'child_process';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const JSON_OUTPUT = process.argv.includes('--json');

// ─── ANSI colours ────────────────────────────────────────────────────────────
const C = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
};
const color = (c, str) => (JSON_OUTPUT ? str : `${c}${str}${C.reset}`);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Normalize path separators to forward slash */
const fwd = (p) => p.replace(/\\/g, '/');

/** Extract workspace package name from file path (e.g. "apps/order-service") */
function pkgFromPath(filePath) {
    const p = fwd(filePath);
    const m = p.match(/^(apps\/[^/]+|packages\/[^/]+)\//);
    return m ? m[1] : null;
}

/** Extract DDD layer from file path */
function layerFromPath(filePath) {
    const p = fwd(filePath);
    const m = p.match(/\/src\/(domain|application|infrastructure|presentation)\//);
    return m ? m[1] : null;
}

/** Qualified layer key: "apps/order-service#domain" */
const layerKey = (pkg, layer) => `${pkg}#${layer}`;

/** Round to 2 decimal places */
const r2 = (n) => Math.round(n * 100) / 100;

// ─── Step 1: Run dependency-cruiser and get JSON graph ───────────────────────

process.stderr.write(color(C.dim, '  Analysing dependency graph...\n'));

let graphJson;
try {
    graphJson = execSync(
        'npx depcruise --config .dependency-cruiser.cjs --output-type json apps packages',
        { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
} catch (e) {
    // depcruise exits 1 when violations are found — output is still valid JSON on stdout
    graphJson = e.stdout || '{}';
}

const graph = JSON.parse(graphJson);
const modules = graph.modules || [];
const violations = graph.summary?.violations || [];

// ─── Step 2: Discover workspace packages ─────────────────────────────────────

const workspacePkgs = new Set();
const DDD_LAYERS = ['domain', 'application', 'infrastructure', 'presentation'];

for (const mod of modules) {
    const pkg = pkgFromPath(mod.source);
    if (pkg) workspacePkgs.add(pkg);
}

// ─── Step 3: Build package-level Ca / Ce tables ──────────────────────────────
// Ca[pkg] = Set of OTHER packages that import at least one file in pkg
// Ce[pkg] = Set of packages that pkg imports at least one file from

const caMap = {}; // pkg → Set<importer-pkg>
const ceMap = {}; // pkg → Set<dependency-pkg>

// Also layer-level
const layerCa = {}; // "pkg#layer" → Set<"pkg#layer">
const layerCe = {}; // "pkg#layer" → Set<"pkg#layer">

for (const pkg of workspacePkgs) {
    caMap[pkg] = new Set();
    ceMap[pkg] = new Set();
    for (const layer of DDD_LAYERS) {
        const k = layerKey(pkg, layer);
        layerCa[k] = new Set();
        layerCe[k] = new Set();
    }
}

for (const mod of modules) {
    const fromPkg = pkgFromPath(mod.source);
    const fromLayer = layerFromPath(mod.source);
    if (!fromPkg) continue;

    for (const dep of mod.dependencies || []) {
        if (dep.coreModule || dep.couldNotResolve) continue;
        const toPkg = pkgFromPath(dep.resolved);
        const toLayer = layerFromPath(dep.resolved);
        if (!toPkg) continue;

        // Package-level
        if (toPkg !== fromPkg) {
            ceMap[fromPkg].add(toPkg);
            caMap[toPkg].add(fromPkg);
        }

        // Layer-level (within same service only)
        if (toPkg === fromPkg && fromLayer && toLayer && fromLayer !== toLayer) {
            const fk = layerKey(fromPkg, fromLayer);
            const tk = layerKey(fromPkg, toLayer);
            if (layerCe[fk] !== undefined) layerCe[fk].add(tk);
            if (layerCa[tk] !== undefined) layerCa[tk].add(fk);
        }
    }
}

// ─── Step 4: Abstractness per package ────────────────────────────────────────

function scanAbstractness(pkgName) {
    const srcDir = join(ROOT, pkgName, 'src');
    let abstractCount = 0;
    let concreteCount = 0;

    function walk(dir) {
        let entries;
        try {
            entries = readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const full = join(dir, entry.name);
            if (entry.isDirectory() && !entry.name.startsWith('.')) {
                walk(full);
            } else if (
                entry.isFile() &&
                entry.name.endsWith('.ts') &&
                !entry.name.endsWith('.spec.ts') &&
                !entry.name.endsWith('.d.ts')
            ) {
                let content;
                try {
                    content = readFileSync(full, 'utf8');
                } catch {
                    continue;
                }
                // Abstract: export interface X | export abstract class X
                abstractCount += (
                    content.match(/^\s*export\s+(abstract\s+class|interface)\s+\w/gm) || []
                ).length;
                // Concrete: export class X (not abstract)
                const classLines = content.match(/^\s*export\s+class\s+\w/gm) || [];
                concreteCount += classLines.length;
            }
        }
    }

    walk(srcDir);
    const total = abstractCount + concreteCount;
    return total > 0 ? abstractCount / total : null;
}

// ─── Step 5: Connascence scan on @ecommerce/shared ───────────────────────────

function scanConnascence() {
    const sharedSrc = join(ROOT, 'packages/shared/src');
    const results = { CoN: [], CoT: [], CoV: [] };

    function walk(dir) {
        let entries;
        try {
            entries = readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const full = join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.isFile() && entry.name.endsWith('.ts')) {
                let content;
                try {
                    content = readFileSync(full, 'utf8');
                } catch {
                    continue;
                }
                const rel = fwd(full.replace(ROOT + '/', ''));

                // CoN — Connascence of Name: exported string event/queue names
                const eventNames = content.match(/['"`][\w.]+['"`]\s*[,;)]/g) || [];
                if (eventNames.length > 0) {
                    results.CoN.push({ file: rel, count: eventNames.length });
                }

                // CoT — Connascence of Type: exported interfaces / DTOs
                const typeExports = content.match(/^\s*export\s+(interface|class|type)\s+\w+/gm) || [];
                if (typeExports.length > 0) {
                    results.CoT.push({ file: rel, exports: typeExports.map((l) => l.trim()) });
                }

                // CoV — Connascence of Value: exported const scalars
                const constExports = content.match(/^\s*export\s+const\s+\w+\s*=/gm) || [];
                if (constExports.length > 0) {
                    results.CoV.push({ file: rel, count: constExports.length });
                }
            }
        }
    }

    walk(sharedSrc);
    return results;
}

// ─── Step 6: Compute final metrics ───────────────────────────────────────────

const metrics = [];

for (const pkg of [...workspacePkgs].sort()) {
    const ca = caMap[pkg].size;
    const ce = ceMap[pkg].size;
    const sum = ca + ce;
    const I = sum > 0 ? r2(ce / sum) : ca === 0 ? 1.0 : 0.0; // no deps at all = unstable (leaf node)
    const A = scanAbstractness(pkg);
    const aVal = A !== null ? r2(A) : null;
    const D = aVal !== null ? r2(Math.abs(aVal + I - 1)) : null;

    const layers = {};
    for (const layer of DDD_LAYERS) {
        const k = layerKey(pkg, layer);
        if (layerCa[k] !== undefined) {
            const lca = layerCa[k].size;
            const lce = layerCe[k].size;
            const lsum = lca + lce;
            const lI = lsum > 0 ? r2(lce / lsum) : null;
            layers[layer] = { ca: lca, ce: lce, I: lI };
        }
    }

    metrics.push({ pkg, ca, ce, I, A: aVal, D, layers });
}

const connascence = scanConnascence();

// ─── Step 7: JSON output path ─────────────────────────────────────────────────

if (JSON_OUTPUT) {
    console.log(
        JSON.stringify(
            {
                generatedAt: new Date().toISOString(),
                violations: violations.length,
                packages: metrics,
                connascence,
            },
            null,
            2,
        ),
    );
    process.exit(0);
}

// ─── Step 8: Pretty console report ───────────────────────────────────────────

const W = 88;
const line = '─'.repeat(W);
const dline = '═'.repeat(W);

const pad = (s, n, right = false) => {
    const str = String(s ?? '—');
    return right ? str.padStart(n) : str.padEnd(n);
};

const zoneLabel = (I, D) => {
    if (D === null) return color(C.dim, 'N/A');
    if (D <= 0.1) return color(C.green, 'MAIN SEQ ✓');
    if (D <= 0.3) return color(C.yellow, 'NEAR SEQ ~');
    return color(C.red, 'OFF SEQ  ✗');
};

const iLabel = (I) => {
    if (I === null || I === undefined) return color(C.dim, '  —  ');
    if (I <= 0.3) return color(C.green, `${r2(I).toFixed(2)} ↓`);
    if (I <= 0.7) return color(C.yellow, `${r2(I).toFixed(2)} ~`);
    return color(C.cyan, `${r2(I).toFixed(2)} ↑`);
};

console.log();
console.log(color(C.bold, `╔${'═'.repeat(W)}╗`));
console.log(
    color(C.bold, `║`) +
        color(C.bold + C.white, pad('  COUPLING METRICS — Ecommerce Microservices', W, false)) +
        color(C.bold, '║'),
);
console.log(
    color(C.bold, `║`) +
        color(C.dim, pad(`  Robert C. Martin Package Metrics  •  ${new Date().toISOString().slice(0, 10)}`, W)) +
        color(C.bold, '║'),
);
console.log(color(C.bold, `╠${'═'.repeat(W)}╣`));
console.log(
    color(C.bold, '║') +
        color(C.bold, '  ' + pad('Package / Layer', 36) + pad('Ca', 5) + pad('Ce', 5) + pad('I', 8) + pad('A', 7) + pad('D', 7) + pad('Zone', 13)) +
        color(C.bold, '║'),
);
console.log(color(C.bold, `╠${'═'.repeat(W)}╣`));

let totalViolations = 0;

for (const m of metrics) {
    const isApp = m.pkg.startsWith('apps/');
    const prefix = isApp ? '  ' : '';

    // ── Package row
    const aStr = m.A !== null ? m.A.toFixed(2) : '  —';
    const dStr = m.D !== null ? m.D.toFixed(2) : '  —';

    console.log(
        `║  ` +
            color(C.bold, pad(prefix + m.pkg, 36)) +
            color(C.white, pad(m.ca, 5)) +
            color(C.white, pad(m.ce, 5)) +
            pad(iLabel(m.I), 8) +
            color(C.dim, pad(aStr, 7)) +
            color(C.dim, pad(dStr, 7)) +
            pad(zoneLabel(m.I, m.D), 13) +
            '║',
    );

    // ── Layer rows (only for app services with DDD layers)
    if (isApp) {
        const layerSymbols = { domain: '◆', application: '◇', infrastructure: '▲', presentation: '▽' };
        for (const layer of DDD_LAYERS) {
            const l = m.layers[layer];
            if (!l || (l.ca === 0 && l.ce === 0)) continue;
            const sym = layerSymbols[layer];
            console.log(
                `║    ` +
                    color(C.dim, pad(`${sym} ${layer}`, 34)) +
                    color(C.dim, pad(l.ca, 5)) +
                    color(C.dim, pad(l.ce, 5)) +
                    pad(iLabel(l.I), 8) +
                    color(C.dim, pad('  —', 7)) +
                    color(C.dim, pad('  —', 7)) +
                    color(C.dim, pad('', 13)) +
                    '║',
            );
        }
    }
}

console.log(color(C.bold, `╠${'═'.repeat(W)}╣`));

// ─── Connascence section ─────────────────────────────────────────────────────

const totalCoN = connascence.CoN.reduce((s, f) => s + f.count, 0);
const totalCoT = connascence.CoT.reduce((s, f) => s + f.exports.length, 0);
const totalCoV = connascence.CoV.reduce((s, f) => s + f.count, 0);

console.log(
    color(C.bold, '║') +
        color(C.bold, pad('  CONNASCENCE — @ecommerce/shared surface area', W)) +
        color(C.bold, '║'),
);
console.log(color(C.bold, `╠${'═'.repeat(W)}╣`));
console.log(
    `║  ` +
        color(C.cyan, `CoN (Name)     `) +
        `${totalCoN} shared identifiers (event names, queue keys, command strings)  ` +
        ' '.repeat(Math.max(0, W - 66)) +
        '║',
);
console.log(
    `║  ` +
        color(C.cyan, `CoT (Type)     `) +
        `${totalCoT} exported types/DTOs/interfaces shared across service boundaries  ` +
        ' '.repeat(Math.max(0, W - 67)) +
        '║',
);
console.log(
    `║  ` +
        color(C.cyan, `CoV (Value)    `) +
        `${totalCoV} exported constants (queue names, retry limits, config values)   ` +
        ' '.repeat(Math.max(0, W - 67)) +
        '║',
);

// ─── Violations section ───────────────────────────────────────────────────────

console.log(color(C.bold, `╠${'═'.repeat(W)}╣`));
console.log(
    color(C.bold, '║') +
        color(C.bold, pad('  ARCHITECTURAL VIOLATIONS', W)) +
        color(C.bold, '║'),
);
console.log(color(C.bold, `╠${'═'.repeat(W)}╣`));

if (violations.length === 0) {
    console.log(`║  ${color(C.green, '✓')} No architectural violations found${' '.repeat(W - 37)}║`);
} else {
    totalViolations = violations.length;
    for (const v of violations) {
        const msg = `${v.rule.name}: ${v.from} → ${v.to}`.slice(0, W - 8);
        console.log(`║  ${color(C.red, '✗')} ${color(C.red, pad(msg, W - 6))}║`);
    }
}

// ─── Recommendations ─────────────────────────────────────────────────────────

const recs = [];
for (const m of metrics) {
    if (m.ce > 5)
        recs.push(`[Ce=${m.ce}] ${m.pkg}: High efferent coupling — consider splitting responsibilities`);
    if (m.ca > 4 && m.I > 0.5)
        recs.push(`[Ca=${m.ca}, I=${m.I}] ${m.pkg}: Many dependents + high instability — risky to change`);
    if (m.D !== null && m.D > 0.3)
        recs.push(`[D=${m.D}] ${m.pkg}: Far from Main Sequence — rebalance abstractness vs instability`);
}

if (recs.length > 0) {
    console.log(color(C.bold, `╠${'═'.repeat(W)}╣`));
    console.log(
        color(C.bold, '║') +
            color(C.bold, pad('  RECOMMENDATIONS', W)) +
            color(C.bold, '║'),
    );
    console.log(color(C.bold, `╠${'═'.repeat(W)}╣`));
    for (const rec of recs) {
        const msg = rec.slice(0, W - 6);
        console.log(`║  ${color(C.yellow, '!')} ${pad(msg, W - 6)}║`);
    }
}

console.log(color(C.bold, `╚${'═'.repeat(W)}╝`));

console.log();
console.log(color(C.dim, '  Legend:'));
console.log(color(C.dim, '    Ca = Afferent Coupling   Ce = Efferent Coupling'));
console.log(color(C.dim, '    I  = Instability (0=stable, 1=unstable)'));
console.log(color(C.dim, '    A  = Abstractness (interfaces+abstract / total classes)'));
console.log(color(C.dim, '    D  = Distance from Main Sequence |A+I-1| (0=ideal)'));
console.log(color(C.dim, '    Main Sequence: stable packages should be abstract; unstable ones concrete'));
console.log();

process.exit(totalViolations > 0 ? 1 : 0);
