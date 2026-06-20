import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const indexPath = path.join(__dirname, 'dist', 'index.html');
const docsPath = path.join(__dirname, 'dist', 'docs.html');

if (!fs.existsSync(indexPath)) {
  console.error('Error: dist/index.html not found! Build the project first.');
  process.exit(1);
}

let html = fs.readFileSync(indexPath, 'utf8');

// Robust replacement for og:title
html = html.replace(
  /<meta property="og:title" content="[^"]*"\s*\/?>/g,
  '<meta property="og:title" content="Happy Hour Documentation" />'
);

// Robust replacement for og:description
html = html.replace(
  /<meta property="og:description" content="[^"]*"\s*\/?>/g,
  '<meta property="og:description" content="Learn about $HH utility, economy, in-app mechanics, and contract details of the Happy Hour App." />'
);

// Robust replacement for og:image
html = html.replace(
  /<meta property="og:image" content="[^"]*"\s*\/?>/g,
  '<meta property="og:image" content="https://happy-hour-based.app/meta-x.jfif" />'
);

// Robust replacement for twitter:title
html = html.replace(
  /<meta name="twitter:title" content="[^"]*"\s*\/?>/g,
  '<meta name="twitter:title" content="Happy Hour Documentation" />'
);

// Robust replacement for twitter:description
html = html.replace(
  /<meta name="twitter:description" content="[^"]*"\s*\/?>/g,
  '<meta name="twitter:description" content="Learn about $HH utility, economy, in-app mechanics, and contract details of the Happy Hour App." />'
);

// Robust replacement for twitter:image
html = html.replace(
  /<meta name="twitter:image" content="[^"]*"\s*\/?>/g,
  '<meta name="twitter:image" content="https://happy-hour-based.app/meta-x.jfif" />'
);

// Replace page title
html = html.replace(
  /<title>[^<]*<\/title>/g,
  '<title>Happy Hour Documentation</title>'
);

fs.writeFileSync(docsPath, html, 'utf8');
console.log('Successfully generated dist/docs.html with updated documentation metadata!');
