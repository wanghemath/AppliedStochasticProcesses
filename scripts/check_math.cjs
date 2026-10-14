/* Offline syntax check for the same $/$$ math rendered in lessons and notebooks. */
'use strict';
const fs = require('fs');
const path = require('path');
const katex = require('../assets/vendor/katex/katex.min.js');
const root = path.resolve(__dirname, '..');
const htmlFiles = ['index.html', 'course-overview.html', 'project-guide.html',
  ...fs.readdirSync(path.join(root, 'modules')).filter(n => n.endsWith('.html')).map(n => 'modules/' + n)];
if (fs.existsSync(path.join(root, 'templates/lesson.html'))) htmlFiles.push('templates/lesson.html');
const notebooks = ['notebooks', 'instructor'].flatMap(dir => fs.existsSync(path.join(root, dir)) ?
  fs.readdirSync(path.join(root, dir)).filter(n => n.endsWith('.ipynb')).map(n => dir + '/' + n) : []);
const decode = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
let fragments = 0; const errors = [];
function check(text, label) {
  text = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  for (const m of text.matchAll(/\$\$([\s\S]*?)\$\$|(?<![\\$])\$(?!\$)([^$\n]+?)(?<!\\)\$/g)) {
    const formula = decode(m[1] ?? m[2]);
    try { katex.renderToString(formula, {displayMode:m[1] !== undefined, throwOnError:true, strict:'error', trust:false}); fragments++; }
    catch (e) { errors.push(`${label}: ${formula}\n${e.message}`); }
  }
}
for (const filename of htmlFiles) {
  const text = fs.readFileSync(path.join(root, filename), 'utf8')
    .replace(/<(script|style|pre|code)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  check(text, filename);
}
for (const filename of notebooks) {
  const nb = JSON.parse(fs.readFileSync(path.join(root, filename), 'utf8'));
  nb.cells.forEach((c, i) => { if (c.cell_type === 'markdown') check(Array.isArray(c.source) ? c.source.join('') : c.source, `${filename}, cell ${i+1}`); });
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`PASS: ${fragments} mathematical fragments in ${htmlFiles.length} HTML files and ${notebooks.length} notebooks parse with bundled KaTeX.`);
