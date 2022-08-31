// remove type imports from http for Deno compatibility
// see https://github.com/octokit/octokit.js/issues/2075#issuecomment-817361886
// import { IncomingMessage, ServerResponse } from "http";
type IncomingMessage = any;
type ServerResponse = any;

import { parseRequest } from "./parse-request";
import { sendResponse } from "./send-response";
import { handleRequest } from "../handle-request";
import { OAuthApp } from "../../index";
import { HandlerOptions } from "../types";
import { ClientType, Options } from "../../types";

export function createNodeMiddleware(
  app: OAuthApp<Options<ClientType>>,
  options: HandlerOptions = {}
) {
  return async function (
    request: IncomingMessage,
    response: ServerResponse,
    next?: Function
  ) {
    const octokitRequest = await parseRequest(request);
    const octokitResponse = await handleRequest(app, options, octokitRequest);
    if (octokitResponse.status === 404 && next) return next();
    sendResponse(octokitResponse, response);
  };
}
