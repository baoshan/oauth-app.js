// remove type imports from http for Deno compatibility
// see https://github.com/octokit/octokit.js/issues/2075#issuecomment-817361886
// import { IncomingMessage } from "http";
type IncomingMessage = any;

import { OctokitRequest } from "../types";

export async function parseRequest(
  request: IncomingMessage
): Promise<OctokitRequest> {
  const { method, url, headers } = request;
  const text = await new Promise<string>((resolve, reject) => {
    let bodyChunks: Uint8Array[] = [];
    request
      .on("error", reject)
      .on("data", (chunk: Uint8Array) => bodyChunks.push(chunk))
      .on("end", () => resolve(Buffer.concat(bodyChunks).toString()));
  });
  return { method, url, headers, text };
}
