/**
 * Dependency Cruiser — Architectural Rules
 *
 * Enforces:
 *  1. DDD layer constraints (domain → application → infrastructure → presentation)
 *  2. No direct cross-service imports between apps
 *  3. No circular dependencies
 *
 * Run:   pnpm coupling:validate
 * Graph: pnpm coupling:graph
 */

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
    forbidden: [
        // ── DDD LAYER RULES ─────────────────────────────────────────────────────
        // Domain is the innermost ring — it must have zero outward dependencies.
        {
            name: 'domain-not-depend-on-application',
            comment: '[DDD] Domain layer must not depend on Application layer',
            severity: 'error',
            from: { path: '/src/domain/' },
            to: { path: '/src/application/' },
        },
        {
            name: 'domain-not-depend-on-infrastructure',
            comment: '[DDD] Domain layer must not depend on Infrastructure layer',
            severity: 'error',
            from: { path: '/src/domain/' },
            to: { path: '/src/infrastructure/' },
        },
        {
            name: 'domain-not-depend-on-presentation',
            comment: '[DDD] Domain layer must not depend on Presentation layer',
            severity: 'error',
            from: { path: '/src/domain/' },
            to: { path: '/src/presentation/' },
        },
        // Application (use cases) may only depend on Domain.
        {
            name: 'application-not-depend-on-infrastructure',
            comment:
                '[DDD] Application layer must not depend directly on Infrastructure — use repository interfaces',
            severity: 'error',
            from: { path: '/src/application/' },
            to: { path: '/src/infrastructure/' },
        },
        {
            name: 'application-not-depend-on-presentation',
            comment: '[DDD] Application layer must not depend on Presentation layer',
            severity: 'error',
            from: { path: '/src/application/' },
            to: { path: '/src/presentation/' },
        },
        // Presentation mediates between outside world and use cases.
        // It must NOT bypass Application and call Infrastructure directly.
        {
            name: 'presentation-not-depend-on-infrastructure',
            comment: '[DDD] Presentation must call use cases, not Infrastructure directly',
            severity: 'error',
            from: { path: '/src/presentation/' },
            to: { path: '/src/infrastructure/' },
        },

        // ── CROSS-SERVICE COUPLING ───────────────────────────────────────────────
        // Services must communicate via RabbitMQ events or HTTP, never via source imports.
        {
            name: 'api-gateway-no-service-src-imports',
            comment: '[COUPLING] api-gateway must not import source files from other services',
            severity: 'error',
            from: { path: '^apps/api-gateway/' },
            to: { path: '^apps/(order-service|payment-service|user-service)/' },
        },
        {
            name: 'order-service-no-cross-service-imports',
            comment: '[COUPLING] order-service must not import source files from other services',
            severity: 'error',
            from: { path: '^apps/order-service/' },
            to: { path: '^apps/(api-gateway|payment-service|user-service)/' },
        },
        {
            name: 'payment-service-no-cross-service-imports',
            comment: '[COUPLING] payment-service must not import source files from other services',
            severity: 'error',
            from: { path: '^apps/payment-service/' },
            to: { path: '^apps/(api-gateway|order-service|user-service)/' },
        },
        {
            name: 'user-service-no-cross-service-imports',
            comment: '[COUPLING] user-service must not import source files from other services',
            severity: 'error',
            from: { path: '^apps/user-service/' },
            to: { path: '^apps/(api-gateway|order-service|payment-service)/' },
        },

        // ── CIRCULAR DEPENDENCIES ────────────────────────────────────────────────
        {
            name: 'no-circular',
            comment:
                '[QUALITY] Circular dependencies create tight coupling and prevent tree-shaking',
            severity: 'error',
            from: {},
            to: { circular: true },
        },
    ],

    options: {
        doNotFollow: {
            path: 'node_modules',
            dependencyTypes: [
                'npm',
                'npm-dev',
                'npm-optional',
                'npm-peer',
                'npm-bundled',
                'npm-no-pkg',
            ],
        },

        tsPreCompilationDeps: true,

        tsConfig: {
            fileName: 'tsconfig.json',
        },

        enhancedResolveOptions: {
            exportsFields: ['exports'],
            conditionNames: ['import', 'require', 'node', 'default'],
            extensions: ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'],
        },

        // Visual graph output: colour-coded per DDD layer
        reporterOptions: {
            dot: {
                collapsePattern: 'node_modules/[^/]+',
                theme: {
                    replace: false,
                    graph: { rankdir: 'LR', splines: 'ortho' },
                    modules: [
                        {
                            criteria: { source: '/src/domain/' },
                            attributes: { fillcolor: '#dae8fc', color: '#6c8ebf', style: 'filled' },
                        },
                        {
                            criteria: { source: '/src/application/' },
                            attributes: { fillcolor: '#d5e8d4', color: '#82b366', style: 'filled' },
                        },
                        {
                            criteria: { source: '/src/infrastructure/' },
                            attributes: { fillcolor: '#ffe6cc', color: '#d6b656', style: 'filled' },
                        },
                        {
                            criteria: { source: '/src/presentation/' },
                            attributes: { fillcolor: '#e1d5e7', color: '#9673a6', style: 'filled' },
                        },
                        {
                            criteria: { source: '^packages/' },
                            attributes: {
                                fillcolor: '#fff2cc',
                                color: '#d6b656',
                                style: 'filled,bold',
                            },
                        },
                    ],
                },
            },
        },
    },
};
