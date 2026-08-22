const d=()=>new Date().getFullYear();function i(e){return String(e||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function c(e,t,a){return{name:e,blocks:t,pages:[{id:"page-home",name:"Home",path:"/",blocks:t}],...a?{theme:a}:null}}const p={bg0:"#ffffff",bg1:"#f8fafc",bg2:"#f1f5f9",bg3:"#e2e8f0",bg4:"#cbd5e1",bg5:"#94a3b8",text0:"#0f172a",text1:"#334155",text2:"#64748b",text3:"#94a3b8",accent:"#2563eb",accentDim:"#1d4ed8",borderDefault:"#e2e8f0",borderSubtle:"#f1f5f9",borderHover:"#cbd5e1",fontSans:"DM Sans",fontDisplay:"DM Sans",fontMono:"JetBrains Mono",radius:8,radiusLg:12,presetId:"classic-blue"},v={bg0:"#171210",bg1:"#1e1816",bg2:"#26201c",bg3:"#302925",bg4:"#3d3530",bg5:"#504640",text0:"#faf6f0",text1:"#d4c8b8",text2:"#a89a88",text3:"#7d7062",accent:"#e8a838",accentDim:"#cc8f20",borderDefault:"#352e28",borderSubtle:"#28211b",borderHover:"#443c35",fontSans:"Outfit",fontDisplay:"Outfit",fontMono:"JetBrains Mono",radius:6,radiusLg:10};function y(e){return[{id:"block-navbar",type:"navbar",variant:"default",props:{logo:e,links:["Menu","About","Find us"],ctaText:"Order now",ctaUrl:"/menu"}},{id:"block-hero",type:"hero",variant:"gradient",props:{badge:"Food truck",headline:e,subheadline:"Street food with real flavor. Order ahead for pickup — or find us on the road.",primaryCta:"See the menu",primaryCtaUrl:"/menu",secondaryCta:"Order online",secondaryCtaUrl:"/menu"}},{id:"block-features",type:"features",variant:"list",props:{label:"Why us",title:"Made for the street",subtitle:"Same kitchen as our truck — order ahead and skip the queue.",items:[{icon:"Flame",title:"Cooked fresh",description:"Hot off the grill, never sitting under a lamp."},{icon:"MapPin",title:"Find the truck",description:"Check our stops, then order ahead so it’s ready when you arrive."},{icon:"Zap",title:"Order in minutes",description:"Pickup or delivery — checkout on your phone."}]}},{id:"block-stats",type:"stats",variant:"bar",props:{items:[{value:"Daily",label:"Fresh prep"},{value:"Local",label:"Ingredients"},{value:"Fast",label:"Pickup"},{value:"5★",label:"Regulars"}]}},{id:"block-testimonials",type:"testimonials",variant:"cards",props:{title:"From the line",items:[{name:"Jordan",role:"Regular",quote:"Best stop on my lunch route. Ordering ahead is a game changer.",rating:5},{name:"Samira",role:"Office crew",quote:"We order for the whole team — always hot, always on time.",rating:5}]}},{id:"block-cta",type:"cta",variant:"simple",props:{headline:"Hungry now?",subheadline:"Browse the menu and we’ll have it ready.",buttonText:"Start your order",buttonUrl:"/menu"}},{id:"block-footer",type:"footer",variant:"simple",props:{logo:e,copyright:`${d()} ${e}. All rights reserved.`,links:["Menu","Reservations"]}}]}function x(e){return[{id:"block-navbar",type:"navbar",variant:"centered",props:{logo:e,links:["Menu","About","Reservations"],ctaText:"Book a table",ctaUrl:"/reservations"}},{id:"block-hero",type:"hero",variant:"centered",props:{badge:"Restaurant",headline:`Welcome to ${e}`,subheadline:"Fresh dishes, crafted with care. Order online for pickup or delivery.",primaryCta:"Order now",primaryCtaUrl:"/menu",secondaryCta:"Reservations",secondaryCtaUrl:"/reservations"}},{id:"block-features",type:"features",variant:"grid",props:{title:"Why guests come back",items:[{icon:"Utensils",title:"Kitchen fresh",description:"Same menu as our POS — cooked to order."},{icon:"Clock",title:"Order ahead",description:"Pickup or delivery when you want it."},{icon:"Heart",title:"Local favourite",description:"Crafted with care for the neighborhood."}]}},{id:"block-cta",type:"cta",variant:"simple",props:{headline:"Hungry?",subheadline:"Order online in minutes.",buttonText:"Order online",buttonUrl:"/menu"}},{id:"block-footer",type:"footer",variant:"simple",props:{logo:e,copyright:`${d()} ${e}`,links:["Menu","Reservations"]}}]}function k(e){return[{id:"block-hero",type:"hero",variant:"centered",props:{badge:"Welcome",headline:e,subheadline:"Order online for pickup or delivery.",primaryCta:"Order now",primaryCtaUrl:"/menu"}},{id:"block-cta",type:"cta",variant:"simple",props:{headline:"Hungry?",subheadline:"Browse the menu and checkout in minutes.",buttonText:"See menu",buttonUrl:"/menu"}},{id:"block-footer",type:"footer",variant:"minimal",props:{copyright:`${d()} ${e}`,links:["Menu","Contact"]}}]}function f(e,t,a=p){const r=a,o=i(e),s=(t.features||[]).map(l=>`<article class="card">
  <h3>${i(l.title)}</h3>
  <p>${i(l.description)}</p>
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
      <div class="badge">${i(t.badge)}</div>
      <h1>${i(t.headline)}</h1>
      <p class="lead">${i(t.subheadline)}</p>
      <div class="actions">
        <a class="btn" href="/menu">See the menu</a>
        <a class="btn btn-ghost" href="/menu">Order online</a>
      </div>
    </section>

    ${s?`<section class="features" aria-label="Highlights">
${s}
    </section>`:""}

    <section class="cta">
      <h2>${i(t.ctaHeadline)}</h2>
      <p>${i(t.ctaSub)}</p>
      <a class="btn" href="/menu">Start your order</a>
    </section>

    <footer>
      <span>© ${d()} ${o}</span>
      <div class="links">
        <a href="/menu">Menu</a>
        <a href="/reservations">Reservations</a>
      </div>
    </footer>
  </div>
</body>
</html>`}function m(e,t){return{engine:"openpage",config:e,html:t,defaultLocale:"en",locales:{en:{config:e,html:t}}}}function u(e="Food truck"){const t=String(e||"Food truck").trim()||"Food truck",a=y(t),r=c(t,a,p),o=f(t,{badge:"Food truck",headline:t,subheadline:"Street food with real flavor. Order ahead for pickup — or find us on the road.",features:[{title:"Cooked fresh",description:"Hot off the grill, never sitting under a lamp."},{title:"Find the truck",description:"Order ahead so it’s ready when you arrive."},{title:"Order in minutes",description:"Pickup or delivery — checkout on your phone."}],ctaHeadline:"Hungry now?",ctaSub:"Browse the menu and we’ll have it ready."},p);return m(r,o)}function w(e="Restaurant"){const t=String(e||"Restaurant").trim()||"Restaurant",a=x(t),r=c(t,a,{...v,presetId:"amber"}),o=f(t,{badge:"Restaurant",headline:`Welcome to ${t}`,subheadline:"Fresh dishes, crafted with care. Order online for pickup or delivery.",features:[{title:"Kitchen fresh",description:"Same menu as our POS — cooked to order."},{title:"Order ahead",description:"Pickup or delivery when you want it."},{title:"Local favourite",description:"Crafted with care for the neighborhood."}],ctaHeadline:"Hungry?",ctaSub:"Order online in minutes."});return m(r,o)}function $(e="Homepage"){const t=String(e||"Homepage").trim()||"Homepage",a=k(t),r=c(t,a),o=f(t,{badge:"Welcome",headline:t,subheadline:"Order online for pickup or delivery.",ctaHeadline:"Hungry?",ctaSub:"Browse the menu and checkout in minutes."});return m(r,o)}const g={bg0:"#ffffff",bg1:"#fafafa",bg2:"#f5f5f4",bg3:"#e7e5e4",bg4:"#d6d3d1",bg5:"#a8a29e",text0:"#171717",text1:"#404040",text2:"#737373",text3:"#a3a3a3",accent:"#171717",accentDim:"#404040",borderDefault:"#e5e5e5",borderSubtle:"#f0f0f0",borderHover:"#d4d4d4",fontSans:"DM Sans",fontDisplay:"DM Sans",fontMono:"JetBrains Mono",radius:8,radiusLg:16,presetId:"clean"};function h(e){return[{id:"block-navbar",type:"navbar",variant:"pill",props:{logo:e,links:["Menu","Catering","Our Story","Location","FAQs"],ctaText:"Order online →",ctaUrl:"/menu",signInText:"Sign in"}},{id:"block-hero",type:"hero",variant:"overlay",props:{badge:"Best cafe in the neighborhood",headline:"Where Every Meal Feels Like Home, Served Fresh Daily",subheadline:"Craft coffee, brunch, and comfort food made from scratch every morning.",primaryCta:"Order online →",primaryCtaUrl:"/menu"}},{id:"block-featured",type:"featured",variant:"row",props:{title:"Featured",viewAllText:"View menu →",viewAllUrl:"/menu",items:[{title:"Morning croissant"},{title:"Avocado toast"},{title:"Seasonal latte"},{title:"House sandwich"},{title:"Chef special"}]}},{id:"block-footer",type:"footer",variant:"minimal",props:{copyright:`${d()} ${e}`,links:["Menu","Gift cards","Contact"]}}]}function b(e,t,a,r){const o=i(e);return`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${o}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet"/>
<style>body{margin:0;font-family:"DM Sans",sans-serif;background:#fff;color:#171717}.wrap{max-width:72rem;margin:0 auto;padding:0 1.25rem}
header{display:flex;align-items:center;justify-content:space-between;padding:1rem 0;border-bottom:1px solid #eee}
.btn{padding:.65rem 1.25rem;border-radius:999px;background:#171717;color:#fff;font-weight:600;text-decoration:none;font-size:.85rem}
.hero{min-height:380px;display:flex;align-items:center;justify-content:center;text-align:center;color:#fff;background:linear-gradient(135deg,#78716c,#44403c);margin:0 -1.25rem;padding:3rem 1.25rem;position:relative}
.hero::before{content:"";position:absolute;inset:0;background:rgba(0,0,0,.4)}.hero>div{position:relative;z-index:1;max-width:40rem}
.hero h1{font-size:clamp(1.75rem,4vw,2.75rem);margin:0 0 .75rem;line-height:1.1}.featured{padding:2rem 0;display:flex;gap:1rem;overflow-x:auto}
.card{flex:0 0 10rem;height:13rem;border-radius:1rem;background:#f5f5f4;border:1px solid #e5e5e5}
a{color:inherit;text-decoration:none}</style></head><body><div class="wrap">
<header><strong>${o}</strong><a class="btn" href="/menu">Order online →</a></header>
<section class="hero"><div><p>${i(r)}</p><h1>${i(t)}</h1><p>${i(a)}</p><a class="btn" href="/menu">Order online →</a></div></section>
<section class="featured"><div class="card"></div><div class="card"></div><div class="card"></div><div class="card"></div></section>
</div></body></html>`}function S(e="Cafe"){const t=String(e||"Cafe").trim()||"Cafe",a=h(t),r=c(t,a,g),o=b(t,"Where Every Meal Feels Like Home, Served Fresh Daily","Craft coffee, brunch, and comfort food made from scratch every morning.","Best cafe in the neighborhood");return m(r,o)}function C(e="Bistro"){const t=String(e||"Bistro").trim()||"Bistro",a=h(t).map(n=>n.type==="hero"?{...n,props:{...n.props,headline:`Welcome to ${t}`,subheadline:"Neighborhood bistro — order pickup or delivery online.",badge:"Neighborhood bistro"}}:n),r=c(t,a,g),o=b(t,`Welcome to ${t}`,"Neighborhood bistro — order pickup or delivery online.","Neighborhood bistro");return m(r,o)}function H(e,t){switch(e){case"restaurant":return w(t);case"blank":return $(t);case"cafe_classic":return S(t);case"bistro_light":return C(t);case"food_truck":default:return u(t)}}function M(e){if(!e||typeof e!="object"||Array.isArray(e))return!1;const t=e;return t.engine==="openpage"&&typeof t.html=="string"&&!!t.config&&typeof t.config=="object"&&Array.isArray(t.config.blocks)}function D(e="Homepage"){return u(e||"Homepage")}function F(e,t){var o,n,s;const a=(t||"").toLowerCase().slice(0,2);if(a==="en"||a==="fr"||a==="de"){const l=(o=e.locales)==null?void 0:o[a];if(l!=null&&l.html)return l.html}const r=e.defaultLocale;return r&&((s=(n=e.locales)==null?void 0:n[r])!=null&&s.html)?e.locales[r].html:e.html}function B(e,t){var a,r;return((r=(a=e.locales)==null?void 0:a[t])==null?void 0:r.config)||e.config}function L(e,t,a){const r={...e.locales||{},[t]:a},o=!e.defaultLocale||e.defaultLocale===t;return{...e,locales:r,defaultLocale:e.defaultLocale||t,...o?{config:a.config,html:a.html}:null}}const O=`
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
`.replace(/\n/g,"");function P(e,t){const a=(t||"").replace(/\/$/,"");let r=e||"";/<head[\s>]/i.test(r)?r=r.replace(/<head([^>]*)>/i,'<head$1><base target="_parent" />'):r=`<base target="_parent" />${r}`;const o=`
<link rel="preconnect" href="https://cdn.tailwindcss.com" crossorigin />
<link rel="dns-prefetch" href="https://cdn.tailwindcss.com" />
<style id="op-cdn-fallback">${O}</style>
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
<\/script>`;/<\/head>/i.test(r)?/id="op-cdn-fallback"/.test(r)||(r=r.replace(/<\/head>/i,`${o}</head>`)):/html\s*,\s*body\s*\{[^}]*height\s*:\s*100%/i.test(r)||(r=`${o}${r}`);const n=a?`${a}/menu`:"/menu",s=a?`${a}/reservations`:"/reservations";return r=r.replace(/href="\/menu"/g,`href="${n}"`).replace(/href='\/menu'/g,`href='${n}'`).replace(/href="\/reservations"/g,`href="${s}"`).replace(/href='\/reservations'/g,`href='${s}'`).replace(/href="\/"/g,`href="${a||"/"}"`).replace(/href='\/'/g,`href='${a||"/"}'`).replace(/href="#"/g,`href="${n}"`).replace(/href='#'/g,`href='${n}'`),r}function A(e){return/<!DOCTYPE html|<html[\s>]/i.test(e||"")}export{F as a,A as b,B as c,D as e,M as i,P as r,H as s,L as w};
