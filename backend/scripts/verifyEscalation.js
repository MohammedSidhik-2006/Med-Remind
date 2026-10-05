// Verify the IST→UTC conversion fix for escalation timing
// Run: node scripts/verifyEscalation.js

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Test case: Reminder sent at 10:30 IST, current time is 10:36 IST
// Expected diffMinutes: 6 (>= 5, so escalation should fire)

const sentDate = "2026-10-05";
const sentTime = "10:30";
const [year, month, day] = sentDate.split("-").map(Number);
const [hour, minute] = sentTime.split(":").map(Number);

// NEW FIX: Simple IST→UTC
const sentTime_ms = Date.UTC(year, month - 1, day, hour, minute) - IST_OFFSET_MS;

// Simulate current time as 10:36 IST = 05:06 UTC
const simulatedNow = Date.UTC(2026, 9, 5, 5, 6, 0); // 05:06 UTC = 10:36 IST

const diffMinutes = Math.floor((simulatedNow - sentTime_ms) / (1000 * 60));

console.log("=== Escalation Timing Verification ===");
console.log(`Sent time (IST): ${sentTime}`);
console.log(`Sent time → UTC ms: ${new Date(sentTime_ms).toISOString()}`);
console.log(`Expected UTC: 2026-10-05T05:00:00.000Z`);
console.log(`Current time (UTC): ${new Date(simulatedNow).toISOString()}`);
console.log(`diffMinutes: ${diffMinutes}`);
console.log(`Escalation should fire (>= 5): ${diffMinutes >= 5 ? "✅ YES" : "❌ NO"}`);
console.log();

// Test 2: Too early (only 3 minutes elapsed)
const earlyNow = Date.UTC(2026, 9, 5, 5, 3, 0); // 05:03 UTC = 10:33 IST
const earlyDiff = Math.floor((earlyNow - sentTime_ms) / (1000 * 60));
console.log(`Test 2 - 3 min elapsed: diffMinutes=${earlyDiff}, should skip: ${earlyDiff < 5 ? "✅ CORRECT" : "❌ WRONG"}`);

// Test 3: Midnight edge case - 23:55 IST → 00:05 IST next day
const midnightSent = Date.UTC(2026, 9, 5, 23, 55) - IST_OFFSET_MS;
const midnightNow = Date.UTC(2026, 9, 5, 18, 36, 0); // 18:36 UTC = 00:06 IST (Oct 6)
const midnightDiff = Math.floor((midnightNow - midnightSent) / (1000 * 60));
console.log(`Test 3 - Midnight: sent=23:55 IST, now=00:06 IST(next day), diff=${midnightDiff}min, should fire: ${midnightDiff >= 5 ? "✅ YES" : "❌ NO"}`);

// OLD BUG COMPARISON: What the old createDateInTZ produced
const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
// Old formula: utcDate.getTime() - tzOffsetMS where tzOffsetMS = utcDate - IST_representation_as_UTC
// For IST+5:30, tzOffsetMS = -19800000
// Old result: utcDate + 19800000 = 10:30Z + 5:30 = 16:00Z
const oldSentTime_ms = utcDate.getTime() + IST_OFFSET_MS; // This is what the old code produced
const oldDiff = Math.floor((simulatedNow - oldSentTime_ms) / (1000 * 60));
console.log();
console.log("=== OLD BUG COMPARISON ===");
console.log(`Old formula sent time (UTC): ${new Date(oldSentTime_ms).toISOString()}`);
console.log(`Old diffMinutes: ${oldDiff} (${oldDiff < 0 ? "NEGATIVE — escalation never fires!" : ""})`);
