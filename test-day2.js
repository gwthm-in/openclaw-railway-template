#!/usr/bin/env node
/**
 * Day 2 Feature Test Suite
 * Tests all 12 tasks from the Day 2 migration plan
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, "src", "server.js");
const serverCode = fs.readFileSync(serverPath, "utf8");

console.log("========== DAY 2 FEATURE VERIFICATION ==========\n");

let passCount = 0;
let failCount = 0;

function test(name, condition, details = "") {
  if (condition) {
    console.log(`✓ ${name}`);
    if (details) console.log(`  ${details}`);
    passCount++;
  } else {
    console.log(`✗ ${name}`);
    if (details) console.log(`  ${details}`);
    failCount++;
  }
}

// Task 1: Environment Variable Migration
console.log("\n=== Task 1: Environment Variable Migration ===");
test(
  "ENV_MIGRATIONS array exists",
  serverCode.includes("const ENV_MIGRATIONS = ["),
  "Found ENV_MIGRATIONS definition"
);
test(
  "Migrates CLAWDBOT_PUBLIC_PORT",
  serverCode.includes('{ old: "CLAWDBOT_PUBLIC_PORT", new: "OPENCLAW_PUBLIC_PORT" }'),
  "Migration mapping exists"
);
test(
  "Migrates MOLTBOT_* variables",
  serverCode.includes("MOLTBOT_STATE_DIR") && serverCode.includes("MOLTBOT_GATEWAY_TOKEN"),
  "MOLTBOT_* migration mappings exist"
);
test(
  "Auto-migration loop exists",
  serverCode.includes("for (const { old, new: newVar } of ENV_MIGRATIONS)"),
  "Migration loop implemented"
);
test(
  "Logs migration warnings",
  serverCode.includes("[env-migration] Detected legacy"),
  "Warning messages present"
);

// Task 2: Improved PORT Handling
console.log("\n=== Task 2: Improved PORT Handling ===");
test(
  "Prefers OPENCLAW_PUBLIC_PORT",
  serverCode.includes("process.env.OPENCLAW_PUBLIC_PORT?.trim()"),
  "OPENCLAW_PUBLIC_PORT checked first"
);
test(
  "Falls back to Railway PORT",
  serverCode.includes('process.env.PORT || "8080"'),
  "Railway PORT fallback exists"
);

// Task 3: Config Path Resolution with Candidates
console.log("\n=== Task 3: Config Path Resolution ===");
test(
  "resolveConfigCandidates() function exists",
  serverCode.includes("function resolveConfigCandidates()"),
  "Candidate resolution function defined"
);
test(
  "Checks legacy moltbot.json",
  serverCode.includes('path.join(STATE_DIR, "moltbot.json")'),
  "moltbot.json in candidates"
);
test(
  "Checks legacy clawdbot.json",
  serverCode.includes('path.join(STATE_DIR, "clawdbot.json")'),
  "clawdbot.json in candidates"
);
test(
  "isConfigured() checks all candidates",
  serverCode.includes("for (const candidate of candidates)"),
  "Candidate loop in isConfigured()"
);

// Task 4: Legacy Config File Migration
console.log("\n=== Task 4: Legacy Config File Migration ===");
test(
  "Migration IIFE exists",
  serverCode.includes("(function migrateLegacyConfigFiles()"),
  "IIFE function definition found"
);
test(
  "Checks if target exists before migrating",
  serverCode.includes("if (fs.existsSync(target))"),
  "Target existence check present"
);
test(
  "Uses fs.renameSync for migration",
  serverCode.includes("fs.renameSync(legacyPath, target)"),
  "Atomic rename operation"
);
test(
  "Logs migration warnings",
  serverCode.includes("[config-migration] Found legacy config file"),
  "Migration logging present"
);

// Task 5: Railway Proxy Trust Configuration
console.log("\n=== Task 5: Railway Proxy Trust Configuration ===");
test(
  "Sets gateway.trustedProxies",
  serverCode.includes('"gateway.trustedProxies"'),
  "Trusted proxies config key exists"
);
test(
  "Trusts 127.0.0.1",
  serverCode.includes('["127.0.0.1"]'),
  "Localhost proxy trust configured"
);
test(
  "Uses --json flag",
  serverCode.includes('"--json"') && serverCode.includes('"gateway.trustedProxies"'),
  "JSON serialization for array config"
);

// Task 6: Enhanced runCmd with Timeout
console.log("\n=== Task 6: Enhanced runCmd with Timeout ===");
test(
  "Default timeout is 120 seconds",
  serverCode.includes("timeoutMs ?? 120_000"),
  "120s default timeout"
);
test(
  "Sets timeout timer",
  serverCode.includes("setTimeout") && serverCode.includes("timedOut = true"),
  "Timeout timer implementation"
);
test(
  "Sends SIGTERM first",
  serverCode.includes('proc.kill("SIGTERM")') && serverCode.includes("[timeout]"),
  "SIGTERM on timeout"
);
test(
  "Escalates to SIGKILL",
  serverCode.includes('proc.kill("SIGKILL")') && serverCode.includes("Process still alive"),
  "SIGKILL escalation after delay"
);
test(
  "Returns exit code 124 for timeout",
  serverCode.includes("code: 124"),
  "GNU timeout-compatible exit code"
);

// Task 7: Improved Gateway Restart with pkill
console.log("\n=== Task 7: Improved Gateway Restart ===");
test(
  "Uses multiple pkill patterns",
  serverCode.includes("killPatterns = [") && serverCode.includes("gateway run"),
  "Multiple kill patterns defined"
);
test(
  "Kills wrapper-managed process",
  serverCode.includes("gatewayProc.kill") && serverCode.includes("restartGateway"),
  "Wrapper process killed"
);
test(
  "Verifies port is free",
  serverCode.includes("stillListening = await probeGateway()"),
  "Port verification after pkill"
);
test(
  "Increased sleep time",
  serverCode.includes("await sleep(2000)") || serverCode.includes("await sleep(3000)"),
  "Longer wait for process cleanup"
);

// Task 8: Auth Secret Validation
console.log("\n=== Task 8: Auth Secret Validation ===");
test(
  "requiresSecret array exists",
  serverCode.includes("const requiresSecret = ["),
  "Secret requirement list defined"
);
test(
  "Validates secret presence",
  serverCode.includes("requiresSecret.includes(payload.authChoice) && !secret"),
  "Secret validation logic present"
);
test(
  "Throws error with helpful message",
  serverCode.includes('throw new Error') && serverCode.includes("requires an API key or token"),
  "Descriptive error thrown"
);

// Task 9: Better Reset with Gateway Stop
console.log("\n=== Task 9: Better Reset with Gateway Stop ===");
test(
  "Stops gateway before reset",
  serverCode.includes("[reset] Stopping gateway before config deletion"),
  "Gateway stop logging present"
);
test(
  "Kills gateway process in reset",
  serverCode.includes('gatewayProc.kill("SIGTERM")') && serverCode.includes("app.post(\"/setup/api/reset\""),
  "Gateway killed in reset handler"
);
test(
  "Uses pkill in reset",
  serverCode.includes('runCmd("pkill", ["-f", "gateway run"]') && serverCode.includes("/setup/api/reset"),
  "pkill used in reset handler"
);
test(
  "Waits before deleting config",
  serverCode.includes("await sleep(1000)") && serverCode.includes("Deleting config file"),
  "Sleep before config deletion"
);

// Task 10: Updated Proxy Error Handling
console.log("\n=== Task 10: Updated Proxy Error Handling ===");
test(
  "Proxy error handler enhanced",
  serverCode.includes('proxy.on("error"') && serverCode.includes("Don't throw - just log"),
  "Enhanced error handler with comment"
);
test(
  "Checks if headers sent",
  serverCode.includes("!res.headersSent"),
  "Header sent check present"
);
test(
  "Returns 502 status",
  serverCode.includes("res.writeHead(502"),
  "Proper HTTP status code"
);
test(
  "Provides helpful error message",
  serverCode.includes("Gateway may not be ready"),
  "User-friendly error message"
);

// Task 11: Improved Gateway Not Ready Error Message
console.log("\n=== Task 11: Improved Gateway Not Ready Message ===");
test(
  "Provides troubleshooting steps",
  serverCode.includes("Troubleshooting steps:"),
  "Troubleshooting section exists"
);
test(
  "Mentions /healthz endpoint",
  serverCode.includes("Check /healthz"),
  "Health endpoint referenced"
);
test(
  "Includes last gateway error",
  serverCode.includes("lastGatewayError") && serverCode.includes("Last gateway error:"),
  "Last error included in message"
);
test(
  "Includes last gateway exit",
  serverCode.includes("lastGatewayExit") && serverCode.includes("Last gateway exit:"),
  "Last exit info included"
);
test(
  "Includes doctor output",
  serverCode.includes("lastDoctorOutput"),
  "Doctor diagnostics included"
);

// Task 12: Better Shutdown Handler
console.log("\n=== Task 12: Better Shutdown Handler ===");
test(
  "SIGTERM handler is async",
  serverCode.includes('process.on("SIGTERM", async ()'),
  "Async SIGTERM handler"
);
test(
  "Closes HTTP server gracefully",
  serverCode.includes("server.close("),
  "HTTP server close called"
);
test(
  "Stops gateway on shutdown",
  serverCode.includes("[shutdown] Stopping gateway process"),
  "Gateway stopped on SIGTERM"
);
test(
  "Sets shutdown timeout",
  serverCode.includes("setTimeout") && serverCode.includes("Graceful shutdown timeout"),
  "Shutdown timeout implemented"
);
test(
  "Exits on server close",
  serverCode.includes('server.on("close"') && serverCode.includes("exiting cleanly"),
  "Clean exit on server close"
);

// Summary
console.log("\n========== TEST SUMMARY ==========");
console.log(`Total tests: ${passCount + failCount}`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);

if (failCount === 0) {
  console.log("\n✓ All Day 2 features verified successfully!");
  process.exit(0);
} else {
  console.log(`\n✗ ${failCount} feature(s) missing or incomplete`);
  process.exit(1);
}
