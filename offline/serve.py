#!/usr/bin/env python3
"""Runs Shoresh on this Mac: a small web server for the app folder that only
this computer can reach (http://localhost:8790/).

Double-click start_shoresh.command rather than running this directly. Stop it
with stop_shoresh.command, Ctrl+C, or by closing its window.

Progress is saved in the browser and, through this server, in the progress
folder next to this file (plus one copy per day in progress/backups).
Needs only Python 3.9+ and its standard library.
"""

import argparse
import datetime
import http.server
import json
import os
import shutil
import socket
import socketserver
import sys
import threading
import time
import urllib.request
import webbrowser
from functools import partial

VERSION = "dev"  # set by scripts/package-offline.mjs
HOST = "127.0.0.1"
PORTS = range(8790, 8800)
HERE = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(HERE, "app")
PROGRESS_DIR = os.path.join(HERE, "progress")
PROGRESS_FILE = os.path.join(PROGRESS_DIR, "shoresh-progress.json")
BACKUP_DIR = os.path.join(PROGRESS_DIR, "backups")
KEEP_BACKUPS = 30
MAX_BODY = 50 * 1024 * 1024

save_lock = threading.Lock()
# Talk to other running copies directly, never through a configured proxy.
direct = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def call(port, path, method="GET"):
    req = urllib.request.Request(
        "http://%s:%d%s" % (HOST, port, path),
        data=b"" if method == "POST" else None,
        headers={"X-Shoresh": "1"},
        method=method,
    )
    with direct.open(req, timeout=2) as res:
        return res.read()


def port_busy(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((HOST, port)) == 0


def is_shoresh(port):
    try:
        return json.loads(call(port, "/__shoresh/info").decode("utf-8")).get("app") == "shoresh"
    except Exception:
        return False


def stop_running():
    """Asks every running Shoresh to quit. Returns how many there were."""
    count = 0
    for port in PORTS:
        if not port_busy(port) or not is_shoresh(port):
            continue
        count += 1
        try:
            call(port, "/__shoresh/quit", method="POST")
        except Exception:
            pass
        for _ in range(50):
            if not port_busy(port):
                break
            time.sleep(0.1)
    return count


def backup_today():
    """Keeps the progress as it was before the first save of each day."""
    if not os.path.exists(PROGRESS_FILE):
        return
    os.makedirs(BACKUP_DIR, exist_ok=True)
    target = os.path.join(BACKUP_DIR, "shoresh-progress-%s.json" % datetime.date.today().isoformat())
    if os.path.exists(target):
        return
    shutil.copy2(PROGRESS_FILE, target)
    old = sorted(f for f in os.listdir(BACKUP_DIR) if f.startswith("shoresh-progress-"))
    for name in old[:-KEEP_BACKUPS]:
        os.remove(os.path.join(BACKUP_DIR, name))


class Handler(http.server.SimpleHTTPRequestHandler):
    server_version = "Shoresh"
    sys_version = ""
    # Explicit types: a browser refuses module scripts served as text/plain.
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".json": "application/json",
        ".webmanifest": "application/manifest+json",
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
    }

    def log_message(self, format, *args):  # keep the window quiet
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def list_directory(self, path):  # no folder listings
        self.send_error(404)
        return None

    # Only pages from this server may use it: the Host check stops other
    # websites reaching it by DNS tricks, and the custom header (which other
    # websites can't send without permission) stops them saving or quitting.
    def host_ok(self):
        port = self.server.server_address[1]
        return (self.headers.get("Host") or "").lower() in ("localhost:%d" % port, "127.0.0.1:%d" % port)

    def from_shoresh(self):
        port = self.server.server_address[1]
        origin = self.headers.get("Origin")
        return self.headers.get("X-Shoresh") == "1" and origin in (
            None,
            "http://localhost:%d" % port,
            "http://127.0.0.1:%d" % port,
        )

    def route(self):
        return self.path.split("?", 1)[0]

    def send_body(self, code, body, kind="application/json"):
        self.send_response(code)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if not self.host_ok():
            return self.send_error(403)
        route = self.route()
        if route == "/__shoresh/info":
            return self.send_body(200, json.dumps({"app": "shoresh", "version": VERSION}).encode("utf-8"))
        if route == "/__shoresh/progress":
            if not self.from_shoresh():
                return self.send_error(403)
            try:
                with open(PROGRESS_FILE, "rb") as f:
                    return self.send_body(200, f.read())
            except FileNotFoundError:
                self.send_response(204)
                return self.end_headers()
        if route.startswith("/__shoresh/"):
            return self.send_error(404)
        super().do_GET()

    def do_HEAD(self):
        if not self.host_ok():
            return self.send_error(403)
        super().do_HEAD()

    def do_PUT(self):
        if not self.host_ok() or not self.from_shoresh():
            return self.send_error(403)
        if self.route() != "/__shoresh/progress":
            return self.send_error(404)
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length > MAX_BODY:
            return self.send_error(413)
        body = self.rfile.read(length) if length > 0 else b""
        try:
            data = json.loads(body.decode("utf-8"))
            valid = data.get("app") == "shoresh" and data["state"]["version"] == 1
        except Exception:
            valid = False
        if not valid:
            return self.send_error(400, "Not Shoresh progress")
        with save_lock:
            os.makedirs(PROGRESS_DIR, exist_ok=True)
            backup_today()
            tmp = PROGRESS_FILE + ".tmp"
            with open(tmp, "wb") as f:
                f.write(body)
            os.replace(tmp, PROGRESS_FILE)
        self.send_body(200, b'{"ok":true}')

    def do_POST(self):
        if not self.host_ok() or not self.from_shoresh():
            return self.send_error(403)
        if self.route() != "/__shoresh/quit":
            return self.send_error(404)
        self.send_body(200, b'{"ok":true}')
        self.server.stopped_by = "another start or stop_shoresh"
        threading.Thread(target=self.server.shutdown, daemon=True).start()


class Server(http.server.ThreadingHTTPServer):
    daemon_threads = True
    stopped_by = None

    def server_bind(self):
        # Skip HTTPServer's reverse-DNS lookup of the address, which can be slow.
        socketserver.TCPServer.server_bind(self)
        self.server_name, self.server_port = "localhost", self.server_address[1]


def start(open_browser):
    if not os.path.isfile(os.path.join(APP_DIR, "index.html")):
        print("The app folder is missing. Unzip the whole Shoresh download and start it again.")
        return 1
    if stop_running():
        print("Stopped the Shoresh that was already running; this one takes over.")

    server = None
    for port in PORTS:
        if port_busy(port):
            continue
        try:
            server = Server((HOST, port), partial(Handler, directory=APP_DIR))
            break
        except OSError:
            continue
    if server is None:
        print("Ports %d-%d are all in use by other programs, so Shoresh can't start." % (PORTS[0], PORTS[-1]))
        return 1

    port = server.server_address[1]
    url = "http://localhost:%d/" % port
    print()
    print("  Shoresh %s is running on this Mac." % VERSION)
    print()
    print("  Open:  %s" % url)
    print()
    print("  Keep this window open while you practise (you can minimise it).")
    print("  To stop: close this window, press Ctrl+C, or double-click stop_shoresh.command.")
    print("  Progress is also saved in: %s" % PROGRESS_DIR)
    if port != PORTS[0]:
        print()
        print("  Note: another program uses port %d, so Shoresh runs at the address above this time." % PORTS[0])
        print("  Your progress comes back from the progress folder by itself.")
    print()
    sys.stdout.flush()

    if open_browser:
        threading.Timer(0.3, webbrowser.open, args=(url,)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    print("  Shoresh stopped%s." % (" by " + server.stopped_by if server.stopped_by else ""))
    return 0


def main():
    parser = argparse.ArgumentParser(description="Run Shoresh on this Mac.")
    parser.add_argument("--stop", action="store_true", help="stop Shoresh if it is running")
    parser.add_argument("--no-browser", action="store_true", help="don't open the browser")
    args = parser.parse_args()
    if args.stop:
        print("  Shoresh stopped." if stop_running() else "  Shoresh wasn't running.")
        return 0
    return start(open_browser=not args.no_browser)


if __name__ == "__main__":
    sys.exit(main())
