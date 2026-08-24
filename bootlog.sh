export PATH=/opt/alt/alt-nodejs20/root/usr/bin:/opt/alt/alt-nodejs20/root/bin:$PATH
node -e "
var fs=require('fs');
var log='/home/u605945793/domains/mustaphaukizuru.com/nodejs/stderr.log';
if(fs.existsSync(log)){
  var lines=fs.readFileSync(log,'utf8').split('\n');
  console.log(lines.slice(-30).join('\n'));
}else{ console.log('no stderr.log yet'); }
"
