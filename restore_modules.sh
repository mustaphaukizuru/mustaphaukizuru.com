export PATH=/opt/alt/alt-nodejs20/root/usr/bin:/opt/alt/alt-nodejs20/root/bin:$PATH
node -e "
var fs=require('fs'),cp=require('child_process');
var dir='/home/u605945793/domains/mustaphaukizuru.com/nodejs';
process.chdir(dir);
var env=Object.assign({},process.env);
fs.readFileSync(dir+'/.env','utf8').split('\n').forEach(function(l){
  l=l.trim(); if(!l||l[0]==='#') return;
  var i=l.indexOf('='); if(i<0) return;
  env[l.slice(0,i).trim()]=l.slice(i+1).trim();
});
// Clean cache
console.log('Cleaning npm cache...');
try{ cp.execSync('npm cache clean --force',{cwd:dir,env:env,encoding:'utf8'}); }catch(e){}
// Delete node_modules to start clean
console.log('Removing node_modules...');
fs.rmSync(dir+'/node_modules',{recursive:true,force:true});
// Reinstall from lockfile
console.log('Installing from lockfile (npm ci)...');
var r=cp.execSync('npm ci --omit=dev --ignore-scripts',{cwd:dir,env:env,stdio:'pipe',encoding:'utf8'});
console.log(r.slice(-200));
// Regenerate prisma
console.log('Regenerating Prisma client...');
var p=cp.execSync('node node_modules/.bin/prisma generate',{cwd:dir,env:env,stdio:'pipe',encoding:'utf8'});
console.log(p.slice(-200));
// Restart
fs.mkdirSync(dir+'/tmp',{recursive:true});
fs.writeFileSync(dir+'/tmp/restart.txt',new Date().toString());
console.log('DONE — restarted');
" 2>&1
