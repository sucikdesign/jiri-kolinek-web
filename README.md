# Jiří Kolínek — landing page

Static site with no build step and no dependencies. Open `index.html` through any web server (fonts will not load from `file://`, so a local server is needed for testing):

```
cd web && python3 -m http.server 8000   →  http://localhost:8000
```

## Structure
```
index.html            the page (generated from src/index.src.html by build.py)
assets/css/style.css  design system, layout, responsive design, reduced motion
assets/js/main.js     scroll animations, signature, menu, chart, form
assets/fonts/         Yafeu (headings); Open Sans (text) loads from Google Fonts
assets/img/           optimized background, portraits (webp + jpg/png)
assets/svg/           headline.svg (heroheadline), signature.svg, imperial-logo.svg
```

## Contact form
The form validates its fields, then:
- if `data-endpoint` on `<form id="contact-form">` is filled in (for example a Formspree, Make or custom API URL), it sends JSON with a POST request;
- otherwise it opens the visitor's email client with a pre-filled message to info@imperialvision.cz.

## Editing content
Edit text directly in `index.html`. The chart data (SAB servis, 03/2026, read from the chart on sabservis.cz/imperial-vision) is in `build.py`. After changing `src/index.src.html` or the chart data, run `python3 build.py`.

## Notes
- Border radius is 0 everywhere (enforced globally in CSS).
- Animations respect `prefers-reduced-motion`.
- The signature is animated with a mask built from the skeleton of the original `signature.svg`; the original shapes stay unchanged.
- Open Sans (400–800) loads from Google Fonts via a link in `<head>`. To self-host it, add the woff2 files to `assets/fonts/`, add `@font-face` rules to `style.css`, and remove the Google Fonts link.
- Typography: Yafeu is used for all headings, the type scale is defined as tokens in `:root` (`--fs-*`), labels are Open Sans 600, sub-headings 500 and body text 400.
