// test-paths.js - Run this in Electron to see where files are
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

console.log('=== Testing File Paths ===');
console.log('App path:', app.getAppPath());
console.log('Resources path:', process.resourcesPath);
console.log('Current dir:', __dirname);

const pathsToCheck = [
    path.join(__dirname, 'public', 'index.html'),
    path.join(process.resourcesPath, 'app', 'public', 'index.html'),
    path.join(process.resourcesPath, 'app.asar', 'public', 'index.html'),
    path.join(__dirname, '..', '..', 'dist', 'public', 'index.html')
];

console.log('\nChecking paths:');
for (const p of pathsToCheck) {
    console.log(`${fs.existsSync(p) ? '' : ''} ${p}`);
}

// Check what's actually in the app directory
console.log('\nContents of app directory:');
const appDir = path.join(process.resourcesPath, 'app');
if (fs.existsSync(appDir)) {
    const files = fs.readdirSync(appDir, { withFileTypes: true });
    files.forEach(file => {
        console.log(`  ${file.isDirectory() ? '' : ''} ${file.name}`);
    });
}

app.quit();
