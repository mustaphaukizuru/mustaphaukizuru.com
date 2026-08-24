export PATH=/opt/alt/alt-nodejs20/root/usr/bin:/opt/alt/alt-nodejs20/root/bin:$PATH
node -e "
var fs=require('fs'),cp=require('child_process');
var dir='/home/u605945793/domains/mustaphaukizuru.com/nodejs';
var nm=dir+'/node_modules';
var exists=fs.existsSync(nm);
console.log('node_modules exists:',exists);
if(exists){
  var express=fs.existsSync(nm+'/express');
  var prisma=fs.existsSync(nm+'/@prisma/client');
  var readable=fs.existsSync(nm+'/readable-stream');
  console.log('express:',express,'prisma-client:',prisma,'readable-stream:',readable);
  // Try to load app
  try{
    process.chdir(dir);
    require(dir+'/src/app');
    console.log('app.js loads: OK');
  }catch(e){
    console.log('app.js ERROR:',e.message);
  }
}else{
  console.log('node_modules is MISSING - still installing?');
}
" 2>&1
