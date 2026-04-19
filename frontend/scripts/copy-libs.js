/**
 * Copy third-party libraries from node_modules to static/lib/
 * These are loaded on-demand by the enhancers (not bundled).
 */

const fs = require('fs');
const path = require('path');

const STATIC_LIB = path.resolve(__dirname, '../../src/main/resources/static/lib');

function copyFile(src, destDir, destName) {
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, destName || path.basename(src));
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`  Copied ${path.basename(src)} -> ${path.relative(process.cwd(), dest)}`);
  } else {
    console.warn(`  WARN: ${src} not found, skipping`);
  }
}

console.log('Copying mermaid.js...');
// Mermaid provides a pre-built bundle
const mermaidSrc = path.resolve(__dirname, '../node_modules/mermaid/dist/mermaid.min.js');
copyFile(mermaidSrc, path.join(STATIC_LIB, 'mermaid'));

console.log('Copying KaTeX...');
const katexDir = path.resolve(__dirname, '../node_modules/katex/dist');
copyFile(path.join(katexDir, 'katex.min.js'), path.join(STATIC_LIB, 'katex'));
copyFile(path.join(katexDir, 'katex.min.css'), path.join(STATIC_LIB, 'katex'));

// Copy KaTeX fonts
const katexFontsDir = path.join(katexDir, 'fonts');
if (fs.existsSync(katexFontsDir)) {
  const fontsDestDir = path.join(STATIC_LIB, 'katex', 'fonts');
  fs.mkdirSync(fontsDestDir, { recursive: true });
  const fonts = fs.readdirSync(katexFontsDir).filter(f => f.endsWith('.woff2'));
  for (const font of fonts) {
    copyFile(path.join(katexFontsDir, font), fontsDestDir);
  }
  console.log(`  Copied ${fonts.length} KaTeX font files`);
}

console.log('Libraries copied successfully.');
