#!/usr/bin/env python3
"""
Smart Pantry - Startup Script
Starts both FastAPI backend and Streamlit frontend together.
"""

import subprocess
import sys
import time
import signal
import os
from pathlib import Path

# Colors for terminal output
class Colors:
    GREEN = '\033[0;32m'
    BLUE = '\033[0;34m'
    YELLOW = '\033[1;33m'
    RED = '\033[0;31m'
    NC = '\033[0m'  # No Color

def print_colored(message: str, color: str = Colors.NC):
    """Print colored message."""
    print(f"{color}{message}{Colors.NC}")

def check_port(port: int) -> bool:
    """Check if a port is already in use."""
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

def kill_port(port: int) -> bool:
    """Kill process using a port."""
    try:
        if sys.platform == "win32":
            result = subprocess.run(
                ["netstat", "-ano"], 
                capture_output=True, 
                text=True
            )
            for line in result.stdout.split('\n'):
                if f':{port}' in line and 'LISTENING' in line:
                    pid = line.split()[-1]
                    subprocess.run(["taskkill", "/F", "/PID", pid], 
                                 capture_output=True)
                    return True
        else:
            result = subprocess.run(
                ["lsof", "-ti", f":{port}"],
                capture_output=True,
                text=True
            )
            if result.returncode == 0 and result.stdout.strip():
                pids = result.stdout.strip().split('\n')
                for pid in pids:
                    subprocess.run(["kill", "-9", pid], 
                                 capture_output=True)
                return True
    except Exception:
        pass
    return False

def main():
    """Main function to start both servers."""
    # Change to script directory
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    print_colored("🚀 Starting Smart Pantry Application...", Colors.BLUE)
    print()
    
    # Check ports
    if check_port(8000):
        print_colored("⚠️  Port 8000 is already in use (API server may be running)", Colors.YELLOW)
        response = input("   Kill existing process? (y/n): ").strip().lower()
        if response == 'y':
            if kill_port(8000):
                print_colored("   ✅ Killed process on port 8000", Colors.GREEN)
                time.sleep(1)
            else:
                print_colored("   ❌ Could not kill process", Colors.RED)
                sys.exit(1)
        else:
            print("   Exiting. Please stop the existing server first.")
            sys.exit(1)
    
    if check_port(8501):
        print_colored("⚠️  Port 8501 is already in use (Streamlit may be running)", Colors.YELLOW)
        response = input("   Kill existing process? (y/n): ").strip().lower()
        if response == 'y':
            if kill_port(8501):
                print_colored("   ✅ Killed process on port 8501", Colors.GREEN)
                time.sleep(1)
            else:
                print_colored("   ❌ Could not kill process", Colors.RED)
                sys.exit(1)
        else:
            print("   Exiting. Please stop the existing server first.")
            sys.exit(1)
    
    # Create logs directory
    logs_dir = script_dir / "logs"
    logs_dir.mkdir(exist_ok=True)
    
    processes = []
    
    def cleanup(signum=None, frame=None):
        """Cleanup function to stop all processes."""
        print()
        print_colored("🛑 Shutting down servers...", Colors.YELLOW)
        for proc in processes:
            try:
                proc.terminate()
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
            except Exception:
                pass
        print_colored("✅ Servers stopped", Colors.GREEN)
        sys.exit(0)
    
    # Register signal handlers
    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)
    
    # Start FastAPI server
    print_colored("📡 Starting FastAPI backend on http://localhost:8000", Colors.BLUE)
    api_log = open(logs_dir / "api.log", "w")
    api_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "api.main:app", 
         "--host", "0.0.0.0", "--port", "8000", "--reload"],
        stdout=api_log,
        stderr=api_log,
        cwd=script_dir
    )
    processes.append(api_proc)
    
    # Wait for API to start
    time.sleep(2)
    
    if api_proc.poll() is not None:
        print_colored("❌ Failed to start API server", Colors.RED)
        api_log.close()
        with open(logs_dir / "api.log", "r") as f:
            print(f.read())
        sys.exit(1)
    
    # Start Streamlit dashboard
    print_colored("🎨 Starting Streamlit dashboard on http://localhost:8501", Colors.BLUE)
    streamlit_log = open(logs_dir / "streamlit.log", "w")
    streamlit_proc = subprocess.Popen(
        [sys.executable, "-m", "streamlit", "run", "dashboard/app.py"],
        stdout=streamlit_log,
        stderr=streamlit_log,
        cwd=script_dir
    )
    processes.append(streamlit_proc)
    
    # Wait for Streamlit to start
    time.sleep(3)
    
    if streamlit_proc.poll() is not None:
        print_colored("❌ Failed to start Streamlit", Colors.RED)
        streamlit_log.close()
        with open(logs_dir / "streamlit.log", "r") as f:
            print(f.read())
        cleanup()
        sys.exit(1)
    
    print()
    print_colored("✅ Both servers started successfully!", Colors.GREEN)
    print()
    print_colored("📍 Access points:", Colors.BLUE)
    print_colored("   API:      http://localhost:8000", Colors.GREEN)
    print_colored("   API Docs: http://localhost:8000/docs", Colors.GREEN)
    print_colored("   Dashboard: http://localhost:8501", Colors.GREEN)
    print()
    print_colored("📝 Logs:", Colors.YELLOW)
    print(f"   API:      {logs_dir / 'api.log'}")
    print(f"   Streamlit: {logs_dir / 'streamlit.log'}")
    print()
    print_colored("Press Ctrl+C to stop both servers", Colors.YELLOW)
    print()
    
    # Wait for processes to finish
    try:
        while True:
            # Check if processes are still running
            for proc in processes:
                if proc.poll() is not None:
                    print_colored(f"⚠️  Process {proc.pid} exited unexpectedly", Colors.YELLOW)
                    cleanup()
            time.sleep(1)
    except KeyboardInterrupt:
        cleanup()

if __name__ == "__main__":
    main()

