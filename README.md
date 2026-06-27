# 🐝 buzz

> Keep your screen awake — **zero dependencies, no admin required**.

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

| Input | Meaning |
|-------|---------|
| `buzz 30` | 30 **minutes** |
| `buzz 5min` | 5 **minutes** |
| `buzz 2h` | 2 **hours** |
| `buzz 1.5h` | 1.5 hours = 90 minutes |
| `buzz 30s` | 30 **seconds** |
| `buzz` | ∞ (until Ctrl+C) |

## How It Works

| Platform | Method | Admin? | EDR Safe? |
|----------|--------|:------:|:---------:|
| **macOS** | `caffeinate -i` (built-in) | ❌ | ✅ |
| **Windows** (with Java) | `java.awt.Robot` mouse jiggle | ❌ | ✅ |
| **Windows** (no Java) | `SendKeys F15` fallback | ❌ | ✅ |
| **Linux** | `xdotool` | ❌ | ✅ |

### Why Java Robot on Windows?

PowerShell-based mouse movement (`DllImport` / `SetThreadExecutionState`) triggers EDR alerts on corporate machines — it looks like malware. Java's `Robot` class goes through JVM → JNI → OS, which EDR sees as a **normal application** doing normal things. If you have Java installed (most dev machines do), buzz will auto-detect and use it.

If no Java is found, buzz falls back to `SendKeys F15` (benign keystroke, but may not override strict GPO policies).

## Why buzz?

- **Zero npm dependencies** — nothing to break, nothing to audit
- **No admin required** — perfect for locked-down corporate laptops
- **EDR-safe** — no suspicious API calls
- **Auto-detects best engine** — Java Robot > F15 fallback

## Examples

```bash
buzz 3h            # 3 hours
buzz 30            # 30 minutes
buzz &             # background, then 'buzz stop' when done
```

## License

MIT © [leonezhu](https://github.com/leonezhu)
