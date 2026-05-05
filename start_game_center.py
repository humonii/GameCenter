#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import socket
import sys
import threading
import time
import webbrowser
from dataclasses import dataclass
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Dict, List
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
GAMES_DIR = ROOT / 'games'
IGNORE_FILES = {'index.html', 'quize.html', 'game-template.html', 'template-check-mini.html'}
LIVE_FEED_PATH = '/__gamecenter__/games.json'


class MetaParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.meta: Dict[str, str] = {}
        self.title_parts: List[str] = []
        self._in_title = False

    def handle_starttag(self, tag: str, attrs) -> None:  # type: ignore[override]
        pairs = {str(k).lower(): '' if v is None else str(v) for k, v in attrs}
        if tag.lower() == 'meta':
            name = pairs.get('name', '').strip().lower()
            if name:
                self.meta[name] = pairs.get('content', '').strip()
        elif tag.lower() == 'title':
            self._in_title = True

    def handle_endtag(self, tag: str) -> None:  # type: ignore[override]
        if tag.lower() == 'title':
            self._in_title = False

    def handle_data(self, data: str) -> None:  # type: ignore[override]
        if self._in_title:
            self.title_parts.append(data)

    @property
    def document_title(self) -> str:
        return ''.join(self.title_parts).strip()


@dataclass(frozen=True)
class GameRecord:
    file: str
    title: str
    tag: str
    cover: str
    coverColor: str
    emoji: str
    order: int


def normalize_hex(value: str) -> str:
    raw = (value or '').strip()
    if not raw:
        return ''
    if len(raw) == 4 and raw.startswith('#'):
        return '#' + ''.join(ch * 2 for ch in raw[1:]).lower()
    if len(raw) == 7 and raw.startswith('#'):
        return raw.lower()
    return ''


def parse_game(path: Path) -> GameRecord:
    parser = MetaParser()
    parser.feed(path.read_text(encoding='utf-8'))
    meta = parser.meta
    title = meta.get('game:title', '').strip() or parser.document_title.replace('Feeling Game |', '').strip() or path.stem
    tag = meta.get('game:tag', '').strip() or 'Game'
    cover = meta.get('game:cover', '').strip() or 'generic'
    cover_color = normalize_hex(meta.get('game:cover-color', '') or meta.get('theme-color', ''))
    emoji = meta.get('game:emoji', '').strip() or '🎮'
    try:
        order = int(meta.get('game:order', '999').strip() or '999')
    except ValueError:
        order = 999
    return GameRecord(path.name, title, tag, cover, cover_color, emoji, order)


def scan_games() -> List[dict]:
    games: List[GameRecord] = []
    for path in sorted(GAMES_DIR.glob('*.html')):
        if path.name in IGNORE_FILES or path.name.startswith('.') or path.name.startswith('_'):
            continue
        games.append(parse_game(path))
    games.sort(key=lambda item: (item.order, item.file))
    return [game.__dict__ for game in games]


class GameCenterHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, directory: str | None = None, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format: str, *args) -> None:  # noqa: A003
        sys.stdout.write('%s - - [%s] %s\n' % (self.address_string(), self.log_date_time_string(), format % args))

    def end_headers(self) -> None:
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == LIVE_FEED_PATH:
            payload = {
                'source': 'start_game_center.py',
                'generatedAt': time.strftime('%Y-%m-%dT%H:%M:%S'),
                'games': scan_games(),
            }
            body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()


def find_available_port(host: str, start_port: int, max_tries: int = 25) -> int:
    for port in range(start_port, start_port + max_tries):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind((host, port))
            except OSError:
                continue
            return port
    raise OSError('空いているポートが見つかりませんでした。')


def main() -> int:
    parser = argparse.ArgumentParser(description='Start GameCenter local server with live game feed.')
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()

    if not GAMES_DIR.exists():
        print(f'games フォルダが見つかりません: {GAMES_DIR}', file=sys.stderr)
        return 1

    port = find_available_port(args.host, args.port)
    httpd = ThreadingHTTPServer((args.host, port), GameCenterHandler)
    url = f'http://{args.host}:{port}/'

    print('Feeling GameCenter を起動します。')
    print(f'URL: {url}')
    print('ゲームを追加・削除すると、選択画面へ自動反映されます。')
    print('終了するには、この画面で Ctrl+C を押してください。')

    if not args.no_browser:
        threading.Timer(0.35, lambda: webbrowser.open(url)).start()

    try:
        httpd.serve_forever(poll_interval=0.25)
    except KeyboardInterrupt:
        print('\n終了します。')
    finally:
        httpd.server_close()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
