import{r as x,a as B,j as o,L as C}from"./app-Db7hc5Od.js";/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const E=t=>t==null?void 0:t.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase();/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */function R(t,e,i=[]){if(e==null)throw new Error("[lucide]: iconNode is required when icon name is used");return{name:E(t),size:24,node:e,...i.length>0?{aliases:i}:{}}}/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const q=t=>{let e="",i=!1;for(const s of t){if(s==="-"||s==="_"||s<=" "){i=e.length>0;continue}e.length===0?e+=s.toLowerCase():e+=i?s.toUpperCase():s,i=!1}return e};/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const D=t=>{const e=q(t);return e.charAt(0).toUpperCase()+e.slice(1)};/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const N=(...t)=>t.filter((e,i,s)=>!!e&&e.trim()!==""&&s.indexOf(e)===i).join(" ").trim();/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const h={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor","stroke-width":2,"stroke-linecap":"round","stroke-linejoin":"round"};/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */function v(t){return t!=null}function G(t,e={}){var p,m;const i=e.attributeNames??{},s=n=>i[n]??n,l=t.size??t.width??h.width,r=t.size??t.height??h.height,a=((p=t.aliases)==null?void 0:p.filter(n=>typeof n=="string"&&n.trim()!=="").map(n=>`lucide-${n}`))??[],c=[...t.name?[`lucide-${t.name}`]:[],...a],d=((m=e.className)==null?void 0:m.split(" ").filter(Boolean))??[],g=e.includeDefaultClasses===!1?N(...d):N("lucide",...c,...d),k=e.absoluteStrokeWidth?Number(e.strokeWidth??h["stroke-width"])*Number(t.size??t.width??h.width)/Number(e.size??e.width??h.width):e.strokeWidth??h["stroke-width"];return["svg",{...Object.entries(h).reduce((n,[u,f])=>(n[s(u)]=f,n),{}),..."color"in e&&e.color&&{[s("stroke")]:e.color},..."size"in e&&v(e.size)&&{[s("width")]:e.size,[s("height")]:e.size},..."width"in e&&v(e.width)&&{[s("width")]:e.width},..."height"in e&&v(e.height)&&{[s("height")]:e.height},[s("stroke-width")]:k,...g&&{[s("class")]:g},[s("viewBox")]:`0 0 ${l} ${r}`,...e.hasA11yProp===!1?{[s("aria-hidden")]:"true"}:{},..."attributes"in e&&e.attributes},t.node.map(n=>{const[u,f,w]=n,b=e.nonScalingStroke?{[s("vector-effect")]:"non-scaling-stroke",...f}:f;return w?[u,b,w]:[u,b]})]}/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */function F(t,e={}){return G(t,{...e,attributeNames:{...e.attributeNames,class:"className","stroke-width":"strokeWidth","stroke-linecap":"strokeLinecap","stroke-linejoin":"strokeLinejoin","vector-effect":"vectorEffect"}})}/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const U=t=>{for(const e in t)if(e.startsWith("aria-")||e==="role"||e==="title")return!0;return!1},V=x.createContext({}),H=()=>x.useContext(V),K=x.forwardRef(({color:t,size:e,width:i,height:s,strokeWidth:l,absoluteStrokeWidth:r,nonScalingStroke:a,className:c="",children:d,iconNode:g=[],icon:k={node:g,aliases:[],size:24},...y},p)=>{const{size:m=24,strokeWidth:n=2,absoluteStrokeWidth:u=!1,nonScalingStroke:f=!1,color:w="currentColor",className:b=""}=H()??{},A=!!d||U(y),[W,P,$=[]]=F(k,{color:t??w,width:i??e??m,height:s??e??m,strokeWidth:l??n,absoluteStrokeWidth:r??u,nonScalingStroke:a??f,className:N(b,c),hasA11yProp:A,attributes:y});return x.createElement(W,{ref:p,...P},[...$.map(([I,_])=>x.createElement(I,_)),...Array.isArray(d)?d:[d]])});/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */function j(t,e=[],i=[]){const s=typeof t=="string"?R(t,e,i):t,l=x.forwardRef(({className:r,...a},c)=>x.createElement(K,{ref:c,icon:s,className:r,...a}));return s.name&&(l.displayName=D(s.name)),l}/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const L={name:"circle-check",size:24,node:[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m16 9-5.5 5.5L8 12",key:"xofnsj"}]],aliases:["check-circle-2"]};L.node;const M=j(L);/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const z={name:"git-pull-request",size:24,node:[["circle",{cx:"18",cy:"18",r:"3",key:"1xkwt0"}],["circle",{cx:"6",cy:"6",r:"3",key:"1lh9wr"}],["path",{d:"M13 6h3a2 2 0 0 1 2 2v7",key:"1yeb86"}],["line",{x1:"6",x2:"6",y1:"9",y2:"21",key:"rroup"}]]};z.node;const O=j(z);/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const S={name:"layout-grid",size:24,node:[["rect",{width:"7",height:"7",x:"3",y:"3",rx:"1",key:"1g98yp"}],["rect",{width:"7",height:"7",x:"14",y:"3",rx:"1",key:"6d4xhi"}],["rect",{width:"7",height:"7",x:"14",y:"14",rx:"1",key:"nxv5o0"}],["rect",{width:"7",height:"7",x:"3",y:"14",rx:"1",key:"1bb6yr"}]]};S.node;const Q=j(S);function J({activeNav:t="overview",children:e}){const{url:i}=B(),s=t||(i==="/"?"overview":i.startsWith("/repositories")?"pulls":"checks"),l=[{key:"overview",href:"/",label:"Overview",icon:Q},{key:"pulls",href:"/repositories",label:"Pull Requests",icon:O},{key:"checks",href:"/checks",label:"Verification",icon:M}];return o.jsxs("div",{className:"min-h-screen flex flex-col bg-[#f8fafc] text-slate-800",children:[o.jsx("header",{className:"sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs",children:o.jsx("div",{className:"max-w-7xl mx-auto px-4 sm:px-6 lg:px-8",children:o.jsxs("div",{className:"flex items-center justify-between h-16",children:[o.jsxs("div",{className:"flex items-center gap-6",children:[o.jsxs(C,{href:"/",className:"flex items-center gap-3 group",children:[o.jsx("span",{className:"w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center text-white font-bold text-lg shadow-sm shadow-violet-500/30 group-hover:scale-105 transition duration-150",children:"P"}),o.jsx("span",{className:"font-bold text-slate-900 tracking-tight text-lg group-hover:text-violet-700 transition",children:"ProofPatch"})]}),o.jsxs("div",{className:"hidden sm:flex items-center text-xs text-slate-400 gap-1.5 font-medium border-l border-slate-200 pl-4",children:[o.jsx("span",{className:"text-slate-500",children:"local"}),o.jsx("span",{children:"/"}),o.jsx("span",{className:"inline-flex items-center px-2 py-0.5 rounded-full font-mono font-medium bg-violet-50 text-violet-700 ring-1 ring-violet-700/10",children:"sqlite:proofpatch"})]})]}),o.jsx("nav",{className:"flex items-center gap-1 sm:gap-2",children:l.map(r=>{const a=r.icon,c=s===r.key;return o.jsxs(C,{href:r.href,className:`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-all ${c?"bg-violet-50 text-violet-700 font-semibold shadow-xs ring-1 ring-violet-600/10":"text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"}`,children:[o.jsx(a,{className:`w-4 h-4 ${c?"text-violet-600":"text-slate-400"}`}),o.jsx("span",{children:r.label})]},r.key)})}),o.jsx("div",{className:"hidden md:flex items-center gap-3",children:o.jsxs("span",{className:"inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20",children:[o.jsx("span",{className:"w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"}),o.jsx("span",{children:"Ready"})]})})]})})}),o.jsx("main",{className:"flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8",children:e}),o.jsx("footer",{className:"mt-auto border-t border-slate-200/80 bg-white/60 py-6",children:o.jsxs("div",{className:"max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500",children:[o.jsxs("div",{className:"flex items-center gap-2",children:[o.jsx("span",{className:"font-semibold text-slate-700",children:"ProofPatch"}),o.jsx("span",{children:"·"}),o.jsx("span",{children:"Visual review engine"})]}),o.jsx("div",{children:"Local SQLite worktree runner"})]})})]})}export{J as A,M as C,O as G,j as c};
