package com.plainward.bitbucket.markdownx.service;

import com.atlassian.plugin.spring.scanner.annotation.export.ExportAsService;
import com.atlassian.plugin.spring.scanner.annotation.imports.ComponentImport;
import com.atlassian.sal.api.pluginsettings.PluginSettings;
import com.atlassian.sal.api.pluginsettings.PluginSettingsFactory;
import com.atlassian.sal.api.transaction.TransactionCallback;
import com.atlassian.sal.api.transaction.TransactionTemplate;

import javax.inject.Inject;
import javax.inject.Named;
import java.util.HashMap;
import java.util.Map;

@Named
@ExportAsService
public class SettingsService {

    private static final String PLUGIN_KEY = "com.plainward.bitbucket.markdown-extra";
    private static final java.util.Set<String> VALID_THEMES = java.util.Set.of("default", "dark", "forest", "neutral");
    private static final String KEY_MERMAID_ENABLED = PLUGIN_KEY + ".mermaid.enabled";
    private static final String KEY_PLANTUML_ENABLED = PLUGIN_KEY + ".plantuml.enabled";
    private static final String KEY_MATH_ENABLED = PLUGIN_KEY + ".math.enabled";
    private static final String KEY_MERMAID_THEME = PLUGIN_KEY + ".mermaid.theme";

    private final PluginSettingsFactory pluginSettingsFactory;
    private final TransactionTemplate transactionTemplate;

    @Inject
    public SettingsService(@ComponentImport PluginSettingsFactory pluginSettingsFactory,
                           @ComponentImport TransactionTemplate transactionTemplate) {
        this.pluginSettingsFactory = pluginSettingsFactory;
        this.transactionTemplate = transactionTemplate;
    }

    public Map<String, Object> getSettings() {
        return transactionTemplate.execute((TransactionCallback<Map<String, Object>>) () -> {
            PluginSettings settings = pluginSettingsFactory.createGlobalSettings();
            Map<String, Object> result = new HashMap<>();
            result.put("mermaidEnabled", getBooleanSetting(settings, KEY_MERMAID_ENABLED, true));
            result.put("plantumlEnabled", getBooleanSetting(settings, KEY_PLANTUML_ENABLED, true));
            result.put("mathEnabled", getBooleanSetting(settings, KEY_MATH_ENABLED, true));
            result.put("mermaidTheme", getStringSetting(settings, KEY_MERMAID_THEME, "default"));
            return result;
        });
    }

    public void saveSettings(Map<String, Object> newSettings) {
        transactionTemplate.execute((TransactionCallback<Void>) () -> {
            PluginSettings settings = pluginSettingsFactory.createGlobalSettings();
            if (newSettings.containsKey("mermaidEnabled")) {
                settings.put(KEY_MERMAID_ENABLED, String.valueOf(newSettings.get("mermaidEnabled")));
            }
            if (newSettings.containsKey("plantumlEnabled")) {
                settings.put(KEY_PLANTUML_ENABLED, String.valueOf(newSettings.get("plantumlEnabled")));
            }
            if (newSettings.containsKey("mathEnabled")) {
                settings.put(KEY_MATH_ENABLED, String.valueOf(newSettings.get("mathEnabled")));
            }
            if (newSettings.containsKey("mermaidTheme")) {
                String theme = String.valueOf(newSettings.get("mermaidTheme"));
                if (VALID_THEMES.contains(theme)) {
                    settings.put(KEY_MERMAID_THEME, theme);
                }
            }
            return null;
        });
    }

    private boolean getBooleanSetting(PluginSettings settings, String key, boolean defaultValue) {
        String value = (String) settings.get(key);
        return value == null ? defaultValue : Boolean.parseBoolean(value);
    }

    private String getStringSetting(PluginSettings settings, String key, String defaultValue) {
        String value = (String) settings.get(key);
        return value == null ? defaultValue : value;
    }
}
