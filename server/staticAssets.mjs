import fs from "node:fs/promises";
import path from "node:path";

const publicAssets = {
  "/public/app.css": { file: "app.css", contentType: "text/css; charset=utf-8" },
  "/public/app.js": { file: "app.js", contentType: "text/javascript; charset=utf-8" },
  "/public/style.css": { file: "style.css", contentType: "text/css; charset=utf-8" },
  "/public/shared.js": { file: "shared.js", contentType: "text/javascript; charset=utf-8" },
  "/public/admin.js": { file: "admin.js", contentType: "text/javascript; charset=utf-8" },
  "/public/student.js": { file: "student.js", contentType: "text/javascript; charset=utf-8" },
  "/public/pwa.js": { file: "pwa.js", contentType: "text/javascript; charset=utf-8" },
  "/public/service-worker.js": { file: "service-worker.js", contentType: "text/javascript; charset=utf-8" },
  "/public/offline.html": { file: "offline.html", contentType: "text/html; charset=utf-8" },
  "/public/manifest.webmanifest": { file: "manifest.webmanifest", contentType: "application/manifest+json; charset=utf-8" },
  "/public/app-icon.svg": { file: "app-icon.svg", contentType: "image/svg+xml" },
  "/public/app-icon-maskable.svg": { file: "app-icon-maskable.svg", contentType: "image/svg+xml" },
};

const imageAssets = {
  "/assets/student-starry-bg.png": { file: "student-starry-bg.png", contentType: "image/png" },
  "/assets/math-lab-planet-map.png": { file: "math-lab-planet-map.png", contentType: "image/png" },
};

export function createStaticAssetHandler({ assetsDir, publicDir, send }) {
  return async function handleStaticAsset(res, pathname) {
    const imageAsset = imageAssets[pathname];
    if (imageAsset) {
      const body = await fs.readFile(path.join(assetsDir, imageAsset.file));
      send(res, 200, body, { "content-type": imageAsset.contentType, "cache-control": "public, max-age=604800" });
      return true;
    }

    const publicAsset = publicAssets[pathname];
    if (publicAsset) {
      const body = await fs.readFile(path.join(publicDir, publicAsset.file));
      send(res, 200, body, { "content-type": publicAsset.contentType, "cache-control": "no-store" });
      return true;
    }

    return false;
  };
}
