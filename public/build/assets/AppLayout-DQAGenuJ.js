import{r as x,b as E,j as i,L as C}from"./app-B7f7jAW-.js";/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const R=t=>t==null?void 0:t.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase();/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */function D(t,e,o=[]){if(e==null)throw new Error("[lucide]: iconNode is required when icon name is used");return{name:R(t),size:24,node:e,...o.length>0?{aliases:o}:{}}}/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const M=t=>{let e="",o=!1;for(const s of t){if(s==="-"||s==="_"||s<=" "){o=e.length>0;continue}e.length===0?e+=s.toLowerCase():e+=o?s.toUpperCase():s,o=!1}return e};/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const q=t=>{const e=M(t);return e.charAt(0).toUpperCase()+e.slice(1)};/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const N=(...t)=>t.filter((e,o,s)=>!!e&&e.trim()!==""&&s.indexOf(e)===o).join(" ").trim();/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const h={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor","stroke-width":2,"stroke-linecap":"round","stroke-linejoin":"round"};/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */function j(t){return t!=null}function G(t,e={}){var p,m;const o=e.attributeNames??{},s=n=>o[n]??n,l=t.size??t.width??h.width,r=t.size??t.height??h.height,a=((p=t.aliases)==null?void 0:p.filter(n=>typeof n=="string"&&n.trim()!=="").map(n=>`lucide-${n}`))??[],c=[...t.name?[`lucide-${t.name}`]:[],...a],d=((m=e.className)==null?void 0:m.split(" ").filter(Boolean))??[],g=e.includeDefaultClasses===!1?N(...d):N("lucide",...c,...d),y=e.absoluteStrokeWidth?Number(e.strokeWidth??h["stroke-width"])*Number(t.size??t.width??h.width)/Number(e.size??e.width??h.width):e.strokeWidth??h["stroke-width"];return["svg",{...Object.entries(h).reduce((n,[u,f])=>(n[s(u)]=f,n),{}),..."color"in e&&e.color&&{[s("stroke")]:e.color},..."size"in e&&j(e.size)&&{[s("width")]:e.size,[s("height")]:e.size},..."width"in e&&j(e.width)&&{[s("width")]:e.width},..."height"in e&&j(e.height)&&{[s("height")]:e.height},[s("stroke-width")]:y,...g&&{[s("class")]:g},[s("viewBox")]:`0 0 ${l} ${r}`,...e.hasA11yProp===!1?{[s("aria-hidden")]:"true"}:{},..."attributes"in e&&e.attributes},t.node.map(n=>{const[u,f,w]=n,k=e.nonScalingStroke?{[s("vector-effect")]:"non-scaling-stroke",...f}:f;return w?[u,k,w]:[u,k]})]}/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */function V(t,e={}){return G(t,{...e,attributeNames:{...e.attributeNames,class:"className","stroke-width":"strokeWidth","stroke-linecap":"strokeLinecap","stroke-linejoin":"strokeLinejoin","vector-effect":"vectorEffect"}})}/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const F=t=>{for(const e in t)if(e.startsWith("aria-")||e==="role"||e==="title")return!0;return!1},H=x.createContext({}),U=()=>x.useContext(H),K=x.forwardRef(({color:t,size:e,width:o,height:s,strokeWidth:l,absoluteStrokeWidth:r,nonScalingStroke:a,className:c="",children:d,iconNode:g=[],icon:y={node:g,aliases:[],size:24},...v},p)=>{const{size:m=24,strokeWidth:n=2,absoluteStrokeWidth:u=!1,nonScalingStroke:f=!1,color:w="currentColor",className:k=""}=U()??{},W=!!d||F(v),[P,$,_=[]]=V(y,{color:t??w,width:o??e??m,height:s??e??m,strokeWidth:l??n,absoluteStrokeWidth:r??u,nonScalingStroke:a??f,className:N(k,c),hasA11yProp:W,attributes:v});return x.createElement(P,{ref:p,...$},[..._.map(([I,B])=>x.createElement(I,B)),...Array.isArray(d)?d:[d]])});/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */function b(t,e=[],o=[]){const s=typeof t=="string"?D(t,e,o):t,l=x.forwardRef(({className:r,...a},c)=>x.createElement(K,{ref:c,icon:s,className:r,...a}));return s.name&&(l.displayName=q(s.name)),l}/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const z={name:"circle-check",size:24,node:[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m16 9-5.5 5.5L8 12",key:"xofnsj"}]],aliases:["check-circle-2"]};z.node;const O=b(z);/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const L={name:"clipboard-list",size:24,node:[["rect",{width:"8",height:"4",x:"8",y:"2",rx:"1",ry:"1",key:"tgr4d6"}],["path",{d:"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",key:"116196"}],["path",{d:"M12 11h4",key:"1jrz19"}],["path",{d:"M12 16h4",key:"n85exb"}],["path",{d:"M8 11h.01",key:"1dfujw"}],["path",{d:"M8 16h.01",key:"18s6g9"}]]};L.node;const Q=b(L);/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const S={name:"git-pull-request",size:24,node:[["circle",{cx:"18",cy:"18",r:"3",key:"1xkwt0"}],["circle",{cx:"6",cy:"6",r:"3",key:"1lh9wr"}],["path",{d:"M13 6h3a2 2 0 0 1 2 2v7",key:"1yeb86"}],["line",{x1:"6",x2:"6",y1:"9",y2:"21",key:"rroup"}]]};S.node;const Z=b(S);/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const A={name:"layout-grid",size:24,node:[["rect",{width:"7",height:"7",x:"3",y:"3",rx:"1",key:"1g98yp"}],["rect",{width:"7",height:"7",x:"14",y:"3",rx:"1",key:"6d4xhi"}],["rect",{width:"7",height:"7",x:"14",y:"14",rx:"1",key:"nxv5o0"}],["rect",{width:"7",height:"7",x:"3",y:"14",rx:"1",key:"1bb6yr"}]]};A.node;const J=b(A);function X({activeNav:t="overview",children:e}){const{url:o}=E(),s=t||(o==="/"?"overview":o.startsWith("/repositories")?"pulls":"checks"),l=[{key:"overview",href:"/",label:"Overview",icon:J},{key:"pulls",href:"/repositories",label:"Pull Requests",icon:Z},{key:"issues",href:"/issues",label:"Issues",icon:Q},{key:"checks",href:"/checks",label:"Verification",icon:O}];return i.jsxs("div",{className:"min-h-screen flex flex-col bg-[#f8fafc] text-slate-800",children:[i.jsx("header",{className:"sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs",children:i.jsx("div",{className:"max-w-7xl mx-auto px-4 sm:px-6 lg:px-8",children:i.jsxs("div",{className:"flex items-center justify-between h-16",children:[i.jsxs("div",{className:"flex items-center gap-6",children:[i.jsxs(C,{href:"/",className:"flex items-center gap-3 group",children:[i.jsx("span",{className:"w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center text-white font-bold text-lg shadow-sm shadow-violet-500/30 group-hover:scale-105 transition duration-150",children:"P"}),i.jsx("span",{className:"font-bold text-slate-900 tracking-tight text-lg group-hover:text-violet-700 transition",children:"ProofPatch"})]}),i.jsxs("div",{className:"hidden sm:flex items-center text-xs text-slate-400 gap-1.5 font-medium border-l border-slate-200 pl-4",children:[i.jsx("span",{className:"text-slate-500",children:"local"}),i.jsx("span",{children:"/"}),i.jsx("span",{className:"inline-flex items-center px-2 py-0.5 rounded-full font-mono font-medium bg-violet-50 text-violet-700 ring-1 ring-violet-700/10",children:"sqlite:proofpatch"})]})]}),i.jsx("nav",{className:"flex items-center gap-1 sm:gap-2",children:l.map(r=>{const a=r.icon,c=s===r.key;return i.jsxs(C,{href:r.href,className:`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-all ${c?"bg-violet-50 text-violet-700 font-semibold shadow-xs ring-1 ring-violet-600/10":"text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"}`,children:[i.jsx(a,{className:`w-4 h-4 ${c?"text-violet-600":"text-slate-400"}`}),i.jsx("span",{children:r.label})]},r.key)})}),i.jsx("div",{className:"hidden md:flex items-center gap-3",children:i.jsxs("span",{className:"inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20",children:[i.jsx("span",{className:"w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"}),i.jsx("span",{children:"Ready"})]})})]})})}),i.jsx("main",{className:"flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8",children:e}),i.jsx("footer",{className:"mt-auto border-t border-slate-200/80 bg-white/60 py-6",children:i.jsxs("div",{className:"max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500",children:[i.jsxs("div",{className:"flex items-center gap-2",children:[i.jsx("span",{className:"font-semibold text-slate-700",children:"ProofPatch"}),i.jsx("span",{children:"·"}),i.jsx("span",{children:"Visual review engine"})]}),i.jsx("div",{children:"Local SQLite worktree runner"})]})})]})}export{X as A,O as C,Z as G,b as c};
