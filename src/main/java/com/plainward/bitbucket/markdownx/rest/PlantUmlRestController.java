package com.plainward.bitbucket.markdownx.rest;

import com.atlassian.bitbucket.auth.AuthenticationContext;
import com.atlassian.plugin.spring.scanner.annotation.imports.ComponentImport;
import com.plainward.bitbucket.markdownx.service.PlantUmlService;

import javax.inject.Inject;
import javax.inject.Named;
import javax.ws.rs.*;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.util.HashMap;
import java.util.Map;

@Named
@Path("/plantuml")
public class PlantUmlRestController {

    private final PlantUmlService plantUmlService;
    private final AuthenticationContext authenticationContext;

    @Inject
    public PlantUmlRestController(PlantUmlService plantUmlService,
                                  @ComponentImport AuthenticationContext authenticationContext) {
        this.plantUmlService = plantUmlService;
        this.authenticationContext = authenticationContext;
    }

    @POST
    @Path("/render")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response renderPlantUml(Map<String, String> request) {
        if (!authenticationContext.isAuthenticated()) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "Authentication required");
            return Response.status(Response.Status.FORBIDDEN).entity(error).build();
        }

        String source = request == null ? null : request.get("source");
        if (source == null || source.trim().isEmpty()) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "Missing 'source' field");
            return Response.status(Response.Status.BAD_REQUEST).entity(error).build();
        }

        try {
            String svg = plantUmlService.renderSvg(source);
            Map<String, String> result = new HashMap<>();
            result.put("svg", svg);
            return Response.ok(result).build();
        } catch (PlantUmlService.PlantUmlBusyException e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return Response.status(Response.Status.SERVICE_UNAVAILABLE).entity(error).build();
        } catch (PlantUmlService.PlantUmlRenderException e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return Response.status(Response.Status.BAD_REQUEST).entity(error).build();
        }
    }
}
