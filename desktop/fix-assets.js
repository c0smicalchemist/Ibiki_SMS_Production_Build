// fix-assets.js - Fix asset paths for Electron
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../dist/public/index.html');
if (fs.existsSync(indexPath)) {
    let content = fs.readFileSync(indexPath, 'utf8');
    
    // Fix CSS paths (remove leading slash)
    content = content.replace(/href="\/assets\//g, 'href="assets/');
    content = content.replace(/href="\assets\//g, 'href="assets/');
    
    // Fix JS paths (remove leading slash)
    content = content.replace(/src="\/assets\//g, 'src="assets/');
    content = content.replace(/src="\assets\//g, 'src="assets/');
    
    // Also fix any other asset paths
    content = content.replace(/"\/assets\//g, '"assets/');
    
    fs.writeFileSync(indexPath, content, 'utf8');
    console.log('Fixed asset paths in index.html');
    
    // Also fix any CSS files that might have references
    const assetsDir = path.join(__dirname, '../dist/public/assets');
    if (fs.existsSync(assetsDir)) {
        const cssFiles = fs.readdirSync(assetsDir)
            .filter(f => f.endsWith('.css'));
        
        cssFiles.forEach(cssFile => {
            const cssPath = path.join(assetsDir, cssFile);
            let cssContent = fs.readFileSync(cssPath, 'utf8');
            // Fix url() references in CSS
            cssContent = cssContent.replace(/url\(\/\//g, 'url(//');
            cssContent = cssContent.replace(/url\("?\//g, 'url("');
            cssContent = cssContent.replace(/url\('/g, "url('");
            fs.writeFileSync(cssPath, cssContent, 'utf8');
        });
        console.log('Fixed paths in CSS files');
    }
} else {
    console.error('index.html not found at:', indexPath);
}
