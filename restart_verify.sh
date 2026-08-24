export PATH=/opt/alt/alt-nodejs20/root/usr/bin:/opt/alt/alt-nodejs20/root/bin:$PATH
node -e "
var fs=require('fs');
var dir='/home/u605945793/domains/mustaphaukizuru.com/nodejs';
fs.mkdirSync(dir+'/tmp',{recursive:true});
fs.writeFileSync(dir+'/tmp/restart.txt',new Date().toString());
console.log('Passenger restarted');
// Quick sanity check that app loads
try{
  require(dir+'/src/app');
  console.log('app.js: OK');
}catch(e){
  console.log('app.js ERROR:',e.message);
}
"
