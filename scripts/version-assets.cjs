// Every deployment references immutable, content-versioned JS and CSS files.
// This avoids mixing stale browser-cached modules with newly deployed features.
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
function versionAssets(root){
 const index=path.join(root,'index.html');
 let count=0;
 const html=fs.readFileSync(index,'utf8').replace(/\b(src|href)="([\w.-]+\.(?:js|css))"/g,(match,attr,name)=>{
  const base=name.replace(/\.[a-f0-9]{12}(\.(?:js|css))$/,'$1');
  const content=fs.readFileSync(path.join(root,base));
  const hash=createHash('sha256').update(content).digest('hex').slice(0,12);
  const extension=path.extname(base);
  const versioned=base.slice(0,-extension.length)+'.'+hash+extension;
  fs.writeFileSync(path.join(root,versioned),content);count++;
  return `${attr}="${versioned}"`;
 });
 fs.writeFileSync(index,html);
 return count;
}
if(require.main===module)console.log('Versioned assets:',versionAssets(path.resolve(__dirname,'../dist')));
module.exports={versionAssets};
