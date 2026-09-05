from http.server import BaseHTTPRequestHandler
import urllib.parse
import urllib.request
import json
import re

def clean_track_query(title, artist=""):
    t = title
    t = re.sub(r'[\(\[\{].*?(official|music video|video|lyric|audio|visualizer|mv|lirik|remastered|hd|4k|hq).*?[\)\]\}]', '', t, flags=re.IGNORECASE)
    t = re.sub(r'\|\s*(official|music video|video|audio).*', '', t, flags=re.IGNORECASE)
    t = re.sub(r'\s+', ' ', t).strip()
    if artist and artist.lower() in t.lower():
        t = re.sub(re.escape(artist), '', t, flags=re.IGNORECASE).strip(' -:|')
    return t.strip()

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
        query_params = urllib.parse.parse_qs(parsed.query)
        q = query_params.get('q', [''])[0].strip()
        track = query_params.get('track', [''])[0].strip()
        artist = query_params.get('artist', [''])[0].strip()
        duration = query_params.get('duration', [''])[0].strip()

        if not q and not track:
            self.send_response(400)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'error', 'message': 'Parameter q or track is required'}).encode('utf-8'))
            return

        result = None
        headers = {'User-Agent': 'HarmoniX-Music/1.0 (https://github.com/brilliant10/harmonix-music)'}

        # 1. Try exact get if track and artist provided
        if track and artist:
            clean_track = clean_track_query(track, artist)
            params = {'track_name': clean_track, 'artist_name': artist}
            if duration:
                try:
                    params['duration'] = str(int(float(duration)))
                except Exception:
                    pass
            url = 'https://lrclib.net/api/get?' + urllib.parse.urlencode(params)
            try:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, timeout=6) as resp:
                    if resp.status == 200:
                        result = json.loads(resp.read().decode('utf-8'))
            except Exception:
                result = None

        # 2. Try search if not found
        if not result:
            search_str = q
            if not search_str:
                clean_t = clean_track_query(track, artist)
                search_str = f"{artist} {clean_t}".strip() if artist else clean_t

            url = 'https://lrclib.net/api/search?q=' + urllib.parse.quote(search_str)
            try:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, timeout=6) as resp:
                    if resp.status == 200:
                        data = json.loads(resp.read().decode('utf-8'))
                        if data and isinstance(data, list) and len(data) > 0:
                            synced = [item for item in data if item.get('syncedLyrics')]
                            result = synced[0] if synced else data[0]
            except Exception as e:
                print('Lyrics search error:', e)

        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()

        if result:
            self.wfile.write(json.dumps({'status': 'success', 'data': result}).encode('utf-8'))
        else:
            self.wfile.write(json.dumps({'status': 'not_found', 'message': 'Lirik tidak ditemukan'}).encode('utf-8'))
