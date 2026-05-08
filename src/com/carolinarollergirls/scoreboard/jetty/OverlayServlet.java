package com.carolinarollergirls.scoreboard.jetty;

import java.io.IOException;
import java.util.Collections;
import java.util.Map;
import java.util.regex.Pattern;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.carolinarollergirls.scoreboard.core.interfaces.Clients.Device;
import com.carolinarollergirls.scoreboard.core.interfaces.ScoreBoard;
import com.carolinarollergirls.scoreboard.event.ScoreBoardEventProvider.Source;
import com.carolinarollergirls.scoreboard.json.JSONStateManager;
import com.carolinarollergirls.scoreboard.json.ScoreBoardJSONSetter;

/**
 * HTTP servlet for controlling overlay interactive settings from external tools
 * such as Elgato Stream Deck. Accepts GET requests to set or toggle settings.
 *
 * Examples:
 *   GET /Overlay?set=Clock&value=true
 *   GET /Overlay?toggle=Score
 *   GET /Overlay?panel=PPJBox         (toggles: sets if different, clears if same)
 *   GET /Overlay?set-panel=PPJBox     (sets unconditionally)
 *   GET /Overlay?clear-panel          (clears the panel)
 */
public class OverlayServlet extends HttpServlet {

    private static final String SETTING_PREFIX = "ScoreBoard.Settings.Setting(Overlay.Interactive.";
    private static final String SETTING_SUFFIX = ")";

    /** Only allow key names that are safe identifiers (letters, digits, dots). */
    private static final Pattern SAFE_KEY = Pattern.compile("[A-Za-z][A-Za-z0-9.]*");

    public OverlayServlet(ScoreBoard sb, JSONStateManager jsm) {
        this.sb = sb;
        this.jsm = jsm;
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setHeader("Cache-Control", "no-cache");
        response.setCharacterEncoding("utf-8");

        String sessionId = request.getSession().getId();
        Device device = sb.getClients().getOrAddDevice(sessionId);
        sb.getClients().addClient(device.getId(), request.getRemoteAddr(), "StreamDeck", null);
        device.access();

        if (!device.mayWrite()) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "Not authorized");
            return;
        }

        String toggleParam = request.getParameter("toggle");
        String setParam = request.getParameter("set");
        String panelParam = request.getParameter("panel");
        String setPanelParam = request.getParameter("set-panel");
        boolean clearPanel = request.getParameter("clear-panel") != null;

        if (toggleParam != null) {
            if (!isSafeKey(toggleParam)) {
                response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Invalid key name");
                return;
            }
            handleToggle(toggleParam, response);
        } else if (setParam != null) {
            if (!isSafeKey(setParam)) {
                response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Invalid key name");
                return;
            }
            String value = request.getParameter("value");
            if (value == null) {
                response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Missing 'value' parameter");
                return;
            }
            handleSet(setParam, value, response);
        } else if (panelParam != null) {
            handlePanelToggle(panelParam, response);
        } else if (setPanelParam != null) {
            handleSetPanel(setPanelParam, response);
        } else if (clearPanel) {
            handleSetPanel("", response);
        } else {
            response.sendError(HttpServletResponse.SC_BAD_REQUEST,
                "Use ?set=<key>&value=<val>, ?toggle=<key>, ?panel=<value>, ?set-panel=<value>, or ?clear-panel");
        }
    }

    private boolean isSafeKey(String key) {
        return key != null && SAFE_KEY.matcher(key).matches();
    }

    private void handleSet(String key, String value, HttpServletResponse response) throws IOException {
        setStateSetting(key, value);
        sendOk(response, "Set " + key + " = " + value);
    }

    private void handleToggle(String key, HttpServletResponse response) throws IOException {
        String fullKey = SETTING_PREFIX + key + SETTING_SUFFIX;
        Map<String, Object> state = jsm.getState(false);
        Object current = state.get(fullKey);
        String newValue = "true".equalsIgnoreCase(String.valueOf(current)) ? "false" : "true";
        setStateKey(fullKey, newValue);
        sendOk(response, "Toggled " + key + " \u2192 " + newValue);
    }

    private void handlePanelToggle(String panel, HttpServletResponse response) throws IOException {
        String fullKey = SETTING_PREFIX + "Panel" + SETTING_SUFFIX;
        Map<String, Object> state = jsm.getState(false);
        Object current = state.get(fullKey);
        String newValue = panel.equals(String.valueOf(current)) ? "" : panel;
        setStateKey(fullKey, newValue);
        sendOk(response, "Panel \u2192 " + (newValue.isEmpty() ? "(none)" : newValue));
    }

    private void handleSetPanel(String panel, HttpServletResponse response) throws IOException {
        setStateSetting("Panel", panel);
        sendOk(response, "Panel \u2192 " + (panel.isEmpty() ? "(none)" : panel));
    }

    private void setStateSetting(String key, String value) {
        setStateKey(SETTING_PREFIX + key + SETTING_SUFFIX, value);
    }

    private void setStateKey(String fullKey, String value) {
        final ScoreBoardJSONSetter.JSONSet js = new ScoreBoardJSONSetter.JSONSet(fullKey, value, null);
        sb.runInBatch(new Runnable() {
            @Override
            public void run() {
                ScoreBoardJSONSetter.set(sb, Collections.singletonList(js), Source.WS);
            }
        });
    }

    private void sendOk(HttpServletResponse response, String message) throws IOException {
        response.setContentType("application/json");
        // Sanitize message to avoid JSON injection
        String safe = message.replace("\\", "\\\\").replace("\"", "\\\"");
        response.getWriter().write("{\"status\":\"ok\",\"message\":\"" + safe + "\"}");
        response.setStatus(HttpServletResponse.SC_OK);
    }

    private final ScoreBoard sb;
    private final JSONStateManager jsm;
}
