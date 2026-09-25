package com.plainward.bitbucket.markdownx.servlet;

import com.atlassian.bitbucket.auth.AuthenticationContext;
import com.atlassian.bitbucket.permission.Permission;
import com.atlassian.bitbucket.permission.PermissionService;
import com.atlassian.plugin.spring.scanner.annotation.imports.ComponentImport;
import com.atlassian.sal.api.auth.LoginUriProvider;

import javax.inject.Inject;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;

/**
 * Serves the MarkdownX admin page to system administrators only.
 * The page itself is static; settings are read and written through
 * {@code /rest/markdownx/1.0/settings}, which enforces the same check.
 */
public class AdminServlet extends HttpServlet {

    static final String TEMPLATE = "/templates/admin.html";

    private final AuthenticationContext authenticationContext;
    private final PermissionService permissionService;
    private final LoginUriProvider loginUriProvider;

    @Inject
    public AdminServlet(@ComponentImport AuthenticationContext authenticationContext,
                        @ComponentImport PermissionService permissionService,
                        @ComponentImport LoginUriProvider loginUriProvider) {
        this.authenticationContext = authenticationContext;
        this.permissionService = permissionService;
        this.loginUriProvider = loginUriProvider;
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        if (!authenticationContext.isAuthenticated()) {
            resp.sendRedirect(loginUriProvider.getLoginUri(currentUri(req)).toASCIIString());
            return;
        }
        if (!permissionService.hasGlobalPermission(Permission.SYS_ADMIN)) {
            resp.sendError(HttpServletResponse.SC_FORBIDDEN, "System admin access required");
            return;
        }

        byte[] page;
        try (InputStream in = AdminServlet.class.getResourceAsStream(TEMPLATE)) {
            if (in == null) {
                resp.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Admin page not found");
                return;
            }
            page = in.readAllBytes();
        }

        resp.setContentType("text/html");
        resp.setCharacterEncoding(StandardCharsets.UTF_8.name());
        resp.setHeader("Cache-Control", "no-store");
        resp.setHeader("X-Content-Type-Options", "nosniff");
        resp.setHeader("X-Frame-Options", "SAMEORIGIN");
        resp.getOutputStream().write(page);
    }

    private static URI currentUri(HttpServletRequest req) {
        StringBuffer url = req.getRequestURL();
        if (req.getQueryString() != null) {
            url.append('?').append(req.getQueryString());
        }
        return URI.create(url.toString());
    }
}
