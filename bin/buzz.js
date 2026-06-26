#!/usr/bin/env node

const robot = require('robotjs');
const pkg = require('../package.json');

const BEE = `
  \\
   \\___
  (• • )
   > ^ <
  /|   |\\
   |   |
  [_] [_]
  BUZZ!
`;

const HELP = `🐝 buzz v${pkg.version}

Keep your screen awake by jiggling the mouse.

USAGE:
  buzz              Keep awake indefinitely (Ctrl+C to stop)
  buzz 20           Keep awake for 20 minutes
  buzz 1.5          Keep awake for 1.5 hours (= 90 minutes)
  buzz stop         Stop any running buzz
  buzz status       Check if buzz is running
  buzz help         Show this help

EXAMPLES:
  buzz 30           # Stay awake for 30 min
  buzz 2            # Stay awake for 2 hours
  buzz              # Stay awake until you Ctrl+C

TIPS:
  - Mouse moves 1px every 30 seconds (unnoticeable)
  - Press Ctrl+C to stop early
  - buzz 0 or negative values are ignored
`;

const PID_FILE = require('path').join(require('os').tmpdir(), 'buzz.pid');
const INTERVAL_MS = 30000; // 30 seconds

// --- Helpers ---

function readPid() {
  try {
    const fs = require('fs');
    return parseInt(fs.readFileSync(PID_FILE, 'utf8').trim());
  } catch {
    return null;
  }
}

function writePid(pid) {
  const fs = require('fs');
  fs.writeFileSync(PID_FILE, String(pid));
}

function removePid() {
  try {
    const fs = require('fs');
    fs.unlinkSync(PID_FILE);
  } catch {}
}

function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function parseDuration(arg) {
  // Accept: "20" = 20 minutes, "1.5" = 1.5 hours
  const num = parseFloat(arg);
  if (isNaN(num) || num <= 0) return null;

  // If number >= 10, treat as minutes (buzz 20 = 20 min)
  // If number < 10, treat as hours (buzz 2 = 2 hours, buzz 0.5 = 30 min)
  // This is intuitive: small numbers = hours, big numbers = minutes
  if (num >= 10) {
    return num * 60 * 1000; // minutes → ms
  } else {
    return num * 60 * 60 * 1000; // hours → ms
  }
}

// --- Commands ---

function cmdStop() {
  const pid = readPid();
  if (!pid) {
    console.log('🐝 buzz is not running.');
    process.exit(0);
  }
  if (isRunning(pid)) {
    try {
      process.kill(pid, 'SIGTERM');
      // Give it a moment
      setTimeout(() => {
        removePid();
        console.log('🐝 buzz stopped. Your screen can sleep now.');
        process.exit(0);
      }, 500);
    } catch {
      removePid();
      console.log('🐝 buzz was not running (cleaned up stale PID).');
      process.exit(0);
    }
  } else {
    removePid();
    console.log('🐝 buzz was not running (cleaned up stale PID).');
    process.exit(0);
  }
}

function cmdStatus() {
  const pid = readPid();
  if (pid && isRunning(pid)) {
    console.log(`🐝 buzz is running (PID: ${pid})`);
  } else {
    if (pid) removePid();
    console.log('🐝 buzz is not running.');
  }
  process.exit(0);
}

function cmdHelp() {
  console.log(HELP);
  process.exit(0);
}

function cmdRun(durationMs) {
  // Check if already running
  const existingPid = readPid();
  if (existingPid && isRunning(existingPid)) {
    console.log(`⚠️  buzz is already running (PID: ${existingPid}). Run 'buzz stop' first.`);
    process.exit(1);
  }

  // Write our PID
  writePid(process.pid);

  // Handle stop signal
  let stopped = false;
  const cleanup = () => {
    if (stopped) return;
    stopped = true;
    removePid();
    console.log('\n🐝 buzz stopped. Your screen can sleep now. Bye! 👋');
    process.exit(0);
  };
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
  process.on('exit', () => {
    removePid();
  });

  console.log(BEE);
  if (durationMs) {
    const mins = Math.round(durationMs / 60000);
    console.log(`🐝 buzz started! Keeping awake for ${mins} minutes.`);
    console.log(`   Mouse will jiggle every 30 seconds.`);
    console.log(`   Press Ctrl+C to stop early.\n`);
  } else {
    console.log(`🐝 buzz started! Keeping awake indefinitely.`);
    console.log(`   Mouse will jiggle every 30 seconds.`);
    console.log(`   Press Ctrl+C to stop.\n`);
  }

  const startTime = Date.now();
  let jiggleCount = 0;

  function jiggle() {
    if (stopped) return;

    const elapsed = Date.now() - startTime;
    if (durationMs && elapsed >= durationMs) {
      console.log(`\n✅ buzz finished! Kept awake for ${formatDuration(elapsed)}.`);
      cleanup();
      return;
    }

    // Move mouse 1px right, then back
    const mouse = robot.getMousePos();
    robot.moveMouse(mouse.x + 1, mouse.y);
    setTimeout(() => {
      if (stopped) return;
      robot.moveMouse(mouse.x, mouse.y);
    }, 100);

    jiggleCount++;

    // Print status every 10 jiggles (~5 min)
    if (jiggleCount % 10 === 0) {
      const remaining = durationMs ? formatDuration(durationMs - elapsed) : '∞';
      console.log(`   🐝 jiggle #${jiggleCount} | elapsed: ${formatDuration(elapsed)} | remaining: ${remaining}`);
    }
  }

  // Initial jiggle
  jiggle();

  // Schedule regular jiggles
  const timer = setInterval(jiggle, INTERVAL_MS);

  // If duration set, ensure we stop on time
  if (durationMs) {
    setTimeout(() => {
      clearInterval(timer);
      const elapsed = Date.now() - startTime;
      console.log(`\n✅ buzz finished! Kept awake for ${formatDuration(elapsed)}.`);
      cleanup();
    }, durationMs + 1000);
  }
}

// --- Main ---

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // buzz (no args) = run indefinitely
    cmdRun(null);
    return;
  }

  const cmd = args[0].toLowerCase();

  switch (cmd) {
    case 'help':
    case '--help':
    case '-h':
      cmdHelp();
      break;
    case 'stop':
      cmdStop();
      break;
    case 'status':
      cmdStatus();
      break;
    case 'version':
    case '--version':
    case '-v':
      console.log(`buzz v${pkg.version}`);
      process.exit(0);
      break;
    default:
      // Try to parse as duration
      const durationMs = parseDuration(args[0]);
      if (durationMs === null) {
        console.log(`Unknown command: "${args[0]}"\n`);
        cmdHelp();
        process.exit(1);
      }
      cmdRun(durationMs);
  }
}

main();
