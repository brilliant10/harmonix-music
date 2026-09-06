from http.server import BaseHTTPRequestHandler
import urllib.parse
import urllib.request
import json
import re

def get_audio_stream_url(video_id, title=None):
    # Method 1: yt-dlp with android/ios player client
    try:
        import yt_dlp
        ydl_opts = {
            'format': 'bestaudio[ext=m4a]/bestaudio/best',
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            'extractor_args': {
                'youtube': {
                    'player_client': ['android', 'ios']
                }
            }
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

    # Method 2: Official iTunes Audio Stream Fallback
    try:
        search_query = title or ''
        if not search_query and video_id:
            try:
                oe_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
                req_oe = urllib.request.Request(oe_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req_oe, timeout=4) as oe_resp:
                    oe_data = json.loads(oe_resp.read().decode('utf-8'))
                    search_query = oe_data.get('title', '')
            except Exception:
                pass

        if search_query:
            clean_q = re.sub(r'[\(\[\{].*?(official|music video|video|lyric|audio|visualizer|mv|lirik|remastered|hd|4k|hq).*?[\)\]\}]', '', search_query, flags=re.IGNORECASE)
            clean_q = re.sub(r'\|\s*(official|music video|video|audio).*', '', clean_q, flags=re.IGNORECASE).strip()
            itunes_url = f"https://itunes.apple.com/search?term={urllib.parse.quote(clean_q)}&entity=song&limit=3"
            req_it = urllib.request.Request(itunes_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req_it, timeout=4) as it_resp:
                it_data = json.loads(it_resp.read().decode('utf-8'))
                results = it_data.get('results', [])
                if results and results[0].get('previewUrl'):
                    first = results[0]
                    return {
                        'streamUrl': first['previewUrl'],
                        'title': first.get('trackName', search_query),
                        'artist': first.get('artistName', 'Artis'),
                        'duration': int(first.get('trackTimeMillis', 210000) / 1000),
                        'mimeType': 'audio/mp4'
                    }
    except Exception as e:
        print('iTunes stream fallback error:', e)

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

        title_param = query_params.get('title', [''])[0].strip()
        result = get_audio_stream_url(vid, title_param)

        redirect_param = query_params.get('redirect', ['0'])[0]
        if redirect_param == '1' and result and result.get('streamUrl'):
            self.send_response(302)
            self.send_header('Location', result['streamUrl'])
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            return

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
