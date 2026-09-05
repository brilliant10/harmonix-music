package com.harmonix.music;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import androidx.webkit.WebViewAssetLoader;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private SwipeRefreshLayout swipeRefresh;
    private WebViewAssetLoader assetLoader;

    // Memuat aset langsung dari dalam APK tanpa butuh server PC!
    public static final String APP_URL = "https://appassets.androidplatform.net/assets/index.html";

    private static final Map<String, String> GENRE_QUERIES = new HashMap<>();
    static {
        GENRE_QUERIES.put("all", "lagu terpopuler indonesia hits");
        GENRE_QUERIES.put("indonesia", "lagu pop indonesia hits terbaru");
        GENRE_QUERIES.put("western", "billboard hot 100 music hits");
        GENRE_QUERIES.put("kpop", "kpop top hits official music video");
        GENRE_QUERIES.put("dangdut", "dangdut koplo viral terbaru");
        GENRE_QUERIES.put("lofi", "lofi hip hop radio beats to relax");
        GENRE_QUERIES.put("rock", "classic rock and alternative hits");
        GENRE_QUERIES.put("jazz", "smooth jazz coffee shop music");
        GENRE_QUERIES.put("anime", "popular anime opening ost music");
        GENRE_QUERIES.put("acoustic", "lagu akustik santai indonesia");
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        getWindow().setStatusBarColor(getResources().getColor(R.color.bg_dark));
        getWindow().setNavigationBarColor(getResources().getColor(R.color.bg_dark));

        swipeRefresh = findViewById(R.id.swipe_refresh);
        webView = findViewById(R.id.webview);

        assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        setupWebView();
        setupBackPressed();

        swipeRefresh.setColorSchemeResources(R.color.primary, R.color.accent);
        swipeRefresh.setOnRefreshListener(() -> webView.reload());

        webView.loadUrl(APP_URL);
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        String defaultUA = settings.getUserAgentString();
        settings.setUserAgentString(defaultUA + " HarmoniX-Android/1.0");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String path = uri.getPath();

                // 1. Intercept request API internal (/api/search, /api/trending, /api/suggest)
                if (path != null && path.startsWith("/api/")) {
                    try {
                        String jsonResp = handleApiRequest(uri);
                        if (jsonResp != null) {
                            return new WebResourceResponse("application/json", "UTF-8",
                                    new ByteArrayInputStream(jsonResp.getBytes(StandardCharsets.UTF_8)));
                        }
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }

                // 2. Intercept aset lokal (HTML, CSS, JS, Gambar)
                WebResourceResponse assetResponse = assetLoader.shouldInterceptRequest(uri);
                if (assetResponse != null) {
                    return assetResponse;
                }

                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost();
                if (host != null && (host.contains("appassets.androidplatform.net") || host.contains("youtube.com") || host.contains("youtu.be"))) {
                    return false;
                }
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                    startActivity(intent);
                    return true;
                } catch (Exception e) {
                    return false;
                }
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                swipeRefresh.setRefreshing(true);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                swipeRefresh.setRefreshing(false);
            }
        });

        webView.setWebChromeClient(new WebChromeClient());
    }

    private String handleApiRequest(Uri uri) {
        String path = uri.getPath();
        if (path == null) return null;

        if (path.equals("/api/search")) {
            String q = uri.getQueryParameter("q");
            int page = 1;
            try {
                String pStr = uri.getQueryParameter("page");
                if (pStr != null) page = Integer.parseInt(pStr);
            } catch (Exception ignored) {}
            return executeYouTubeSearch(q, page);
        } else if (path.equals("/api/trending")) {
            String genre = uri.getQueryParameter("genre");
            if (genre == null) genre = "all";
            int page = 1;
            try {
                String pStr = uri.getQueryParameter("page");
                if (pStr != null) page = Integer.parseInt(pStr);
            } catch (Exception ignored) {}
            String query = GENRE_QUERIES.get(genre.toLowerCase());
            if (query == null) query = "lagu " + genre + " hits";
            return executeYouTubeSearch(query, page);
        } else if (path.equals("/api/suggest")) {
            String q = uri.getQueryParameter("q");
            return executeYouTubeSuggest(q);
        } else if (path.equals("/api/network-info")) {
            return "{\"status\":\"success\",\"local_ip\":\"127.0.0.1\",\"port\":5500,\"local_url\":\"https://appassets.androidplatform.net/assets/index.html\"}";
        }
        return null;
    }

    private String executeYouTubeSearch(String query, int page) {
        if (query == null || query.trim().isEmpty()) return "{\"status\":\"success\",\"data\":[]}";
        try {
            String q = query.trim();
            if (page > 1) q = q + " lagu ke " + page;
            String searchUrl = "https://www.youtube.com/results?search_query=" + URLEncoder.encode(q, "UTF-8");
            String html = fetchHttp(searchUrl);
            if (html == null) return "{\"status\":\"error\",\"data\":[]}";

            JSONArray results = new JSONArray();
            Set<String> seenIds = new HashSet<>();

            Pattern blockPattern = Pattern.compile("\"videoRenderer\":\\{(.*?)\"navigationEndpoint\"", Pattern.DOTALL);
            Matcher blockMatcher = blockPattern.matcher(html);

            Pattern vidPattern = Pattern.compile("\"videoId\":\"([0-9A-Za-z_-]{11})\"");
            Pattern titlePattern = Pattern.compile("\"title\":\\{\"runs\":\\[\\{\"text\":\"(.*?)\"\\}");
            Pattern ownerPattern = Pattern.compile("\"ownerText\":\\{\"runs\":\\[\\{\"text\":\"(.*?)\"\\}");
            Pattern durPattern = Pattern.compile("\"lengthText\":\\{\"simpleText\":\"(.*?)\"\\}");

            while (blockMatcher.find() && results.length() < 30) {
                String block = blockMatcher.group(1);
                Matcher vidMatcher = vidPattern.matcher(block);
                Matcher titleMatcher = titlePattern.matcher(block);

                if (vidMatcher.find() && titleMatcher.find()) {
                    String vid = vidMatcher.group(1);
                    if (seenIds.contains(vid)) continue;
                    seenIds.add(vid);

                    String title = unescapeJson(titleMatcher.group(1));
                    String artist = "Artis";
                    Matcher ownerMatcher = ownerPattern.matcher(block);
                    if (ownerMatcher.find()) {
                        artist = unescapeJson(ownerMatcher.group(1));
                    }
                    String durStr = "3:30";
                    Matcher durMatcher = durPattern.matcher(block);
                    if (durMatcher.find()) {
                        durStr = durMatcher.group(1);
                    }

                    int durSecs = parseDuration(durStr);
                    if (durSecs > 7200) continue; // Skip excessively long compilations

                    JSONObject track = new JSONObject();
                    track.put("id", "yt-" + vid);
                    track.put("videoId", vid);
                    track.put("title", title);
                    track.put("artist", artist);
                    track.put("duration", durSecs);
                    track.put("durationStr", durStr);
                    track.put("artwork", "https://i.ytimg.com/vi/" + vid + "/hqdefault.jpg");
                    track.put("genre", "YouTube Music");
                    track.put("source", "youtube");
                    track.put("isRadio", false);
                    track.put("isLocal", false);

                    results.put(track);
                }
            }

            JSONObject resp = new JSONObject();
            resp.put("status", "success");
            resp.put("data", results);
            resp.put("page", page);
            return resp.toString();
        } catch (Exception e) {
            e.printStackTrace();
            return "{\"status\":\"error\",\"data\":[]}";
        }
    }

    private String executeYouTubeSuggest(String query) {
        if (query == null || query.trim().isEmpty()) return "{\"status\":\"success\",\"data\":[]}";
        try {
            String suggestUrl = "https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=" + URLEncoder.encode(query.trim(), "UTF-8");
            String res = fetchHttp(suggestUrl);
            if (res != null) {
                JSONArray arr = new JSONArray(res);
                if (arr.length() > 1) {
                    JSONArray suggestions = arr.getJSONArray(1);
                    JSONObject out = new JSONObject();
                    out.put("status", "success");
                    out.put("data", suggestions);
                    return out.toString();
                }
            }
        } catch (Exception ignored) {}
        return "{\"status\":\"success\",\"data\":[]}";
    }

    private static String fetchHttp(String urlStr) {
        try {
            URL url = new URL(urlStr);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(6000);
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
            conn.setRequestProperty("Accept-Language", "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7");
            if (conn.getResponseCode() == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
                reader.close();
                return sb.toString();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return null;
    }

    private static int parseDuration(String dur) {
        if (dur == null) return 210;
        try {
            String[] parts = dur.split(":");
            if (parts.length == 2) {
                return Integer.parseInt(parts[0]) * 60 + Integer.parseInt(parts[1]);
            } else if (parts.length == 3) {
                return Integer.parseInt(parts[0]) * 3600 + Integer.parseInt(parts[1]) * 60 + Integer.parseInt(parts[2]);
            }
        } catch (Exception ignored) {}
        return 210;
    }

    private static String unescapeJson(String text) {
        if (text == null) return "";
        return text.replace("\\\"", "\"").replace("\\/", "/").replace("\\\\", "\\");
    }

    private void setupBackPressed() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            private long backPressedTime = 0;

            @Override
            public void handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    if (System.currentTimeMillis() - backPressedTime < 2000) {
                        finish();
                    } else {
                        backPressedTime = System.currentTimeMillis();
                        Toast.makeText(MainActivity.this, "Tekan sekali lagi untuk keluar dari HarmoniX", Toast.LENGTH_SHORT).show();
                    }
                }
            }
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onPause() {
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
