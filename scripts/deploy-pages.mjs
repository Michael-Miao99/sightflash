// SightFlash → GitHub Pages 发布。project 站点 URL 恒带仓库名前缀 = https://michael-miao99.github.io/sightflash/
// （独立 repo 不等于根路径；gh-pages 分支根被映射到 /sightflash/ 子路径）。
// 用法：node scripts/deploy-pages.mjs   （幂等；首次自动建孤儿 gh-pages 分支，后续原地更新）
// 原理：BASE_PATH=/sightflash/ 注入构建（vite.config 读它设 base，产物资源引用 /sightflash/assets/…）
//      → 组装 gh-pages 分支树（dist 产物平铺分支根）→ push。main 不受污染（.gitignore 忽略 dist/ 与 .gh-pages-worktree/）。
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)); // scripts
const repo = join(here, '..'); // 独立仓根
const PAGE_BASE = '/sightflash/'; // project Pages 子路径（gh-pages 根映射到该子路径）
const GHP = 'gh-pages';
const WT = join(repo, '.gh-pages-worktree');
const DIST = join(repo, 'dist');

// Windows 下 npm 是 .cmd，spawnSync 需 shell 才可解析；git.exe 直接可 spawn（且 shell 会破坏中文 commit message 引号）。
const SHELL = process.platform === 'win32';
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: SHELL && cmd === 'npm', ...opts });
  if (r.status !== 0) {
    console.error(`\n[deploy] 失败: ${cmd} ${args.join(' ')}`);
    process.exit(r.status ?? 1);
  }
}
function git(args) {
  const r = spawnSync('git', ['-C', repo, ...args], { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`\n[deploy] git 失败: git ${args.join(' ')}`);
    process.exit(r.status ?? 1);
  }
}
const gitOk = (args) => spawnSync('git', ['-C', repo, ...args], { stdio: 'ignore' }).status === 0;

// 1) 子路径构建（vite.config 读 BASE_PATH 注入 base=PAGE_BASE）
console.log(`[deploy] 构建 (base=${PAGE_BASE})…`);
run('npm', ['run', 'build'], { cwd: repo, env: { ...process.env, BASE_PATH: PAGE_BASE } });
if (!existsSync(join(DIST, 'index.html'))) {
  console.error('[deploy] 构建未产出 index.html，中止');
  process.exit(1);
}

// 2) gh-pages worktree 就绪（首次基于当前 main HEAD 建分支；已存在则复用）
const hasBranch = gitOk(['rev-parse', '--verify', GHP]);
if (existsSync(WT)) {
  git(['worktree', 'remove', '--force', WT]);
}
if (hasBranch) {
  git(['worktree', 'add', WT, GHP]);
} else {
  console.log('[deploy] 首次：创建分支 gh-pages（基于 main HEAD）…');
  git(['worktree', 'add', '-b', GHP, WT]);
}
// 清空 worktree（保留 .git 指针），把 dist 产物平铺进仓库根
for (const entry of readdirSync(WT)) {
  if (entry === '.git') continue;
  rmSync(join(WT, entry), { recursive: true, force: true });
}
for (const entry of readdirSync(DIST)) {
  cpSync(join(DIST, entry), join(WT, entry), { recursive: true });
}

// 3) 提交 + 推送
run('git', ['-C', WT, 'add', '-A']);
const dirty = spawnSync('git', ['-C', WT, 'diff', '--cached', '--quiet'], { stdio: 'ignore' }).status !== 0;
if (dirty) {
  run('git', ['-C', WT, 'commit', '-q', '-m', 'deploy: SightFlash 独立站（github.io 根路径）']);
}
console.log('[deploy] 推送 gh-pages…');
git(['push', 'origin', GHP]);
console.log('[deploy] 完成 → https://michael-miao99.github.io/sightflash/');
