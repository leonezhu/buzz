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
buzz 20           # Keep awake for 20 minutes
buzz 2            # Keep awake for 2 hours
buzz 1.5          # Keep awake for 1.5 hours (90 min)
buzz stop         # Stop any running buzz
buzz status       # Check if buzz is running
buzz help         # Show help
```

## How It Works

| Platform | Method | Install needed? | Admin needed? |
|----------|--------|:---------------:|:-------------:|
| **macOS** | `caffeinate -i` (built-in) | ❌ | ❌ |
| **Windows** | PowerShell `SendKeys F15` (built-in) | ❌ | ❌ |
| **Linux** | `xdotool` (pre-installed on most distros) | maybe | ❌ |

- **macOS**: Uses Apple's built-in `caffeinate` — not even a mouse jiggle, just cleanly blocks idle sleep.
- **Windows**: Presses F15 every 30 seconds via PowerShell. No app binds to F15, so it's completely harmless.
- **Linux**: Moves mouse 1px via `xdotool`.

## Duration Format

| Input | Meaning |
|-------|---------|
| `buzz 30` | 30 **minutes** (numbers ≥ 10 = minutes) |
| `buzz 5` | 5 **hours** (numbers < 10 = hours) |
| `buzz 0.5` | 0.5 hours = 30 minutes |
| `buzz 1.5` | 1.5 hours = 90 minutes |

## Why buzz?

- **Zero dependencies** — `package.json` has no `dependencies` field. Nothing to break.
- **No admin required** — perfect for locked-down corporate laptops.
- **Cross-platform** — macOS, Windows, Linux all supported out of the box.
- **Clean exit** — `buzz stop` from any terminal kills the running instance.

## Examples

```bash
# Weekend crunch time
buzz 3             # 3 hours of uninterrupted focus

# Quick meeting
buzz 30            # 30 minutes

# Background build running
buzz &             # indefinite, then 'buzz stop' when done
```

## License

MIT © [leonezhu](https://github.com/leonezhu)
