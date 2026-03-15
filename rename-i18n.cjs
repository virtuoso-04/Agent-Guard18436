const fs = require('fs');
const path = require('path');

const replaceInFile = (filePath, searchValue, replaceValue) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  if (content.includes(searchValue) || content.includes(searchValue.toLowerCase())) {
    const newContent = content
      .replace(new RegExp(searchValue, 'ig'), replaceValue);
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`Updated ${filePath}`);
  }
};

const i18nDir = path.join(__dirname, 'packages/i18n/locales');
const findFiles = (dir) => {
  const results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results.push(...findFiles(file));
    } else if (file.endsWith('.json')) {
      results.push(file);
    }
  });
  return results;
};

const files = findFiles(i18nDir);
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf-8');
  let newContent = content;
  newContent = newContent.replace(/Agent Guard/g, 'Agent Guard');
  newContent = newContent.replace(/Agent Guard/g, 'Agent Guard');
  newContent = newContent.replace(/Agent Guard/g, 'agent guard');
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf-8');
    console.log(`Updated translation: ${file}`);
  }
});
