package com.plainward.bitbucket.markdownx.service;

import net.sourceforge.plantuml.SourceStringReader;
import net.sourceforge.plantuml.FileFormatOption;
import net.sourceforge.plantuml.FileFormat;
import net.sourceforge.plantuml.security.SecurityProfile;
import net.sourceforge.plantuml.security.SecurityUtils;

import com.atlassian.plugin.spring.scanner.annotation.export.ExportAsService;
import org.springframework.beans.factory.DisposableBean;

import javax.inject.Named;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;

@Named
@ExportAsService
public class PlantUmlService implements DisposableBean {

    static final int MAX_SOURCE_LENGTH = 50_000;
    static final long RENDER_TIMEOUT_MS = 10_000;
    static final int MAX_CONCURRENT_RENDERS = Math.max(1, Math.min(4, Runtime.getRuntime().availableProcessors() / 2));
    static final int MAX_QUEUED_RENDERS = 16;

    private static final String SECURITY_PROFILE_PROPERTY = "PLANTUML_SECURITY_PROFILE";

    private final ThreadPoolExecutor executor;
    private final long timeoutMs;

    public PlantUmlService() {
        this(MAX_CONCURRENT_RENDERS, MAX_QUEUED_RENDERS, RENDER_TIMEOUT_MS);
    }

    PlantUmlService(int threads, int queueSize, long timeoutMs) {
        pinSandboxProfile();
        this.timeoutMs = timeoutMs;
        this.executor = new ThreadPoolExecutor(threads, threads, 0L, TimeUnit.MILLISECONDS,
                new ArrayBlockingQueue<>(queueSize), new RenderThreadFactory(),
                new ThreadPoolExecutor.AbortPolicy());
    }

    /**
     * PlantUML reads its security profile from a system property once and caches it
     * in {@link SecurityUtils}. Our PlantUML copy lives in this plugin's classloader,
     * so we set the property only long enough to pin SANDBOX there, then restore it
     * to avoid changing JVM-wide state for Bitbucket and other apps.
     */
    private static synchronized void pinSandboxProfile() {
        String previous = System.getProperty(SECURITY_PROFILE_PROPERTY);
        try {
            System.setProperty(SECURITY_PROFILE_PROPERTY, SecurityProfile.SANDBOX.name());
            SecurityProfile active = SecurityUtils.getSecurityProfile();
            if (active != SecurityProfile.SANDBOX) {
                throw new IllegalStateException("PlantUML security profile is " + active + ", expected SANDBOX");
            }
        } finally {
            if (previous == null) {
                System.clearProperty(SECURITY_PROFILE_PROPERTY);
            } else {
                System.setProperty(SECURITY_PROFILE_PROPERTY, previous);
            }
        }
    }

    public String renderSvg(String source) throws PlantUmlRenderException {
        if (source == null || source.trim().isEmpty()) {
            throw new PlantUmlRenderException("Empty PlantUML source");
        }
        if (source.length() > MAX_SOURCE_LENGTH) {
            throw new PlantUmlRenderException("PlantUML source exceeds maximum length of " + MAX_SOURCE_LENGTH);
        }

        String wrappedSource = source.trim();
        if (!wrappedSource.startsWith("@start")) {
            wrappedSource = "@startuml\n" + wrappedSource + "\n@enduml";
        }
        final String finalSource = wrappedSource;

        Future<String> future;
        try {
            future = executor.submit(() -> doRender(finalSource));
        } catch (RejectedExecutionException e) {
            throw new PlantUmlBusyException("PlantUML renderer is busy, try again later");
        }

        try {
            return future.get(timeoutMs, TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            future.cancel(true);
            throw new PlantUmlRenderException("PlantUML rendering timed out after " + timeoutMs + " ms");
        } catch (InterruptedException e) {
            future.cancel(true);
            Thread.currentThread().interrupt();
            throw new PlantUmlRenderException("PlantUML rendering was interrupted");
        } catch (ExecutionException e) {
            Throwable cause = e.getCause();
            if (cause instanceof PlantUmlRenderException) {
                throw (PlantUmlRenderException) cause;
            }
            throw new PlantUmlRenderException("Failed to render PlantUML: " + cause.getMessage(), cause);
        }
    }

    private static String doRender(String source) throws PlantUmlRenderException {
        try {
            SourceStringReader reader = new SourceStringReader(source);
            ByteArrayOutputStream os = new ByteArrayOutputStream();
            reader.outputImage(os, new FileFormatOption(FileFormat.SVG));
            String svg = os.toString(StandardCharsets.UTF_8.name());

            if (svg == null || svg.trim().isEmpty()) {
                throw new PlantUmlRenderException("PlantUML produced empty output");
            }

            return svg;
        } catch (IOException e) {
            throw new PlantUmlRenderException("Failed to render PlantUML: " + e.getMessage(), e);
        }
    }

    @Override
    public void destroy() {
        executor.shutdownNow();
    }

    private static final class RenderThreadFactory implements ThreadFactory {
        private final AtomicInteger counter = new AtomicInteger();

        @Override
        public Thread newThread(Runnable r) {
            Thread t = new Thread(r, "markdownx-plantuml-" + counter.incrementAndGet());
            t.setDaemon(true);
            return t;
        }
    }

    public static class PlantUmlRenderException extends Exception {
        public PlantUmlRenderException(String message) {
            super(message);
        }

        public PlantUmlRenderException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    /** Thrown when the render queue is full; maps to HTTP 503. */
    public static class PlantUmlBusyException extends PlantUmlRenderException {
        public PlantUmlBusyException(String message) {
            super(message);
        }
    }
}
