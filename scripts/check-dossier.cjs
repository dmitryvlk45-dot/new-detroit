const fs=require('fs'),os=require('os'),path=require('path');
for(const file of ['app.js','dossier-v3.js','inventory-v3.js','chrome-ui.js','sheet-v2.js','shop-ui.js','catalog-v2.js','router.js','portrait-crop.js'])new Function(fs.readFileSync('dist/'+file,'utf8'));
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'wd-dossier-'));
fs.cpSync('dist',tmp,{recursive:true});
console.log('Build assets:',require('./version-assets.cjs').versionAssets(tmp));
const html=fs.readFileSync(path.join(tmp,'index.html'),'utf8');
for(const m of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g))if(!fs.existsSync(path.join(tmp,m[1])))throw Error(m[1]);
console.log('Syntax and build references passed');
