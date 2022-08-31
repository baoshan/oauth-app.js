import { createServer } from "http";
import { URL } from "url";

import fetch from "node-fetch";
import { createNodeMiddleware, OAuthApp } from "../src";

// import without types
const express = require("express");

describe("createNodeMiddleware(app)", () => {
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

    const server = createServer(
      createNodeMiddleware(appMock as unknown as OAuthApp)
    ).listen();
    // @ts-expect-error complains about { port } although it's included in returned AddressInfo interface
    const { port } = server.address();

    const response = await fetch(
      `http://localhost:${port}/api/github/oauth/token`,
      {
        method: "POST",
        body: JSON.stringify({
          code: "012345",
          redirectUrl: "http://example.com",
        }),
      }
    );

    server.close();

    expect(response.status).toEqual(201);
    expect(await response.json()).toStrictEqual({
      authentication: { type: "token", tokenType: "oauth" },
    });

    expect(appMock.createToken.mock.calls.length).toEqual(1);
    expect(appMock.createToken.mock.calls[0][0]).toStrictEqual({
      code: "012345",
      redirectUrl: "http://example.com",
    });
  });

  it("express middleware no mount path 404", async () => {
    const expressApp = express();

    expressApp.use(
      createNodeMiddleware(
        new OAuthApp({
          clientId: "0123",
          clientSecret: "0123secret",
        })
      )
    );
    expressApp.all("*", (_request: any, response: any) =>
      response.status(404).send("Nope")
    );

    const server = expressApp.listen();

    const { port } = server.address();

    const response = await fetch(`http://localhost:${port}/test`, {
      method: "POST",
      body: "{}",
    });

    await expect(response.text()).resolves.toBe("Nope");
    expect(response.status).toEqual(404);

    server.close();
  });

  it("express middleware no mount path no next", async () => {
    const app = express();

    app.all("/foo", (_request: any, response: any) => response.end("ok\n"));
    app.use(
      createNodeMiddleware(
        new OAuthApp({
          clientId: "0123",
          clientSecret: "0123secret",
        })
      )
    );

    const server = app.listen();

    const { port } = server.address();

    const response = await fetch(`http://localhost:${port}/test`, {
      method: "POST",
      body: "{}",
    });

    await expect(response.text()).resolves.toContain("Cannot POST /test");
    expect(response.status).toEqual(404);

    const responseForFoo = await fetch(`http://localhost:${port}/foo`, {
      method: "POST",
      body: "{}",
    });

    await expect(responseForFoo.text()).resolves.toContain("ok\n");
    expect(responseForFoo.status).toEqual(200);

    server.close();
  });

  it("express middleware no mount path with options.pathPrefix", async () => {
    const app = express();

    app.use(
      createNodeMiddleware(
        new OAuthApp({
          clientId: "0123",
          clientSecret: "0123secret",
        }),
        { pathPrefix: "/test" }
      )
    );
    app.all("*", (_request: any, response: any) =>
      response.status(404).send("Nope")
    );

    const server = app.listen();

    const { port } = server.address();

    const { status } = await fetch(`http://localhost:${port}/test/login`, {
      redirect: "manual",
    });

    server.close();

    expect(status).toEqual(302);
  });

  it("express middleware with mount path with options.pathPrefix", async () => {
    const app = express();

    app.use(
      "/foo",
      createNodeMiddleware(
        new OAuthApp({
          clientId: "0123",
          clientSecret: "0123secret",
        }),
        { pathPrefix: "/bar" }
      )
    );
    app.all("*", (_request: any, response: any) =>
      response.status(404).send("Nope")
    );

    const server = app.listen();

    const { port } = server.address();

    const { status } = await fetch(`http://localhost:${port}/foo/bar/login`, {
      redirect: "manual",
    });

    server.close();

    expect(status).toEqual(302);
  });
});
