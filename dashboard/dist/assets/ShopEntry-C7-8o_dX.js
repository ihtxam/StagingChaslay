import{r as l,u as U,a as O,b as P,s as K,c as H,d as ne,e as oe,j as i,L as j,S as se,f as ie,g as le,C as ce,h as de,O as me}from"./index-BZ7vAMty.js";import{i as I,f as pe,e as A,s as ue,C as fe}from"./resolver-CkaEUcdF.js";import{C as he}from"./ChaslayShopPageView-CwsPecc-.js";import"./chaslay-pagebuilder-z0Jft8fJ.js";const q=()=>new Date().getFullYear();function g(t){return String(t||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function ge(t,e,a){return{name:t,blocks:e,pages:[{id:"page-home",name:"Home",path:"/",blocks:e}],...a?{theme:a}:null}}const E={bg0:"#ffffff",bg1:"#f8fafc",bg2:"#f1f5f9",bg3:"#e2e8f0",bg4:"#cbd5e1",bg5:"#94a3b8",text0:"#0f172a",text1:"#334155",text2:"#64748b",text3:"#94a3b8",accent:"#2563eb",accentDim:"#1d4ed8",borderDefault:"#e2e8f0",borderSubtle:"#f1f5f9",borderHover:"#cbd5e1",fontSans:"DM Sans",fontDisplay:"DM Sans",fontMono:"JetBrains Mono",radius:8,radiusLg:12,presetId:"classic-blue"};function be(t){return[{id:"block-navbar",type:"navbar",variant:"default",props:{logo:t,links:["Menu","About","Find us"],ctaText:"Order now",ctaUrl:"/menu"}},{id:"block-hero",type:"hero",variant:"gradient",props:{badge:"Food truck",headline:t,subheadline:"Street food with real flavor. Order ahead for pickup — or find us on the road.",primaryCta:"See the menu",primaryCtaUrl:"/menu",secondaryCta:"Order online",secondaryCtaUrl:"/menu"}},{id:"block-features",type:"features",variant:"list",props:{label:"Why us",title:"Made for the street",subtitle:"Same kitchen as our truck — order ahead and skip the queue.",items:[{icon:"Flame",title:"Cooked fresh",description:"Hot off the grill, never sitting under a lamp."},{icon:"MapPin",title:"Find the truck",description:"Check our stops, then order ahead so it’s ready when you arrive."},{icon:"Zap",title:"Order in minutes",description:"Pickup or delivery — checkout on your phone."}]}},{id:"block-stats",type:"stats",variant:"bar",props:{items:[{value:"Daily",label:"Fresh prep"},{value:"Local",label:"Ingredients"},{value:"Fast",label:"Pickup"},{value:"5★",label:"Regulars"}]}},{id:"block-testimonials",type:"testimonials",variant:"cards",props:{title:"From the line",items:[{name:"Jordan",role:"Regular",quote:"Best stop on my lunch route. Ordering ahead is a game changer.",rating:5},{name:"Samira",role:"Office crew",quote:"We order for the whole team — always hot, always on time.",rating:5}]}},{id:"block-cta",type:"cta",variant:"simple",props:{headline:"Hungry now?",subheadline:"Browse the menu and we’ll have it ready.",buttonText:"Start your order",buttonUrl:"/menu"}},{id:"block-footer",type:"footer",variant:"simple",props:{logo:t,copyright:`${q()} ${t}. All rights reserved.`,links:["Menu","Reservations"]}}]}function xe(t,e,a=E){const r=a,n=g(t),c=(e.features||[]).map(d=>`<article class="card">
  <h3>${g(d.title)}</h3>
  <p>${g(d.description)}</p>
</article>`).join(`
`);return`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${n}</title>
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
      <div class="logo">${n}</div>
      <nav class="nav" aria-label="Primary">
        <a href="/menu">Menu</a>
        <a href="/menu">Order</a>
        <a href="/reservations">Reservations</a>
      </nav>
      <a class="btn" href="/menu">Order now</a>
    </header>

    <section class="hero">
      <div class="badge">${g(e.badge)}</div>
      <h1>${g(e.headline)}</h1>
      <p class="lead">${g(e.subheadline)}</p>
      <div class="actions">
        <a class="btn" href="/menu">See the menu</a>
        <a class="btn btn-ghost" href="/menu">Order online</a>
      </div>
    </section>

    ${c?`<section class="features" aria-label="Highlights">
${c}
    </section>`:""}

    <section class="cta">
      <h2>${g(e.ctaHeadline)}</h2>
      <p>${g(e.ctaSub)}</p>
      <a class="btn" href="/menu">Start your order</a>
    </section>

    <footer>
      <span>© ${q()} ${n}</span>
      <div class="links">
        <a href="/menu">Menu</a>
        <a href="/reservations">Reservations</a>
      </div>
    </footer>
  </div>
</body>
</html>`}function ye(t,e){return{engine:"openpage",config:t,html:e,defaultLocale:"en",locales:{en:{config:t,html:e}}}}function ve(t="Food truck"){const e=String(t||"Food truck").trim()||"Food truck",a=be(e),r=ge(e,a,E),n=xe(e,{badge:"Food truck",headline:e,subheadline:"Street food with real flavor. Order ahead for pickup — or find us on the road.",features:[{title:"Cooked fresh",description:"Hot off the grill, never sitting under a lamp."},{title:"Find the truck",description:"Order ahead so it’s ready when you arrive."},{title:"Order in minutes",description:"Pickup or delivery — checkout on your phone."}],ctaHeadline:"Hungry now?",ctaSub:"Browse the menu and we’ll have it ready."},E);return ye(r,n)}function C(t){if(!t||typeof t!="object"||Array.isArray(t))return!1;const e=t;return e.engine==="openpage"&&typeof e.html=="string"&&!!e.config&&typeof e.config=="object"&&Array.isArray(e.config.blocks)}function we(t="Homepage"){return ve(t||"Homepage")}function ke(t,e){var n,s,c;const a=(e||"").toLowerCase().slice(0,2);if(a==="en"||a==="fr"||a==="de"){const d=(n=t.locales)==null?void 0:n[a];if(d!=null&&d.html)return d.html}const r=t.defaultLocale;return r&&((c=(s=t.locales)==null?void 0:s[r])!=null&&c.html)?t.locales[r].html:t.html}function R(t,e){var a,r;return((r=(a=t.locales)==null?void 0:a[e])==null?void 0:r.config)||t.config}const Se=`
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
`.replace(/\n/g,"");function _(t,e){const a=(e||"").replace(/\/$/,"");let r=t||"";/<head[\s>]/i.test(r)?r=r.replace(/<head([^>]*)>/i,'<head$1><base target="_parent" />'):r=`<base target="_parent" />${r}`;const n=`
<link rel="preconnect" href="https://cdn.tailwindcss.com" crossorigin />
<link rel="dns-prefetch" href="https://cdn.tailwindcss.com" />
<style id="op-cdn-fallback">${Se}</style>
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
<\/script>`;/<\/head>/i.test(r)?/id="op-cdn-fallback"/.test(r)||(r=r.replace(/<\/head>/i,`${n}</head>`)):/html\s*,\s*body\s*\{[^}]*height\s*:\s*100%/i.test(r)||(r=`${n}${r}`);const s=a?`${a}/menu`:"/menu",c=a?`${a}/reservations`:"/reservations";return r=r.replace(/href="\/menu"/g,`href="${s}"`).replace(/href='\/menu'/g,`href='${s}'`).replace(/href="\/reservations"/g,`href="${c}"`).replace(/href='\/reservations'/g,`href='${c}'`).replace(/href="\/"/g,`href="${a||"/"}"`).replace(/href='\/'/g,`href='${a||"/"}'`).replace(/href="#"/g,`href="${s}"`).replace(/href='#'/g,`href='${s}'`),r}function $e(t){l.useEffect(()=>{if(!t||document.getElementById("cms-tailwind-cdn"))return;const e=document.createElement("link");e.id="cms-tailwind-preconnect",e.rel="preconnect",e.href="https://cdn.tailwindcss.com",document.head.appendChild(e);const a=document.createElement("script");a.id="cms-tailwind-cdn",a.src="https://cdn.tailwindcss.com",document.head.appendChild(a)},[t])}function je(){var D,N;const{t,locale:e,setLocale:a}=U(),{merchantSlug:r}=O(),n=l.useMemo(()=>P(r),[r]),s=K(n),[c,d]=l.useState(!0),[S,x]=l.useState(null),[y,M]=l.useState(""),[f,W]=l.useState(null),[w,Y]=l.useState(""),[B,J]=l.useState(""),[v,V]=l.useState(null),[G,Z]=l.useState(null);l.useEffect(()=>{if(!n){d(!1),x(t("shopNotFound"));return}let o=!1;return(async()=>{var p,F,L,z;try{const ae=await H.get(`/api/shop/${n}/pages/home`);if(o)return;const u=ae.data.data;W(u.merchant),Y(u.seoTitle||u.title||((p=u.merchant)==null?void 0:p.name)||""),J(u.seoDescription||((F=u.merchant)==null?void 0:F.description)||""),V(u.blocks);const k=(L=u.merchant)==null?void 0:L.language;if(k==="en"||k==="fr"||k==="de")try{const h=localStorage.getItem(ne(n));h!=="en"&&h!=="fr"&&h!=="de"&&a(k)}catch{a(k)}const T=C(u.blocks)?u.blocks:null,$=T?R(T,e):null;if(((z=$==null?void 0:$.blocks)==null?void 0:z.some(h=>h.type==="menu"||h.type==="featured"&&I(h)))??!1){const h=await pe(n);o||Z(h)}}catch{o||x(t("cmsHomeUnavailable"))}finally{o||d(!1)}})(),()=>{o=!0}},[n,t,a]),l.useEffect(()=>{if(f)if(C(v))M(_(ke(v,e),s));else{const o=we(w||f.name||"Welcome");M(_(o.html,s))}},[v,e,s,f,w]);const m=l.useMemo(()=>C(v)?R(v,e):null,[v,e]),b=l.useMemo(()=>{if(!m||!y)return null;const o=A(y);return ue(o,m)},[m,y]),Q=m==null?void 0:m.theme,X=((D=m==null?void 0:m.blocks)==null?void 0:D.some(o=>I(o)))??!1;$e(!!(b!=null&&b.length)),l.useEffect(()=>{w&&(document.title=oe(w))},[w]),l.useEffect(()=>{const o=B.trim();if(!o)return;let p=document.querySelector('meta[name="description"]');p||(p=document.createElement("meta"),p.name="description",document.head.appendChild(p)),p.content=o.slice(0,500)},[B]),l.useEffect(()=>(document.documentElement.lang=e,document.documentElement.classList.add("shop-shell"),()=>document.documentElement.classList.remove("shop-shell")),[e]);const ee=o=>new Intl.NumberFormat(e==="de"?"de-CH":e==="fr"?"fr-CH":"en-CH",{style:"currency",currency:"CHF"}).format(o),te=!!(f!=null&&f.reservationsEnabled),re=X&&((N=m==null?void 0:m.blocks)==null?void 0:N.some(o=>o.type==="menu"));return c?i.jsx("div",{className:"flex min-h-screen items-center justify-center",style:{background:"var(--shop-bg, #fafaf9)",color:"var(--shop-text-muted, #78716c)"},children:t("loading")}):S||!f?i.jsxs("div",{className:"flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-50 px-4 text-center",children:[i.jsx("p",{className:"text-stone-700",children:S||t("cmsHomeUnavailable")}),i.jsx(j,{to:`${s}/menu`,className:"text-sm underline",children:t("shopOrderNow")})]}):i.jsxs(se,{theme:Q,className:"min-h-dvh",style:{background:"var(--color-bg-0)"},children:[i.jsx(ie,{shopKey:n}),i.jsx("div",{className:"cms-homepage pb-24",children:b!=null&&b.length?b.map((o,p)=>o.kind==="dynamic"?i.jsx(fe,{blockType:o.blockType,props:o.props,base:s,menu:G,storeHours:f.storeHours,reservationsEnabled:f.reservationsEnabled,money:ee},o.blockId):i.jsx("div",{dangerouslySetInnerHTML:{__html:o.html}},`static-${p}`)):i.jsx("div",{dangerouslySetInnerHTML:{__html:A(y)}})}),re?null:i.jsx("div",{className:"pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-end",children:i.jsxs("div",{className:"pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-2xl border p-1.5 shadow-2xl backdrop-blur-md",style:{borderColor:"var(--color-border-default)",background:"color-mix(in srgb, var(--color-bg-0) 88%, transparent)"},children:[i.jsx(le,{menuPlacement:"top"}),te?i.jsxs(j,{to:`${s}/reservations`,className:"shop-btn-secondary inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold",children:[i.jsx(ce,{size:14}),t("shopReservations")]}):null,i.jsxs(j,{to:`${s}/menu`,className:"shop-btn-primary inline-flex items-center gap-1 px-3 py-2 text-xs font-bold",children:[i.jsx(de,{size:14}),t("shopOrderNow")]})]})})]})}function Ce(){const{merchantSlug:t}=O(),e=l.useMemo(()=>P(t),[t]),a=K(e);return e?i.jsx(he,{shopKey:e,base:a,pageSlug:"home"}):null}function Be(){const{t}=U(),{merchantSlug:e}=O(),a=l.useMemo(()=>P(e),[e]),[r,n]=l.useState("loading");return l.useEffect(()=>{if(!a){n("menu");return}let s=!1;return(async()=>{var c,d;try{const x=(await H.get(`/api/shop/${a}`)).data.data;if(s)return;if(x!=null&&x.cmsHomepageEnabled)try{const y=await H.get(`/api/shop/${a}/pages/home`);s||n(((d=(c=y.data)==null?void 0:c.data)==null?void 0:d.engine)==="chaslay"?"chaslay":"cms");return}catch{}s||n("menu")}catch{s||n("menu")}})(),()=>{s=!0}},[a]),r==="loading"?i.jsx("div",{className:"min-h-screen flex items-center justify-center bg-stone-50 text-stone-600",children:t("loading")}):r==="chaslay"?i.jsx(Ce,{}):r==="cms"?i.jsx(je,{}):i.jsx(me,{})}export{Be as default};
