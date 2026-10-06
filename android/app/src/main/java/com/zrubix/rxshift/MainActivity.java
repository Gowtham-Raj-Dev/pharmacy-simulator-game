package com.zrubix.rxshift;

import android.os.Build;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import java.util.Locale;

/**
 * RxShift game window: always full screen. The status bar (clock, battery) and the navigation bar stay
 * hidden; a swipe from the edge shows them for a moment and they hide again by themselves. The screen
 * stays on while playing, the game draws edge to edge, and the camera cutout's size is passed to the
 * page as its safe-area padding (--safe-*) so no button sits under the notch.
 */
public class MainActivity extends BridgeActivity {

    private String safeAreaJs = null;
    private long lastBack = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        WindowCompat.setDecorFitsSystemWindows(w, false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = w.getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            w.setAttributes(lp);
        }
        hideSystemBars();
        if (bridge == null) return; // (no WebView on this device: Capacitor shows its own message)

        WebView web = bridge.getWebView();
        ViewCompat.setOnApplyWindowInsetsListener(web, (v, insets) -> {
            Insets c = insets.getInsets(WindowInsetsCompat.Type.displayCutout());
            float d = getResources().getDisplayMetrics().density;
            safeAreaJs = String.format(Locale.US,
                "(function(r){if(!r)return;r.style.setProperty('--safe-t','%.1fpx');r.style.setProperty('--safe-r','%.1fpx');"
                    + "r.style.setProperty('--safe-b','%.1fpx');r.style.setProperty('--safe-l','%.1fpx');})(document.documentElement)",
                c.top / d, c.right / d, c.bottom / d, c.left / d);
            web.evaluateJavascript(safeAreaJs, null);
            return ViewCompat.onApplyWindowInsets(v, insets);
        });
        bridge.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView view) {
                if (safeAreaJs != null) view.evaluateJavascript(safeAreaJs, null);
            }
        });

        // Back = Esc in the game (closes the open panel, or opens the menu). Double-tap back quickly to exit.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                long now = System.currentTimeMillis();
                if (now - lastBack < 450) { finish(); return; }
                if (lastBack == 0) Toast.makeText(MainActivity.this, R.string.exit_hint, Toast.LENGTH_SHORT).show();
                lastBack = now;
                web.evaluateJavascript("window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true}));", null);
            }
        });
    }

    private void hideSystemBars() {
        Window w = getWindow();
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(w, w.getDecorView());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        c.hide(WindowInsetsCompat.Type.systemBars());
    }

    // (Android brings the bars back after the notification shade, a dialog, the recents screen or a toast)
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @Override
    public void onResume() {
        super.onResume();
        hideSystemBars();
    }
}
