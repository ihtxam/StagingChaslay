import{r as s,u as F,a as R,b as I,s as Z,c as M,d as Q,e as X,j as a,L as S,S as ee,f as te,g as re,C as ae,h as ne,i as me,O as ue}from"./index-CgPgE7ef.js";import{i as Y,f as pe,e as J,s as fe,C as he,S as ge,B as be,M as xe,u as ye,c as ve,D as we}from"./resolver-U7zUCkXw.js";import"./chaslay-pagebuilder-BRH7GbYw.js";const oe=()=>new Date().getFullYear();function v(e){return String(e||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function ke(e,t,n){return{name:e,blocks:t,pages:[{id:"page-home",name:"Home",path:"/",blocks:t}],...n?{theme:n}:null}}const T={bg0:"#ffffff",bg1:"#f8fafc",bg2:"#f1f5f9",bg3:"#e2e8f0",bg4:"#cbd5e1",bg5:"#94a3b8",text0:"#0f172a",text1:"#334155",text2:"#64748b",text3:"#94a3b8",accent:"#2563eb",accentDim:"#1d4ed8",borderDefault:"#e2e8f0",borderSubtle:"#f1f5f9",borderHover:"#cbd5e1",fontSans:"DM Sans",fontDisplay:"DM Sans",fontMono:"JetBrains Mono",radius:8,radiusLg:12,presetId:"classic-blue"};function Se(e){return[{id:"block-navbar",type:"navbar",variant:"default",props:{logo:e,links:["Menu","About","Find us"],ctaText:"Order now",ctaUrl:"/menu"}},{id:"block-hero",type:"hero",variant:"gradient",props:{badge:"Food truck",headline:e,subheadline:"Street food with real flavor. Order ahead for pickup — or find us on the road.",primaryCta:"See the menu",primaryCtaUrl:"/menu",secondaryCta:"Order online",secondaryCtaUrl:"/menu"}},{id:"block-features",type:"features",variant:"list",props:{label:"Why us",title:"Made for the street",subtitle:"Same kitchen as our truck — order ahead and skip the queue.",items:[{icon:"Flame",title:"Cooked fresh",description:"Hot off the grill, never sitting under a lamp."},{icon:"MapPin",title:"Find the truck",description:"Check our stops, then order ahead so it’s ready when you arrive."},{icon:"Zap",title:"Order in minutes",description:"Pickup or delivery — checkout on your phone."}]}},{id:"block-stats",type:"stats",variant:"bar",props:{items:[{value:"Daily",label:"Fresh prep"},{value:"Local",label:"Ingredients"},{value:"Fast",label:"Pickup"},{value:"5★",label:"Regulars"}]}},{id:"block-testimonials",type:"testimonials",variant:"cards",props:{title:"From the line",items:[{name:"Jordan",role:"Regular",quote:"Best stop on my lunch route. Ordering ahead is a game changer.",rating:5},{name:"Samira",role:"Office crew",quote:"We order for the whole team — always hot, always on time.",rating:5}]}},{id:"block-cta",type:"cta",variant:"simple",props:{headline:"Hungry now?",subheadline:"Browse the menu and we’ll have it ready.",buttonText:"Start your order",buttonUrl:"/menu"}},{id:"block-footer",type:"footer",variant:"simple",props:{logo:e,copyright:`${oe()} ${e}. All rights reserved.`,links:["Menu","Reservations"]}}]}function je(e,t,n=T){const r=n,o=v(e),d=(t.features||[]).map(m=>`<article class="card">
  <h3>${v(m.title)}</h3>
  <p>${v(m.description)}</p>
</article>`).join(`
`);return`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${o}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: ${r.bg0};
      --bg-card: ${r.bg2};
      --text: ${r.text0};
      --muted: ${r.text2};
      --accent: ${r.accent};
      --accent-dim: ${r.accentDim};
      --border: ${r.borderDefault};
    }
    *, *::before, *::after { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; }
    body {
      background: radial-gradient(1200px 480px at 50% -10%, rgba(232,168,56,0.16), transparent 60%), var(--bg);
      color: var(--text);
      font-family: Outfit, system-ui, sans-serif;
      -webkit-font-smoothing: antialiased;
      line-height: 1.5;
    }
    a { color: inherit; text-decoration: none; }
    .wrap { max-width: 72rem; margin: 0 auto; padding: 0 1.25rem; }
    header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1.1rem 0; gap: 1rem;
    }
    .logo { font-weight: 700; letter-spacing: -0.02em; font-size: 1.05rem; }
    .nav { display: none; gap: 1.25rem; color: var(--muted); font-size: 0.9rem; }
    @media (min-width: 768px) { .nav { display: flex; } }
    .btn {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 0.7rem 1.15rem; border-radius: 0.55rem;
      background: var(--accent); color: #171210; font-weight: 700; font-size: 0.9rem;
    }
    .btn:hover { background: var(--accent-dim); }
    .btn-ghost {
      background: transparent; color: var(--text);
      border: 1px solid var(--border);
    }
    .hero { text-align: center; padding: 4.5rem 0 3.5rem; }
    .badge {
      display: inline-block; margin-bottom: 1rem; padding: 0.3rem 0.75rem;
      border-radius: 999px; border: 1px solid rgba(232,168,56,0.35);
      background: rgba(232,168,56,0.12); color: var(--accent);
      font-size: 0.72rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
    }
    h1 {
      margin: 0 auto 0.85rem; max-width: 18ch;
      font-size: clamp(2.2rem, 5vw, 3.4rem); line-height: 1.05; letter-spacing: -0.03em;
    }
    .lead { margin: 0 auto 1.75rem; max-width: 36rem; color: var(--muted); font-size: 1.05rem; }
    .actions { display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: center; }
    .features {
      display: grid; gap: 0.9rem;
      grid-template-columns: 1fr;
      padding: 1rem 0 2.5rem;
    }
    @media (min-width: 768px) { .features { grid-template-columns: repeat(3, 1fr); } }
    .card {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 0.85rem; padding: 1.15rem 1.2rem;
    }
    .card h3 { margin: 0 0 0.35rem; font-size: 1rem; }
    .card p { margin: 0; color: var(--muted); font-size: 0.9rem; }
    .cta {
      margin: 1rem 0 2.5rem; padding: 2rem 1.25rem; text-align: center;
      border-radius: 1rem; border: 1px solid var(--border);
      background: linear-gradient(180deg, rgba(232,168,56,0.1), transparent);
    }
    .cta h2 { margin: 0 0 0.4rem; font-size: 1.55rem; letter-spacing: -0.02em; }
    .cta p { margin: 0 0 1.1rem; color: var(--muted); }
    footer {
      border-top: 1px solid var(--border);
      padding: 1.25rem 0 2rem; display: flex; flex-wrap: wrap;
      gap: 0.75rem; justify-content: space-between; color: var(--muted); font-size: 0.8rem;
    }
    footer .links { display: flex; gap: 1rem; }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <div class="logo">${o}</div>
      <nav class="nav" aria-label="Primary">
        <a href="/menu">Menu</a>
        <a href="/menu">Order</a>
        <a href="/reservations">Reservations</a>
      </nav>
      <a class="btn" href="/menu">Order now</a>
    </header>

    <section class="hero">
      <div class="badge">${v(t.badge)}</div>
      <h1>${v(t.headline)}</h1>
      <p class="lead">${v(t.subheadline)}</p>
      <div class="actions">
        <a class="btn" href="/menu">See the menu</a>
        <a class="btn btn-ghost" href="/menu">Order online</a>
      </div>
    </section>

    ${d?`<section class="features" aria-label="Highlights">
${d}
    </section>`:""}

    <section class="cta">
      <h2>${v(t.ctaHeadline)}</h2>
      <p>${v(t.ctaSub)}</p>
      <a class="btn" href="/menu">Start your order</a>
    </section>

    <footer>
      <span>© ${oe()} ${o}</span>
      <div class="links">
        <a href="/menu">Menu</a>
        <a href="/reservations">Reservations</a>
      </div>
    </footer>
  </div>
</body>
</html>`}function $e(e,t){return{engine:"openpage",config:e,html:t,defaultLocale:"en",locales:{en:{config:e,html:t}}}}function Ee(e="Food truck"){const t=String(e||"Food truck").trim()||"Food truck",n=Se(t),r=ke(t,n,T),o=je(t,{badge:"Food truck",headline:t,subheadline:"Street food with real flavor. Order ahead for pickup — or find us on the road.",features:[{title:"Cooked fresh",description:"Hot off the grill, never sitting under a lamp."},{title:"Find the truck",description:"Order ahead so it’s ready when you arrive."},{title:"Order in minutes",description:"Pickup or delivery — checkout on your phone."}],ctaHeadline:"Hungry now?",ctaSub:"Browse the menu and we’ll have it ready."},T);return $e(r,o)}function z(e){if(!e||typeof e!="object"||Array.isArray(e))return!1;const t=e;return t.engine==="openpage"&&typeof t.html=="string"&&!!t.config&&typeof t.config=="object"&&Array.isArray(t.config.blocks)}function Ce(e="Homepage"){return Ee(e||"Homepage")}function He(e,t){var o,i,d;const n=(t||"").toLowerCase().slice(0,2);if(n==="en"||n==="fr"||n==="de"){const m=(o=e.locales)==null?void 0:o[n];if(m!=null&&m.html)return m.html}const r=e.defaultLocale;return r&&((d=(i=e.locales)==null?void 0:i[r])!=null&&d.html)?e.locales[r].html:e.html}function G(e,t){var n,r;return((r=(n=e.locales)==null?void 0:n[t])==null?void 0:r.config)||e.config}const Ne=`
html,body{height:100%;margin:0}
body{background:var(--color-bg-0,#171210);color:var(--color-text-0,#faf6f0);font-family:var(--font-sans,system-ui,sans-serif);-webkit-font-smoothing:antialiased}
a{color:inherit}
.bg-bg-0{background-color:var(--color-bg-0)!important}.bg-bg-1{background-color:var(--color-bg-1)!important}
.bg-bg-2{background-color:var(--color-bg-2)!important}.bg-bg-3{background-color:var(--color-bg-3)!important}
.bg-bg-4{background-color:var(--color-bg-4)!important}.bg-green,.bg-green\\/10{background-color:var(--color-green,#e8a838)!important}
.text-text-0{color:var(--color-text-0)!important}.text-text-1{color:var(--color-text-1)!important}
.text-text-2{color:var(--color-text-2)!important}.text-text-3{color:var(--color-text-3)!important}
.text-green{color:var(--color-green,#e8a838)!important}.text-black{color:#111!important}
.border-border-default{border-color:var(--color-border-default)!important}
.border-border-subtle{border-color:var(--color-border-subtle)!important}
.flex{display:flex}.hidden{display:none}.grid{display:grid}.inline-flex{display:inline-flex}
.flex-col{flex-direction:column}.flex-wrap{flex-wrap:wrap}.items-center{align-items:center}
.justify-center{justify-content:center}.justify-between{justify-content:space-between}
.gap-2{gap:.5rem}.gap-3{gap:.75rem}.gap-4{gap:1rem}.gap-6{gap:1.5rem}
.px-6{padding-left:1.5rem;padding-right:1.5rem}.px-8{padding-left:2rem;padding-right:2rem}
.py-3{padding-top:.75rem;padding-bottom:.75rem}.py-4{padding-top:1rem;padding-bottom:1rem}
.py-16{padding-top:4rem;padding-bottom:4rem}.py-20{padding-top:5rem;padding-bottom:5rem}
.text-center{text-align:center}.font-semibold{font-weight:600}.font-bold{font-weight:700}
.rounded-lg{border-radius:.5rem}.rounded-xl{border-radius:.75rem}.rounded-full{border-radius:9999px}
.max-w-3xl{max-width:48rem}.max-w-7xl{max-width:80rem}.max-w-xl{max-width:36rem}.mx-auto{margin-left:auto;margin-right:auto}
.min-w-0{min-width:0}.shrink-0{flex-shrink:0}.truncate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.whitespace-nowrap{white-space:nowrap}
.text-4xl{font-size:2.25rem;line-height:1.1}.text-2xl{font-size:1.5rem}.text-sm{font-size:.875rem}
.w-full{width:100%}.relative{position:relative}.absolute{position:absolute}.inset-0{inset:0}
.overflow-hidden{overflow:hidden}
@media (min-width:768px){
  .md\\:px-10{padding-left:2.5rem;padding-right:2.5rem}
  .md\\:text-5xl{font-size:3rem;line-height:1.1}
  .md\\:py-28{padding-top:7rem;padding-bottom:7rem}
  .md\\:grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}
  .md\\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}
  .md\\:flex-row{flex-direction:row}
}
@media (min-width:1024px){
  .lg\\:flex{display:flex}.lg\\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}
  .lg\\:hidden{display:none}
}
`.replace(/\n/g,"");function V(e,t){const n=(t||"").replace(/\/$/,"");let r=e||"";/<head[\s>]/i.test(r)?r=r.replace(/<head([^>]*)>/i,'<head$1><base target="_parent" />'):r=`<base target="_parent" />${r}`;const o=`
<link rel="preconnect" href="https://cdn.tailwindcss.com" crossorigin />
<link rel="dns-prefetch" href="https://cdn.tailwindcss.com" />
<style id="op-cdn-fallback">${Ne}</style>
<style id="op-shop-chrome-pad">body{padding-bottom:max(5.5rem,env(safe-area-inset-bottom))}</style>
<script>
(function(){
  // If Tailwind Play CDN never boots, keep semantic theme colors via fallback CSS above.
  function mark(){ try { document.documentElement.setAttribute('data-op-tw','pending'); } catch(e){} }
  function ok(){ try { document.documentElement.setAttribute('data-op-tw','ok'); } catch(e){} }
  mark();
  var n = 0;
  var t = setInterval(function(){
    n++;
    if (typeof window.tailwind !== 'undefined') { ok(); clearInterval(t); }
    else if (n > 40) { clearInterval(t); }
  }, 250);
})();
<\/script>`;/<\/head>/i.test(r)?/id="op-cdn-fallback"/.test(r)||(r=r.replace(/<\/head>/i,`${o}</head>`)):/html\s*,\s*body\s*\{[^}]*height\s*:\s*100%/i.test(r)||(r=`${o}${r}`);const i=n?`${n}/menu`:"/menu",d=n?`${n}/reservations`:"/reservations";return r=r.replace(/href="\/menu"/g,`href="${i}"`).replace(/href='\/menu'/g,`href='${i}'`).replace(/href="\/reservations"/g,`href="${d}"`).replace(/href='\/reservations'/g,`href='${d}'`).replace(/href="\/"/g,`href="${n||"/"}"`).replace(/href='\/'/g,`href='${n||"/"}'`).replace(/href="#"/g,`href="${i}"`).replace(/href='#'/g,`href='${i}'`),r}function Pe(e){s.useEffect(()=>{if(!e||document.getElementById("cms-tailwind-cdn"))return;const t=document.createElement("link");t.id="cms-tailwind-preconnect",t.rel="preconnect",t.href="https://cdn.tailwindcss.com",document.head.appendChild(t);const n=document.createElement("script");n.id="cms-tailwind-cdn",n.src="https://cdn.tailwindcss.com",document.head.appendChild(n)},[e])}function Oe(){var A,_;const{t:e,locale:t,setLocale:n}=F(),{merchantSlug:r}=R(),o=s.useMemo(()=>I(r),[r]),i=Z(o),[d,m]=s.useState(!0),[k,x]=s.useState(null),[h,j]=s.useState(""),[p,$]=s.useState(null),[w,E]=s.useState(""),[N,L]=s.useState(""),[f,P]=s.useState(null),[O,B]=s.useState(null);s.useEffect(()=>{if(!o){m(!1),x(e("shopNotFound"));return}let l=!1;return(async()=>{var g,U,K,q;try{const de=await M.get(`/api/shop/${o}/pages/home`);if(l)return;const b=de.data.data;$(b.merchant),E(b.seoTitle||b.title||((g=b.merchant)==null?void 0:g.name)||""),L(b.seoDescription||((U=b.merchant)==null?void 0:U.description)||""),P(b.blocks);const H=(K=b.merchant)==null?void 0:K.language;if(H==="en"||H==="fr"||H==="de")try{const y=localStorage.getItem(Q(o));y!=="en"&&y!=="fr"&&y!=="de"&&n(H)}catch{n(H)}const W=z(b.blocks)?b.blocks:null,D=W?G(W,t):null;if(((q=D==null?void 0:D.blocks)==null?void 0:q.some(y=>y.type==="menu"||y.type==="featured"&&Y(y)))??!1){const y=await pe(o);l||B(y)}}catch{l||x(e("cmsHomeUnavailable"))}finally{l||m(!1)}})(),()=>{l=!0}},[o,e,n]),s.useEffect(()=>{if(p)if(z(f))j(V(He(f,t),i));else{const l=Ce(w||p.name||"Welcome");j(V(l.html,i))}},[f,t,i,p,w]);const c=s.useMemo(()=>z(f)?G(f,t):null,[f,t]),u=s.useMemo(()=>{if(!c||!h)return null;const l=J(h);return fe(l,c)},[c,h]),C=c==null?void 0:c.theme,se=((A=c==null?void 0:c.blocks)==null?void 0:A.some(l=>Y(l)))??!1;Pe(!!(u!=null&&u.length)),s.useEffect(()=>{w&&(document.title=X(w))},[w]),s.useEffect(()=>{const l=N.trim();if(!l)return;let g=document.querySelector('meta[name="description"]');g||(g=document.createElement("meta"),g.name="description",document.head.appendChild(g)),g.content=l.slice(0,500)},[N]),s.useEffect(()=>(document.documentElement.lang=t,document.documentElement.classList.add("shop-shell"),()=>document.documentElement.classList.remove("shop-shell")),[t]);const ie=l=>new Intl.NumberFormat(t==="de"?"de-CH":t==="fr"?"fr-CH":"en-CH",{style:"currency",currency:"CHF"}).format(l),le=!!(p!=null&&p.reservationsEnabled),ce=se&&((_=c==null?void 0:c.blocks)==null?void 0:_.some(l=>l.type==="menu"));return d?a.jsx("div",{className:"flex min-h-screen items-center justify-center",style:{background:"var(--shop-bg, #fafaf9)",color:"var(--shop-text-muted, #78716c)"},children:e("loading")}):k||!p?a.jsxs("div",{className:"flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-50 px-4 text-center",children:[a.jsx("p",{className:"text-stone-700",children:k||e("cmsHomeUnavailable")}),a.jsx(S,{to:`${i}/menu`,className:"text-sm underline",children:e("shopOrderNow")})]}):a.jsxs(ee,{theme:C,className:"min-h-dvh",style:{background:"var(--color-bg-0)"},children:[a.jsx(te,{shopKey:o}),a.jsx("div",{className:"cms-homepage pb-24",children:u!=null&&u.length?u.map((l,g)=>l.kind==="dynamic"?a.jsx(he,{blockType:l.blockType,props:l.props,base:i,menu:O,storeHours:p.storeHours,reservationsEnabled:p.reservationsEnabled,money:ie},l.blockId):a.jsx("div",{dangerouslySetInnerHTML:{__html:l.html}},`static-${g}`)):a.jsx("div",{dangerouslySetInnerHTML:{__html:J(h)}})}),ce?null:a.jsx("div",{className:"pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-end",children:a.jsxs("div",{className:"pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-2xl border p-1.5 shadow-2xl backdrop-blur-md",style:{borderColor:"var(--color-border-default)",background:"color-mix(in srgb, var(--color-bg-0) 88%, transparent)"},children:[a.jsx(re,{menuPlacement:"top"}),le?a.jsxs(S,{to:`${i}/reservations`,className:"shop-btn-secondary inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold",children:[a.jsx(ae,{size:14}),e("shopReservations")]}):null,a.jsxs(S,{to:`${i}/menu`,className:"shop-btn-primary inline-flex items-center gap-1 px-3 py-2 text-xs font-bold",children:[a.jsx(ne,{size:14}),e("shopOrderNow")]})]})})]})}function Me({editorState:e,shopKey:t,basePath:n,className:r}){return s.useEffect(()=>(document.documentElement.classList.add("chaslay-storefront"),()=>document.documentElement.classList.remove("chaslay-storefront")),[]),a.jsx(ge,{shopKey:t,basePath:n,children:a.jsx(be,{children:a.jsx(xe,{children:a.jsx("div",{className:`chaslay-pagebuilder-root chaslay-storefront-page ${r||""}`,children:a.jsx(ye,{enabled:!1,resolver:ve,children:a.jsx(we,{data:e})})})})})})}function Le(){const{t:e,locale:t,setLocale:n}=F(),{merchantSlug:r}=R(),o=s.useMemo(()=>I(r),[r]),i=Z(o),d=me(o),[m,k]=s.useState(!0),[x,h]=s.useState(null),[j,p]=s.useState(""),[$,w]=s.useState(null),[E,N]=s.useState("");s.useEffect(()=>{if(!o){k(!1),h(e("shopNotFound"));return}let f=!1;return(async()=>{var P,O;try{const B=await M.get(`/api/shop/${o}/pages/home`);if(f)return;const c=B.data.data;if(c.engine!=="chaslay"||!c.editorState){h(e("cmsHomeUnavailable"));return}w(c.merchant),N(c.seoTitle||c.title||((P=c.merchant)==null?void 0:P.name)||""),p(c.editorState);const u=(O=c.merchant)==null?void 0:O.language;if(u==="en"||u==="fr"||u==="de")try{const C=localStorage.getItem(Q(o));C!=="en"&&C!=="fr"&&C!=="de"&&n(u)}catch{n(u)}}catch{f||h(e("cmsHomeUnavailable"))}finally{f||k(!1)}})(),()=>{f=!0}},[o,e,n]),s.useEffect(()=>{E&&(document.title=X(E))},[E]),s.useEffect(()=>(document.documentElement.lang=t,document.documentElement.classList.add("shop-shell"),()=>document.documentElement.classList.remove("shop-shell")),[t]);const L=!!($!=null&&$.reservationsEnabled);return m?a.jsx("div",{className:"flex min-h-screen items-center justify-center",style:{background:"var(--shop-bg, #fafaf9)",color:"var(--shop-text-muted, #78716c)"},children:e("loading")}):x||!j?a.jsxs("div",{className:"flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-50 px-4 text-center",children:[a.jsx("p",{className:"text-stone-700",children:x||e("cmsHomeUnavailable")}),a.jsx(S,{to:`${i}/menu`,className:"text-sm underline",children:e("shopOrderNow")})]}):a.jsxs(ee,{theme:d,className:"min-h-dvh",style:{background:"var(--color-bg-0)"},children:[a.jsx(te,{shopKey:o}),a.jsx("div",{className:"cms-homepage pb-24",children:a.jsx(Me,{editorState:j,shopKey:o,basePath:i})}),a.jsx("div",{className:"pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-end",children:a.jsxs("div",{className:"pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-2xl border p-1.5 shadow-2xl backdrop-blur-md",style:{borderColor:"var(--color-border-default)",background:"color-mix(in srgb, var(--color-bg-0) 88%, transparent)"},children:[a.jsx(re,{menuPlacement:"top"}),L?a.jsxs(S,{to:`${i}/reservations`,className:"shop-btn-secondary inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold",children:[a.jsx(ae,{size:14}),e("shopReservations")]}):null,a.jsxs(S,{to:`${i}/menu`,className:"shop-btn-primary inline-flex items-center gap-1 px-3 py-2 text-xs font-bold",children:[a.jsx(ne,{size:14}),e("shopOrderNow")]})]})})]})}function Fe(){const{t:e}=F(),{merchantSlug:t}=R(),n=s.useMemo(()=>I(t),[t]),[r,o]=s.useState("loading");return s.useEffect(()=>{if(!n){o("menu");return}let i=!1;return(async()=>{var d,m;try{const x=(await M.get(`/api/shop/${n}`)).data.data;if(i)return;if(x!=null&&x.cmsHomepageEnabled)try{const h=await M.get(`/api/shop/${n}/pages/home`);i||o(((m=(d=h.data)==null?void 0:d.data)==null?void 0:m.engine)==="chaslay"?"chaslay":"cms");return}catch{}i||o("menu")}catch{i||o("menu")}})(),()=>{i=!0}},[n]),r==="loading"?a.jsx("div",{className:"min-h-screen flex items-center justify-center bg-stone-50 text-stone-600",children:e("loading")}):r==="chaslay"?a.jsx(Le,{}):r==="cms"?a.jsx(Oe,{}):a.jsx(ue,{})}export{Fe as default};
