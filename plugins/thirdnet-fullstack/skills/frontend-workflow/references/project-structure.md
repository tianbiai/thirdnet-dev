# 项目结构（project-structure）

> 本文件是 `frontend-workflow` 技能的目录结构参考：编码前确认文件落点、或结构检查发现布局偏差时用 Read 打开。骨架规则以 SKILL.md「项目结构」摘要为准。

前端项目统一创建在工作区根目录的 `frontend/` 文件夹下：

```
frontend/
├── web/                          # Web 网站（Element Plus）
│   ├── spec.md
│   ├── specs/{页面名}.md
│   ├── public/                   # changelog.md + viewer.html + marked.min.js
│   └── src/
│       ├── config/index.ts
│       ├── views/
│       ├── components/HelpBubble.vue
│       ├── composables/
│       ├── utils/token.ts
│       ├── api/
│       │   ├── types/               # common.ts/enums.ts + {module}.ts（工程内扁平）
│       │   ├── interfaces/{module}.ts
│       │   ├── adapter.ts / adapter.web.ts / adapter.uni.ts
│       │   ├── request.ts
│       │   └── modules/{module}.ts
│       ├── mock/
│       │   ├── api/{module}.ts
│       │   └── data/{module}.ts
│       ├── stores/
│       ├── router/
│       └── styles/
└── minigram/                     # 小程序（uniapp + Vant，强制）
    ├── spec.md / specs/
    └── src/                      # uniapp Vite 模板：manifest/pages/static 均在 src/ 下
        ├── manifest.json         # uniapp 应用配置（appId、平台配置）——uniapp 工程标志文件
        ├── pages.json            # 页面路由注册（uniapp 无 vue-router）
        ├── static/               # changelog.md + viewer.html + marked.min.js
        ├── pages/                # 移动端用 pages/，Web 用 views/
        └── ...（结构同 web，但无 router/）
```

## 结构适配

若项目顶层目录布局不同，仍必须保留上图树中的内部目录模式（`src/api/` 策略工厂、`src/mock/data/`、`src/stores/`、`src/views|pages/`、`src/components/`、`src/composables/`、`src/router/`、`src/styles/`），并将任何结构偏差记录在项目的 spec.md 中。
