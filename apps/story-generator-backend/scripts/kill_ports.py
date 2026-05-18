"""Kill any processes occupying the story-generator dev ports (cross-platform)."""
from __future__ import annotations
import subprocess
import sys

PORTS = [8000, 5174]


def kill_port(port: int) -> None:
    """Kill all processes listening on *port*, silently ignoring errors."""
    if sys.platform == "win32":
        # netstat -ano lists all connections; filter for LISTENING on this port
        result = subprocess.run(
            ["netstat", "-ano"],
            capture_output=True,
            text=True,
        )
        pids: set[str] = set()
        for line in result.stdout.splitlines():
            parts = line.split()
            if len(parts) >= 5 and f":{port}" in parts[1] and parts[3] == "LISTENING":
                pids.add(parts[4])
        for pid in pids:
            subprocess.run(
                ["taskkill", "/F", "/PID", pid],
                capture_output=True,
            )
    else:
        # POSIX: lsof finds PIDs, xargs kill terminates them
        subprocess.run(
            f"lsof -ti:{port} | xargs kill -9 2>/dev/null; true",
            shell=True,
        )


if __name__ == "__main__":
    for port in PORTS:
        kill_port(port)
        print(f"  cleared port {port}")
