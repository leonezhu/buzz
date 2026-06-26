#!/usr/bin/env node

const { exec, execSync, spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

const pkg = require('../package.json');
const PLATFORM = os.platform();
const PID_FILE = path.join(os.tmpdir(), 'buzz.pid');
const JIGGLE_INTERVAL_MS = 30000; // 30s

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

const HELP = `🐝 buzz v${pkg.version} — zero dependencies, no admin required

Keep your screen awake by simulating input.

USAGE:
  buzz              Keep awake indefinitely (Ctrl+C to stop)
  buzz 20           Keep awake for 20 minutes
  buzz 1.5          Keep awake for 1.5 hours (90 min)
  buzz stop         Stop any running buzz
  buzz status       Check if buzz is running
  buzz help         Show this help

PLATFORMS:
  macOS     Uses 'caffeinate' (built-in, zero install)
  Windows   Uses PowerShell SendKeys (built-in, zero install)
  Linux     Uses xdotool (if available)

EXAMPLES:
  buzz 30           # Stay awake for 30 min
  buzz 2            # Stay awake for 2 hours
  buzz              # Stay awake until you Ctrl+C

TIPS:
  - Numbers >= 10 are treated as minutes
  - Numbers < 10 are treated as hours
  - No npm dependencies required!
`;

// ─── Helpers ───

function readPid() {
  try { return parseInt(fs.readFileSync(PID_FILE, 'utf8').trim()); }
  catch { return null; }
}

function writePid(pid) {
  fs.writeFileSync(PID_FILE, String(pid));
}

function removePid() {
  try { fs.unlinkSync(PID_FILE); } catch {}
}

function isRunning(pid) {
  try { process.kill(pid, 0); return true; }
  catch { return false; }
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function parseDuration(arg) {
  const num = parseFloat(arg);
  if (isNaN(num) || num <= 0) return null;
  // >= 10 → minutes, < 10 → hours
  return num >= 10
    ? num * 60 * 1000
    : num * 60 * 60 * 1000;
}

// ─── Platform-specific jiggler ───

/**
 * macOS: use built-in `caffeinate -i` 
 * Blocks idle sleep entirely — no mouse movement needed.
 * Zero install, zero admin, zero permissions.
 */
function startCaffeinate(durationMs) {
  const args = ['-i']; // -i = prevent idle sleep
  if (durationMs) {
    args.push('-t', String(Math.ceil(durationMs / 1000)));
  }
  const child = spawn('caffeinate', args, { stdio: 'ignore' });
  return child;
}

/**
 * Windows: use PowerShell SendKeys to press F15 every 30s.
 * F15 is harmless — no app binds to it.
 * Zero install, zero admin.
 */
function jiggleWindows() {
  // Single PowerShell invocation that loops every 30s
  const psScript = `
    $wsh = New-Object -ComObject WScript.Shell
    while ($true) {
      Start-Sleep -Seconds 30
      $wsh.SendKeys('{F15}')
    }
  `;
  // This runs as a detached child
  const child = spawn('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-Command', psScript
  ], { stdio: 'ignore', detached: true });
  child.unref();
  return child;
}

/**
 * Linux: xdotool — move mouse 1px
 */
function jiggleLinux() {
  exec('xdotool mousemove_relative 1 0', (err) => {
    if (err) {
      console.log('⚠️  xdotool not found. Install: sudo apt install xdotool');
      process.exit(1);
    }
    setTimeout(() => {
      exec('xdotool mousemove_relative -- -1 0');
    }, 100);
  });
}

// ─── Commands ───

function cmdStop() {
  const pid = readPid();
  if (!pid) {
    console.log('🐝 buzz is not running.');
    process.exit(0);
  }
  if (isRunning(pid)) {
    try { process.kill(pid, 'SIGTERM'); } catch {}
    setTimeout(() => {
      removePid();
      console.log('🐝 buzz stopped. Your screen can sleep now.');
      process.exit(0);
    }, 500);
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
  const existingPid = readPid();
  if (existingPid && isRunning(existingPid)) {
    console.log(`⚠️  buzz is already running (PID: ${existingPid}). Run 'buzz stop' first.`);
    process.exit(1);
  }

  writePid(process.pid);

  let stopped = false;
  let childProc = null;
  let jiggleTimer = null;

  const cleanup = () => {
    if (stopped) return;
    stopped = true;
    if (childProc) { try { childProc.kill(); } catch {} }
    if (jiggleTimer) clearInterval(jiggleTimer);
    removePid();
    console.log('\n🐝 buzz stopped. Your screen can sleep now. Bye! 👋');
    process.exit(0);
  };

  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
  process.on('exit', () => removePid());

  console.log(BEE);

  const platformLabel = PLATFORM === 'darwin' ? 'macOS caffeinate'
    : PLATFORM === 'win32' ? 'Windows SendKeys'
    : 'Linux xdotool';

  if (durationMs) {
    const mins = Math.round(durationMs / 60000);
    console.log(`🐝 buzz started! Keeping awake for ${mins} minutes.`);
  } else {
    console.log(`🐝 buzz started! Keeping awake indefinitely.`);
  }
  console.log(`   Engine: ${platformLabel}`);
  console.log(`   Press Ctrl+C to stop.\n`);

  const startTime = Date.now();
  let tickCount = 0;

  // ── macOS: just launch caffeinate and wait ──
  if (PLATFORM === 'darwin') {
    childProc = startCaffeinate(durationMs);
    
    // Status updates every 5 min
    jiggleTimer = setInterval(() => {
      if (stopped) return;
      tickCount++;
      const elapsed = Date.now() - startTime;
      const remaining = durationMs ? formatDuration(durationMs - elapsed) : '∞';
      console.log(`   🐝 tick #${tickCount} | elapsed: ${formatDuration(elapsed)} | remaining: ${remaining}`);
    }, 5 * 60 * 1000);

    if (durationMs) {
      setTimeout(() => {
        console.log(`\n✅ buzz finished! Kept awake for ${formatDuration(Date.now() - startTime)}.`);
        cleanup();
      }, durationMs + 500);
    }
    return;
  }

  // ── Windows: launch PowerShell jiggler ──
  if (PLATFORM === 'win32') {
    childProc = jiggleWindows();
    
    jiggleTimer = setInterval(() => {
      if (stopped) return;
      tickCount++;
      const elapsed = Date.now() - startTime;
      const remaining = durationMs ? formatDuration(durationMs - elapsed) : '∞';
      console.log(`   🐝 tick #${tickCount} | elapsed: ${formatDuration(elapsed)} | remaining: ${remaining}`);
    }, 5 * 60 * 1000);

    if (durationMs) {
      setTimeout(() => {
        console.log(`\n✅ buzz finished! Kept awake for ${formatDuration(Date.now() - startTime)}.`);
        cleanup();
      }, durationMs + 500);
    }
    return;
  }

  // ── Linux: xdotool jiggle loop ──
  jiggleLinux();
  jiggleTimer = setInterval(() => {
    if (stopped) return;
    tickCount++;
    jiggleLinux();
    const elapsed = Date.now() - startTime;
    if (durationMs && elapsed >= durationMs) {
      console.log(`\n✅ buzz finished! Kept awake for ${formatDuration(elapsed)}.`);
      cleanup();
      return;
    }
    if (tickCount % 10 === 0) {
      const remaining = durationMs ? formatDuration(durationMs - elapsed) : '∞';
      console.log(`   🐝 tick #${tickCount} | elapsed: ${formatDuration(elapsed)} | remaining: ${remaining}`);
    }
  }, JIGGLE_INTERVAL_MS);
}

// ─── Main ───

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    cmdRun(null);
    return;
  }

  const cmd = args[0].toLowerCase();

  switch (cmd) {
    case 'help': case '--help': case '-h':
      cmdHelp(); break;
    case 'stop':
      cmdStop(); break;
    case 'status':
      cmdStatus(); break;
    case 'version': case '--version': case '-v':
      console.log(`buzz v${pkg.version}`); process.exit(0); break;
    default:
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
