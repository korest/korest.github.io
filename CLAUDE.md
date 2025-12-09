# Orest's Blog - Hugo Site

Personal blog for Orest Kyrylchuk, a Software Engineer based in Seattle.

## Project Structure

```
/
├── content/
│   ├── articles/          # Blog posts (10 articles)
│   │   └── _index.md      # Articles section index
│   └── resume/
│       └── _index.md      # Resume page with experience/education/skills
├── static/
│   ├── images/            # Blog images
│   │   └── serverless-in-action/  # Article images
│   ├── favicon.ico
│   └── favicon.png
├── themes/theminal/       # Terminal-themed Hugo theme
├── hugo.toml              # Site configuration
└── .github/workflows/
    └── deploy.yml         # GitHub Pages deployment
```

## Development

```bash
# Run local server
hugo server

# Build for production
hugo

# Create new article
hugo new articles/my-post.md
```

Site runs at http://localhost:1313/ in development.

## Configuration (hugo.toml)

Key settings:
- **baseURL**: `https://orestkyrylchuk.com/`
- **theme**: `theminal` (terminal-inspired dark/light theme)
- **Disqus**: `orestkyrylchuk`
- **Google Analytics**: `UA-124218867-1`
- **Social**: GitHub (korest), LinkedIn

## Article Front Matter

Articles use TOML front matter:

```toml
+++
title = "Article Title"
date = 2025-01-01
draft = false
slug = "url-slug"           # Controls permalink: /:slug/
description = "SEO description"
tags = ["tag1", "tag2"]
author = "Orest Kyrylchuk"
+++
```

## URL Structure

- Homepage: `/`
- Articles list: `/articles/`
- Individual article: `/:slug/` (e.g., `/rust-testing-mocks/`)
- Resume: `/resume/`
- Tags: `/tags/:tag/`

## Theme Features (Theminal)

- Dark/light theme toggle (press `t` or click button)
- Mini terminal with `/commands` (search, navigation)
- Syntax highlighting (monokai style)
- Client-side search via `/index.json`

## Deployment

GitHub Actions deploys to GitHub Pages on push to `master`:
1. Builds with Hugo 0.152.2
2. Uploads to GitHub Pages artifact
3. Deploys automatically

To enable: GitHub repo Settings → Pages → Source: "GitHub Actions"

## Common Tasks

### Add new article
```bash
hugo new articles/my-new-post.md
# Edit content/articles/my-new-post.md
# Set draft = false when ready
```

### Update resume
Edit `content/resume/_index.md` - uses TOML arrays for experience, education, skills.

### Add images
Place in `static/images/` and reference as `/images/filename.jpg` in markdown.
