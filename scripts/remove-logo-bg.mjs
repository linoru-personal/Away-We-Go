/**
 * One-off: make logo PNG background transparent (flood from edges + near-white islands).
 * Run: node scripts/remove-logo-bg.mjs
 */
import sharp from "sharp";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const input = join(__dirname, "../public/brand/away-we-go-logo.png");

function similar(r, g, b, rr, gg, bb, tol) {
  return (
    Math.abs(r - rr) <= tol &&
    Math.abs(g - gg) <= tol &&
    Math.abs(b - bb) <= tol
  );
}

function main() {
  const img = sharp(input).ensureAlpha();
  return img.raw().toBuffer({ resolveWithObject: true }).then(({ data, info }) => {
    const w = info.width;
    const h = info.height;
    const ch = info.channels; // 4
    const idx = (x, y) => (y * w + x) * ch;

    const r0 = data[idx(0, 0)];
    const g0 = data[idx(0, 0) + 1];
    const b0 = data[idx(0, 0) + 2];
    const tol = 28;

    const visited = new Uint8Array(w * h);
    const q = [];

    function tryPush(x, y) {
      if (x < 0 || x >= w || y < 0 || y >= h) return;
      const i = y * w + x;
      if (visited[i]) return;
      const j = i * ch;
      if (!similar(data[j], data[j + 1], data[j + 2], r0, g0, b0, tol)) return;
      visited[i] = 1;
      q.push(x, y);
    }

    for (let x = 0; x < w; x++) {
      tryPush(x, 0);
      tryPush(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
      tryPush(0, y);
      tryPush(w - 1, y);
    }

    while (q.length) {
      const y = q.pop();
      const x = q.pop();
      tryPush(x + 1, y);
      tryPush(x - 1, y);
      tryPush(x, y + 1);
      tryPush(x, y - 1);
    }

    for (let i = 0; i < w * h; i++) {
      const j = i * ch;
      if (visited[i]) {
        data[j + 3] = 0;
        continue;
      }
      const r = data[j];
      const g = data[j + 1];
      const b = data[j + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const chroma = max - min;
      // Letter counters / leftover white: high, greyish
      if (r >= 248 && g >= 248 && b >= 248 && chroma <= 12) {
        data[j + 3] = 0;
      }
    }

    return sharp(data, {
      raw: { width: w, height: h, channels: ch },
    })
      .png({ compressionLevel: 9 })
      .toFile(input);
  });
}

main().then(() => console.log("Wrote transparent PNG:", input)).catch((e) => {
  console.error(e);
  process.exit(1);
});
