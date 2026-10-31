import{r as c,j as w,L as B}from"./app-D_WW6LAD.js";/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const E=t=>t==null?void 0:t.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase();/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */function I(t,e,s=[]){if(e==null)throw new Error("[lucide]: iconNode is required when icon name is used");return{name:E(t),size:24,node:e,...s.length>0?{aliases:s}:{}}}/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $=t=>{let e="",s=!1;for(const o of t){if(o==="-"||o==="_"||o<=" "){s=e.length>0;continue}e.length===0?e+=o.toLowerCase():e+=s?o.toUpperCase():o,s=!1}return e};/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const P=t=>{const e=$(t);return e.charAt(0).toUpperCase()+e.slice(1)};/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const v=(...t)=>t.filter((e,s,o)=>!!e&&e.trim()!==""&&o.indexOf(e)===s).join(" ").trim();/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const r={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor","stroke-width":2,"stroke-linecap":"round","stroke-linejoin":"round"};/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */function p(t){return t!=null}function R(t,e={}){var m,x;const s=e.attributeNames??{},o=n=>s[n]??n,l=t.size??t.width??r.width,d=t.size??t.height??r.height,h=((m=t.aliases)==null?void 0:m.filter(n=>typeof n=="string"&&n.trim()!=="").map(n=>`lucide-${n}`))??[],f=[...t.name?[`lucide-${t.name}`]:[],...h],i=((x=e.className)==null?void 0:x.split(" ").filter(Boolean))??[],k=e.includeDefaultClasses===!1?v(...i):v("lucide",...f,...i),C=e.absoluteStrokeWidth?Number(e.strokeWidth??r["stroke-width"])*Number(t.size??t.width??r.width)/Number(e.size??e.width??r.width):e.strokeWidth??r["stroke-width"];return["svg",{...Object.entries(r).reduce((n,[a,u])=>(n[o(a)]=u,n),{}),..."color"in e&&e.color&&{[o("stroke")]:e.color},..."size"in e&&p(e.size)&&{[o("width")]:e.size,[o("height")]:e.size},..."width"in e&&p(e.width)&&{[o("width")]:e.width},..."height"in e&&p(e.height)&&{[o("height")]:e.height},[o("stroke-width")]:C,...k&&{[o("class")]:k},[o("viewBox")]:`0 0 ${l} ${d}`,...e.hasA11yProp===!1?{[o("aria-hidden")]:"true"}:{},..."attributes"in e&&e.attributes},t.node.map(n=>{const[a,u,b]=n,g=e.nonScalingStroke?{[o("vector-effect")]:"non-scaling-stroke",...u}:u;return b?[a,g,b]:[a,g]})]}/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */function _(t,e={}){return R(t,{...e,attributeNames:{...e.attributeNames,class:"className","stroke-width":"strokeWidth","stroke-linecap":"strokeLinecap","stroke-linejoin":"strokeLinejoin","vector-effect":"vectorEffect"}})}/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const D=t=>{for(const e in t)if(e.startsWith("aria-")||e==="role"||e==="title")return!0;return!1},F=c.createContext({}),H=()=>c.useContext(F),U=c.forwardRef(({color:t,size:e,width:s,height:o,strokeWidth:l,absoluteStrokeWidth:d,nonScalingStroke:h,className:f="",children:i,iconNode:k=[],icon:C={node:k,aliases:[],size:24},...N},m)=>{const{size:x=24,strokeWidth:n=2,absoluteStrokeWidth:a=!1,nonScalingStroke:u=!1,color:b="currentColor",className:g=""}=H()??{},S=!!i||D(N),[z,L,W=[]]=_(C,{color:t??b,width:s??e??x,height:o??e??x,strokeWidth:l??n,absoluteStrokeWidth:d??a,nonScalingStroke:h??u,className:v(g,f),hasA11yProp:S,attributes:N});return c.createElement(z,{ref:m,...L},[...W.map(([j,y])=>c.createElement(j,y)),...Array.isArray(i)?i:[i]])});/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */function q(t,e=[],s=[]){const o=typeof t=="string"?I(t,e,s):t,l=c.forwardRef(({className:d,...h},f)=>c.createElement(U,{ref:f,icon:o,className:d,...h}));return o.name&&(l.displayName=P(o.name)),l}/**
 * @license lucide-react v1.62.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const A={name:"arrow-left",size:24,node:[["path",{d:"m12 19-7-7 7-7",key:"1l729n"}],["path",{d:"M19 12H5",key:"x3x0zl"}]]};A.node;const K=q(A);function Z({activeNav:t,children:e}){const s=t==="issues";return w.jsxs("div",{className:"min-h-screen bg-slate-50 text-slate-900 dark:bg-[#0e1117] dark:text-slate-100",children:[!s&&w.jsx("div",{className:"mx-auto max-w-6xl px-4 pt-5 sm:px-6",children:w.jsxs(B,{href:"/issues",className:"inline-flex items-center gap-2 text-sm text-slate-600 hover:text-violet-700 dark:text-slate-400 dark:hover:text-violet-300",children:[w.jsx(K,{className:"h-4 w-4"}),"Back to workspace"]})}),w.jsx("main",{className:s?"min-h-screen w-full":"mx-auto max-w-6xl px-4 py-6 sm:px-6",children:e})]})}export{Z as A,q as c};
