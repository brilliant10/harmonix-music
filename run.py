#!/usr/bin/env python3
"""
HarmoniX Music Player - Local Server & Universal YouTube Gateway
Menghubungkan aplikasi ke seluruh lagu yang ada di YouTube dengan suara jernih dan pencarian lengkap.
"""

import http.server
import socketserver
import urllib.request
import urllib.parse
import json
import re
import webbrowser
import os
import sys
import socket

DEFAULT_PORT = 5500

# Cache memori agar pencarian dan navigasi cepat
SEARCH_CACHE = {}

def extract_youtube_video_id(text):
    text = text.strip()
    patterns = [
        r'(?:v=|\/)([0-9A-Za-z_-]{11})(?:[&?]|$)',
        r'youtu\.be\/([0-9A-Za-z_-]{11})',
        r'shorts\/([0-9A-Za-z_-]{11})'
    ]
    for p in patterns:
        m = re.search(p, text)
        if m:
            return m.group(1)
    if re.match(r'^[0-9A-Za-z_-]{11}$', text):
        return text
    return None

def fetch_single_video_oembed(video_id):
    try:
        url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as res:
            data = json.loads(res.read().decode('utf-8'))
            return [{
                'id': 'yt-' + video_id,
                'videoId': video_id,
                'title': data.get('title', 'YouTube Track'),
                'artist': data.get('author_name', 'Artis YouTube'),
                'duration': 240,
                'durationStr': 'Video',
                'artwork': f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
                'genre': 'YouTube Music',
                'source': 'youtube',
                'isRadio': False,
                'isLocal': False
            }]
    except Exception as e:
        print(f"oEmbed error for {video_id}: {e}")
        return [{
            'id': 'yt-' + video_id,
            'videoId': video_id,
            'title': f"YouTube Video ({video_id})",
            'artist': 'YouTube',
            'duration': 240,
            'durationStr': 'Video',
            'artwork': f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
            'genre': 'YouTube Music',
            'source': 'youtube',
            'isRadio': False,
            'isLocal': False
        }]

def search_youtube(query, limit=30, page=1):
    query = query.strip()
    if not query:
        return []

    # Cek jika pengguna memasukkan link langsung YouTube atau Video ID
    direct_id = extract_youtube_video_id(query)
    if direct_id and ('http' in query or 'youtu' in query or len(query) == 11):
        return fetch_single_video_oembed(direct_id)

    cache_key = f"{query.lower()}_p{page}"
    if cache_key in SEARCH_CACHE:
        return SEARCH_CACHE[cache_key]

    search_term = query
    if page > 1:
        search_term = f"{query} lagu ke-{page}"

    url = 'https://www.youtube.com/results?search_query=' + urllib.parse.quote(search_term)
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
    }

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=9) as res:
            html = res.read().decode('utf-8', errors='ignore')

        m = re.search(r'var ytInitialData = ({.*?});</script>', html)
        if not m:
            return []

        data = json.loads(m.group(1))
        results = []
        seen_ids = set()

        # Ekstraksi rekursif semua elemen videoRenderer
        def extract_renderers(node):
            if len(results) >= limit:
                return

            if isinstance(node, dict):
                if 'videoRenderer' in node:
                    vr = node['videoRenderer']
                    vid = vr.get('videoId')
                    if vid and vid not in seen_ids:
                        seen_ids.add(vid)
                        title_runs = vr.get('title', {}).get('runs', [])
                        title = title_runs[0]['text'] if title_runs else 'Unknown Title'
                        owner_runs = vr.get('ownerText', {}).get('runs', [])
                        artist = owner_runs[0]['text'] if owner_runs else 'Artis'
                        dur_str = vr.get('lengthText', {}).get('simpleText', '3:30')

                        dur_secs = 0
                        parts = dur_str.split(':')
                        if len(parts) == 2:
                            dur_secs = int(parts[0]) * 60 + int(parts[1])
                        elif len(parts) == 3:
                            dur_secs = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])

                        # Hindari kompilasi di atas 2 jam untuk track satuan
                        if dur_secs <= 7200:
                            thumb = f'https://i.ytimg.com/vi/{vid}/hqdefault.jpg'
                            results.append({
                                'id': 'yt-' + vid,
                                'videoId': vid,
                                'title': title,
                                'artist': artist,
                                'duration': dur_secs,
                                'durationStr': dur_str,
                                'artwork': thumb,
                                'genre': 'YouTube Music',
                                'source': 'youtube',
                                'isRadio': False,
                                'isLocal': False
                            })
                for v in node.values():
                    extract_renderers(v)
            elif isinstance(node, list):
                for item in node:
                    extract_renderers(item)

        extract_renderers(data)
        SEARCH_CACHE[cache_key] = results
        return results
    except Exception as err:
        print(f"  [!] Error searching YouTube for '{query}': {err}")
        return []

GENRE_QUERIES = {
    'all': 'lagu pop indonesia terbaru dan viral hits 2026',
    'indonesia': 'top hits indonesia pop viral terbaru 2026',
    'pop': 'top global pop billboard hits 2026',
    'tiktok': 'lagu viral tiktok terbaru 2026',
    'galau': 'lagu galau indonesia akustik sedih',
    'dangdut': 'dangdut koplo pop jawa terbaru denny caknan ndx',
    'lofi': 'lofi hip hop beats to relax study to',
    'rock': 'best rock songs indonesia alternative hits',
    'nostalgia': 'lagu nostalgia 90an 2000an indonesia terpopuler',
    'electronic': 'top edm electronic dance music hits',
    'hiphop': 'top hip hop rap hits 2026',
    'acoustic': 'lagu akustik santai cafe indonesia',
    'kpop': 'top kpop hits viral songs',
    'anime': 'best anime songs openings hits'
}

def get_trending_tracks(genre='all', page=1):
    query = GENRE_QUERIES.get(genre.lower(), f"lagu {genre} terpopuler")
    return search_youtube(query, limit=30, page=page)

def get_local_ip():
    try:
        hostname = socket.gethostname()
        ips = socket.gethostbyname_ex(hostname)[2]
        for ip in ips:
            if not ip.startswith('127.'):
                return ip
    except Exception:
        pass

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        if ip and not ip.startswith('127.'):
            return ip
    except Exception:
        pass

    return '127.0.0.1'

def find_available_port(start_port):
    import socket
    port = start_port
    while port < start_port + 100:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('127.0.0.1', port)) != 0:
                return port
            port += 1
    return start_port

class HarmoniXHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        '': 'application/octet-stream',
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.ico': 'image/x-icon',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.apk': 'application/vnd.android.package-archive',
    }

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query_params = urllib.parse.parse_qs(parsed.query)

        # 1. API Search
        if path == '/api/search':
            q = query_params.get('q', [''])[0]
            page = int(query_params.get('page', [1])[0])
            tracks = search_youtube(q, limit=30, page=page)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success', 'data': tracks, 'page': page}).encode('utf-8'))
            return

        # 2. API Trending by Genre
        if path == '/api/trending':
            genre = query_params.get('genre', ['all'])[0]
            page = int(query_params.get('page', [1])[0])
            tracks = get_trending_tracks(genre, page=page)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success', 'data': tracks, 'genre': genre, 'page': page}).encode('utf-8'))
            return

        # 3. API Suggestions (Auto-complete)
        if path == '/api/suggest':
            q = query_params.get('q', [''])[0]
            suggestions = []
            if q:
                try:
                    s_url = 'https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=' + urllib.parse.quote(q)
                    req = urllib.request.Request(s_url, headers={'User-Agent': 'Mozilla/5.0'})
                    with urllib.request.urlopen(req, timeout=3) as res:
                        data = json.loads(res.read().decode('utf-8'))
                        if len(data) > 1 and isinstance(data[1], list):
                            suggestions = data[1]
                except Exception:
                    pass
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success', 'data': suggestions}).encode('utf-8'))
            return

        # 4. API Network Info (Untuk Akses dari Smartphone Android via Wi-Fi)
        if path == '/api/network-info':
            local_ip = get_local_ip()
            port = self.server.server_address[1]
            info = {
                'status': 'success',
                'local_ip': local_ip,
                'port': port,
                'local_url': f"http://{local_ip}:{port}",
                'localhost_url': f"http://localhost:{port}"
            }
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(info).encode('utf-8'))
            return

        # 5. Default Static Files
        super().do_GET()

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)

    port = find_available_port(DEFAULT_PORT)
    url = f"http://localhost:{port}"
    local_ip = get_local_ip()
    mobile_url = f"http://{local_ip}:{port}"

    print("=" * 68)
    print("  🎵 HarmoniX Music Player - Akses Seluruh Lagu YouTube")
    print("=" * 68)
    print(f"  -> Komputer (Desktop) : {url}")
    print(f"  -> HP Android (Wi-Fi)  : {mobile_url}")
    print("  -> Seluruh lagu di YouTube siap dicari & diputar secara gratis")
    print("  -> Buka di HP Android Anda untuk memasang aplikasi via WebAPK!")
    print("  -> Tekan Ctrl + C di terminal ini untuk mematikan server.")
    print("=" * 68)

    webbrowser.open(url)

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("0.0.0.0", port), HarmoniXHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  [!] Server HarmoniX dimatikan. Sampai jumpa!")
            sys.exit(0)

if __name__ == '__main__':
    main()
