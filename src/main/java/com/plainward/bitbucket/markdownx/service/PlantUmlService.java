package com.plainward.bitbucket.markdownx.service;

import net.sourceforge.plantuml.SourceStringReader;
import net.sourceforge.plantuml.FileFormatOption;
import net.sourceforge.plantuml.FileFormat;

import com.atlassian.plugin.spring.scanner.annotation.export.ExportAsService;
import javax.inject.Named;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

@Named
@ExportAsService
public class PlantUmlService {

    private static final int MAX_SOURCE_LENGTH = 50_000;

    static {
        System.setProperty("PLANTUML_SECURITY_PROFILE", "SANDBOX");
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

        try {
            SourceStringReader reader = new SourceStringReader(wrappedSource);
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

    public static class PlantUmlRenderException extends Exception {
        public PlantUmlRenderException(String message) {
            super(message);
        }

        public PlantUmlRenderException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
