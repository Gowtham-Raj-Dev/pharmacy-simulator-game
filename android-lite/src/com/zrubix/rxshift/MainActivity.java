package com.zrubix.rxshift;

import android.app.Activity;
import android.content.res.AssetManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * RxShift — standalone Android shell: a full-screen, hardware-accelerated WebView that serves the
 * game (assets/www) from a secure https origin, so ES modules, WebGL2, localStorage saves and the
 * avatar files (people/*.glb) all work offline. No network is used.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String BASE = "https://" + HOST + "/";
    private WebView web;
    private long lastBack = 0;
    private TextToSpeech tts;
    private volatile boolean ttsReady = false;

    private static final Map<String, String> MIME = new HashMap<>();
    static {
        MIME.put("html", "text/html"); MIME.put("js", "text/javascript"); MIME.put("mjs", "text/javascript");
        MIME.put("css", "text/css"); MIME.put("json", "application/json"); MIME.put("glb", "model/gltf-binary");
        MIME.put("jpg", "image/jpeg"); MIME.put("jpeg", "image/jpeg"); MIME.put("png", "image/png");
        MIME.put("webp", "image/webp"); MIME.put("svg", "image/svg+xml"); MIME.put("woff2", "font/woff2");
        MIME.put("woff", "font/woff"); MIME.put("md", "text/markdown"); MIME.put("txt", "text/plain");
        MIME.put("wasm", "application/wasm"); MIME.put("mp3", "audio/mpeg"); MIME.put("ogg", "audio/ogg");
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        // draw behind the camera notch (API 28+: LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES = 1)
        try {
            WindowManager.LayoutParams lp = w.getAttributes();
            lp.getClass().getField("layoutInDisplayCutoutMode").setInt(lp, 1);
            w.setAttributes(lp);
        } catch (Throwable ignored) { }

        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(11, 31, 29));
        web.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setTextZoom(100);                  // the game has its own text-size setting
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setLoadWithOverviewMode(false);
        s.setUseWideViewPort(true);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        s.setUserAgentString(s.getUserAgentString() + " RxShiftApp/3.0");

        final AssetManager assets = getAssets();
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                return serve(assets, req.getUrl());
            }
            @Override
            @SuppressWarnings("deprecation")
            public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                return serve(assets, Uri.parse(url));
            }
            // (API 24+ overload; android-23 stubs don't declare it, so no @Override)
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return !HOST.equals(req.getUrl().getHost());
            }
            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return !HOST.equals(Uri.parse(url).getHost());
            }
        });
        web.setWebChromeClient(new WebChromeClient());
        tts = new TextToSpeech(this, new TextToSpeech.OnInitListener() {
            @Override public void onInit(int status) { ttsReady = status == TextToSpeech.SUCCESS; }
        });
        web.addJavascriptInterface(new Voice(), "RxTTS");
        setContentView(web);
        hideSystemBars();
        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(BASE + "index.html");
    }

    private WebResourceResponse serve(AssetManager assets, Uri uri) {
        if (uri == null || !HOST.equals(uri.getHost())) return null;
        String path = uri.getPath();
        if (path == null || path.equals("/") || path.isEmpty()) path = "/index.html";
        String file = "www" + path;
        int dot = path.lastIndexOf('.');
        String ext = dot >= 0 ? path.substring(dot + 1).toLowerCase() : "";
        String mime = MIME.containsKey(ext) ? MIME.get(ext) : "application/octet-stream";
        try {
            InputStream in = assets.open(file, AssetManager.ACCESS_STREAMING);
            Map<String, String> headers = new HashMap<>();
            headers.put("Access-Control-Allow-Origin", "*");
            headers.put("Cache-Control", "no-cache");
            boolean text = mime.startsWith("text/") || mime.equals("application/json");
            return new WebResourceResponse(mime, text ? "utf-8" : null, 200, "OK", headers, in);
        } catch (IOException e) {
            Map<String, String> headers = new HashMap<>();
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", headers, new java.io.ByteArrayInputStream(new byte[0]));
        }
    }

    private void hideSystemBars() {
        View d = getWindow().getDecorView();
        d.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    /** Back = Esc in the game (closes the open panel, or opens the menu). Double-tap back quickly to exit. */
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            long now = System.currentTimeMillis();
            if (now - lastBack < 450) { finish(); return true; }
            if (lastBack == 0) Toast.makeText(this, R.string.exit_hint, Toast.LENGTH_SHORT).show();
            lastBack = now;
            web.evaluateJavascript("window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true}));", null);
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override protected void onPause() { super.onPause(); if (web != null) web.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); hideSystemBars(); }
    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); if (web != null) web.saveState(out); }
    @Override protected void onDestroy() { if (tts != null) { tts.shutdown(); tts = null; } if (web != null) { web.destroy(); web = null; } super.onDestroy(); }

    /** window.RxTTS: native text-to-speech for customer dialogue (the WebView has no speechSynthesis). */
    private class Voice {
        private Locale locale(String tag) { String[] p = tag.split("-"); return p.length > 1 ? new Locale(p[0], p[1]) : new Locale(p[0]); }
        @JavascriptInterface public boolean hasLang(String tag) {
            return tts != null && tts.isLanguageAvailable(locale(tag)) >= TextToSpeech.LANG_AVAILABLE;
        }
        @JavascriptInterface public void speak(String text, String tag, float rate, float pitch, float volume) {
            if (tts == null || !ttsReady) return;
            tts.setLanguage(locale(tag));
            tts.setSpeechRate(rate);
            tts.setPitch(pitch);
            Bundle b = new Bundle();
            b.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, volume);
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, b, "rx");
        }
        /** Like speak(), but queue = true waits for the current line (pharmacist asks → customer answers). */
        @JavascriptInterface public void speakQ(String text, String tag, float rate, float pitch, float volume, boolean queue) {
            if (tts == null || !ttsReady) return;
            tts.setLanguage(locale(tag));
            tts.setSpeechRate(rate);
            tts.setPitch(pitch);
            Bundle b = new Bundle();
            b.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, volume);
            tts.speak(text, queue ? TextToSpeech.QUEUE_ADD : TextToSpeech.QUEUE_FLUSH, b, "rx" + System.nanoTime());
        }
        @JavascriptInterface public void stop() { if (tts != null) tts.stop(); }
    }
}
