/**
 * Alaga AI Integration Test Runner
 * ==================================
 * Simulates ESP32 sensor readings without any physical hardware.
 * Tests two layers independently:
 *   Layer A — Python AI Service directly (port 5001)
 *   Layer B — Full Express pipeline (port 3000) end-to-end
 *
 * Usage:
 *   1. Start the Python AI service first:
 *        $env:AI_INTERNAL_TOKEN = "39c5ca3e8bef940663098c816b778788071a0ee9434fa6bb22ab6980366c8333"
 *        python alaga-oc-svm-main/alaga-oc-svm-main/ai_service.py
 *
 *   2. Start the Express backend (separate terminal):
 *        node backend/index.js
 *
 *   3. Run this script (from the project root):
 *        node test-ai-integration.js
 *
 * No device, no ESP32, no hardware required.
 */

const http  = require('http');
const https = require('https');

// ── Configuration ─────────────────────────────────────────────────────────────
const CONFIG = {
    // Python AI service (direct test — bypasses Express)
    AI_SERVICE_HOST  : '127.0.0.1',
    AI_SERVICE_PORT  : 5001,
    AI_INTERNAL_TOKEN: '39c5ca3e8bef940663098c816b778788071a0ee9434fa6bb22ab6980366c8333',

    // Express backend (full pipeline test)
    EXPRESS_HOST     : 'localhost',
    EXPRESS_PORT     : 3000,

    // ESP32 device credentials (must match a row in device_whitelist)
    DEVICE_SERIAL    : 'ESP32-001',
    DEVICE_TOKEN     : 'b5311ca84cd76e1e6a906dc3c872a7eeef5ae9ca880415e6a4bea2e058623bba',

    // Patient ID to use for full-pipeline tests (must exist in patients table)
    TEST_PATIENT_ID  : 1,
};

// ── Clinical Test Scenarios ───────────────────────────────────────────────────
// These match the scenarios in scripts/04_predict.py and WHO clinical thresholds.
const SCENARIOS = [
    {
        label       : 'Normal adult vitals',
        expect      : 'NORMAL',
        body        : { heart_rate: 75, temperature: 36.8, spo2: 98, moisture: 0, patient_type: 'adult' }
    },
    {
        label       : 'Normal infant vitals',
        expect      : 'NORMAL',
        body        : { heart_rate: 130, temperature: 37.0, spo2: 97, moisture: 0, patient_type: 'infant' }
    },
    {
        label       : 'Fever (temp 39.2 C)',
        expect      : 'CRITICAL',
        body        : { heart_rate: 88, temperature: 39.2, spo2: 96, moisture: 0, patient_type: 'adult' }
    },
    {
        label       : 'Hypothermia risk (temp 34.5 C)',
        expect      : 'CRITICAL',
        body        : { heart_rate: 60, temperature: 34.5, spo2: 96, moisture: 0, patient_type: 'adult' }
    },
    {
        label       : 'Critical low SpO2 — Hypoxia (85%)',
        expect      : 'CRITICAL',
        body        : { heart_rate: 95, temperature: 36.9, spo2: 85, moisture: 0, patient_type: 'adult' }
    },
    {
        label       : 'Warning SpO2 (93%)',
        expect      : 'WARNING',
        body        : { heart_rate: 82, temperature: 36.7, spo2: 93, moisture: 0, patient_type: 'adult' }
    },
    {
        label       : 'Adult tachycardia (HR 115 bpm)',
        expect      : 'WARNING',
        body        : { heart_rate: 115, temperature: 36.9, spo2: 97, moisture: 0, patient_type: 'adult' }
    },
    {
        label       : 'Infant tachycardia (HR 165 bpm)',
        expect      : 'WARNING',
        body        : { heart_rate: 165, temperature: 37.0, spo2: 97, moisture: 0, patient_type: 'infant' }
    },
    {
        label       : 'Bradycardia — low heart rate (42 bpm)',
        expect      : 'CRITICAL',
        body        : { heart_rate: 42, temperature: 36.8, spo2: 97, moisture: 0, patient_type: 'adult' }
    },
    {
        label       : 'No pulse detected (HR 0)',
        expect      : 'CRITICAL',
        body        : { heart_rate: 0, temperature: 36.8, spo2: 97, moisture: 0, patient_type: 'adult' }
    },
    {
        label       : 'Wet diaper detected',
        expect      : 'WARNING',
        body        : { heart_rate: 120, temperature: 36.7, spo2: 98, moisture: 1, patient_type: 'infant' }
    },
    {
        label       : 'Multiple critical flags — fever + low SpO2 + wet',
        expect      : 'CRITICAL',
        body        : { heart_rate: 95, temperature: 39.5, spo2: 86, moisture: 1, patient_type: 'adult' }
    },
];

// ── Colour output helpers ─────────────────────────────────────────────────────
const C = {
    reset  : '\x1b[0m',
    bold   : '\x1b[1m',
    red    : '\x1b[31m',
    green  : '\x1b[32m',
    yellow : '\x1b[33m',
    cyan   : '\x1b[36m',
    grey   : '\x1b[90m',
};

function pass(msg) { console.log(`  ${C.green}PASS${C.reset}  ${msg}`); }
function fail(msg) { console.log(`  ${C.red}FAIL${C.reset}  ${msg}`); }
function info(msg) { console.log(`  ${C.cyan}INFO${C.reset}  ${msg}`); }
function warn(msg) { console.log(`  ${C.yellow}WARN${C.reset}  ${msg}`); }
function head(msg) { console.log(`\n${C.bold}${msg}${C.reset}`); }
function divider()  { console.log(`${C.grey}${'─'.repeat(60)}${C.reset}`); }

// ── Core HTTP helper ──────────────────────────────────────────────────────────
function httpPost(options, body) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(body);
        const reqOptions = {
            hostname: options.hostname,
            port    : options.port,
            path    : options.path,
            method  : 'POST',
            headers : {
                'Content-Type'  : 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                ...options.headers
            }
        };

        const req = http.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(6000, () => {
            req.destroy();
            reject(new Error('Request timed out after 6 seconds'));
        });

        req.write(payload);
        req.end();
    });
}

function httpGet(options) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: options.hostname,
            port    : options.port,
            path    : options.path,
            method  : 'GET',
            headers : options.headers || {}
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(4000, () => { req.destroy(); reject(new Error('Timeout')); });
        req.end();
    });
}

// ── LAYER A: Test the Python AI Service directly ──────────────────────────────
async function testAiServiceDirect() {
    head('LAYER A — Python AI Service Direct Tests (port 5001)');
    divider();
    info('Checking if AI service is reachable...');

    try {
        const health = await httpGet({
            hostname: CONFIG.AI_SERVICE_HOST,
            port    : CONFIG.AI_SERVICE_PORT,
            path    : '/health',
            headers : { 'X-Internal-Token': CONFIG.AI_INTERNAL_TOKEN }
        });

        if (health.status === 200) {
            pass(`AI service is UP — ${JSON.stringify(health.body)}`);
        } else {
            fail(`Health check returned ${health.status}`);
            return false;
        }
    } catch (e) {
        fail(`Cannot reach AI service: ${e.message}`);
        console.log(`\n  ${C.yellow}Make sure the Python service is running:${C.reset}`);
        console.log(`  $env:AI_INTERNAL_TOKEN = "${CONFIG.AI_INTERNAL_TOKEN}"`);
        console.log(`  python alaga-oc-svm-main/alaga-oc-svm-main/ai_service.py\n`);
        return false;
    }

    divider();
    info('Running clinical scenario tests against AI service...\n');

    let passed = 0;
    let failed = 0;

    for (const scenario of SCENARIOS) {
        try {
            const result = await httpPost(
                {
                    hostname: CONFIG.AI_SERVICE_HOST,
                    port    : CONFIG.AI_SERVICE_PORT,
                    path    : '/predict',
                    headers : { 'X-Internal-Token': CONFIG.AI_INTERNAL_TOKEN }
                },
                { ...scenario.body, patient_id: CONFIG.TEST_PATIENT_ID }
            );

            const status    = result.body.status;
            const alerts    = result.body.alerts || [];
            const ocsvm     = result.body.ocsvm_result;
            const matched   = status === scenario.expect;

            if (matched) {
                pass(`${scenario.label}`);
                passed++;
            } else {
                fail(`${scenario.label}`);
                console.log(`         Expected: ${scenario.expect}  |  Got: ${status}`);
                failed++;
            }

            // Print alerts for non-NORMAL results
            if (alerts.length > 0) {
                alerts.forEach(a => {
                    const colour = a.severity === 'critical' ? C.red : C.yellow;
                    console.log(`         ${colour}[${a.severity.toUpperCase()}]${C.reset} ${a.message}`);
                });
            }

            console.log(`         ${C.grey}OC-SVM: ${ocsvm}${C.reset}`);

        } catch (e) {
            fail(`${scenario.label} — Request error: ${e.message}`);
            failed++;
        }
    }

    divider();
    const colour = failed === 0 ? C.green : C.red;
    console.log(`  Layer A Result: ${colour}${passed} passed, ${failed} failed${C.reset} out of ${SCENARIOS.length} scenarios`);
    return failed === 0;
}

// ── LAYER B: Test the full Express pipeline ───────────────────────────────────
async function testExpressPipeline() {
    head('LAYER B — Full Express Pipeline Tests (port 3000)');
    divider();
    info('Checking if Express backend is reachable...');

    try {
        // Use a route that exists and returns quickly without auth
        const check = await httpGet({
            hostname: CONFIG.EXPRESS_HOST,
            port    : CONFIG.EXPRESS_PORT,
            path    : '/api/auth/my-permissions',
        });
        // 401 is fine — it means Express is up, just rejected the unauthenticated request
        if (check.status === 401 || check.status === 200) {
            pass('Express backend is UP');
        } else {
            warn(`Express returned ${check.status} on health probe — continuing anyway`);
        }
    } catch (e) {
        fail(`Cannot reach Express backend: ${e.message}`);
        console.log(`\n  ${C.yellow}Make sure the backend is running:${C.reset}`);
        console.log(`  node backend/index.js\n`);
        return false;
    }

    divider();

    // Test 1: Reject request with no device credentials
    info('Test B-1: Request with no device headers should return 401...');
    try {
        const r = await httpPost(
            { hostname: CONFIG.EXPRESS_HOST, port: CONFIG.EXPRESS_PORT, path: '/api/sensor/reading' },
            { heart_rate: 75, temperature: 36.8, spo2: 98, moisture: 0 }
        );
        if (r.status === 401) {
            pass('Correctly rejected unauthenticated device (401)');
        } else {
            fail(`Expected 401, got ${r.status} — device auth may not be enforced`);
        }
    } catch (e) {
        fail(`B-1 error: ${e.message}`);
    }

    // Test 2: Reject request with wrong token
    info('Test B-2: Wrong device token should return 401...');
    try {
        const r = await httpPost(
            {
                hostname: CONFIG.EXPRESS_HOST,
                port    : CONFIG.EXPRESS_PORT,
                path    : '/api/sensor/reading',
                headers : { 'X-Device-Serial': CONFIG.DEVICE_SERIAL, 'X-Device-Token': 'wrongtoken' }
            },
            { heart_rate: 75, temperature: 36.8, spo2: 98, moisture: 0 }
        );
        if (r.status === 401) {
            pass('Correctly rejected bad device token (401)');
        } else {
            fail(`Expected 401, got ${r.status}`);
        }
    } catch (e) {
        fail(`B-2 error: ${e.message}`);
    }

    // Test 3: Reject reading with invalid vital range
    info('Test B-3: Out-of-range spo2 (999) should return 400 validation error...');
    try {
        const r = await httpPost(
            {
                hostname: CONFIG.EXPRESS_HOST,
                port    : CONFIG.EXPRESS_PORT,
                path    : '/api/sensor/reading',
                headers : { 'X-Device-Serial': CONFIG.DEVICE_SERIAL, 'X-Device-Token': CONFIG.DEVICE_TOKEN }
            },
            { heart_rate: 75, temperature: 36.8, spo2: 999, moisture: 0 }
        );
        if (r.status === 400) {
            pass(`Correctly rejected invalid spo2=999 (400) — ${r.body.message}`);
        } else {
            warn(`Expected 400, got ${r.status} — validation may not be active`);
        }
    } catch (e) {
        fail(`B-3 error: ${e.message}`);
    }

    divider();

    // Test 4–7: Full pipeline with valid device token (requires device in DB)
    info('Tests B-4 to B-7: Full pipeline with real device token (requires DB device row)...');
    info(`Using device: ${CONFIG.DEVICE_SERIAL} | patient_id: ${CONFIG.TEST_PATIENT_ID}\n`);

    const fullPipelineScenarios = [
        { label: 'Normal reading', body: { heart_rate: 75, temperature: 36.8, spo2: 98, moisture: 0 }, expect: 'NORMAL' },
        { label: 'Fever (39.2 C)', body: { heart_rate: 88, temperature: 39.2, spo2: 96, moisture: 0 }, expect: 'CRITICAL' },
        { label: 'Low SpO2 (87%)', body: { heart_rate: 95, temperature: 36.9, spo2: 87, moisture: 0 }, expect: 'CRITICAL' },
        { label: 'Wet diaper',     body: { heart_rate: 120, temperature: 36.7, spo2: 98, moisture: 1 }, expect: 'WARNING' },
    ];

    let passed = 0;
    let failed = 0;
    let dbNotReady = false;

    for (const scenario of fullPipelineScenarios) {
        try {
            const r = await httpPost(
                {
                    hostname: CONFIG.EXPRESS_HOST,
                    port    : CONFIG.EXPRESS_PORT,
                    path    : '/api/sensor/reading',
                    headers : {
                        'X-Device-Serial': CONFIG.DEVICE_SERIAL,
                        'X-Device-Token' : CONFIG.DEVICE_TOKEN,
                    }
                },
                scenario.body
            );

            if (r.status === 401) {
                warn(`${scenario.label} — Device not found in DB (run migration + INSERT first)`);
                dbNotReady = true;
                failed++;
                continue;
            }

            if (r.status === 422) {
                warn(`${scenario.label} — Device not assigned to a patient (set assigned_patient_id in device_whitelist)`);
                dbNotReady = true;
                failed++;
                continue;
            }

            if (r.status !== 200) {
                fail(`${scenario.label} — HTTP ${r.status}: ${r.body?.message || JSON.stringify(r.body)}`);
                failed++;
                continue;
            }

            const status = r.body.status;
            if (status === scenario.expect) {
                pass(`${scenario.label} → status: ${status}`);
                passed++;
            } else if (status === 'UNKNOWN') {
                warn(`${scenario.label} → status: UNKNOWN (AI service may be down — reading was stored)`);
                failed++;
            } else {
                fail(`${scenario.label} → Expected: ${scenario.expect} | Got: ${status}`);
                failed++;
            }

            const alerts = r.body.alerts || [];
            alerts.forEach(a => {
                const colour = a.severity === 'critical' ? C.red : C.yellow;
                console.log(`         ${colour}[${a.severity.toUpperCase()}]${C.reset} ${a.message}`);
            });

        } catch (e) {
            fail(`${scenario.label} — ${e.message}`);
            failed++;
        }
    }

    divider();
    const colour = failed === 0 ? C.green : (dbNotReady ? C.yellow : C.red);
    console.log(`  Layer B Result: ${colour}${passed} passed, ${failed} failed${C.reset} out of ${fullPipelineScenarios.length} scenarios`);

    if (dbNotReady) {
        console.log(`\n  ${C.yellow}Action Required:${C.reset} Run the DB migration and INSERT the device row.`);
        console.log(`  See walkthrough.md Step 1 and Step 2 for the exact SQL.\n`);
    }

    return failed === 0;
}

// ── Entry Point ───────────────────────────────────────────────────────────────
async function main() {
    console.log('\n' + C.bold + '=' .repeat(60) + C.reset);
    console.log(C.bold + '  ALAGA AI Integration Test Suite' + C.reset);
    console.log(C.bold + '  No hardware required' + C.reset);
    console.log(C.bold + '=' .repeat(60) + C.reset);

    const layerAOk = await testAiServiceDirect();
    const layerBOk = await testExpressPipeline();

    console.log('\n' + C.bold + '=' .repeat(60) + C.reset);
    console.log(C.bold + '  Overall Result' + C.reset);
    console.log('  Layer A (AI Service) : ' + (layerAOk ? C.green + 'PASS' : C.red + 'FAIL') + C.reset);
    console.log('  Layer B (Express)    : ' + (layerBOk ? C.green + 'PASS' : C.yellow + 'PARTIAL / FAIL') + C.reset);
    console.log(C.bold + '=' .repeat(60) + C.reset + '\n');

    if (!layerAOk) {
        console.log('Next step: Start the Python AI service (see instructions above).');
    }
    if (!layerBOk) {
        console.log('Next step: Run backend/migrations/003_ai_integration.sql in pgAdmin 4,');
        console.log('           then INSERT the ESP32-001 device row into device_whitelist.');
    }
}

main().catch(err => {
    console.error('\nFatal test runner error:', err.message);
    process.exit(1);
});
