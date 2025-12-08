// diagnose.js - Diagnose the packaged app
const fs = require('fs');
const path = require('path');

console.log('=== DIAGNOSTIC REPORT ===');
console.log('Current dir:', __dirname);
console.log('Resources path:', process.resourcesPath);

// Check public folder
const publicDir = path.join(process.resourcesPath, 'public');
console.log('\n Public folder:', publicDir);
console.log('Exists:', fs.existsSync(publicDir));

if (fs.existsSync(publicDir)) {
    const files = fs.readdirSync(publicDir);
    console.log('Files in public:', files);
    
    // Check index.html
    const indexPath = path.join(publicDir, 'index.html');
    if (fs.existsSync(indexPath)) {
        console.log('\n index.html exists');
        const content = fs.readFileSync(indexPath, 'utf8');
        
        // Check for asset references
        const assetMatches = content.match(/href="([^"]+\.css)"/g) || [];
        console.log('CSS links found:', assetMatches.length);
        
        assetMatches.forEach(match => {
            const href = match.match(/href="([^"]+)"/)[1];
            const fullPath = path.join(publicDir, href);
            console.log(`  ${href} -> ${fs.existsSync(fullPath) ? '' : ''} ${fullPath}`);
        });
        
        const jsMatches = content.match(/src="([^"]+\.js)"/g) || [];
        console.log('JS scripts found:', jsMatches.length);
        
        jsMatches.forEach(match => {
            const src = match.match(/src="([^"]+)"/)[1];
            const fullPath = path.join(publicDir, src);
            console.log(`  ${src} -> ${fs.existsSync(fullPath) ? '' : ''} ${fullPath}`);
        });
    }
}

// Check assets folder
const assetsDir = path.join(publicDir, 'assets');
console.log('\n Assets folder:', assetsDir);
console.log('Exists:', fs.existsSync(assetsDir));

if (fs.existsSync(assetsDir)) {
    const assetFiles = fs.readdirSync(assetsDir);
    console.log('Asset files (first 10):', assetFiles.slice(0, 10));
    console.log('Total assets:', assetFiles.length);
}
