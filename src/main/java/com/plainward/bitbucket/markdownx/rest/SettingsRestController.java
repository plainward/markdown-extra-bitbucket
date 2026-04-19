package com.plainward.bitbucket.markdownx.rest;

import com.atlassian.bitbucket.auth.AuthenticationContext;
import com.atlassian.bitbucket.permission.Permission;
import com.atlassian.bitbucket.permission.PermissionService;
import com.atlassian.plugin.spring.scanner.annotation.imports.ComponentImport;
import com.plainward.bitbucket.markdownx.service.SettingsService;

import javax.inject.Inject;
import javax.inject.Named;
import javax.ws.rs.*;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.util.HashMap;
import java.util.Map;

@Named
@Path("/settings")
public class SettingsRestController {

    private final SettingsService settingsService;
    private final AuthenticationContext authenticationContext;
    private final PermissionService permissionService;

    @Inject
    public SettingsRestController(SettingsService settingsService,
                                  @ComponentImport AuthenticationContext authenticationContext,
                                  @ComponentImport PermissionService permissionService) {
        this.settingsService = settingsService;
        this.authenticationContext = authenticationContext;
        this.permissionService = permissionService;
    }

    private boolean isSystemAdmin() {
        return authenticationContext.isAuthenticated()
                && permissionService.hasGlobalPermission(Permission.SYS_ADMIN);
    }

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response getSettings() {
        if (!authenticationContext.isAuthenticated()) {
            return Response.status(Response.Status.FORBIDDEN)
                    .entity("{\"error\":\"Authentication required\"}")
                    .build();
        }
        Map<String, Object> settings = settingsService.getSettings();
        return Response.ok(settings).build();
    }

    @PUT
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response saveSettings(Map<String, Object> newSettings) {
        if (!isSystemAdmin()) {
            return Response.status(Response.Status.FORBIDDEN)
                    .entity("{\"error\":\"System admin access required\"}")
                    .build();
        }
        settingsService.saveSettings(newSettings);
        Map<String, Object> result = new HashMap<>();
        result.put("status", "saved");
        return Response.ok(result).build();
    }
}
