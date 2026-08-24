export PATH=/opt/alt/alt-nodejs20/root/usr/bin:/opt/alt/alt-nodejs20/root/bin:$PATH
node -e "
var fs=require('fs'),cp=require('child_process');
var dir='/home/u605945793/domains/mustaphaukizuru.com/nodejs';
process.chdir(dir);

// Load env
var env=Object.assign({},process.env);
fs.readFileSync(dir+'/.env','utf8').split('\n').forEach(function(l){
  l=l.trim(); if(!l||l[0]==='#') return;
  var i=l.indexOf('='); if(i<0) return;
  env[l.slice(0,i).trim()]=l.slice(i+1).trim();
});

// 1. Clean npm cache
console.log('[1/4] Cleaning npm cache...');
try{ cp.execSync('npm cache clean --force',{cwd:dir,env:env,encoding:'utf8'}); }catch(e){}

// 2. Install from lockfile (strict — no package upgrades)
console.log('[2/4] Installing from lockfile...');
var r=cp.execSync('npm ci --omit=dev --ignore-scripts',{cwd:dir,env:env,stdio:'pipe',encoding:'utf8',timeout:120000});
console.log(r.slice(-150));

// 3. Regenerate Prisma client
console.log('[3/4] Generating Prisma client...');
var p=cp.execSync('node node_modules/.bin/prisma generate',{cwd:dir,env:env,stdio:'pipe',encoding:'utf8',timeout:60000});
console.log(p.slice(-150));

// 4. Touch restart.txt
console.log('[4/4] Restarting Passenger...');
fs.mkdirSync(dir+'/tmp',{recursive:true});
fs.writeFileSync(dir+'/tmp/restart.txt',new Date().toString());

console.log('RECOVERY COMPLETE');
" 2>&1
