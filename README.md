# Breach Protocol · 反向塔防

一款 browser-only 的反向塔防策略游戏。这次玩家扮演怪物：设计路线、购买并排列怪物批次，在五回合内突破会学习玩家打法的 AI 防线。

## 玩法

- 拖拽三个路标或选择路线预设，绕开 AI 防御塔射界。
- 组合史莱姆群、疾行兽与铁甲兽，每种单位拥有不同数量、速度、生命与突破伤害。
- 用紧密、标准或分批节奏控制各批次间隔。
- AI 会针对高速或重甲编队改变塔组，并在下一回合沿玩家上一条路线重新布防。
- 在最多五回合内将 AI 核心完整度从 30 降至 0。

游戏数据只保存在浏览器本地，不需要账号，也不会上传数据。

## 本地开发

需要 Node.js 22：

```bash
npm install
npm run dev
```

完整验证：

```bash
npm run validate
```

## 部署

项目通过 GitHub Actions 静态部署到 GitHub Pages：

<https://ayaya114514.github.io/AyayaGame_1/>
