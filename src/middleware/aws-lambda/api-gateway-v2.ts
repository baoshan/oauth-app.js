import { parseRequest } from "./api-gateway-v2-parse-request";
import { sendResponse } from "./api-gateway-v2-send-response";
import { handleRequest } from "../handle-request";
import { onUnhandledRequestDefault } from "../on-unhandled-request-default";
import { HandlerOptions } from "../types";
import { OAuthApp } from "../../index";
import { ClientType, Options } from "../../types";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";

async function onUnhandledRequestDefaultAWSAPIGatewayV2(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> {
  const request = parseRequest(event);
  const response = onUnhandledRequestDefault(request);
  return sendResponse(response);
}
/** @deprecated */
export function createAWSLambdaAPIGatewayV2Handler(
  app: OAuthApp<Options<ClientType>>,
  {
    pathPrefix,
    onUnhandledRequest = onUnhandledRequestDefaultAWSAPIGatewayV2,
  }: HandlerOptions & {
    onUnhandledRequest?: (
      event: APIGatewayProxyEventV2
    ) => Promise<APIGatewayProxyStructuredResultV2>;
  } = {}
) {
  app.octokit.log.warn(
    "[@octokit/oauth-app] `createAWSLambdaAPIGatewayV2Handler` is deprecated and will be removed from the next major version."
  );
  return async function (event: APIGatewayProxyEventV2) {
    const request = parseRequest(event);
    const response = await handleRequest(app, { pathPrefix }, request);
    return response ? sendResponse(response) : onUnhandledRequest(event);
  };
}
