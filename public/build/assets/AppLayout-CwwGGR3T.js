import{r as x,b as G,j as t,L as j,a as F}from"./app-BKkxDYu6.js";/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const K=s=>s==null?void 0:s.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase();/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */function U(s,e,a=[]){if(e==null)throw new Error("[lucide]: iconNode is required when icon name is used");return{name:K(s),size:24,node:e,...a.length>0?{aliases:a}:{}}}/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const X=s=>{let e="",a=!1;for(const n of s){if(n==="-"||n==="_"||n<=" "){a=e.length>0;continue}e.length===0?e+=n.toLowerCase():e+=a?n.toUpperCase():n,a=!1}return e};/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Z=s=>{const e=X(s);return e.charAt(0).toUpperCase()+e.slice(1)};/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const C=(...s)=>s.filter((e,a,n)=>!!e&&e.trim()!==""&&n.indexOf(e)===a).join(" ").trim();/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor","stroke-width":2,"stroke-linecap":"round","stroke-linejoin":"round"};/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */function N(s){return s!=null}function J(s,e={}){var b,i;const a=e.attributeNames??{},n=o=>a[o]??o,l=s.size??s.width??m.width,c=s.size??s.height??m.height,d=((b=s.aliases)==null?void 0:b.filter(o=>typeof o=="string"&&o.trim()!=="").map(o=>`lucide-${o}`))??[],u=[...s.name?[`lucide-${s.name}`]:[],...d],f=((i=e.className)==null?void 0:i.split(" ").filter(Boolean))??[],p=e.includeDefaultClasses===!1?C(...f):C("lucide",...u,...f),y=e.absoluteStrokeWidth?Number(e.strokeWidth??m["stroke-width"])*Number(s.size??s.width??m.width)/Number(e.size??e.width??m.width):e.strokeWidth??m["stroke-width"];return["svg",{...Object.entries(m).reduce((o,[r,g])=>(o[n(r)]=g,o),{}),..."color"in e&&e.color&&{[n("stroke")]:e.color},..."size"in e&&N(e.size)&&{[n("width")]:e.size,[n("height")]:e.size},..."width"in e&&N(e.width)&&{[n("width")]:e.width},..."height"in e&&N(e.height)&&{[n("height")]:e.height},[n("stroke-width")]:y,...p&&{[n("class")]:p},[n("viewBox")]:`0 0 ${l} ${c}`,...e.hasA11yProp===!1?{[n("aria-hidden")]:"true"}:{},..."attributes"in e&&e.attributes},s.node.map(o=>{const[r,g,v]=o,w=e.nonScalingStroke?{[n("vector-effect")]:"non-scaling-stroke",...g}:g;return v?[r,w,v]:[r,w]})]}/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */function Q(s,e={}){return J(s,{...e,attributeNames:{...e.attributeNames,class:"className","stroke-width":"strokeWidth","stroke-linecap":"strokeLinecap","stroke-linejoin":"strokeLinejoin","vector-effect":"vectorEffect"}})}/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Y=s=>{for(const e in s)if(e.startsWith("aria-")||e==="role"||e==="title")return!0;return!1},ee=x.createContext({}),te=()=>x.useContext(ee),se=x.forwardRef(({color:s,size:e,width:a,height:n,strokeWidth:l,absoluteStrokeWidth:c,nonScalingStroke:d,className:u="",children:f,iconNode:p=[],icon:y={node:p,aliases:[],size:24},...k},b)=>{const{size:i=24,strokeWidth:o=2,absoluteStrokeWidth:r=!1,nonScalingStroke:g=!1,color:v="currentColor",className:w=""}=te()??{},R=!!f||Y(k),[T,H,O=[]]=Q(y,{color:s??v,width:a??e??i,height:n??e??i,strokeWidth:l??o,absoluteStrokeWidth:c??r,nonScalingStroke:d??g,className:C(w,u),hasA11yProp:R,attributes:k});return x.createElement(T,{ref:b,...H},[...O.map(([V,q])=>x.createElement(V,q)),...Array.isArray(f)?f:[f]])});/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */function h(s,e=[],a=[]){const n=typeof s=="string"?U(s,e,a):s,l=x.forwardRef(({className:c,...d},u)=>x.createElement(se,{ref:u,icon:n,className:c,...d}));return n.name&&(l.displayName=Z(n.name)),l}/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const A={name:"bell",size:24,node:[["path",{d:"M10.268 21a2 2 0 0 0 3.464 0",key:"vwvbt9"}],["path",{d:"M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326",key:"11g9vi"}]]};A.node;const z=h(A);/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const L={name:"book-open",size:24,node:[["path",{d:"M12 5v16",key:"1f6ucr"}],["path",{d:"M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z",key:"1fyvmf"}]]};L.node;const ne=h(L);/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const M={name:"circle-check",size:24,node:[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m16 9-5.5 5.5L8 12",key:"xofnsj"}]],aliases:["check-circle-2"]};M.node;const _=h(M);/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const S={name:"clipboard-list",size:24,node:[["rect",{width:"8",height:"4",x:"8",y:"2",rx:"1",ry:"1",key:"tgr4d6"}],["path",{d:"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",key:"116196"}],["path",{d:"M12 11h4",key:"1jrz19"}],["path",{d:"M12 16h4",key:"n85exb"}],["path",{d:"M8 11h.01",key:"1dfujw"}],["path",{d:"M8 16h.01",key:"18s6g9"}]]};S.node;const ie=h(S);/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $={name:"git-pull-request",size:24,node:[["circle",{cx:"18",cy:"18",r:"3",key:"1xkwt0"}],["circle",{cx:"6",cy:"6",r:"3",key:"1lh9wr"}],["path",{d:"M13 6h3a2 2 0 0 1 2 2v7",key:"1yeb86"}],["line",{x1:"6",x2:"6",y1:"9",y2:"21",key:"rroup"}]]};$.node;const oe=h($);/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const W={name:"info",size:24,node:[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 16v-4",key:"1dtifu"}],["path",{d:"M12 8h.01",key:"e9boi3"}]]};W.node;const ae=h(W);/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const D={name:"layout-grid",size:24,node:[["rect",{width:"7",height:"7",x:"3",y:"3",rx:"1",key:"1g98yp"}],["rect",{width:"7",height:"7",x:"14",y:"3",rx:"1",key:"6d4xhi"}],["rect",{width:"7",height:"7",x:"14",y:"14",rx:"1",key:"nxv5o0"}],["rect",{width:"7",height:"7",x:"3",y:"14",rx:"1",key:"1bb6yr"}]]};D.node;const re=h(D);/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const P={name:"settings",size:24,node:[["path",{d:"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915",key:"1i5ecw"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]]};P.node;const le=h(P);/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const E={name:"trash",size:24,node:[["path",{d:"M10 11v6",key:"nco0om"}],["path",{d:"M14 11v6",key:"outv1u"}],["path",{d:"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",key:"miytrc"}],["path",{d:"M3 6h18",key:"d0wm0j"}],["path",{d:"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",key:"e791ji"}]],aliases:["trash-2"]};E.node;const ce=h(E);/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const I={name:"triangle-alert",size:24,node:[["path",{d:"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",key:"wmoenq"}],["path",{d:"M12 9v4",key:"juzpu7"}],["path",{d:"M12 17h.01",key:"p32p05"}]],aliases:["alert-triangle"]};I.node;const de=h(I);/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const B={name:"x",size:24,node:[["path",{d:"M18 6 6 18",key:"1bl5f8"}],["path",{d:"m6 6 12 12",key:"d8bk6v"}]]};B.node;const he=h(B);function ue({activeNav:s,children:e}){const{url:a,props:n}=G(),l=n.notifications||[],[c,d]=x.useState(!1),u=x.useRef(null),f=s?s==="pulls"?"repositories":s:a==="/"?"overview":a.startsWith("/repositories")?"repositories":a.startsWith("/issues")?"issues":a.startsWith("/checks")?"checks":a.startsWith("/settings")?"settings":a.startsWith("/docs")?"docs":"overview",p=[{key:"overview",href:"/",label:"Overview",icon:re},{key:"repositories",href:"/repositories",label:"Repositories",icon:oe},{key:"issues",href:"/issues",label:"Issues",icon:ie},{key:"checks",href:"/checks",label:"Checks",icon:_},{key:"settings",href:"/settings",label:"Settings",icon:le},{key:"docs",href:"/docs",label:"Docs",icon:ne}];x.useEffect(()=>{function i(r){u.current&&!u.current.contains(r.target)&&d(!1)}function o(r){r.key==="Escape"&&d(!1)}return c&&(document.addEventListener("mousedown",i),document.addEventListener("keydown",o)),()=>{document.removeEventListener("mousedown",i),document.removeEventListener("keydown",o)}},[c]);const y=()=>{F.post("/notifications/clear",{},{preserveScroll:!0,onSuccess:()=>d(!1)})},k=i=>{try{return new Date(i).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}catch{return""}},b=i=>i.replace(/\b([a-f0-9]{12})[a-f0-9]{52}\b/g,"$1…");return t.jsxs("div",{className:"min-h-screen flex flex-col bg-slate-50/60 text-slate-800 antialiased font-sans",children:[t.jsx("header",{className:"sticky top-0 z-40 bg-white border-b border-slate-200 shadow-2xs",children:t.jsx("div",{className:"max-w-7xl mx-auto px-4 sm:px-6 lg:px-8",children:t.jsxs("div",{className:"flex items-center justify-between h-14 gap-3",children:[t.jsx("div",{className:"flex items-center gap-4 shrink-0",children:t.jsxs(j,{href:"/",className:"flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 rounded-lg",children:[t.jsx("span",{className:"w-7 h-7 rounded-md bg-violet-700 flex items-center justify-center text-white font-bold text-xs tracking-tight shadow-xs group-hover:bg-violet-800 transition",children:"P"}),t.jsx("span",{className:"font-bold text-slate-900 tracking-tight text-sm",children:"ProofPatcher"})]})}),t.jsx("nav",{className:"flex items-center gap-1 sm:gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-1",children:p.map(i=>{const o=i.icon,r=f===i.key;return t.jsxs(j,{href:i.href,className:`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 whitespace-nowrap ${r?"bg-violet-700 text-white shadow-xs":"text-slate-600 hover:text-slate-900 hover:bg-slate-100"}`,children:[t.jsx(o,{className:`w-3.5 h-3.5 ${r?"text-white":"text-slate-400"}`}),t.jsx("span",{children:i.label})]},i.key)})}),t.jsx("div",{className:"flex items-center gap-2 relative",children:t.jsxs("div",{className:"relative",children:[t.jsxs("button",{type:"button",onClick:()=>d(!c),"aria-label":"View notifications",className:`p-2 rounded-md border text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 ${c?"bg-slate-100 border-slate-300":"border-slate-200 bg-white"}`,children:[t.jsx(z,{className:"w-4 h-4"}),l.length>0&&t.jsx("span",{className:"absolute -top-1 -right-1 w-4 h-4 bg-violet-700 text-white text-[10px] font-bold rounded-full flex items-center justify-center",children:l.length>9?"9+":l.length})]}),c&&t.jsxs("div",{ref:u,className:"absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden",children:[t.jsxs("div",{className:"px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between",children:[t.jsxs("div",{className:"flex items-center gap-1.5",children:[t.jsx(z,{className:"w-3.5 h-3.5 text-violet-700"}),t.jsx("span",{className:"text-xs font-semibold text-slate-900",children:"Notifications"}),t.jsxs("span",{className:"text-[10px] text-slate-400 font-mono",children:["(",l.length,")"]})]}),t.jsxs("div",{className:"flex items-center gap-2",children:[l.length>0&&t.jsxs("button",{type:"button",onClick:y,className:"text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 focus-visible:outline-none focus-visible:underline",children:[t.jsx(ce,{className:"w-3 h-3"}),t.jsx("span",{children:"Clear all"})]}),t.jsx("button",{type:"button",onClick:()=>d(!1),className:"p-1 rounded text-slate-400 hover:text-slate-600 focus-visible:outline-none",children:t.jsx(he,{className:"w-3.5 h-3.5"})})]})]}),t.jsx("div",{className:"max-h-80 overflow-y-auto divide-y divide-slate-100",children:l.length===0?t.jsxs("div",{className:"p-6 text-center text-xs text-slate-500 space-y-1",children:[t.jsx("p",{className:"font-medium text-slate-700",children:"No new notifications"}),t.jsx("p",{className:"text-[11px] text-slate-400",children:"Workflow events and verifications appear here."})]}):l.map(i=>{const o=i.type==="error"?de:i.type==="success"?_:ae,r=i.type==="error"?"text-rose-500":i.type==="success"?"text-emerald-500":"text-violet-600";return t.jsxs("div",{className:"p-3 hover:bg-slate-50/70 text-xs space-y-0.5",children:[t.jsxs("div",{className:"flex items-center justify-between gap-2",children:[t.jsxs("div",{className:"flex items-center gap-1.5 font-medium text-slate-900",children:[t.jsx(o,{className:`w-3.5 h-3.5 shrink-0 ${r}`}),t.jsx("span",{children:i.title})]}),t.jsx("span",{className:"text-[10px] text-slate-400 whitespace-nowrap",children:k(i.timestamp)})]}),t.jsx("p",{className:"text-slate-600 pl-5 text-[11px] leading-relaxed break-words font-mono",children:b(i.message)})]},i.id)})})]})]})})]})})}),t.jsx("main",{className:"flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6",children:e}),t.jsx("footer",{className:"mt-auto border-t border-slate-200 bg-white py-3.5",children:t.jsxs("div",{className:"max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500",children:[t.jsxs("div",{className:"flex items-center gap-2 text-slate-600",children:[t.jsx("span",{children:"© 2026 ProofPatcher"}),t.jsx("span",{className:"text-slate-300",children:"·"}),t.jsx("a",{href:"https://github.com/prateekbhujel",target:"_blank",rel:"noreferrer",className:"text-slate-600 hover:text-slate-900 font-medium transition",children:"by Pratik Bhujel"})]}),t.jsxs("div",{className:"flex items-center gap-3 text-slate-500",children:[t.jsx(j,{href:"/docs",className:"hover:text-slate-800 transition font-medium",children:"Docs"}),t.jsx("span",{className:"text-slate-300",children:"·"}),t.jsx("a",{href:"https://github.com/prateekbhujel/proofPatch",target:"_blank",rel:"noreferrer",className:"hover:text-slate-800 transition font-medium",children:"GitHub"})]})]})})]})}export{ue as A,ne as B,_ as C,oe as G,ae as I,le as S,de as T,he as X,ce as a,h as c};
