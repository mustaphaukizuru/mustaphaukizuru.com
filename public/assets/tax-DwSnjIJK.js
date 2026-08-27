const t=(Number.isFinite(NaN),.16),u=Math.round(t*1e4)/100;function a(e,r=t){const n=Math.round(Number(e||0)*100);return!(r>0)||n<=0?0:(n-Math.round(n/(1+r)))/100}export{u as T,a as i};
