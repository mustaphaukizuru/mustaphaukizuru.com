export PATH=/opt/alt/alt-nodejs20/root/usr/bin:/opt/alt/alt-nodejs20/root/bin:$PATH
node -e "
var fs=require('fs'),path=require('path'),cp=require('child_process');
var dir='/home/u605945793/domains/mustaphaukizuru.com/nodejs';
process.chdir(dir);
// Delete the broken readable-stream package
var rsPath=dir+'/node_modules/readable-stream';
if(fs.existsSync(rsPath)){
  fs.rmSync(rsPath,{recursive:true,force:true});
  console.log('Deleted broken readable-stream');
}
// Reinstall just readable-stream
var env=Object.assign({},process.env);
fs.readFileSync(dir+'/.env','utf8').split('\n').forEach(function(l){
  l=l.trim(); if(!l||l[0]==='#') return;
  var i=l.indexOf('='); if(i<0) return;
  env[l.slice(0,i).trim()]=l.slice(i+1).trim();
});
var out=cp.execSync('npm install --ignore-scripts --no-save readable-stream@4',{cwd:dir,env:env,encoding:'utf8'});
console.log(out);
var exists=fs.existsSync(dir+'/node_modules/readable-stream/lib/_stream_readable.js');
console.log('readable-stream restored:',exists);
" 2>&1
echo "Done"
