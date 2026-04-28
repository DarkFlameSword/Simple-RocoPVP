# 洛克王国 PVP 配队辅助器

完全本地化的 Windows 桌面应用,基于属性克制的 PVP 配队推荐工具。

实现自《洛克王国 PVP 配队推荐 APP 设计报告 v0.3》—— P0 阶段(MVP)。

## 工程结构

```
app/
├── src/                          Vue 3 + TypeScript 前端
│   ├── core/                     纯 TS 引擎(无 Vue / Tauri 依赖)
│   │   ├── types.ts              数据模型
│   │   ├── matrix.ts             EffectLevel 整数算术 + M 表预计算
│   │   ├── stats.ts              Dirichlet 平滑、双模融合 θ
│   │   ├── scoring.ts            A(P) / D_switch(P) / D_weak(P)
│   │   ├── recommend.ts          贪心 + 边际收益
│   │   ├── config.ts             读取打包内 / AppData 配置
│   │   └── persistence.ts        Tauri fs JSONL/JSON 读写
│   ├── store/app.ts              Pinia 单一 store
│   ├── views/                    InputView / RecommendView / SettingsView
│   ├── components/               TypeBadge / ComboChip
│   └── App.vue, main.ts, router.ts, style.css
├── src-tauri/                    Rust 壳 (Tauri 2)
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/default.json
│   ├── resources/config/         打包内置静态配置
│   │   ├── type_matrix.json      18×18 克制矩阵(从图片提取)
│   │   ├── valid_duals.json      双属性白名单(占位,需按游戏更新)
│   │   └── manifest.json
│   └── src/{main.rs, lib.rs}
├── scripts/extract_type_matrix.py   从 洛克王国.png 提取矩阵的工具
└── package.json
```

## 运行

前置条件:
- Node.js ≥ 18
- Rust toolchain (rustup, cargo)

```bash
cd app
npm install              # 首次
npm run tauri dev        # 桌面 dev 模式(首次 Rust 编译耗时 ~10 分钟)
```

## 构建发行版

```bash
npm run tauri build
```

输出位于 `src-tauri/target/release/bundle/`,包括 `.exe` 和 NSIS 安装包。

## 用户数据位置

Windows: `%APPDATA%\com.simplerocopvp.helper\user-data\`

- `battle_events.jsonl` —— 模式 A 录入的对局事件(append-only)
- `community_teams.json` —— 模式 B 收集的强队
- `settings.json` —— 用户参数(λ、α₀、N₀、统计周期等)

## 数据维护

### 克制矩阵数据形式

```json
{
  "version": "2026-04",
  "schema_version": 1,
  "types": ["通用","草","水","火","电","翼","冰","机械","地面",
            "恶魔","龙","幽","武","光","毒","萌","虫","幻"],
  "matrix": [
    [1, 1, 1, 1, 1, 1, 1, 0.5, 0.5, 1, 1, 0.5, 1, 1, 1, 1, 1, 1]
    // ... 17 more rows
  ]
}
```

### 双属性白名单

`src-tauri/resources/config/valid_duals.json` 当前为占位数据。
请根据游戏内实际存在的双属性精灵填写;
ID 应稳定不变,作为 `battle_events.jsonl` 的外键。

## v1.0.0 范围(已实现)

- 加性层级模型 + 整数 EffectLevel
- 数据 JSONL 持久化
- Dirichlet 先验平滑 + 双模融合 θ
- 团队评分 A + D_switch + D_weak
- 贪心推荐 + 边际收益追踪
- 团队覆盖热力图 + 共同弱点警告
- λ 滑块、α₀ / N₀ 设置、统计周期重置
- 攻击方算法计算考虑的是打击面(考虑精灵使用非本系技能)而非属性克制面

## 后续阶段(无先后顺序)

- ε-探索机制 / 配置版本回滚
- Beam Search / 局部 2-swap 优化
- 数据导入导出 / 配置包升级流程
- Android 移植
- 种族值考量（包含性格和天分）
- “实时权重录入”与“主流配队录入”可以通过哦欸之文件导入
