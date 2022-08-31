import { OctokitRequest } from "../types";

export async function parseRequest(request: Request): Promise<OctokitRequest> {
  // @ts-ignore Worker environment supports fromEntries/entries.
  const headers = Object.fromEntries(request.headers.entries());
  return {
    method: request.method,
    url: request.url,
    headers,
    text: await request.text(),
  };
}
