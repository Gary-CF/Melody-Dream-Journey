import { createReadStream, existsSync, statSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
export function reviewPlugin(directory = ".local/releases") {
  const root = resolve(directory);
  const install = (server) => {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith("/review/")) return next();
      let url;
      try {
        url = decodeURIComponent(req.url.split("?")[0].slice(8));
      } catch {
        res.statusCode = 400;
        return res.end();
      }
      const id = url.split("/")[0];
      if (
        !/^(?:v[0-5]|r3-[a-z][a-z0-9-]{0,47})$/.test(id) ||
        !existsSync(resolve(root, id, "release.json"))
      ) {
        res.statusCode = 404;
        return res.end("Version is not published");
      }
      const releaseRoot = resolve(root, id);
      const file = resolve(root, url.endsWith("/") ? url + "index.html" : url);
      if (
        !file.startsWith(releaseRoot + sep) ||
        !existsSync(file) ||
        !statSync(file).isFile()
      ) {
        res.statusCode = 404;
        return res.end("Version not available");
      }
      res.setHeader(
        "Content-Type",
        {
          ".html": "text/html; charset=utf-8",
          ".js": "text/javascript",
          ".css": "text/css",
          ".json": "application/json",
          ".png": "image/png",
        }[extname(file)] || "application/octet-stream",
      );
      res.setHeader("Cache-Control", "no-store");
      createReadStream(file).pipe(res);
    });
  };
  return {
    name: "round2-review",
    configureServer: install,
    configurePreviewServer: install,
  };
}
