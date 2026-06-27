# 🐝 buzz

> Keep your screen awake — **zero dependencies, no admin required**.

Tired of your screen locking during long builds, meetings, or deployments? `buzz` keeps your screen awake using built-in OS tools. No native modules, no admin access, no permissions to grant.

## Install

```bash
npm install -g @xiaoxionga/buzz
```

## Usage

```bash
buzz              # Keep awake indefinitely (Ctrl+C to stop)
buzz 20           # 20 minutes (default unit)
buzz 2h           # 2 hours
buzz 30s          # 30 seconds
buzz 1.5h         # 90 minutes
buzz stop         # Stop any running buzz
buzz status       # Check if buzz is running
buzz help         # Show help
```

## Duration Format

Default unit is **minutes**. Add a suffix to override:

| Input | Meaning |
|-------|---------|
| `buzz 30` | 30 **minutes** |
| `buzz 5min` | 5 **minutes** |
| `buzz 2h` | 2 **hours** |
| `buzz 1.5h` | 1.5 hours = 90 minutes |
| `buzz 30s` | 30 **seconds** |
| `buzz` | ∞ (until Ctrl+C) |

## How It Works

| Platform | Method | Install needed? | Admin needed? | EDR Safe? |
|----------|--------|:---------------:|:-------------:|:---------:|
| **macOS** | `caffeinate -i` (built-in) | ❌ | ❌ | ✅ |
| **Windows** | `SendKeys F15` (built-in, minimal) | ❌ | ❌ | ✅ |
| **Linux** | `xdotool` (pre-installed) | maybe | ❌ | ✅ |

### Corporate Safety (Windows)

buzz deliberately uses **only** the most benign method on Windows (`WScript.Shell.SendKeys('{F15}')`) to avoid triggering corporate security software (EDR/DLP/antivirus). It does **NOT** use:

- ❌ `Add-Type` + `DllImport` — flagged as malware technique by CrowdStrike/Defender
- ❌ `SetThreadExecutionState` via PowerShell — P/Invoke into kernel32.dll triggers EDR
- ❌ Automated mouse movement — flagged as keylogger behavior

**If corporate GPO still locks your screen**: buzz can't override hard GPO policies. Use a **hardware Mouse Jiggler** instead — a USB device (~¥15 on Taobao) that physically simulates mouse movement. Zero software footprint, zero EDR detection risk.

## Why buzz?

- **Zero dependencies** — nothing to break, nothing to audit
- **No admin required** — perfect for locked-down corporate laptops
- **EDR-safe** — no suspicious API calls or DLL imports
- **Cross-platform** — macOS, Windows, Linux all supported

## Examples

```bash
# Weekend crunch time
buzz 3h            # 3 hours of uninterrupted focus

# Quick meeting
buzz 30            # 30 minutes

# Background build running
buzz &             # indefinite, then 'buzz stop' when done
```

## License

MIT © [leonezhu](https://github.com/leonezhu)
