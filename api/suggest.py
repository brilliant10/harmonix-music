import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from http.server import BaseHTTPRequestHandler
import urllib.parse
import urllib.request
import json

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
