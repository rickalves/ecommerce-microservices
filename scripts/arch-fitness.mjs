#!/usr/bin/env node
/**
 * Architectural Fitness Functions
 *
 * Executable specifications that prevent architectural regression.
 * Each function encodes a rule that MUST hold at all times.
 * Fails with exit code 1 if any rule is violated — suitable for CI gate.
 *
 * Usage:
 *   pnpm coupling:fitness
 *
 * Concept: "Fitness functions provide an objective integrity assessment of
 * some architectural characteristic." — Building Evolutionary Architectures
 */

import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ─── ANSI ─────────────────────────────────────────────────────────────────────
const C = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
};
const ok = (msg) => console.log(`  ${C.green}✓${C.reset} ${msg}`);
const fail = (msg) => console.log(`  ${C.red}✗${C.reset} ${C.bold}${C.red}${msg}${C.reset}`);
const warn = (msg) => console.log(`  ${C.yellow}!${C.reset} ${msg}`);
const section = (title) => {
    console.log();
    console.log(`${C.bold}${C.cyan}── ${title} ${C.reset}`);
};

// ─── Shared state ─────────────────────────────────────────────────────────────
let graph = null;
let violations = [];
let totalFailed = 0;
let totalPassed = 0;

function assert(condition, passMsg, failMsg, details = []) {
    if (condition) {
        ok(passMsg);
        totalPassed++;
    } else {
        fail(failMsg);
        for (const d of details) console.log(`     ${C.dim}  ${d}${C.reset}`);
        totalFailed++;
    }
}

// ─── Load graph ───────────────────────────────────────────────────────────────

function loadGraph() {
    process.stdout.write(`${C.dim}  Loading dependency graph...${C.reset}`);
    let raw;
    try {
        raw = execSync(
            'npx depcruise --config .dependency-cruiser.cjs --output-type json apps packages',
            { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
        );
    } catch (e) {
        raw = e.stdout || '{}';
    }
    graph = JSON.parse(raw);
    violations = graph.summary?.violations || [];
    process.stdout.write(` ${C.dim}done (${graph.modules?.length ?? 0} modules)${C.reset}\n`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fwd = (p) => p.replace(/\\/g, '/');
const pkgFrom = (p) => {
    const m = fwd(p).match(/^(apps\/[^/]+|packages\/[^/]+)\//);
    return m?.[1];
};
const layerFrom = (p) => {
    const m = fwd(p).match(/\/src\/(domain|application|infrastructure|presentation)\//);
    return m?.[1];
};

function violationsByRule(ruleName) {
    return violations.filter((v) => v.rule.name === ruleName);
}

function buildDepMap() {
    const ceMap = {}; // pkg → Set<pkg>
    const caMap = {}; // pkg → Set<pkg>
    const pkgs = new Set();

    for (const mod of graph.modules || []) {
        const from = pkgFrom(mod.source);
        if (from) pkgs.add(from);
    }
    for (const pkg of pkgs) {
        ceMap[pkg] = new Set();
        caMap[pkg] = new Set();
    }

    for (const mod of graph.modules || []) {
        const from = pkgFrom(mod.source);
        if (!from) continue;
        for (const dep of mod.dependencies || []) {
            if (dep.coreModule || dep.couldNotResolve) continue;
            const to = pkgFrom(dep.resolved);
            if (!to || to === from) continue;
            ceMap[from].add(to);
            caMap[to].add(from);
        }
    }
    return { ceMap, caMap, pkgs };
}

// ─── FITNESS FUNCTIONS ────────────────────────────────────────────────────────

/**
 * FF-01: DDD Layer Dependency Rules
 * Domain must not depend on any outer layer.
 * Application must not depend on Infrastructure or Presentation.
 * Presentation must not depend on Infrastructure directly.
 */
function ff01_dddLayerConstraints() {
    section('FF-01: DDD Layer Dependency Constraints');

    const rules = [
        'domain-not-depend-on-application',
        'domain-not-depend-on-infrastructure',
        'domain-not-depend-on-presentation',
        'application-not-depend-on-infrastructure',
        'application-not-depend-on-presentation',
        'presentation-not-depend-on-infrastructure',
    ];

    for (const rule of rules) {
        const hits = violationsByRule(rule);
        const label = rule.replace(/-/g, ' ');
        assert(
            hits.length === 0,
            label,
            `${label} (${hits.length} violation${hits.length > 1 ? 's' : ''})`,
            hits.map((h) => `${h.from} → ${h.to}`)
        );
    }
}

/**
 * FF-02: No Cross-Service Source Imports
 * Services must communicate via events (RabbitMQ) or HTTP.
 * Direct TypeScript imports across service boundaries are forbidden.
 */
function ff02_noCrossServiceImports() {
    section('FF-02: No Cross-Service Source Imports');

    const rules = [
        'api-gateway-no-service-src-imports',
        'order-service-no-cross-service-imports',
        'payment-service-no-cross-service-imports',
        'user-service-no-cross-service-imports',
    ];

    for (const rule of rules) {
        const hits = violationsByRule(rule);
        const label = rule.replace(/-/g, ' ');
        assert(
            hits.length === 0,
            label,
            `${label} — ${hits.length} direct import(s) detected`,
            hits.map((h) => `${h.from} → ${h.to}`)
        );
    }
}

/**
 * FF-03: No Circular Dependencies
 * Cycles prevent independent deployment and make reasoning about
 * build order impossible.
 */
function ff03_noCircularDependencies() {
    section('FF-03: No Circular Dependencies');

    const hits = violationsByRule('no-circular');
    assert(
        hits.length === 0,
        'No circular dependencies found',
        `${hits.length} circular dependency chain(s) detected`,
        hits.map((h) => `${h.from} → ${h.to}`)
    );
}

/**
 * FF-04: Shared Package Stability
 * @ecommerce/shared and @ecommerce/observability are depended upon by ALL
 * services. High Ca means they must be STABLE (I close to 0).
 * Threshold: I ≤ 0.25 for shared packages.
 */
function ff04_sharedPackageStability() {
    section('FF-04: Shared Package Stability (I ≤ 0.25)');

    const THRESHOLD = 0.25;
    const SHARED_PKGS = ['packages/shared', 'packages/observability'];
    const { ceMap, caMap } = buildDepMap();

    for (const pkg of SHARED_PKGS) {
        const ca = caMap[pkg]?.size ?? 0;
        const ce = ceMap[pkg]?.size ?? 0;
        const sum = ca + ce;
        const I = sum > 0 ? ce / sum : 0;

        assert(
            I <= THRESHOLD,
            `${pkg}: I=${I.toFixed(2)} (Ca=${ca}, Ce=${ce}) — within stability threshold`,
            `${pkg}: I=${I.toFixed(2)} exceeds threshold ${THRESHOLD} — package is too unstable for a shared dependency`,
            [`Ca=${ca} (dependents)  Ce=${ce} (dependencies)  I=${I.toFixed(2)}`]
        );
    }
}

/**
 * FF-05: Domain Layer Isolation
 * Each service's domain/ must have 0 efferent coupling to outer layers
 * within its own service (Ce = 0 at layer level).
 */
function ff05_domainLayerIsolation() {
    section('FF-05: Domain Layer Zero Efferent Coupling');

    const APP_SERVICES = ['apps/order-service', 'apps/payment-service', 'apps/user-service'];
    const layerCe = {};

    for (const mod of graph.modules || []) {
        const fromPkg = pkgFrom(mod.source);
        const fromLayer = layerFrom(mod.source);
        if (!fromPkg || fromLayer !== 'domain') continue;

        for (const dep of mod.dependencies || []) {
            if (dep.coreModule || dep.couldNotResolve) continue;
            const toPkg = pkgFrom(dep.resolved);
            const toLayer = layerFrom(dep.resolved);
            if (!toPkg || toPkg !== fromPkg || !toLayer || toLayer === 'domain') continue;

            // domain imports another local layer — violation
            const key = `${fromPkg}#domain → ${toLayer}`;
            layerCe[key] = (layerCe[key] || 0) + 1;
        }
    }

    for (const svc of APP_SERVICES) {
        const offenders = Object.entries(layerCe)
            .filter(([k]) => k.startsWith(svc))
            .map(([k, n]) => `${k} (${n} import${n > 1 ? 's' : ''})`);

        assert(
            offenders.length === 0,
            `${svc}/domain — Ce=0, no outward layer imports`,
            `${svc}/domain — outward imports detected`,
            offenders
        );
    }
}

/**
 * FF-06: Application Layer Does Not Leak Infrastructure
 * Use cases must depend only on repository interfaces (in domain/),
 * never on concrete infrastructure implementations.
 */
function ff06_applicationUsesInterfaces() {
    section('FF-06: Application Layer Depends on Interfaces (not Implementations)');

    const leaks = [];

    for (const mod of graph.modules || []) {
        const fromLayer = layerFrom(mod.source);
        if (fromLayer !== 'application') continue;

        for (const dep of mod.dependencies || []) {
            if (dep.coreModule || dep.couldNotResolve) continue;
            const toLayer = layerFrom(dep.resolved);
            if (toLayer === 'infrastructure') {
                leaks.push(`${fwd(mod.source)} → ${fwd(dep.resolved)}`);
            }
        }
    }

    assert(
        leaks.length === 0,
        'Application layer uses only domain interfaces — no infrastructure leaks',
        `Application layer references infrastructure directly (${leaks.length} occurrence${leaks.length > 1 ? 's' : ''})`,
        leaks
    );
}

/**
 * FF-07: No Package Depends on More Than 3 Internal Packages
 * Prevents "big ball of yarn" fan-out. Threshold for Ce among workspace
 * packages is 3 — each package should have a focused role.
 */
function ff07_efferentCouplingThreshold() {
    section('FF-07: Efferent Coupling ≤ 3 per Package (focused responsibility)');

    const THRESHOLD = 3;
    const { ceMap } = buildDepMap();

    for (const [pkg, deps] of Object.entries(ceMap)) {
        const internalDeps = [...deps].filter(
            (d) => d.startsWith('apps/') || d.startsWith('packages/')
        );
        assert(
            internalDeps.length <= THRESHOLD,
            `${pkg}: Ce=${internalDeps.length} — within threshold`,
            `${pkg}: Ce=${internalDeps.length} exceeds threshold ${THRESHOLD}`,
            internalDeps.map((d) => `  depends on ${d}`)
        );
    }
}

// ─── Run all fitness functions ────────────────────────────────────────────────

console.log();
console.log(`${C.bold}╔════════════════════════════════════════════════════════════╗`);
console.log(`║        Architectural Fitness Functions — Ecommerce         ║`);
console.log(`╚════════════════════════════════════════════════════════════╝${C.reset}`);

loadGraph();

ff01_dddLayerConstraints();
ff02_noCrossServiceImports();
ff03_noCircularDependencies();
ff04_sharedPackageStability();
ff05_domainLayerIsolation();
ff06_applicationUsesInterfaces();
ff07_efferentCouplingThreshold();

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log();
console.log('─'.repeat(64));

if (totalFailed === 0) {
    console.log(`${C.bold}${C.green}  ✓ All ${totalPassed} fitness functions passed${C.reset}`);
    console.log(`${C.dim}  Architecture is healthy — no coupling violations detected${C.reset}`);
} else {
    console.log(
        `${C.bold}${C.red}  ✗ ${totalFailed} fitness function(s) FAILED  (${totalPassed} passed)${C.reset}`
    );
    console.log(
        `${C.dim}  Fix violations before merging to protect architectural integrity${C.reset}`
    );
}

console.log('─'.repeat(64));
console.log();

process.exit(totalFailed > 0 ? 1 : 0);
