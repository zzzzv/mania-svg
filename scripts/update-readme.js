import { readFileSync, writeFileSync } from 'fs';

const sourceCode = readFileSync('src/index.ts', 'utf-8');
const readme = readFileSync('README.md', 'utf-8');

const match = sourceCode.match(/const defaultOptions = \{[\s\S]*?\n\};/);
const optionsCode = match ? match[0] : '';

const updated = readme.replace(
  /<!-- OPTIONS:START -->[\s\S]*?<!-- OPTIONS:END -->/,
  `<!-- OPTIONS:START -->\n\`\`\`typescript\n${optionsCode}\n\`\`\`\n<!-- OPTIONS:END -->`
);

writeFileSync('README.md', updated);