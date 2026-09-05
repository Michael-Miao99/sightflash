# 五线速读 SightFlash

把「五线谱 ↔ 音名 ↔ 琴键」练成条件反射的识谱反应训练器（PWA，手机可用）。

## 里程碑 A（当前）：认音模式
看谱 → 点音名按钮或仿真钢琴琴键（可听该音钢琴音）。难度阶梯 S1~S5、错音加权复习、打卡/连击、速度曲线与准确率、本地数据（IndexedDB）。

里程碑 B（规划中）：跟弹模式 —— 麦克风音高判定（真琴弹奏）。
设计文档：`docs/superpowers/specs/2026-09-05-sightflash-design.md`

## 开发

```bash
npm install
npm run dev        # localhost
npm test           # vitest 全量
npm run build      # 产出 dist/（PWA）
```

## 真机验收清单（里程碑 A）
- [ ] 手机浏览器打开 https 页面（认音模式无需麦克风）
- [ ] 首页 → 开始训练 → 选高音谱 → 练一轮：谱面渲染正确、点音名判对/错、到点自动结算
- [ ] 答错后「常错音符」出现该音；重复练到准确率 ≥85% 自动升 S2（低音谱解锁）
- [ ] 混合模式（S3 后）：同一题明确显示高音或低音谱
- [ ] 今日目标随正确数累加、跨天清零；连续天数正确累计
- [ ] 「添加到主屏幕」安装为 PWA；断网重开仍可用、数据不丢
- [ ] 数据页速度曲线 / 错音分布与练习记录一致

> 真机验收需经 **https** 访问构建产物：`npm run build` 后把 `dist/` 伺服成 https（service worker 仅在 production 构建生效；可用 cloudflared 隧道等，见设计文档 §16）。

## 里程碑 B 接入点
- `src/core/generator`（chooseQuestion）已产出 `{midi, clef}` —— 跟弹模式直接复用
- `src/core/session.ts` 状态机：跟弹模式以「起音事件→音高判定」替代「按钮→音级判定」，加一个 `answerPlay`
- `StaffView`、打卡/统计/存储全部复用
