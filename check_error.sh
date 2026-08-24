export PATH=/opt/alt/alt-nodejs20/root/usr/bin:/opt/alt/alt-nodejs20/root/bin:$PATH
node -e "
var fs=require('fs');
var dir='/home/u605945793/domains/mustaphaukizuru.com/nodejs';
process.chdir(dir);
// Check stderr log
var log=dir+'/stderr.log';
if(fs.existsSync(log)){
  var content=fs.readFileSync(log,'utf8');
  var lines=content.split('\n');
  var last=lines.slice(-40).join('\n');
  console.log('=== LAST 40 LINES OF stderr.log ===');
  console.log(last);
}
// Try to require server.js and catch errors
try{
  require(dir+'/src/app');
  console.log('app.js loads OK');
}catch(e){
  console.log('app.js ERROR:',e.message);
}
"
