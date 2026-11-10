/** Local, read-only design review; deliberately outside the application. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const files = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/discover.html", ["discover.html", "text/html; charset=utf-8"]],
  ["/discover.css", ["discover.css", "text/css; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/GUIDELINES.md", ["GUIDELINES.md", "text/plain; charset=utf-8"]],
  ["/assets/encore-mark.svg", ["assets/encore-mark.svg", "image/svg+xml"]],
] as const);

const server = createServer(async (request, response) => {
  const path = request.url?.split("?")[0] ?? "/";
  const file = files.get(path as Parameters<typeof files.get>[0]);
  if (!file || (request.method !== "GET" && request.method !== "HEAD")) {
    response.writeHead(404).end("Not found");
    return;
  }
  try {
    const body = await readFile(new URL(file[0], import.meta.url));
    response.writeHead(200, {
      "Content-Type": file[1],
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'",
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch {
    response.writeHead(500).end("Preview file unavailable");
  }
});
server.on("error", (error: Error) => {
  console.error(`Design preview could not start: ${error.message}`);
  process.exitCode = 1;
});
server.listen(4173, "127.0.0.1", () => {
  console.log("Encore design review: http://127.0.0.1:4173 (Ctrl+C to stop)");
});
