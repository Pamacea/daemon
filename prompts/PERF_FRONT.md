# Frontend Performance Testing Guide (Lighthouse)

This prompt provides guidance for frontend performance analysis using Google Lighthouse.

---

## Overview

Lighthouse analyzes web apps and web pages, collecting modern performance metrics and insights on developer best practices.

## Core Web Vitals

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| **LCP** (Largest Contentful Paint) | <2.5s | 2.5s - 4s | >4s |
| **FID** (First Input Delay) | <100ms | 100ms - 300ms | >300ms |
| **CLS** (Cumulative Layout Shift) | <0.1 | 0.1 - 0.25 | >0.25 |

## Running Lighthouse

### Quick Performance Audit

```bash
docker exec daemon-tools npx lighthouse http://localhost:3000 --output=json --output=html --chrome-flags="--headless"
```

### Mobile Audit

```bash
docker exec daemon-tools npx lighthouse http://localhost:3000 --form-factor=mobile --screen-emulation=mobile --output=json
```

### Desktop Audit

```bash
docker exec daemon-tools npx lighthouse http://localhost:3000 --form-factor=desktop --output=json
```

### Performance Only (Faster)

```bash
docker exec daemon-tools npx lighthouse http://localhost:3000 --only-categories=performance --output=json
```

### All Categories

```bash
docker exec daemon-tools npx lighthouse http://localhost:3000 --only-categories=performance,accessibility,best-practices,seo --output=json
```

### With Custom Output

```bash
docker exec daemon-tools npx lighthouse http://localhost:3000 --output=json --output-path=/app/reports/lighthouse-$(date +%s).json
```

---

## Reading Lighthouse Results

### Score Interpretation

- **90-100**: Green (Good)
- **50-89**: Orange (Needs Improvement)
- **0-49**: Red (Poor)

### Key Metrics

```javascript
{
  "categories": {
    "performance": { "score": 0.85 },  // 85/100
    "accessibility": { "score": 0.92 },
    "best-practices": { "score": 0.90 },
    "seo": { "score": 0.95 }
  },
  "audits": {
    "largest-contentful-paint": {
      "displayValue": "2.1 s",
      "score": 0.92
    },
    "cumulative-layout-shift": {
      "displayValue": "0.05",
      "score": 1
    },
    "max-potential-fid": {
      "displayValue": "56 ms",
      "score": 1
    }
  }
}
```

---

## Common Performance Issues & Fixes

### 1. Render-Blocking Resources

**Issue**: CSS/JavaScript blocks page rendering

**Detection**: `render-blocking-resources` audit

**Fix**:
```html
<!-- Defer non-critical CSS -->
<link rel="preload" href="styles.css" as="style" onload="this.onload=null;this.rel='stylesheet'">

<!-- Defer JavaScript -->
<script src="app.js" defer></script>
<script src="analytics.js" async></script>
```

### 2. Unoptimized Images

**Issue**: Large images slow down LCP

**Detection**: `modern-image-formats`, `offscreen-images`, `scaled-images`

**Fix**:
```typescript
// Next.js
import Image from 'next/image';

<Image
  src="/hero.jpg"
  width={1920}
  height={1080}
  priority // For above-fold images
  placeholder="blur"
/>

// Or use WebP/AVIF formats
<picture>
  <source srcset="hero.webp" type="image/webp">
  <img src="hero.jpg" alt="Hero" loading="lazy">
</picture>
```

### 3. Unused JavaScript

**Issue**: Too much JS parsed/executed

**Detection**: `unused-javascript`

**Fix**:
- Code splitting: `import()` for routes
- Tree shaking: Remove unused exports
- Dynamic imports: Load heavy libs on demand

```typescript
// Before
import { HeavyChart } from 'chart-library';

// After
const HeavyChart = lazy(() => import('chart-library'));
```

### 4. Unused CSS

**Issue**: Large CSS bundles

**Detection**: `unused-css-rules`

**Fix**:
- PurgeCSS/Tailwind purge
- CSS modules
- Critical CSS extraction

### 5. High CLS

**Issue**: Layout shifts during load

**Detection**: `cumulative-layout-shift`

**Fix**:
```css
/* Reserve space for images/ads */
.banner {
  min-height: 250px;
  position: relative;
}

/* Skeleton loading */
.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

### 6. Text Compression

**Issue**: Assets not compressed

**Detection**: `text-compression`

**Fix**:
```nginx
# nginx.conf
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
gzip_min_length 1000;
```

---

## Performance Budgets

Set budgets in `lighthouse.config.js`:

```javascript
module.exports = {
  budgets: [
    {
      path: '/*.js',
      maxSize: 200 * 1024, // 200 KB
    },
    {
      path: '/*.css',
      maxSize: 50 * 1024, // 50 KB
    },
    {
      path: '/img/*',
      maxSize: 300 * 1024, // 300 KB
    },
  ],
};
```

Run with config:

```bash
docker exec daemon-tools npx lighthouse http://localhost:3000 --config-path=/app/lighthouse.config.js
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Lighthouse CI

on: [push, pull_request]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Lighthouse
        run: |
          npx lighthouse https://your-app.com --output=json --output=html --chrome-flags="--headless"
      - name: Upload Report
        uses: actions/upload-artifact@v3
        with:
          name: lighthouse-report
          path: './*.html'
```

### Assert Scores

```bash
# Fail if performance score < 90
docker exec daemon-tools npx lighthouse http://localhost:3000 --assertions.performance=0.9
```

---

## Multi-Page Testing

Test multiple routes:

```bash
# Home
docker exec daemon-tools npx lighthouse http://localhost:3000 --output=json --output-path=reports/home.json

# Product page
docker exec daemon-tools npx lighthouse http://localhost:3000/products --output=json --output-path=reports/products.json

# Checkout
docker exec daemon-tools npx lighthouse http://localhost:3000/checkout --output=json --output-path=reports/checkout.json
```

---

## Troubleshooting

### Container Access Issues

If Lighthouse can't reach localhost:

```bash
# Use host.docker.internal (Mac/Windows) or host network (Linux)
docker exec daemon-tools npx lighthouse http://host.docker.internal:3000
```

### Timeout Errors

Increase timeout for slow apps:

```bash
docker exec daemon-tools npx lighthouse http://localhost:3000 --max-wait-for-load=45000
```

### Chrome Flags

For problematic environments:

```bash
docker exec daemon-tools npx lighthouse http://localhost:3000 --chrome-flags="--headless --no-sandbox --disable-gpu --disable-dev-shm-usage"
```

---

## Example Test Session

```bash
# 1. Ensure app is running locally
npm run dev

# 2. Run Lighthouse audit
docker exec daemon-tools npx lighthouse http://host.docker.internal:3000 --output=json --output=html

# 3. Check the report
cat lighthouse-report.json | jq '.categories'

# 4. View HTML report
open lighthouse-report.html  # Mac
xdg-open lighthouse-report.html  # Linux
```

---

## Expected Output

```
Lighthouse Scores:
  Performance:    85/100 ✓
  Accessibility:  92/100 ✓
  Best Practices: 90/100 ✓
  SEO:            95/100 ✓

Core Web Vitals:
  LCP: 2.1s ✓ (target: <2.5s)
  FID: 56ms ✓ (target: <100ms)
  CLS: 0.05 ✓ (target: <0.1)

Top Opportunities:
  1. Serve images in next-gen formats (WebP/AVIF)
  2. Eliminate render-blocking resources
  3. Reduce unused JavaScript
  4. Minify CSS
  5. Enable text compression
```
