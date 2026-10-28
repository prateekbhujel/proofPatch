import{r as h,b as G,j as e,L as C,a as H}from"./app-DJFWUwtH.js";/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const F=s=>s==null?void 0:s.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase();/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */function K(s,t,a=[]){if(t==null)throw new Error("[lucide]: iconNode is required when icon name is used");return{name:F(s),size:24,node:t,...a.length>0?{aliases:a}:{}}}/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const U=s=>{let t="",a=!1;for(const n of s){if(n==="-"||n==="_"||n<=" "){a=t.length>0;continue}t.length===0?t+=n.toLowerCase():t+=a?n.toUpperCase():n,a=!1}return t};/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const X=s=>{const t=U(s);return t.charAt(0).toUpperCase()+t.slice(1)};/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const N=(...s)=>s.filter((t,a,n)=>!!t&&t.trim()!==""&&n.indexOf(t)===a).join(" ").trim();/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const f={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor","stroke-width":2,"stroke-linecap":"round","stroke-linejoin":"round"};/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */function j(s){return s!=null}function Z(s,t={}){var i,l;const a=t.attributeNames??{},n=o=>a[o]??o,r=s.size??s.width??f.width,c=s.size??s.height??f.height,d=((i=s.aliases)==null?void 0:i.filter(o=>typeof o=="string"&&o.trim()!=="").map(o=>`lucide-${o}`))??[],u=[...s.name?[`lucide-${s.name}`]:[],...d],m=((l=t.className)==null?void 0:l.split(" ").filter(Boolean))??[],p=t.includeDefaultClasses===!1?N(...m):N("lucide",...u,...m),y=t.absoluteStrokeWidth?Number(t.strokeWidth??f["stroke-width"])*Number(s.size??s.width??f.width)/Number(t.size??t.width??f.width):t.strokeWidth??f["stroke-width"];return["svg",{...Object.entries(f).reduce((o,[b,g])=>(o[n(b)]=g,o),{}),..."color"in t&&t.color&&{[n("stroke")]:t.color},..."size"in t&&j(t.size)&&{[n("width")]:t.size,[n("height")]:t.size},..."width"in t&&j(t.width)&&{[n("width")]:t.width},..."height"in t&&j(t.height)&&{[n("height")]:t.height},[n("stroke-width")]:y,...p&&{[n("class")]:p},[n("viewBox")]:`0 0 ${r} ${c}`,...t.hasA11yProp===!1?{[n("aria-hidden")]:"true"}:{},..."attributes"in t&&t.attributes},s.node.map(o=>{const[b,g,w]=o,k=t.nonScalingStroke?{[n("vector-effect")]:"non-scaling-stroke",...g}:g;return w?[b,k,w]:[b,k]})]}/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */function J(s,t={}){return Z(s,{...t,attributeNames:{...t.attributeNames,class:"className","stroke-width":"strokeWidth","stroke-linecap":"strokeLinecap","stroke-linejoin":"strokeLinejoin","vector-effect":"vectorEffect"}})}/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Q=s=>{for(const t in s)if(t.startsWith("aria-")||t==="role"||t==="title")return!0;return!1},Y=h.createContext({}),ee=()=>h.useContext(Y),te=h.forwardRef(({color:s,size:t,width:a,height:n,strokeWidth:r,absoluteStrokeWidth:c,nonScalingStroke:d,className:u="",children:m,iconNode:p=[],icon:y={node:p,aliases:[],size:24},...v},i)=>{const{size:l=24,strokeWidth:o=2,absoluteStrokeWidth:b=!1,nonScalingStroke:g=!1,color:w="currentColor",className:k=""}=ee()??{},R=!!m||Q(v),[B,T,q=[]]=J(y,{color:s??w,width:a??t??l,height:n??t??l,strokeWidth:r??o,absoluteStrokeWidth:c??b,nonScalingStroke:d??g,className:N(k,u),hasA11yProp:R,attributes:v});return h.createElement(B,{ref:i,...T},[...q.map(([O,V])=>h.createElement(O,V)),...Array.isArray(m)?m:[m]])});/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */function x(s,t=[],a=[]){const n=typeof s=="string"?K(s,t,a):s,r=h.forwardRef(({className:c,...d},u)=>h.createElement(te,{ref:u,icon:n,className:c,...d}));return n.name&&(r.displayName=X(n.name)),r}/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const S={name:"bell",size:24,node:[["path",{d:"M10.268 21a2 2 0 0 0 3.464 0",key:"vwvbt9"}],["path",{d:"M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326",key:"11g9vi"}]]};S.node;const z=x(S);/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _={name:"circle-check",size:24,node:[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m16 9-5.5 5.5L8 12",key:"xofnsj"}]],aliases:["check-circle-2"]};_.node;const L=x(_);/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const M={name:"clipboard-list",size:24,node:[["rect",{width:"8",height:"4",x:"8",y:"2",rx:"1",ry:"1",key:"tgr4d6"}],["path",{d:"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",key:"116196"}],["path",{d:"M12 11h4",key:"1jrz19"}],["path",{d:"M12 16h4",key:"n85exb"}],["path",{d:"M8 11h.01",key:"1dfujw"}],["path",{d:"M8 16h.01",key:"18s6g9"}]]};M.node;const se=x(M);/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const A={name:"git-pull-request",size:24,node:[["circle",{cx:"18",cy:"18",r:"3",key:"1xkwt0"}],["circle",{cx:"6",cy:"6",r:"3",key:"1lh9wr"}],["path",{d:"M13 6h3a2 2 0 0 1 2 2v7",key:"1yeb86"}],["line",{x1:"6",x2:"6",y1:"9",y2:"21",key:"rroup"}]]};A.node;const ne=x(A);/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const W={name:"info",size:24,node:[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 16v-4",key:"1dtifu"}],["path",{d:"M12 8h.01",key:"e9boi3"}]]};W.node;const ie=x(W);/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $={name:"layout-grid",size:24,node:[["rect",{width:"7",height:"7",x:"3",y:"3",rx:"1",key:"1g98yp"}],["rect",{width:"7",height:"7",x:"14",y:"3",rx:"1",key:"6d4xhi"}],["rect",{width:"7",height:"7",x:"14",y:"14",rx:"1",key:"nxv5o0"}],["rect",{width:"7",height:"7",x:"3",y:"14",rx:"1",key:"1bb6yr"}]]};$.node;const oe=x($);/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const I={name:"settings",size:24,node:[["path",{d:"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915",key:"1i5ecw"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]]};I.node;const ae=x(I);/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const D={name:"trash",size:24,node:[["path",{d:"M10 11v6",key:"nco0om"}],["path",{d:"M14 11v6",key:"outv1u"}],["path",{d:"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",key:"miytrc"}],["path",{d:"M3 6h18",key:"d0wm0j"}],["path",{d:"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",key:"e791ji"}]],aliases:["trash-2"]};D.node;const re=x(D);/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const E={name:"triangle-alert",size:24,node:[["path",{d:"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",key:"wmoenq"}],["path",{d:"M12 9v4",key:"juzpu7"}],["path",{d:"M12 17h.01",key:"p32p05"}]],aliases:["alert-triangle"]};E.node;const le=x(E);/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const P={name:"x",size:24,node:[["path",{d:"M18 6 6 18",key:"1bl5f8"}],["path",{d:"m6 6 12 12",key:"d8bk6v"}]]};P.node;const ce=x(P);function he({activeNav:s,children:t}){const{url:a,props:n}=G(),r=n.notifications||[],[c,d]=h.useState(!1),u=h.useRef(null),m=s?s==="pulls"?"repositories":s:a==="/"?"overview":a.startsWith("/repositories")?"repositories":a.startsWith("/issues")?"issues":a.startsWith("/checks")?"checks":a.startsWith("/settings")?"settings":"overview",p=[{key:"overview",href:"/",label:"Overview",shortLabel:"Overview",icon:oe},{key:"repositories",href:"/repositories",label:"Repositories",shortLabel:"Repos",icon:ne},{key:"issues",href:"/issues",label:"Issues",shortLabel:"Issues",icon:se},{key:"checks",href:"/checks",label:"Checks",shortLabel:"Checks",icon:L},{key:"settings",href:"/settings",label:"Settings",shortLabel:"Settings",icon:ae}];h.useEffect(()=>{function i(o){u.current&&!u.current.contains(o.target)&&d(!1)}function l(o){o.key==="Escape"&&d(!1)}return c&&(document.addEventListener("mousedown",i),document.addEventListener("keydown",l)),()=>{document.removeEventListener("mousedown",i),document.removeEventListener("keydown",l)}},[c]);const y=()=>{H.post("/notifications/clear",{},{preserveScroll:!0,onSuccess:()=>d(!1)})},v=i=>{try{return new Date(i).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}catch{return""}};return e.jsxs("div",{className:"min-h-screen flex flex-col bg-slate-50/60 text-slate-800 antialiased",children:[e.jsx("header",{className:"sticky top-0 z-40 bg-white border-b border-slate-200",children:e.jsx("div",{className:"max-w-7xl mx-auto px-3 sm:px-6 lg:px-8",children:e.jsxs("div",{className:"flex items-center justify-between h-14 gap-2",children:[e.jsxs("div",{className:"flex items-center gap-3 sm:gap-5 shrink-0",children:[e.jsxs(C,{href:"/",className:"flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 rounded-lg",children:[e.jsx("span",{className:"w-7 h-7 rounded-md bg-violet-700 flex items-center justify-center text-white font-bold text-xs tracking-tight shadow-xs group-hover:bg-violet-800 motion-safe:transition motion-reduce:transition-none",children:"P"}),e.jsxs("div",{className:"hidden sm:flex flex-col",children:[e.jsx("span",{className:"font-semibold text-slate-900 tracking-tight text-sm leading-none",children:"ProofPatch"}),e.jsx("span",{className:"text-[10px] text-violet-700 font-medium tracking-normal mt-0.5",children:"Co-Maintainer"})]})]}),e.jsxs("div",{className:"hidden md:flex items-center text-xs text-slate-400 gap-1.5 font-medium border-l border-slate-200 pl-3.5",children:[e.jsx("span",{className:"text-slate-500",children:"local"}),e.jsx("span",{children:"/"}),e.jsx("span",{className:"inline-flex items-center px-2 py-0.5 rounded font-mono text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200",children:"sqlite:proofpatch"})]})]}),e.jsx("nav",{className:"flex items-center gap-0.5 sm:gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-1",children:p.map(i=>{const l=i.icon,o=m===i.key;return e.jsxs(C,{href:i.href,className:`inline-flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-medium rounded-md motion-safe:transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-1 whitespace-nowrap ${o?"bg-violet-700 text-white shadow-xs":"text-slate-600 hover:text-slate-900 hover:bg-slate-100"}`,children:[e.jsx(l,{className:`w-3.5 h-3.5 ${o?"text-white":"text-slate-400"}`}),e.jsx("span",{className:"hidden sm:inline",children:i.label}),e.jsx("span",{className:"inline sm:hidden",children:i.shortLabel})]},i.key)})}),e.jsxs("div",{className:"flex items-center gap-2 relative",children:[e.jsxs("div",{className:"relative",children:[e.jsxs("button",{type:"button",onClick:()=>d(!c),"aria-label":"View notifications",className:`p-1.5 rounded-md border text-slate-600 hover:text-slate-900 hover:bg-slate-100 motion-safe:transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 ${c?"bg-slate-100 border-slate-300":"border-slate-200 bg-white"}`,children:[e.jsx(z,{className:"w-4 h-4"}),r.length>0&&e.jsx("span",{className:"absolute -top-1 -right-1 w-4 h-4 bg-violet-700 text-white text-[10px] font-bold rounded-full flex items-center justify-center",children:r.length>9?"9+":r.length})]}),c&&e.jsxs("div",{ref:u,className:"absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden motion-safe:transition motion-reduce:transition-none",children:[e.jsxs("div",{className:"px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between",children:[e.jsxs("div",{className:"flex items-center gap-1.5",children:[e.jsx(z,{className:"w-3.5 h-3.5 text-violet-700"}),e.jsx("span",{className:"text-xs font-semibold text-slate-900",children:"Notifications"}),e.jsxs("span",{className:"text-[10px] text-slate-400 font-mono",children:["(",r.length,")"]})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[r.length>0&&e.jsxs("button",{type:"button",onClick:y,className:"text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 focus-visible:outline-none focus-visible:underline",children:[e.jsx(re,{className:"w-3 h-3"}),e.jsx("span",{children:"Clear all"})]}),e.jsx("button",{type:"button",onClick:()=>d(!1),className:"p-1 rounded text-slate-400 hover:text-slate-600 focus-visible:outline-none",children:e.jsx(ce,{className:"w-3.5 h-3.5"})})]})]}),e.jsx("div",{className:"max-h-80 overflow-y-auto divide-y divide-slate-100",children:r.length===0?e.jsxs("div",{className:"p-6 text-center text-xs text-slate-500 space-y-1",children:[e.jsx("p",{className:"font-medium text-slate-700",children:"No new notifications"}),e.jsx("p",{className:"text-[11px] text-slate-400",children:"Workflow events, review drafts, and verifications will appear here."})]}):r.map(i=>{const l=i.type==="error"?le:i.type==="success"?L:ie,o=i.type==="error"?"text-rose-500":i.type==="success"?"text-emerald-500":"text-violet-600";return e.jsxs("div",{className:"p-3 hover:bg-slate-50/70 text-xs space-y-0.5",children:[e.jsxs("div",{className:"flex items-center justify-between gap-2",children:[e.jsxs("div",{className:"flex items-center gap-1.5 font-medium text-slate-900",children:[e.jsx(l,{className:`w-3.5 h-3.5 shrink-0 ${o}`}),e.jsx("span",{children:i.title})]}),e.jsx("span",{className:"text-[10px] text-slate-400 whitespace-nowrap",children:v(i.timestamp)})]}),e.jsx("p",{className:"text-slate-600 pl-5 text-[11px] leading-relaxed",children:i.message})]},i.id)})})]})]}),e.jsx("div",{className:"hidden md:flex items-center",children:e.jsxs("span",{className:"inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200",children:[e.jsx("span",{className:"w-1.5 h-1.5 rounded-full bg-emerald-500"}),e.jsx("span",{children:"Worktree Runner"})]})})]})]})})}),e.jsx("main",{className:"flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-7",children:t}),e.jsx("footer",{className:"mt-auto border-t border-slate-200 bg-white py-5",children:e.jsxs("div",{className:"max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("span",{className:"font-semibold text-slate-800",children:"ProofPatch"}),e.jsx("span",{children:"·"}),e.jsx("span",{children:"Muse co-maintainer & verification engine"})]}),e.jsx("div",{className:"text-[11px] text-slate-400",children:"Isolated worktrees · Cryptographic receipts · Public repositories only"})]})})]})}export{he as A,L as C,ne as G,ie as I,ae as S,le as T,ce as X,re as a,x as c};
