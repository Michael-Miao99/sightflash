import { PNG } from 'pngjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public');
mkdirSync(outDir, { recursive: true });

function draw(size) {
  const png = new PNG({ width: size, height: size });
  const bg = [15, 23, 42];
  const ink = [255, 255, 255];
  const accent = [56, 189, 248];
  const set = (x, y, c) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (size * y + x) * 4;
    png.data[i] = c[0]; png.data[i + 1] = c[1]; png.data[i + 2] = c[2]; png.data[i + 3] = 255;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) set(x, y, bg);
  const cx = size / 2, cy = size / 2;
  const noteR = size * 0.16;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x - cx) / 1.25, dy = y - cy;
    if (dx * dx + dy * dy <= noteR * noteR) set(x, y, accent);
  }
  const half = size * 0.22;
  for (let l = 0; l < 5; l++) {
    const yy = Math.round(cy + half * (l - 2));
    for (let x = Math.round(size * 0.14); x < size * 0.86; x++) {
      set(Math.round(x), yy, ink);
      set(Math.round(x), yy - 1, ink);
    }
  }
  const stemX = Math.round(cx + noteR * 0.7);
  for (let y = Math.round(cy - noteR); y > Math.round(cy - size * 0.38); y--) set(stemX, y, ink);
  return png;
}

for (const s of [192, 512]) {
  writeFileSync(join(outDir, `icon-${s}.png`), PNG.sync.write(draw(s)));
}
console.log('icons generated');
