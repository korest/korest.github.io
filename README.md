# orestkyrylchuk.com

Personal blog powered by Jekyll.

## Development

To run the site locally with proper localhost URLs:

```bash
bundle exec jekyll serve --config _config.yml,_config_dev.yml
```

This will override the production URL with `http://localhost:4000` for local development.

## Production

The site is automatically deployed to GitHub Pages using the main `_config.yml` configuration.