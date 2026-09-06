// SightFlash → GitHub Pages 发布（子路径 /my-projects/sightflash/，整仓 my-projects 公开后生效）。
// 用法：node scripts/deploy-pages.mjs   （幂等；首次自动建孤儿 gh-pages 分支，后续原地更新）
// 原理：BASE_PATH 子路径构建 → 组装独立 gh-pages 分支树（sightflash/ 产物 + 根 index.html 跳转）
//      → push。main 分支不受污染（产物不进 main，.gitignore 已忽略 dist/）。
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)); // sightflash/scripts
const app = join(here, '..'); // sightflash
const repo = join(app, '..'); // cleaner（git 根）
const GHP = 'gh-pages';
const PAGE_BASE = '/my-projects/sightflash/';
const WT = join(repo, '.gh-pages-worktree');
const DIST = join(app, 'dist');

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

// 1) 子路径构建（base 注入由 vite.config 读取 BASE_PATH）
console.log(`[deploy] 构建 (base=${PAGE_BASE})…`);
run('npm', ['run', 'build'], { cwd: app, env: { ...process.env, BASE_PATH: PAGE_BASE } });
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
// 清空 worktree（保留 .git 指针），组装纯产物树
for (const entry of readdirSync(WT)) {
  if (entry === '.git') continue;
  rmSync(join(WT, entry), { recursive: true, force: true });
}
cpSync(DIST, join(WT, 'sightflash'), { recursive: true });
// 根跳转页：/my-projects/ 直达 app
writeFileSync(
  join(WT, 'index.html'),
  `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=./sightflash/">
<title>五线速读 SightFlash</title><a href="./sightflash/">五线速读 SightFlash</a>`,
);

// 3) 提交 + 推送
run('git', ['-C', WT, 'add', '-A']);
const dirty = spawnSync('git', ['-C', WT, 'diff', '--cached', '--quiet'], { stdio: 'ignore' }).status !== 0;
if (dirty) {
  run('git', ['-C', WT, 'commit', '-q', '-m', 'deploy: SightFlash 子路径站点（github.io）']);
}
console.log('[deploy] 推送 gh-pages…');
git(['push', 'origin', GHP]);
console.log(`[deploy] 完成 → https://Michael-Miao99.github.io${PAGE_BASE}`);
