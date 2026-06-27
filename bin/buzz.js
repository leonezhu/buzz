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
  buzz 20           Keep awake for 20 minutes (default unit)
  buzz 2h           Keep awake for 2 hours
  buzz 30s          Keep awake for 30 seconds
  buzz 1.5h         Keep awake for 1.5 hours (90 min)
  buzz stop         Stop any running buzz
  buzz status       Check if buzz is running
  buzz help         Show this help

PLATFORMS:
  macOS     Uses 'caffeinate' (built-in, zero install)
  Windows   Uses SetThreadExecutionState + mouse jiggle (built-in, zero install)
  Linux     Uses xdotool (if available)

EXAMPLES:
  buzz 30           # 30 minutes
  buzz 2h           # 2 hours
  buzz 90           # 90 minutes
  buzz              # until Ctrl+C

TIPS:
  - Default unit is minutes: buzz 5 = 5 minutes
  - Suffixes: s (seconds), min (minutes), h (hours)
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
  // Formats: "20" = 20min, "2h" = 2h, "30s" = 30s, "5min" = 5min, "1.5h" = 90min
  const match = arg.match(/^(\d+(?:\.\d+)?)\s*(h|hour|hours|m|min|mins|minute|minutes|s|sec|secs|second|seconds)?$/i);
  if (!match) return null;

  const num = parseFloat(match[1]);
  if (isNaN(num) || num <= 0) return null;

  const unit = (match[2] || 'min').toLowerCase();

  if (unit.startsWith('h'))     return num * 60 * 60 * 1000;  // hours
  if (unit.startsWith('s'))     return num * 1000;             // seconds
  return num * 60 * 1000;                                      // minutes (default)
}

function humanDuration(ms) {
  if (ms < 60000) {
    const s = Math.round(ms / 1000);
    return `${s} second${s > 1 ? 's' : ''}`;
  }
  if (ms < 3600000) {
    const m = Math.round(ms / 60000);
    return `${m} minute${m > 1 ? 's' : ''}`;
  }
  const h = ms / 3600000;
  if (h === Math.floor(h)) return `${h} hour${h > 1 ? 's' : ''}`;
  // e.g. 90 min → show as "90 minutes" not "1.5 hours"
  const m = Math.round(ms / 60000);
  return `${m} minute${m > 1 ? 's' : ''}`;
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
 * Windows: triple strategy — SetThreadExecutionState + mouse jiggle + F15
 * 
 * Many corporate Windows policies ignore synthetic keystrokes (F15).
 * The robust approach is:
 *   1. SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED)
 *      — the official Windows API to prevent sleep (same as YouTube/PowerPoint do)
 *   2. Move mouse 1px via .NET Cursor.Position — universally recognized as "activity"
 *   3. F15 via SendKeys as backup
 * 
 * All via PowerShell — zero install, zero admin.
 */
function jiggleWindows() {
  const psScript = `
# 1. Load Windows Forms for mouse control
Add-Type -AssemblyName System.Windows.Forms

# 2. Call SetThreadExecutionState to prevent display sleep
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class PowerUtil {
    [DllImport("kernel32.dll")]
    public static extern uint SetThreadExecutionState(uint esFlags);
    
    public const uint ES_CONTINUOUS = 0x80000000;
    public const uint ES_SYSTEM_REQUIRED = 0x00000001;
    public const uint ES_DISPLAY_REQUIRED = 0x00000002;
}
"@

# Prevent display from turning off and system from sleeping
[PowerUtil]::SetThreadExecutionState(
    [PowerUtil]::ES_CONTINUOUS -bor [PowerUtil]::ES_SYSTEM_REQUIRED -bor [PowerUtil]::ES_DISPLAY_REQUIRED
)

# 3. Loop: jiggle mouse + press F15
$wsh = New-Object -ComObject WScript.Shell
while ($true) {
    Start-Sleep -Seconds 30
    
    # Move mouse 1px then back — most reliable "activity" signal
    $pos = [System.Windows.Forms.Cursor]::Position
    [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($pos.X + 1, $pos.Y)
    Start-Sleep -Milliseconds 50
    [System.Windows.Forms.Cursor]::Position = $pos
    
    # Also press F15 as backup
    try { $wsh.SendKeys('{F15}') } catch {}
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
    : PLATFORM === 'win32' ? 'Windows SetThreadExecutionState + Mouse'
    : 'Linux xdotool';

  if (durationMs) {
    console.log(`🐝 buzz started! Keeping awake for ${humanDuration(durationMs)}.`);
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
