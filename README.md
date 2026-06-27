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

| Platform | Method | Install needed? | Admin needed? |
|----------|--------|:---------------:|:-------------:|
| **macOS** | `caffeinate -i` (built-in) | ❌ | ❌ |
| **Windows** | `SetThreadExecutionState` + mouse jiggle (built-in) | ❌ | ❌ |
| **Linux** | `xdotool` (pre-installed on most distros) | maybe | ❌ |

- **macOS**: Uses Apple's built-in `caffeinate` — not even a mouse jiggle, just cleanly blocks idle sleep.
- **Windows**: Triple strategy — `SetThreadExecutionState` (official Windows API, same as YouTube/PowerPoint use to prevent screen sleep) + mouse jiggle 1px every 30s + F15 keystroke as backup. Corporate lock screen policies that ignore synthetic keystrokes are handled by the real mouse movement.
- **Linux**: Moves mouse 1px via `xdotool`.

## Why buzz?

- **Zero dependencies** — `package.json` has no `dependencies` field. Nothing to break.
- **No admin required** — perfect for locked-down corporate laptops.
- **Cross-platform** — macOS, Windows, Linux all supported out of the box.
- **Clean exit** — `buzz stop` from any terminal kills the running instance.

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
