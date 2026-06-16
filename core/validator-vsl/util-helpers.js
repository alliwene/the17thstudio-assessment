const fs = require('fs');
const util = require('util');
const path = require('path');

const mkdir = util.promisify(fs.mkdir);
const access = util.promisify(fs.access);
const writeFile = util.promisify(fs.writeFile);

function toKebabCase(str) {
  return str
    .replace(/([a-z]+)([A-Z])/g, '$1-$2') // added + for lowercase
    .replace(/([A-Z])([A-Z][a-z]+)/g, '$1-$2') // added + for lowercase after uppercase
    .toLowerCase();
}

async function writeFileWithDirs(filePath, content) {
  try {
    // Create all necessary directories
    await mkdir(path.dirname(filePath), { recursive: true });

    // Check if file exists
    try {
      await access(filePath);
      // console.log(`File ${filePath} already exists, skipping creation`);
      throw new Error('File exists');
    } catch {
      // File doesn't exist, create it
      await writeFile(filePath, content);
      // console.log(`Created file ${filePath}`);
    }
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

module.exports = {
  toKebabCase,
  writeFileWithDirs,
};
