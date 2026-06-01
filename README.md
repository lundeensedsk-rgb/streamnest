# StreamNest - Legal Movie Discovery Site MVP

这是一个仿 MovieBox 风格的影视目录网站模板。当前版本使用演示数据，已经预留 TMDB API 接入位置。

## 功能

- 暗色影视站首页
- 左侧导航 / 顶部搜索
- 首页大 Banner
- 热门电视剧、电影、动画分区
- 即将上线日历
- 详情选择卡片
- 手机端自适应

## 本地运行

```bash
npm install
npm run dev
```

打开终端提示的本地地址，例如 `http://localhost:5173`。

## 以后接真实数据

推荐使用 TMDB API 获取合法元数据：电影名、海报、简介、评分、演员、年份、预告片。

1. 注册 TMDB： https://www.themoviedb.org/
2. 申请 API Key
3. 创建 `.env.local`

```bash
VITE_TMDB_API_KEY=你的_TMDB_API_Key
```

注意：不要接入盗版播放源。播放页可以放官方预告片、你自己拥有版权的视频、或合法平台跳转。

## 部署

最简单用 Vercel：

1. 把代码上传 GitHub
2. 登录 https://vercel.com
3. Import Project
4. 选择这个仓库
5. Deploy

