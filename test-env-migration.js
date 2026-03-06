#!/usr/bin/env node
/**
 * Test environment variable migration (backward compatibility)
 * This verifies that legacy CLAWDBOT_* and MOLTBOT_* env vars are migrated to OPENCLAW_*
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log("========== ENVIRONMENT VARIABLE MIGRATION TEST ==========\n");

async function testEnvMigration(envVars, expectedOutputs) {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", ["-e", `
      // Set test env vars
      ${Object.entries(envVars).map(([k, v]) => `process.env.${k} = "${v}";`).join("\n      ")}
      
      // Import server (triggers migration)
      import("${path.join(__dirname, "src", "server.js").replace(/\\/g, "/")}").catch(err => {
        // Server will fail to start (no deps), but migration runs first
        console.log("SERVER_IMPORT_ERROR:", err.message);
      });
    `], {
      env: { ...process.env, ...envVars },
    });

    let output = "";
    proc.stdout?.on("data", (d) => (output += d.toString()));
    proc.stderr?.on("data", (d) => (output += d.toString()));

    proc.on("close", () => {
      const results = expectedOutputs.map((expected) => {
        const found = output.includes(expected);
        return { expected, found };
      });
      resolve({ output, results });
    });

    proc.on("error", reject);
  });
}

// Test 1: CLAWDBOT_PUBLIC_PORT migration
console.log("Test 1: CLAWDBOT_PUBLIC_PORT → OPENCLAW_PUBLIC_PORT");
const test1 = await testEnvMigration(
  { CLAWDBOT_PUBLIC_PORT: "9999" },
  ["[env-migration] Detected legacy CLAWDBOT_PUBLIC_PORT"]
);
console.log(test1.results[0].found ? "✓ Migration warning logged" : "✗ No migration warning");

// Test 2: MOLTBOT_STATE_DIR migration
console.log("\nTest 2: MOLTBOT_STATE_DIR → OPENCLAW_STATE_DIR");
const test2 = await testEnvMigration(
  { MOLTBOT_STATE_DIR: "/tmp/moltbot-test" },
  ["[env-migration] Detected legacy MOLTBOT_STATE_DIR"]
);
console.log(test2.results[0].found ? "✓ Migration warning logged" : "✗ No migration warning");

// Test 3: Multiple legacy vars
console.log("\nTest 3: Multiple legacy variables");
const test3 = await testEnvMigration(
  { 
    CLAWDBOT_WORKSPACE_DIR: "/tmp/claw-workspace",
    MOLTBOT_GATEWAY_TOKEN: "test-token-123",
  },
  [
    "[env-migration] Detected legacy CLAWDBOT_WORKSPACE_DIR",
    "[env-migration] Detected legacy MOLTBOT_GATEWAY_TOKEN",
  ]
);
console.log(test3.results[0].found ? "✓ CLAWDBOT_WORKSPACE_DIR migrated" : "✗ Migration failed");
console.log(test3.results[1].found ? "✓ MOLTBOT_GATEWAY_TOKEN migrated" : "✗ Migration failed");

// Test 4: New vars take precedence (no migration if OPENCLAW_* already set)
console.log("\nTest 4: OPENCLAW_* vars take precedence over legacy");
const test4 = await testEnvMigration(
  { 
    OPENCLAW_STATE_DIR: "/data/.openclaw",
    CLAWDBOT_STATE_DIR: "/tmp/old-claw",
  },
  ["[env-migration] Detected legacy CLAWDBOT_STATE_DIR"]
);
console.log(!test4.results[0].found ? "✓ No migration when OPENCLAW_* already set" : "✗ Unexpected migration");

console.log("\n========== TEST COMPLETE ==========");
console.log("\nNote: Server import errors are expected (missing deps in test environment)");
console.log("Migration logic runs before server initialization, so we can verify it works.\n");
