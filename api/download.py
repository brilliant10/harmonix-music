from http.server import BaseHTTPRequestHandler
import urllib.parse
import urllib.request
import json
import re
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stream import get_audio_stream_url

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

        title_param = query_params.get('title', [''])[0].strip()

        if not vid:
            self.send_response(400)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(b'Missing id parameter')
            return

        stream_info = get_audio_stream_url(vid, title_param)

        if not stream_info or not stream_info.get('streamUrl'):
            # Fallback redirect to a fast online converter if stream extraction fails
            target_url = "https://ytmp3.nu/"
            self.send_response(302)
            self.send_header('Location', target_url)
            self.end_headers()
            return

        stream_url = stream_info['streamUrl']
        title = title_param or stream_info.get('title', 'Lagu')
        clean_title = re.sub(r'[\\/*?:"<>|]', '', title).strip() or 'Lagu'
        ext = 'm4a' if 'm4a' in stream_url or 'audio/mp4' in stream_info.get('mimeType', '') else 'webm'
        filename = f"{clean_title}.{ext}"

        # Proxy stream chunks directly so browser saves file with proper name
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

                # Stream buffer in 64KB chunks
                while True:
                    chunk = remote_resp.read(65536)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
        except Exception as e:
            # If pipe interrupted or failed, 302 redirect directly to stream_url
            try:
                self.send_response(302)
                self.send_header('Location', stream_url)
                self.end_headers()
            except Exception:
                pass
