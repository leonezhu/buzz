# 🐝 buzz

Keep your screen awake by jiggling the mouse.

## Install

```bash
# Global install (from source)
cd buzz
npm install -g .

# Or link for development
npm link
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

## How it works

Moves your mouse 1 pixel every 30 seconds — unnoticeable but enough to prevent screen sleep.

## Tips

- Numbers ≥ 10 are treated as **minutes** (`buzz 30` = 30 min)
- Numbers < 10 are treated as **hours** (`buzz 2` = 2 hours)
- `buzz stop` can kill a background buzz from another terminal
- PID file stored at `$TMPDIR/buzz.pid`

## License

MIT
