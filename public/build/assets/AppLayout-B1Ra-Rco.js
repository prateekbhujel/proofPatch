import{r as x,b as R,j as s,L as C}from"./app-7xR6RsV_.js";/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const B=t=>t==null?void 0:t.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase();/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */function E(t,e,o=[]){if(e==null)throw new Error("[lucide]: iconNode is required when icon name is used");return{name:B(t),size:24,node:e,...o.length>0?{aliases:o}:{}}}/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const D=t=>{let e="",o=!1;for(const i of t){if(i==="-"||i==="_"||i<=" "){o=e.length>0;continue}e.length===0?e+=i.toLowerCase():e+=o?i.toUpperCase():i,o=!1}return e};/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const q=t=>{const e=D(t);return e.charAt(0).toUpperCase()+e.slice(1)};/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const N=(...t)=>t.filter((e,o,i)=>!!e&&e.trim()!==""&&i.indexOf(e)===o).join(" ").trim();/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const h={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor","stroke-width":2,"stroke-linecap":"round","stroke-linejoin":"round"};/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */function j(t){return t!=null}function G(t,e={}){var b,m;const o=e.attributeNames??{},i=n=>o[n]??n,l=t.size??t.width??h.width,r=t.size??t.height??h.height,a=((b=t.aliases)==null?void 0:b.filter(n=>typeof n=="string"&&n.trim()!=="").map(n=>`lucide-${n}`))??[],c=[...t.name?[`lucide-${t.name}`]:[],...a],d=((m=e.className)==null?void 0:m.split(" ").filter(Boolean))??[],p=e.includeDefaultClasses===!1?N(...d):N("lucide",...c,...d),y=e.absoluteStrokeWidth?Number(e.strokeWidth??h["stroke-width"])*Number(t.size??t.width??h.width)/Number(e.size??e.width??h.width):e.strokeWidth??h["stroke-width"];return["svg",{...Object.entries(h).reduce((n,[u,f])=>(n[i(u)]=f,n),{}),..."color"in e&&e.color&&{[i("stroke")]:e.color},..."size"in e&&j(e.size)&&{[i("width")]:e.size,[i("height")]:e.size},..."width"in e&&j(e.width)&&{[i("width")]:e.width},..."height"in e&&j(e.height)&&{[i("height")]:e.height},[i("stroke-width")]:y,...p&&{[i("class")]:p},[i("viewBox")]:`0 0 ${l} ${r}`,...e.hasA11yProp===!1?{[i("aria-hidden")]:"true"}:{},..."attributes"in e&&e.attributes},t.node.map(n=>{const[u,f,g]=n,k=e.nonScalingStroke?{[i("vector-effect")]:"non-scaling-stroke",...f}:f;return g?[u,k,g]:[u,k]})]}/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */function F(t,e={}){return G(t,{...e,attributeNames:{...e.attributeNames,class:"className","stroke-width":"strokeWidth","stroke-linecap":"strokeLinecap","stroke-linejoin":"strokeLinejoin","vector-effect":"vectorEffect"}})}/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const H=t=>{for(const e in t)if(e.startsWith("aria-")||e==="role"||e==="title")return!0;return!1},O=x.createContext({}),U=()=>x.useContext(O),K=x.forwardRef(({color:t,size:e,width:o,height:i,strokeWidth:l,absoluteStrokeWidth:r,nonScalingStroke:a,className:c="",children:d,iconNode:p=[],icon:y={node:p,aliases:[],size:24},...v},b)=>{const{size:m=24,strokeWidth:n=2,absoluteStrokeWidth:u=!1,nonScalingStroke:f=!1,color:g="currentColor",className:k=""}=U()??{},S=!!d||H(v),[P,I,$=[]]=F(y,{color:t??g,width:o??e??m,height:i??e??m,strokeWidth:l??n,absoluteStrokeWidth:r??u,nonScalingStroke:a??f,className:N(k,c),hasA11yProp:S,attributes:v});return x.createElement(P,{ref:b,...I},[...$.map(([_,M])=>x.createElement(_,M)),...Array.isArray(d)?d:[d]])});/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */function w(t,e=[],o=[]){const i=typeof t=="string"?E(t,e,o):t,l=x.forwardRef(({className:r,...a},c)=>x.createElement(K,{ref:c,icon:i,className:r,...a}));return i.name&&(l.displayName=q(i.name)),l}/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const L={name:"circle-check",size:24,node:[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m16 9-5.5 5.5L8 12",key:"xofnsj"}]],aliases:["check-circle-2"]};L.node;const V=w(L);/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const z={name:"clipboard-list",size:24,node:[["rect",{width:"8",height:"4",x:"8",y:"2",rx:"1",ry:"1",key:"tgr4d6"}],["path",{d:"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",key:"116196"}],["path",{d:"M12 11h4",key:"1jrz19"}],["path",{d:"M12 16h4",key:"n85exb"}],["path",{d:"M8 11h.01",key:"1dfujw"}],["path",{d:"M8 16h.01",key:"18s6g9"}]]};z.node;const Z=w(z);/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const W={name:"git-pull-request",size:24,node:[["circle",{cx:"18",cy:"18",r:"3",key:"1xkwt0"}],["circle",{cx:"6",cy:"6",r:"3",key:"1lh9wr"}],["path",{d:"M13 6h3a2 2 0 0 1 2 2v7",key:"1yeb86"}],["line",{x1:"6",x2:"6",y1:"9",y2:"21",key:"rroup"}]]};W.node;const J=w(W);/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const A={name:"layout-grid",size:24,node:[["rect",{width:"7",height:"7",x:"3",y:"3",rx:"1",key:"1g98yp"}],["rect",{width:"7",height:"7",x:"14",y:"3",rx:"1",key:"6d4xhi"}],["rect",{width:"7",height:"7",x:"14",y:"14",rx:"1",key:"nxv5o0"}],["rect",{width:"7",height:"7",x:"3",y:"14",rx:"1",key:"1bb6yr"}]]};A.node;const Q=w(A);function X({activeNav:t,children:e}){const{url:o}=R(),i=t?t==="pulls"?"repositories":t:o==="/"?"overview":o.startsWith("/repositories")?"repositories":o.startsWith("/issues")?"issues":o.startsWith("/checks")?"checks":"overview",l=[{key:"overview",href:"/",label:"Overview",shortLabel:"Overview",icon:Q},{key:"repositories",href:"/repositories",label:"Repositories",shortLabel:"Repos",icon:J},{key:"issues",href:"/issues",label:"Issues",shortLabel:"Issues",icon:Z},{key:"checks",href:"/checks",label:"Checks",shortLabel:"Checks",icon:V}];return s.jsxs("div",{className:"min-h-screen flex flex-col bg-slate-50/60 text-slate-800 antialiased",children:[s.jsx("header",{className:"sticky top-0 z-40 bg-white border-b border-slate-200",children:s.jsx("div",{className:"max-w-7xl mx-auto px-3 sm:px-6 lg:px-8",children:s.jsxs("div",{className:"flex items-center justify-between h-14 gap-2",children:[s.jsxs("div",{className:"flex items-center gap-3 sm:gap-5 shrink-0",children:[s.jsxs(C,{href:"/",className:"flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 rounded-lg",children:[s.jsx("span",{className:"w-7 h-7 rounded-md bg-violet-700 flex items-center justify-center text-white font-bold text-xs tracking-tight shadow-xs group-hover:bg-violet-800 transition",children:"P"}),s.jsxs("div",{className:"hidden sm:flex flex-col",children:[s.jsx("span",{className:"font-semibold text-slate-900 tracking-tight text-sm leading-none",children:"ProofPatch"}),s.jsx("span",{className:"text-[10px] text-violet-700 font-medium tracking-normal mt-0.5",children:"Co-Maintainer"})]})]}),s.jsxs("div",{className:"hidden md:flex items-center text-xs text-slate-400 gap-1.5 font-medium border-l border-slate-200 pl-3.5",children:[s.jsx("span",{className:"text-slate-500",children:"local"}),s.jsx("span",{children:"/"}),s.jsx("span",{className:"inline-flex items-center px-2 py-0.5 rounded font-mono text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200",children:"sqlite:proofpatch"})]})]}),s.jsx("nav",{className:"flex items-center gap-0.5 sm:gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-1",children:l.map(r=>{const a=r.icon,c=i===r.key;return s.jsxs(C,{href:r.href,className:`inline-flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-1 whitespace-nowrap ${c?"bg-violet-700 text-white shadow-xs":"text-slate-600 hover:text-slate-900 hover:bg-slate-100"}`,children:[s.jsx(a,{className:`w-3.5 h-3.5 ${c?"text-white":"text-slate-400"}`}),s.jsx("span",{className:"hidden sm:inline",children:r.label}),s.jsx("span",{className:"inline sm:hidden",children:r.shortLabel})]},r.key)})}),s.jsx("div",{className:"hidden md:flex items-center gap-2",children:s.jsxs("span",{className:"inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200",children:[s.jsx("span",{className:"w-1.5 h-1.5 rounded-full bg-emerald-500"}),s.jsx("span",{children:"Worktree Runner"})]})})]})})}),s.jsx("main",{className:"flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-7",children:e}),s.jsx("footer",{className:"mt-auto border-t border-slate-200 bg-white py-5",children:s.jsxs("div",{className:"max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500",children:[s.jsxs("div",{className:"flex items-center gap-2",children:[s.jsx("span",{className:"font-semibold text-slate-800",children:"ProofPatch"}),s.jsx("span",{children:"·"}),s.jsx("span",{children:"Muse co-maintainer & verification engine"})]}),s.jsx("div",{className:"text-[11px] text-slate-400",children:"Isolated worktrees · Cryptographic receipts"})]})})]})}export{X as A,V as C,J as G,w as c};
