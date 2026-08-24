import{r as o,j as a}from"./react-vendor-BhzkbE4T.js";import{u}from"./framer-Cvo5T-Ur.js";const r="ukz-meteors-kf";function m(){if(typeof document>"u"||document.getElementById(r))return;const t=document.createElement("style");t.id=r,t.textContent=`
@keyframes ukz-meteor {
  0% { transform: translate3d(0, 0, 0) rotate(45deg); opacity: 1; }
  65% { opacity: 1; }
  100% { transform: translate3d(-420px, 420px, 0) rotate(45deg); opacity: 0; }
}
`,document.head.appendChild(t)}const i=["#7DD3FC","#5D3FD3","#0284C7"];function f({number:t=20,className:d=""}){const s=u(),[l]=o.useState(()=>Array.from({length:t}).map((e,n)=>({color:i[n%i.length],top:`${Math.random()*100}%`,left:`${Math.random()*100}%`,duration:(Math.random()*5+4).toFixed(2),delay:(Math.random()*6).toFixed(2)})));return o.useEffect(()=>{m()},[]),s?null:a.jsx("div",{className:`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${d}`,"aria-hidden":"true",children:l.map((e,n)=>a.jsx("span",{className:"absolute h-px w-[90px] rounded-full",style:{top:e.top,left:e.left,background:`linear-gradient(90deg, ${e.color}, transparent)`,boxShadow:`0 0 8px 0 ${e.color}80`,animationName:"ukz-meteor",animationDuration:`${e.duration}s`,animationDelay:`${e.delay}s`,animationIterationCount:"infinite",animationTimingFunction:"linear",animationFillMode:"backwards"}},n))})}export{f as M};
