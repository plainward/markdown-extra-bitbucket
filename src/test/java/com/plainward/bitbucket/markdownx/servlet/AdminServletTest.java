package com.plainward.bitbucket.markdownx.servlet;

import com.atlassian.bitbucket.auth.AuthenticationContext;
import com.atlassian.bitbucket.permission.Permission;
import com.atlassian.bitbucket.permission.PermissionService;
import com.atlassian.sal.api.auth.LoginUriProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import javax.servlet.ServletOutputStream;
import javax.servlet.WriteListener;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class AdminServletTest {

    private AuthenticationContext auth;
    private PermissionService permissions;
    private LoginUriProvider login;
    private HttpServletRequest req;
    private HttpServletResponse resp;
    private AdminServlet servlet;

    @BeforeEach
    void setUp() {
        auth = mock(AuthenticationContext.class);
        permissions = mock(PermissionService.class);
        login = mock(LoginUriProvider.class);
        req = mock(HttpServletRequest.class);
        resp = mock(HttpServletResponse.class);
        when(req.getRequestURL()).thenReturn(new StringBuffer("http://bb/plugins/servlet/markdownx/admin"));
        servlet = new AdminServlet(auth, permissions, login);
    }

    @Test
    void redirectsAnonymousUsersToLogin() throws Exception {
        when(auth.isAuthenticated()).thenReturn(false);
        when(login.getLoginUri(any(URI.class))).thenReturn(URI.create("http://bb/login"));

        servlet.doGet(req, resp);

        verify(resp).sendRedirect("http://bb/login");
        verify(resp, never()).getOutputStream();
    }

    @Test
    void forbidsNonAdmins() throws Exception {
        when(auth.isAuthenticated()).thenReturn(true);
        when(permissions.hasGlobalPermission(Permission.SYS_ADMIN)).thenReturn(false);

        servlet.doGet(req, resp);

        verify(resp).sendError(eq(HttpServletResponse.SC_FORBIDDEN), anyString());
        verify(resp, never()).getOutputStream();
    }

    @Test
    void servesPageToSysAdmins() throws Exception {
        when(auth.isAuthenticated()).thenReturn(true);
        when(permissions.hasGlobalPermission(Permission.SYS_ADMIN)).thenReturn(true);
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        when(resp.getOutputStream()).thenReturn(new ServletOutputStream() {
            @Override public boolean isReady() { return true; }
            @Override public void setWriteListener(WriteListener l) { }
            @Override public void write(int b) { body.write(b); }
        });

        servlet.doGet(req, resp);

        verify(resp).setContentType("text/html");
        assertTrue(body.toString(StandardCharsets.UTF_8).contains("MarkdownX Settings"));
    }
}
