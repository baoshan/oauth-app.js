import { URL } from "url";
import * as nodeFetch from "node-fetch";
import { handleRequest, OAuthApp } from "../src";

describe("handle request", () => {
  beforeAll(() => {
    (global as any).Request = nodeFetch.Request;
    (global as any).Response = nodeFetch.Response;
  });

  afterAll(() => {
    delete (global as any).Request;
    delete (global as any).Response;
  });

  it("support both oauth-app and github-app", () => {
    const oauthApp = new OAuthApp({
      clientType: "oauth-app",
      clientId: "0123",
      clientSecret: "0123secret",
    });
    handleRequest(oauthApp, {}, { method: "GET", url: "" });

    const githubApp = new OAuthApp({
      clientType: "github-app",
      clientId: "0123",
      clientSecret: "0123secret",
    });
    handleRequest(githubApp, {}, { method: "GET", url: "" });
  });

  it("allow pre-flight requests", async () => {
    const app = new OAuthApp({
      clientId: "0123",
      clientSecret: "0123secret",
    });
    const request = {
      method: "OPTIONS",
      url: "/api/github/oauth/token",
    };

    const response = await handleRequest(app, {}, request);
    expect(response).toBeTruthy();
    expect(response!.status).toStrictEqual(200);
  });

  it("GET /api/github/oauth/login", async () => {
    const app = new OAuthApp({
      clientId: "0123",
      clientSecret: "0123secret",
    });
    const response = await handleRequest(
      app,
      {},
      {
        method: "GET",
        url: "/api/github/oauth/login",
      }
    );

    expect(response).toBeTruthy();
    expect(response!.status).toEqual(302);
    const url = new URL(response!.headers!["location"] as string);
    expect(url).toMatchObject({
      origin: "https://github.com",
      pathname: "/login/oauth/authorize",
    });
    expect(url.searchParams.get("client_id")).toEqual("0123");
    expect(url.searchParams.get("state")).toMatch(/^\w+$/);
    expect(url.searchParams.get("scope")).toEqual(null);
  });

  it("GET /api/github/oauth/login with defaultScopes (#110)", async () => {
    const app = new OAuthApp({
      clientId: "0123",
      clientSecret: "0123secret",
      defaultScopes: ["repo"],
    });
    const response = await handleRequest(
      app,
      {},
      {
        method: "GET",
        url: "/api/github/oauth/login",
      }
    );

    expect(response).toBeTruthy();
    expect(response!.status).toEqual(302);
    const url = new URL(response!.headers!["location"] as string);
    expect(url).toMatchObject({
      origin: "https://github.com",
      pathname: "/login/oauth/authorize",
    });
    expect(url.searchParams.get("client_id")).toEqual("0123");
    expect(url.searchParams.get("state")).toMatch(/^\w+$/);
    expect(url.searchParams.get("scope")).toEqual("repo");
  });

  it("GET /api/github/oauth/login?state=mystate123&scopes=one,two,three", async () => {
    const app = new OAuthApp({
      clientId: "0123",
      clientSecret: "0123secret",
    });
    const response = await handleRequest(
      app,
      {},
      {
        method: "GET",
        url: "/api/github/oauth/login?state=mystate123&scopes=one,two,three",
      }
    );

    const request = new Request(
      "/api/github/oauth/login?state=mystate123&scopes=one,two,three"
    );

    expect(response).toBeTruthy();
    expect(response!.status).toEqual(302);
    const url = new URL(response!.headers!["location"] as string);
    expect(url).toMatchObject({
      origin: "https://github.com",
      pathname: "/login/oauth/authorize",
    });
    expect(url.searchParams.get("client_id")).toEqual("0123");
    expect(url.searchParams.get("state")).toEqual("mystate123");
    expect(url.searchParams.get("scope")).toEqual("one,two,three");
  });

  it("GET /api/github/oauth/callback?code=012345&state=mystate123", async () => {
    const token = Math.random().toString(36).slice(2);
    const appMock = {
      createToken: jest.fn().mockResolvedValue({
        authentication: {
          type: "token",
          tokenType: "oauth",
          token,
        },
      }),
    };
    const response = await handleRequest(
      appMock as unknown as OAuthApp,
      {},
      {
        method: "GET",
        url: "/api/github/oauth/callback?code=012345&state=state123",
      }
    );

    expect(response).toBeTruthy();
    expect(response!.status).toEqual(200);
    expect(response!.text).toContain(token);

    expect(appMock.createToken.mock.calls.length).toEqual(1);
    expect(appMock.createToken.mock.calls[0][0]).toStrictEqual({
      code: "012345",
    });
  });

  it("POST /api/github/oauth/token", async () => {
    const appMock = {
      createToken: jest.fn().mockResolvedValue({
        authentication: {
          type: "token",
          tokenType: "oauth",
          clientSecret: "secret123",
        },
      }),
    };
    const response = await handleRequest(
      appMock as unknown as OAuthApp,
      {},
      {
        method: "POST",
        url: "/api/github/oauth/token",
        headers: { "content-type": "application/json" },
        text: JSON.stringify({
          code: "012345",
          redirectUrl: "http://example.com",
        }),
      }
    );

    expect(response).toBeTruthy();
    expect(response!.status).toEqual(201);
    expect(JSON.parse(response!.text!)).toStrictEqual({
      authentication: { type: "token", tokenType: "oauth" },
    });

    expect(appMock.createToken.mock.calls.length).toEqual(1);
    expect(appMock.createToken.mock.calls[0][0]).toStrictEqual({
      code: "012345",
      redirectUrl: "http://example.com",
    });
  });

  it("GET /api/github/oauth/token", async () => {
    const appMock = {
      checkToken: jest.fn().mockResolvedValue({
        data: { id: 1 },
        authentication: {
          type: "token",
          tokenType: "oauth",
          clientSecret: "secret123",
        },
      }),
    };
    const token = Math.random().toString(36).slice(2);
    const authorization = `token ${token}`;
    const response = await handleRequest(
      appMock as unknown as OAuthApp,
      {},
      {
        method: "GET",
        url: "/api/github/oauth/token",
        headers: { authorization },
      }
    );

    expect(response).toBeTruthy();

    expect(response!.status).toEqual(200);
    expect(JSON.parse(response!.text!)).toStrictEqual({
      data: { id: 1 },
      authentication: { type: "token", tokenType: "oauth" },
    });

    expect(appMock.checkToken.mock.calls.length).toEqual(1);
    expect(appMock.checkToken.mock.calls[0][0]).toStrictEqual({ token });
  });

  it("POST /api/github/oauth/token/scoped", async () => {
    const appMock = {
      scopeToken: jest.fn().mockResolvedValue({
        data: { id: 1 },
        authentication: {
          type: "token",
          tokenType: "oauth",
          clientSecret: "secret123",
        },
      }),
    };
    const token = Math.random().toString(36).slice(2);
    const authorization = `token ${token}`;
    const response = await handleRequest(
      appMock as unknown as OAuthApp,
      {},
      {
        method: "POST",
        url: "/api/github/oauth/token/scoped",
        headers: { authorization },
        text: JSON.stringify({
          target: "octokit",
          repositories: ["oauth-methods.js"],
          permissions: { issues: "write" },
        }),
      }
    );

    expect(response).toBeTruthy();
    expect(response!.status).toEqual(200);
    expect(JSON.parse(response!.text!)).toMatchInlineSnapshot(`
      Object {
        "authentication": Object {
          "tokenType": "oauth",
          "type": "token",
        },
        "data": Object {
          "id": 1,
        },
      }
    `);

    expect(appMock.scopeToken.mock.calls.length).toEqual(1);
    expect(appMock.scopeToken.mock.calls[0][0]).toMatchInlineSnapshot(`
      Object {
        "permissions": Object {
          "issues": "write",
        },
        "repositories": Array [
          "oauth-methods.js",
        ],
        "target": "octokit",
        "token": "${token}",
      }
    `);
  });

  it("PATCH /api/github/oauth/refresh-token", async () => {
    const appMock = {
      refreshToken: jest.fn().mockResolvedValue({
        data: { id: 1 },
        authentication: {
          type: "token",
          tokenType: "oauth",
          clientSecret: "secret123",
        },
      }),
    };
    const token = Math.random().toString(36).slice(2);
    const authorization = `token ${token}`;
    const response = await handleRequest(
      appMock as unknown as OAuthApp,
      {},
      {
        method: "PATCH",
        url: "/api/github/oauth/refresh-token",
        headers: { authorization },
        text: JSON.stringify({ refreshToken: "r1.refreshtoken123" }),
      }
    );

    expect(response).toBeTruthy();
    expect(response!.status).toEqual(200);
    expect(JSON.parse(response!.text!)).toStrictEqual({
      data: { id: 1 },
      authentication: { type: "token", tokenType: "oauth" },
    });

    expect(appMock.refreshToken.mock.calls.length).toEqual(1);
    expect(appMock.refreshToken.mock.calls[0][0]).toStrictEqual({
      refreshToken: "r1.refreshtoken123",
    });
  });

  it("PATCH /api/github/oauth/token", async () => {
    const appMock = {
      resetToken: jest.fn().mockResolvedValue({
        data: { id: 1 },
        authentication: {
          type: "token",
          tokenType: "oauth",
          clientSecret: "secret123",
        },
      }),
    };
    const token = Math.random().toString(36).slice(2);
    const authorization = `token ${token}`;
    const response = await handleRequest(
      appMock as unknown as OAuthApp,
      {},
      {
        method: "PATCH",
        url: "/api/github/oauth/token",
        headers: { authorization },
      }
    );

    expect(response).toBeTruthy();
    expect(response!.status).toEqual(200);
    expect(JSON.parse(response!.text!)).toStrictEqual({
      data: { id: 1 },
      authentication: { type: "token", tokenType: "oauth" },
    });

    expect(appMock.resetToken.mock.calls.length).toEqual(1);
    expect(appMock.resetToken.mock.calls[0][0]).toStrictEqual({ token });
  });

  it("DELETE /api/github/oauth/token", async () => {
    const appMock = {
      deleteToken: jest.fn().mockResolvedValue(undefined),
    };
    const token = Math.random().toString(36).slice(2);
    const authorization = `token ${token}`;
    const response = await handleRequest(
      appMock as unknown as OAuthApp,
      {},
      {
        method: "DELETE",
        url: "/api/github/oauth/token",
        headers: { authorization },
      }
    );

    expect(response).toBeTruthy();
    expect(response!.status).toEqual(204);
    expect(appMock.deleteToken.mock.calls.length).toEqual(1);
    expect(appMock.deleteToken.mock.calls[0][0]).toStrictEqual({ token });
  });

  it("DELETE /api/github/oauth/grant", async () => {
    const appMock = {
      deleteAuthorization: jest.fn().mockResolvedValue(undefined),
    };
    const token = Math.random().toString(36).slice(2);
    const authorization = `token ${token}`;
    const response = await handleRequest(
      appMock as unknown as OAuthApp,
      {},
      {
        method: "DELETE",
        url: "/api/github/oauth/grant",
        headers: { authorization },
      }
    );

    expect(response).toBeTruthy();
    expect(response!.status).toEqual(204);
    expect(appMock.deleteAuthorization.mock.calls.length).toEqual(1);
    expect(appMock.deleteAuthorization.mock.calls[0][0]).toStrictEqual({
      token,
    });
  });

  it("POST /unknown", async () => {
    const response = await handleRequest(
      {} as unknown as OAuthApp,
      {},
      {
        method: "POST",
        url: "/unknown",
      }
    );
    expect(response).toBeTruthy();
    expect(response!.status).toEqual(404);
    expect(JSON.parse(response!.text!)).toEqual({
      error: "Unknown route: POST /unknown",
    });
  });

  it("GET /api/github/oauth/callback without code", async () => {
    const appMock = {};
    const response = await handleRequest(
      appMock as unknown as OAuthApp,
      {},
      {
        method: "GET",
        url: "/api/github/oauth/callback",
      }
    );

    expect(response).toBeTruthy();
    expect(response!.status).toEqual(400);
    expect(JSON.parse(response!.text!)).toStrictEqual({
      error: '[@octokit/oauth-app] "code" parameter is required',
    });
  });

  it("GET /api/github/oauth/callback with error", async () => {
    const appMock = {};
    const response = await handleRequest(
      appMock as unknown as OAuthApp,
      {},
      {
        method: "GET",
        url: "/api/github/oauth/callback?error=redirect_uri_mismatch&error_description=The+redirect_uri+MUST+match+the+registered+callback+URL+for+this+application.&error_uri=https://docs.github.com/en/developers/apps/troubleshooting-authorization-request-errors/%23redirect-uri-mismatch&state=xyz",
      }
    );

    expect(response).toBeTruthy();
    expect(response!.status).toEqual(400);
    expect(JSON.parse(response!.text!)).toStrictEqual({
      error:
        "[@octokit/oauth-app] redirect_uri_mismatch The redirect_uri MUST match the registered callback URL for this application.",
    });
  });

  it("POST /api/github/oauth/token without state or code", async () => {
    const appMock = {};
    const response = await handleRequest(
      appMock as unknown as OAuthApp,
      {},
      {
        method: "POST",
        url: "/api/github/oauth/token",
        headers: { "Content-Type": "application/json" },
        text: JSON.stringify({}),
      }
    );

    expect(response).toBeTruthy();
    expect(response!.status).toEqual(400);
    expect(JSON.parse(response!.text!)).toStrictEqual({
      error: '[@octokit/oauth-app] "code" parameter is required',
    });
  });

  it("POST /api/github/oauth/token with non-JSON request body", async () => {
    const appMock = {};
    const response = await handleRequest(
      appMock as unknown as OAuthApp,
      {},
      {
        method: "POST",
        url: "/api/github/oauth/token",
        headers: {},
        text: "foo",
      }
    );

    expect(response).toBeTruthy();
    expect(response!.status).toEqual(400);
    expect(JSON.parse(response!.text!)).toStrictEqual({
      error: "[@octokit/oauth-app] request error",
    });
  });

  it("GET /api/github/oauth/token without Authorization header", async () => {
    const appMock = {};
    const response = await handleRequest(
      appMock as unknown as OAuthApp,
      {},
      {
        method: "GET",
        url: "/api/github/oauth/token",
      }
    );

    expect(response).toBeTruthy();
    expect(response!.status).toEqual(400);
    expect(JSON.parse(response!.text!)).toStrictEqual({
      error: '[@octokit/oauth-app] "Authorization" header is required',
    });
  });

  it("PATCH /api/github/oauth/token without authorization header", async () => {
    const appMock = {};
    const response = await handleRequest(
      appMock as unknown as OAuthApp,
      {},
      {
        method: "PATCH",
        url: "/api/github/oauth/token",
      }
    );

    expect(response).toBeTruthy();
    expect(response!.status).toEqual(400);
    expect(JSON.parse(response!.text!)).toStrictEqual({
      error: '[@octokit/oauth-app] "Authorization" header is required',
    });
  });

  it("POST /api/github/oauth/token/scoped without authorization header", async () => {
    const appMock = {};
    const response = await handleRequest(
      appMock as unknown as OAuthApp,
      {},
      {
        method: "POST",
        url: "/api/github/oauth/token/scoped",
      }
    );

    expect(response).toBeTruthy();
    expect(response!.status).toEqual(400);
    expect(JSON.parse(response!.text!)).toStrictEqual({
      error: '[@octokit/oauth-app] "Authorization" header is required',
    });
  });

  it("PATCH /api/github/oauth/refresh-token without authorization header", async () => {
    const appMock = {
      refreshToken: jest.fn().mockResolvedValue({
        ok: true,
      }),
    };
    const response = await handleRequest(
      appMock as unknown as OAuthApp,
      {},
      {
        method: "PATCH",
        url: "/api/github/oauth/refresh-token",
        headers: {},
        text: JSON.stringify({
          refreshToken: "r1.refreshtoken123",
        }),
      }
    );
    expect(response).toBeTruthy();
    expect(response!.status).toEqual(400);
    expect(JSON.parse(response!.text!)).toStrictEqual({
      error: '[@octokit/oauth-app] "Authorization" header is required',
    });
  });

  it("PATCH /api/github/oauth/refresh-token without refreshToken", async () => {
    const appMock = {
      refreshToken: jest.fn().mockResolvedValue({
        ok: true,
      }),
    };
    const token = Math.random().toString(36).slice(2);
    const authorization = `token ${token}`;
    const response = await handleRequest(
      appMock as unknown as OAuthApp,
      {},
      {
        method: "PATCH",
        url: "/api/github/oauth/refresh-token",
        headers: { authorization },
      }
    );

    expect(response).toBeTruthy();
    expect(response!.status).toEqual(400);
    expect(JSON.parse(response!.text!)).toStrictEqual({
      error: "[@octokit/oauth-app] refreshToken must be sent in request body",
    });
  });

  it("DELETE /api/github/oauth/token without authorization header", async () => {
    const appMock = {};
    const response = await handleRequest(
      appMock as unknown as OAuthApp,
      {},
      {
        method: "DELETE",
        url: "/api/github/oauth/token",
      }
    );

    expect(response).toBeTruthy();
    expect(response!.status).toEqual(400);
    expect(JSON.parse(response!.text!)).toStrictEqual({
      error: '[@octokit/oauth-app] "Authorization" header is required',
    });
  });

  it("DELETE /api/github/oauth/grant without authorization header", async () => {
    const appMock = {};
    const response = await handleRequest(
      appMock as unknown as OAuthApp,
      {},
      {
        method: "DELETE",
        url: "/api/github/oauth/grant",
      }
    );

    expect(response).toBeTruthy();
    expect(response!.status).toEqual(400);
    expect(JSON.parse(response!.text!)).toStrictEqual({
      error: '[@octokit/oauth-app] "Authorization" header is required',
    });
  });

  it("web worker handler with options.pathPrefix", async () => {
    const response = await handleRequest(
      new OAuthApp({
        clientId: "0123",
        clientSecret: "0123secret",
      }),
      { pathPrefix: "/test" },
      {
        method: "GET",
        url: "/test/login",
      }
    );

    expect(response).toBeTruthy();
    expect(response!.status).toEqual(302);
  });
});
