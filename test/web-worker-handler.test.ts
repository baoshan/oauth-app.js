import { URL } from "url";
import * as nodeFetch from "node-fetch";
import { createWebWorkerHandler, OAuthApp } from "../src";

describe("createWebWorkerHandler(app)", () => {
  beforeAll(() => {
    (global as any).Request = nodeFetch.Request;
    (global as any).Response = nodeFetch.Response;
  });

  afterAll(() => {
    delete (global as any).Request;
    delete (global as any).Response;
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
    const handleRequest = createWebWorkerHandler(
      appMock as unknown as OAuthApp
    );

    const request = new Request("/api/github/oauth/token", {
      method: "POST",
      body: JSON.stringify({
        code: "012345",
        redirectUrl: "http://example.com",
      }),
    });
    const response = await handleRequest(request);

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
});
