package com.plainward.bitbucket.markdownx.service;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

class PlantUmlServiceTest {

    private PlantUmlService service;

    @AfterEach
    void tearDown() {
        if (service != null) {
            service.destroy();
        }
    }

    @Test
    void rendersSvgAndWrapsMissingStartTag() throws Exception {
        service = new PlantUmlService();
        String svg = service.renderSvg("Alice -> Bob : hello");
        assertTrue(svg.contains("<svg"), svg);
        assertTrue(svg.contains("Alice"));
    }

    @Test
    void rejectsEmptyAndOversizedSource() {
        service = new PlantUmlService();
        assertThrows(PlantUmlService.PlantUmlRenderException.class, () -> service.renderSvg("  "));
        assertThrows(PlantUmlService.PlantUmlRenderException.class, () -> service.renderSvg(null));
        String huge = "A -> B\n".repeat(PlantUmlService.MAX_SOURCE_LENGTH / 7 + 1);
        assertThrows(PlantUmlService.PlantUmlRenderException.class, () -> service.renderSvg(huge));
    }

    @Test
    void doesNotLeakSecurityProfileIntoJvm() {
        String before = System.getProperty("PLANTUML_SECURITY_PROFILE");
        service = new PlantUmlService();
        assertEquals(before, System.getProperty("PLANTUML_SECURITY_PROFILE"));
    }

    @Test
    void sandboxBlocksLocalFileInclude() throws Exception {
        service = new PlantUmlService();
        String svg = service.renderSvg("@startuml\n!include /etc/passwd\nA -> B\n@enduml");
        assertFalse(svg.contains("root:"), "local file content leaked into SVG");
    }

    @Test
    void timesOutSlowRenders() {
        service = new PlantUmlService(1, 1, 1);
        PlantUmlService.PlantUmlRenderException e = assertThrows(PlantUmlService.PlantUmlRenderException.class,
                () -> service.renderSvg("@startuml\nA -> B\n@enduml"));
        assertTrue(e.getMessage().contains("timed out"), e.getMessage());
    }

    @Test
    void rejectsWhenQueueIsFull() throws Exception {
        service = new PlantUmlService(1, 1, 30_000);
        String slow = "@startuml\n" + "A -> B\n".repeat(2_000) + "@enduml";
        ExecutorService callers = Executors.newFixedThreadPool(8);
        CountDownLatch start = new CountDownLatch(1);
        try {
            Future<?>[] results = new Future<?>[8];
            for (int i = 0; i < results.length; i++) {
                results[i] = callers.submit(() -> {
                    start.await();
                    return service.renderSvg(slow);
                });
            }
            start.countDown();
            int busy = 0;
            for (Future<?> f : results) {
                try {
                    f.get(60, TimeUnit.SECONDS);
                } catch (java.util.concurrent.ExecutionException ex) {
                    if (ex.getCause() instanceof PlantUmlService.PlantUmlBusyException) {
                        busy++;
                    }
                }
            }
            assertTrue(busy > 0, "expected at least one request to be rejected as busy");
        } finally {
            callers.shutdownNow();
        }
    }
}
