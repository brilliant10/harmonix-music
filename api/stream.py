from http.server import BaseHTTPRequestHandler
import urllib.parse
import urllib.request
import json
import re

def get_audio_stream_url(video_id):
    # Method 1: yt-dlp
    try:
        import yt_dlp
        ydl_opts = {
            'format': 'bestaudio[ext=m4a]/bestaudio/best',
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f'https://www.youtube.com/watch?v={video_id}', download=False)
            stream_url = info.get('url')
            if stream_url:
                return {
                    'streamUrl': stream_url,
                    'title': info.get('title', 'Track'),
                    'artist': info.get('uploader', 'Artis'),
                    'duration': info.get('duration', 210),
                    'mimeType': 'audio/mp4' if 'm4a' in stream_url else 'audio/webm'
                }
    except Exception as e:
        print('yt-dlp stream error:', e)

    # Method 2: Innertube Android Client fallback
    try:
        url = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false"
        payload = {
            "context": {
                "client": {
                    "clientName": "WEB_EMBEDDED_PLAYER",
                    "clientVersion": "1.20240101.01.00",
                    "hl": "id",
                    "gl": "ID"
                }
            },
            "videoId": video_id
        }
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers)
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            formats = data.get("streamingData", {}).get("adaptiveFormats", [])
            audio_formats = [f for f in formats if f.get("mimeType", "").startswith("audio/")]
            if audio_formats:
                best = audio_formats[0]
                if best.get("url"):
                    return {
                        'streamUrl': best.get("url"),
                        'title': data.get("videoDetails", {}).get("title", "Track"),
                        'artist': data.get("videoDetails", {}).get("author", "Artis"),
                        'duration': int(data.get("videoDetails", {}).get("lengthSeconds", 210)),
                        'mimeType': best.get("mimeType", "audio/mp4")
                    }
    except Exception as e:
        print('Innertube stream error:', e)

    return None

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
        vid = query_params.get('id', [''])[0].strip()
        if vid.startswith('yt-'):
            vid = vid[3:]

        if not vid:
            self.send_response(400)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'error', 'message': 'Missing id parameter'}).encode('utf-8'))
            return

        result = get_audio_stream_url(vid)

        if result:
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success', 'data': result}).encode('utf-8'))
        else:
            self.send_response(404)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'error', 'message': 'Stream audio tidak ditemukan'}).encode('utf-8'))
