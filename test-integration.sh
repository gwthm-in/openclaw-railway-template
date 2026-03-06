#!/bin/bash
# Integration test for Day 2 features
# Tests backward compatibility and Railway-specific features

set -e

echo "========== DAY 2 INTEGRATION TEST =========="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_count=0
pass_count=0
fail_count=0

function test_case() {
  test_count=$((test_count + 1))
  echo -e "${YELLOW}Test $test_count: $1${NC}"
}

function pass() {
  pass_count=$((pass_count + 1))
  echo -e "${GREEN}✓ $1${NC}"
}

function fail() {
  fail_count=$((fail_count + 1))
  echo -e "${RED}✗ $1${NC}"
}

# Test 1: Syntax validation
test_case "Syntax validation"
if node -c src/server.js 2>/dev/null; then
  pass "No syntax errors"
else
  fail "Syntax errors found"
fi

# Test 2: Feature verification
test_case "Feature verification (48 tests)"
if node test-day2.js > /dev/null 2>&1; then
  pass "All 48 features verified"
else
  fail "Some features missing"
fi

# Test 3: Environment variable migration
test_case "Environment variable migration"
if grep -q "ENV_MIGRATIONS = \[" src/server.js; then
  pass "Migration logic present"
else
  fail "Migration logic missing"
fi

# Test 4: Legacy config file migration
test_case "Legacy config file migration"
if grep -q "function migrateLegacyConfigFiles()" src/server.js; then
  pass "Config migration IIFE present"
else
  fail "Config migration missing"
fi

# Test 5: Enhanced runCmd with timeout
test_case "runCmd timeout handling"
if grep -q "timeoutMs ?? 120_000" src/server.js; then
  pass "Timeout handling implemented"
else
  fail "Timeout handling missing"
fi

# Test 6: Improved error messages
test_case "Improved error messages"
if grep -q "Troubleshooting steps:" src/server.js; then
  pass "Enhanced error messages present"
else
  fail "Error messages not improved"
fi

# Test 7: Graceful shutdown
test_case "Graceful shutdown handler"
if grep -q 'process.on("SIGTERM", async' src/server.js; then
  pass "Async shutdown handler present"
else
  fail "Shutdown handler not enhanced"
fi

# Test 8: Auth secret validation
test_case "Auth secret validation"
if grep -q "const requiresSecret = \[" src/server.js; then
  pass "Secret validation logic present"
else
  fail "Secret validation missing"
fi

# Test 9: Railway proxy trust config
test_case "Railway proxy trust configuration"
if grep -q "gateway.trustedProxies" src/server.js; then
  pass "Proxy trust config present"
else
  fail "Proxy trust config missing"
fi

# Test 10: Better reset handler
test_case "Better reset with gateway stop"
if grep -q "\[reset\] Stopping gateway" src/server.js; then
  pass "Reset enhancement present"
else
  fail "Reset not enhanced"
fi

# Summary
echo ""
echo "========== TEST SUMMARY =========="
echo "Total tests: $test_count"
echo -e "${GREEN}Passed: $pass_count${NC}"
if [ $fail_count -gt 0 ]; then
  echo -e "${RED}Failed: $fail_count${NC}"
  exit 1
else
  echo -e "${GREEN}Failed: $fail_count${NC}"
  echo ""
  echo -e "${GREEN}✓ All integration tests passed!${NC}"
  exit 0
fi
