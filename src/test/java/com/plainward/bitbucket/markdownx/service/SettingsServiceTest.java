package com.plainward.bitbucket.markdownx.service;

import com.atlassian.sal.api.pluginsettings.PluginSettings;
import com.atlassian.sal.api.pluginsettings.PluginSettingsFactory;
import com.atlassian.sal.api.transaction.TransactionCallback;
import com.atlassian.sal.api.transaction.TransactionTemplate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class SettingsServiceTest {

    private final Map<String, Object> store = new HashMap<>();
    private SettingsService service;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        PluginSettings settings = mock(PluginSettings.class);
        when(settings.get(anyString())).thenAnswer(inv -> store.get(inv.<String>getArgument(0)));
        when(settings.put(anyString(), any())).thenAnswer(inv -> store.put(inv.getArgument(0), inv.getArgument(1)));

        PluginSettingsFactory factory = mock(PluginSettingsFactory.class);
        when(factory.createGlobalSettings()).thenReturn(settings);

        TransactionTemplate tx = mock(TransactionTemplate.class);
        when(tx.execute(any())).thenAnswer(inv -> inv.<TransactionCallback<?>>getArgument(0).doInTransaction());

        service = new SettingsService(factory, tx);
    }

    @Test
    void returnsDefaultsWhenNothingStored() {
        Map<String, Object> s = service.getSettings();
        assertEquals(true, s.get("mermaidEnabled"));
        assertEquals(true, s.get("plantumlEnabled"));
        assertEquals(true, s.get("mathEnabled"));
        assertEquals("default", s.get("mermaidTheme"));
    }

    @Test
    void savesAndReadsBack() {
        Map<String, Object> update = new HashMap<>();
        update.put("plantumlEnabled", false);
        update.put("mermaidTheme", "dark");
        service.saveSettings(update);

        Map<String, Object> s = service.getSettings();
        assertEquals(false, s.get("plantumlEnabled"));
        assertEquals(true, s.get("mermaidEnabled"));
        assertEquals("dark", s.get("mermaidTheme"));
    }

    @Test
    void ignoresUnknownTheme() {
        Map<String, Object> update = new HashMap<>();
        update.put("mermaidTheme", "<script>");
        service.saveSettings(update);
        assertEquals("default", service.getSettings().get("mermaidTheme"));
    }
}
