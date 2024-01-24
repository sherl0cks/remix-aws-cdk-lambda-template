import * as build from "@remix-run/dev/server-build";
import {installGlobals} from "@remix-run/node";
import sourceMapSupport from "source-map-support";
import type { AppLoadContext, ServerBuild } from "@remix-run/node";
import {
    createRequestHandler as createRemixRequestHandler,
    readableStreamToString,
} from "@remix-run/node";
import type {
    APIGatewayProxyEventHeaders,
    APIGatewayProxyEventV2,
    APIGatewayProxyHandlerV2,
    APIGatewayProxyStructuredResultV2,
} from "aws-lambda";




sourceMapSupport.install();
installGlobals();

export const handler = createRequestHandler({
    build,
    mode: build.mode,
});

/**
 * Copied from remix-architect/server.ts
 *
 * @remix-run/architect
 */


/**
 * A function that returns the value to use as `context` in route `loader` and
 * `action` functions.
 *
 * You can think of this as an escape hatch that allows you to pass
 * environment/platform-specific values through to your loader/action.
 */
export type GetLoadContextFunction = (
    event: APIGatewayProxyEventV2
) => Promise<AppLoadContext> | AppLoadContext;

export type RequestHandler = APIGatewayProxyHandlerV2;

/**
 * Returns a request handler for Architect that serves the response using
 * Remix.
 */
export function createRequestHandler({
                                         build,
                                         getLoadContext,
                                         mode = process.env.NODE_ENV,
                                     }: {
    build: ServerBuild;
    getLoadContext?: GetLoadContextFunction;
    mode?: string;
}): RequestHandler {
    let handleRequest = createRemixRequestHandler(build, mode);

    return async (event) => {
        let request = createRemixRequest(event);
        let loadContext = await getLoadContext?.(event);

        let response = await handleRequest(request, loadContext);

        return sendRemixResponse(response);
    };
}

export function createRemixRequest(event: APIGatewayProxyEventV2): Request {
    let host = event.headers["x-forwarded-host"] || event.headers.host;
    let search = event.rawQueryString.length ? `?${event.rawQueryString}` : "";
    // This code only runs when deployed to lambda, so always use https - no need for a conditional
    let url = new URL(`https://${host}${event.rawPath}${search}`);
    let isFormData = event.headers["content-type"]?.includes(
        "multipart/form-data"
    );
    // Note: No current way to abort these for Architect, but our router expects
    // requests to contain a signal, so it can detect aborted requests
    let controller = new AbortController();

    return new Request(url.href, {
        method: event.requestContext.http.method,
        headers: createRemixHeaders(event.headers, event.cookies),
        signal: controller.signal,
        body:
            event.body && event.isBase64Encoded
                ? isFormData
                    ? Buffer.from(event.body, "base64")
                    : Buffer.from(event.body, "base64").toString()
                : event.body,
    });
}

export function createRemixHeaders(
    requestHeaders: APIGatewayProxyEventHeaders,
    requestCookies?: string[]
): Headers {
    let headers = new Headers();

    for (let [header, value] of Object.entries(requestHeaders)) {
        if (value) {
            headers.append(header, value);
        }
    }

    if (requestCookies) {
        headers.append("Cookie", requestCookies.join("; "));
    }

    return headers;
}

export async function sendRemixResponse(
    nodeResponse: Response
): Promise<APIGatewayProxyStructuredResultV2> {
    let cookies: string[] = [];

    // Arc/AWS API Gateway will send back set-cookies outside of response headers.
    for (let [key, value] of nodeResponse.headers.entries()) {
        if (key.toLowerCase() === "set-cookie") {
            cookies.push(value);
        }
    }

    if (cookies.length) {
        nodeResponse.headers.delete("Set-Cookie");
    }

    let contentType = nodeResponse.headers.get("Content-Type");
    let isBase64Encoded = isBinaryType(contentType);
    let body: string | undefined;

    if (nodeResponse.body) {
        if (isBase64Encoded) {
            body = await readableStreamToString(nodeResponse.body, "base64");
        } else {
            body = await nodeResponse.text();
        }
    }

    return {
        statusCode: nodeResponse.status,
        headers: Object.fromEntries(nodeResponse.headers.entries()),
        cookies,
        body,
        isBase64Encoded,
    };
}


/**
 * Copied from binary types
 */

/**
 * Common binary MIME types
 * @see https://github.com/architect/functions/blob/45254fc1936a1794c185aac07e9889b241a2e5c6/src/http/helpers/binary-types.js
 */
const binaryTypes = [
    "application/octet-stream",
    // Docs
    "application/epub+zip",
    "application/msword",
    "application/pdf",
    "application/rtf",
    "application/vnd.amazon.ebook",
    "application/vnd.ms-excel",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    // Fonts
    "font/otf",
    "font/woff",
    "font/woff2",
    // Images
    "image/avif",
    "image/bmp",
    "image/gif",
    "image/jpeg",
    "image/png",
    "image/tiff",
    "image/vnd.microsoft.icon",
    "image/webp",
    // Audio
    "audio/3gpp",
    "audio/aac",
    "audio/basic",
    "audio/mpeg",
    "audio/ogg",
    "audio/wav",
    "audio/webm",
    "audio/x-aiff",
    "audio/x-midi",
    "audio/x-wav",
    // Video
    "video/3gpp",
    "video/mp2t",
    "video/mpeg",
    "video/ogg",
    "video/quicktime",
    "video/webm",
    "video/x-msvideo",
    // Archives
    "application/java-archive",
    "application/vnd.apple.installer+xml",
    "application/x-7z-compressed",
    "application/x-apple-diskimage",
    "application/x-bzip",
    "application/x-bzip2",
    "application/x-gzip",
    "application/x-java-archive",
    "application/x-rar-compressed",
    "application/x-tar",
    "application/x-zip",
    "application/zip",
];

export function isBinaryType(contentType: string | null | undefined) {
    if (!contentType) return false;
    let [test] = contentType.split(";");
    return binaryTypes.includes(test);
}
