from http.server import BaseHTTPRequestHandler
import urllib.parse
import urllib.request
import mimetypes
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    from stream import get_audio_stream_url
except Exception:
    get_audio_stream_url = None

SEARCH_CACHE = {}

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

GENRE_QUERIES = {
    'all': 'lagu terpopuler indonesia hits',
    'indonesia': 'lagu pop indonesia hits terbaru',
    'western': 'billboard hot 100 music hits',
    'kpop': 'kpop top hits official music video',
    'dangdut': 'dangdut koplo viral terbaru',
    'lofi': 'lofi hip hop radio beats to relax',
    'rock': 'classic rock and alternative hits',
    'jazz': 'smooth jazz coffee shop music',
    'anime': 'popular anime opening ost music',
    'acoustic': 'lagu akustik santai indonesia'
}

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
    except Exception:
        return [{
            'id': 'yt-' + video_id,
            'videoId': video_id,
            'title': f'YouTube Video ({video_id})',
            'artist': 'YouTube',
            'duration': 240,
            'durationStr': 'Video',
            'artwork': f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
            'genre': 'YouTube Music',
            'source': 'youtube',
            'isRadio': False,
            'isLocal': False
        }]

def search_innertube(query, limit=30):
    url = "https://www.youtube.com/youtubei/v1/search?prettyPrint=false"
    payload = {
        "context": {
            "client": {
                "clientName": "WEB",
                "clientVersion": "2.20240101.00.00",
                "hl": "id",
                "gl": "ID"
            }
        },
        "query": query
    }
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    }
    results = []
    seen_ids = set()

    try:
        req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers)
        with urllib.request.urlopen(req, timeout=7) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        def walk(node):
            if len(results) >= limit:
                return
            if isinstance(node, dict):
                if "videoRenderer" in node:
                    vr = node["videoRenderer"]
                    vid = vr.get("videoId")
                    if vid and vid not in seen_ids:
                        seen_ids.add(vid)
                        title_runs = vr.get("title", {}).get("runs", [])
                        title = title_runs[0]["text"] if title_runs else "Unknown Title"
                        owner_runs = vr.get("ownerText", {}).get("runs", [])
                        artist = owner_runs[0]["text"] if owner_runs else "Artis"
                        dur_str = vr.get("lengthText", {}).get("simpleText", "3:30")

                        dur_secs = 0
                        parts = dur_str.split(":")
                        if len(parts) == 2:
                            dur_secs = int(parts[0]) * 60 + int(parts[1])
                        elif len(parts) == 3:
                            dur_secs = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])

                        if dur_secs <= 7200:
                            results.append({
                                "id": "yt-" + vid,
                                "videoId": vid,
                                "title": title,
                                "artist": artist,
                                "duration": dur_secs,
                                "durationStr": dur_str,
                                "artwork": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
                                "genre": "YouTube Music",
                                "source": "youtube",
                                "isRadio": False,
                                "isLocal": False
                            })
                else:
                    for v in node.values():
                        walk(v)
            elif isinstance(node, list):
                for v in node:
                    walk(v)

        walk(data)
    except Exception as e:
        print("Innertube search error:", e)

    return results

def search_itunes_fallback(query, limit=25):
    try:
        url = f"https://itunes.apple.com/search?term={urllib.parse.quote(query)}&entity=song&limit={limit}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            items = data.get("results", [])
            results = []
            for item in items:
                track_name = item.get("trackName", "Track")
                artist_name = item.get("artistName", "Artis")
                dur_ms = item.get("trackTimeMillis", 210000)
                dur_sec = int(dur_ms / 1000)
                m, s = divmod(dur_sec, 60)
                art = item.get("artworkUrl100", "").replace("100x100bb", "500x500bb")
                results.append({
                    "id": f"itunes-{item.get('trackId')}",
                    "videoId": None,
                    "title": track_name,
                    "artist": artist_name,
                    "duration": dur_sec,
                    "durationStr": f"{m}:{s:02d}",
                    "artwork": art or "icons/icon-192.png",
                    "genre": item.get("primaryGenreName", "Music"),
                    "streamUrl": item.get("previewUrl", ""),
                    "source": "itunes",
                    "isRadio": False,
                    "isLocal": False
                })
            return results
    except Exception as e:
        print("iTunes search fallback error:", e)
        return []

def search_youtube(query, limit=30, page=1):
    if not query or not query.strip():
        return []

    direct_id = extract_youtube_video_id(query)
    if direct_id and ('http' in query or 'youtu' in query or len(query) == 11):
        return fetch_single_video_oembed(direct_id)

    cache_key = f"{query.lower()}_p{page}"
    if cache_key in SEARCH_CACHE:
        return SEARCH_CACHE[cache_key]

    search_term = query
    if page > 1:
        search_term = f"{query} lagu ke-{page}"

    # 1. Primary: YouTube Innertube API (Highly accurate, resilient, never blocked by consent)
    results = search_innertube(search_term, limit=limit)

    # 2. Secondary Fallback: iTunes Search API
    if not results:
        results = search_itunes_fallback(search_term, limit=limit)

    # 3. Tertiary Fallback: HTML Scrape
    if not results:
        try:
            url = 'https://www.youtube.com/results?search_query=' + urllib.parse.quote(search_term)
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
            }
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=6) as res:
                html = res.read().decode('utf-8', errors='ignore')
            vids = re.findall(r'/watch\?v=([0-9A-Za-z_-]{11})', html)
            seen = set()
            for vid in vids:
                if vid not in seen:
                    seen.add(vid)
                    results.append({
                        'id': 'yt-' + vid,
                        'videoId': vid,
                        'title': f'{search_term} (YouTube)',
                        'artist': 'YouTube Music',
                        'duration': 210,
                        'durationStr': '3:30',
                        'artwork': f'https://i.ytimg.com/vi/{vid}/hqdefault.jpg',
                        'genre': 'YouTube Music',
                        'source': 'youtube',
                        'isRadio': False,
                        'isLocal': False
                    })
                    if len(results) >= limit:
                        break
        except Exception:
            pass

    if results:
        SEARCH_CACHE[cache_key] = results
    return results

def get_trending_tracks(genre='all', page=1):
    query = GENRE_QUERIES.get(genre.lower(), f"lagu {genre} terpopuler")
    return search_youtube(query, limit=30, page=page)

class handler(BaseHTTPRequestHandler):
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

        req_path = self.headers.get('x-matched-path', '') or self.headers.get('x-forwarded-uri', '') or path
        action = query_params.get('action', [''])[0]

        # 1. API Search
        if '/search' in path or '/search' in req_path or action == 'search':
            q = query_params.get('q', [''])[0]
            page = int(query_params.get('page', [1])[0])
            tracks = search_youtube(q, limit=30, page=page)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success', 'data': tracks, 'page': page}).encode('utf-8'))
            return

        # 2. API Trending
        if '/trending' in path or '/trending' in req_path or action == 'trending':
            genre = query_params.get('genre', ['all'])[0]
            page = int(query_params.get('page', [1])[0])
            tracks = get_trending_tracks(genre, page=page)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success', 'data': tracks, 'genre': genre, 'page': page}).encode('utf-8'))
            return

        # 3. API Suggestions
        if '/suggest' in path or '/suggest' in req_path or action == 'suggest':
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

        # 4. API Lyrics
        if '/lyrics' in path or '/lyrics' in req_path or action == 'lyrics':
            q = query_params.get('q', [''])[0].strip()
            track = query_params.get('track', [''])[0].strip()
            artist = query_params.get('artist', [''])[0].strip()

            clean_t = re.sub(r'[\(\[\{].*?(official|music video|video|lyric|audio|visualizer|mv|lirik|remastered|hd|4k|hq).*?[\)\]\}]', '', track or q, flags=re.IGNORECASE)
            clean_t = re.sub(r'\|\s*(official|music video|video|audio).*', '', clean_t, flags=re.IGNORECASE)
            clean_t = re.sub(r'\s+', ' ', clean_t).strip()
            if artist and artist.lower() in clean_t.lower():
                clean_t = re.sub(re.escape(artist), '', clean_t, flags=re.IGNORECASE).strip(' -:|')

            search_str = q if q else (f"{artist} {clean_t}".strip() if artist else clean_t)
            headers = {'User-Agent': 'HarmoniX-Music/1.0'}
            result = None

            try:
                s_url = 'https://lrclib.net/api/search?q=' + urllib.parse.quote(search_str)
                req = urllib.request.Request(s_url, headers=headers)
                with urllib.request.urlopen(req, timeout=5) as res:
                    data = json.loads(res.read().decode('utf-8'))
                    if data and isinstance(data, list) and len(data) > 0:
                        synced = [item for item in data if item.get('syncedLyrics')]
                        result = synced[0] if synced else data[0]
            except Exception as e:
                print('lrclib search error:', e)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            if result:
                self.wfile.write(json.dumps({'status': 'success', 'data': result}).encode('utf-8'))
            else:
                self.wfile.write(json.dumps({'status': 'not_found', 'message': 'Lirik tidak ditemukan'}).encode('utf-8'))
            return

        # 5. API Stream Audio URL
        if '/stream' in path or '/stream' in req_path or action == 'stream':
            vid = query_params.get('id', [''])[0].strip()
            if vid.startswith('yt-'):
                vid = vid[3:]
            if not vid:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': 'Missing id parameter'}).encode('utf-8'))
                return

            stream_info = None
            title_param = query_params.get('title', [''])[0].strip()
            if get_audio_stream_url:
                stream_info = get_audio_stream_url(vid, title_param)

            redirect_param = query_params.get('redirect', ['0'])[0]
            if redirect_param == '1' and stream_info and stream_info.get('streamUrl'):
                self.send_response(302)
                self.send_header('Location', stream_info['streamUrl'])
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                return

            if stream_info:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success', 'data': stream_info}).encode('utf-8'))
            else:
                self.send_response(404)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': 'Stream audio tidak ditemukan'}).encode('utf-8'))
            return

        # 6. API Download Audio File
        if '/download' in path or '/download' in req_path or action == 'download':
            vid = query_params.get('id', [''])[0].strip()
            if vid.startswith('yt-'):
                vid = vid[3:]
            title_param = query_params.get('title', [''])[0].strip()

            if not vid:
                self.send_response(400)
                self.send_header('Content-Type', 'text/plain')
                self.end_headers()
                self.wfile.write(b'Missing id parameter')
                return

            stream_info = None
            if get_audio_stream_url:
                stream_info = get_audio_stream_url(vid, title_param)

            if not stream_info or not stream_info.get('streamUrl'):
                target_url = f"https://www.y2meta.mobi/en/youtube-to-mp3/{vid}"
                self.send_response(302)
                self.send_header('Location', target_url)
                self.end_headers()
                return

            stream_url = stream_info['streamUrl']
            title = title_param or stream_info.get('title', 'Lagu')
            clean_title = re.sub(r'[\\/*?:"<>|]', '', title).strip() or 'Lagu'
            ext = 'm4a' if 'm4a' in stream_url or 'audio/mp4' in stream_info.get('mimeType', '') else 'webm'
            filename = f"{clean_title}.{ext}"

            try:
                req = urllib.request.Request(stream_url, headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                })
                with urllib.request.urlopen(req, timeout=12) as remote_resp:
                    self.send_response(200)
                    self.send_header('Content-Type', stream_info.get('mimeType', 'audio/mp4'))
                    self.send_header('Content-Disposition', f'attachment; filename="{urllib.parse.quote(filename)}"')
                    cl = remote_resp.headers.get('Content-Length')
                    if cl:
                        self.send_header('Content-Length', cl)
                    self.end_headers()

                    while True:
                        chunk = remote_resp.read(65536)
                        if not chunk:
                            break
                        self.wfile.write(chunk)
            except Exception:
                try:
                    self.send_response(302)
                    self.send_header('Location', stream_url)
                    self.end_headers()
                except Exception:
                    pass
            return

        # 7. API Network Info / Health check
        if '/network-info' in path or '/network-info' in req_path or action == 'network-info':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({
                'status': 'success',
                'is_cloud': True,
                'message': 'HarmoniX Cloud API is online 24/7'
            }).encode('utf-8'))
            return

        # 5. Serve Static HTML/CSS/JS Fallback (if Vercel routes root or static files here)
        clean_path = path.strip('/')
        if clean_path in ('', 'index.html'):
            for p in [os.path.join(ROOT_DIR, 'public', 'index.html'), os.path.join(ROOT_DIR, 'index.html')]:
                if os.path.isfile(p):
                    with open(p, 'rb') as f:
                        data = f.read()
                    self.send_response(200)
                    self.send_header('Content-Type', 'text/html; charset=utf-8')
                    self.end_headers()
                    self.wfile.write(data)
                    return

        # Static assets
        for base in [os.path.join(ROOT_DIR, 'public'), ROOT_DIR]:
            target = os.path.normpath(os.path.join(base, clean_path))
            if os.path.isfile(target):
                mime = mimetypes.guess_type(target)[0] or 'application/octet-stream'
                with open(target, 'rb') as f:
                    data = f.read()
                self.send_response(200)
                self.send_header('Content-Type', mime)
                self.end_headers()
                self.wfile.write(data)
                return

        # Fallback 404
        self.send_response(404)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'error': 'Not found'}).encode('utf-8'))
