from http.server import BaseHTTPRequestHandler
import urllib.parse
import urllib.request
import json
import re

SEARCH_CACHE = {}

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

def search_invidious_fallback(query):
    instances = [
        'https://inv.tux.pizza',
        'https://invidious.nerdvpn.de',
        'https://vid.puffyan.us'
    ]
    for inst in instances:
        try:
            url = f"{inst}/api/v1/search?q={urllib.parse.quote(query)}&type=video"
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
            with urllib.request.urlopen(req, timeout=4) as res:
                items = json.loads(res.read().decode('utf-8'))
                if isinstance(items, list) and items:
                    results = []
                    for item in items[:25]:
                        vid = item.get('videoId')
                        if vid:
                            dur = item.get('lengthSeconds', 210)
                            m, s = divmod(dur, 60)
                            results.append({
                                'id': 'yt-' + vid,
                                'videoId': vid,
                                'title': item.get('title', 'Track'),
                                'artist': item.get('author', 'Artis YouTube'),
                                'duration': dur,
                                'durationStr': f"{m}:{s:02d}",
                                'artwork': f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
                                'genre': 'YouTube Music',
                                'source': 'youtube',
                                'isRadio': False,
                                'isLocal': False
                            })
                    if results:
                        return results
        except Exception:
            continue
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

    url = 'https://www.youtube.com/results?search_query=' + urllib.parse.quote(search_term)
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
    }

    results = []
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=8) as res:
            html = res.read().decode('utf-8', errors='ignore')

        m = re.search(r'var ytInitialData = ({.*?});</script>', html)
        if m:
            data = json.loads(m.group(1))
            seen_ids = set()

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
                    else:
                        for v in node.values():
                            extract_renderers(v)
                elif isinstance(node, list):
                    for item in node:
                        extract_renderers(item)

            extract_renderers(data)
    except Exception:
        pass

    # Fallback to Invidious public API if YouTube direct scraping returned nothing
    if not results:
        results = search_invidious_fallback(search_term)

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

        # Check rewrite headers from Vercel if available
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

        # 2. API Trending by Genre
        if '/trending' in path or '/trending' in req_path or action == 'trending':
            genre = query_params.get('genre', ['all'])[0]
            page = int(query_params.get('page', [1])[0])
            tracks = get_trending_tracks(genre, page=page)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success', 'data': tracks, 'genre': genre, 'page': page}).encode('utf-8'))
            return

        # 3. API Suggestions (Auto-complete)
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

        # 4. API Network Info / Health check
        if '/network-info' in path or '/network-info' in req_path or action == 'network-info' or path == '/api' or path == '/api/':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({
                'status': 'success',
                'is_cloud': True,
                'message': 'HarmoniX Cloud API is online 24/7'
            }).encode('utf-8'))
            return

        # Fallback 404 for unknown api
        self.send_response(404)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'error': 'Not found'}).encode('utf-8'))
