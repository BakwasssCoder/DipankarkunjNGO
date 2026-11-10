(function(){
  "use strict";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* loader: the logo intro plays once per browser session, then the site opens straight away */
  var loader = document.getElementById("loader"), loaderDone = false, loadStart = Date.now(), introSeen = false;
  try { introSeen = sessionStorage.getItem("dk-intro") === "1"; sessionStorage.setItem("dk-intro", "1"); } catch(e){}
  function dismissLoader(){
    if(loaderDone) return; loaderDone = true;
    loader.classList.add("done");
    document.body.classList.remove("loading");
    setTimeout(function(){ if(loader.parentNode) loader.parentNode.removeChild(loader); }, 750);
  }
  window.addEventListener("load", function(){
    var wait = Math.max(0, 2600 - (Date.now() - loadStart));
    setTimeout(dismissLoader, reduceMotion ? 0 : wait);
  });
  if(introSeen) dismissLoader();
  setTimeout(dismissLoader, 3600); /* never trap the visitor behind the intro */

  /* self-heal: if an image request hiccups on a slow connection, retry it once */
  document.addEventListener("error", function(e){
    var t = e.target;
    if(t && t.tagName === "IMG" && !t.dataset.rtd){
      var s = t.getAttribute("src") || "";
      if(s.indexOf("assets/") === 0){ t.dataset.rtd = "1"; t.src = s + "?r=1"; }
    }
  }, true);

  /* marquee: duplicate content for a seamless loop */
  var track = document.getElementById("marqueeTrack");
  track.innerHTML = track.innerHTML + track.innerHTML + track.innerHTML + track.innerHTML;

  /* ---------- multi-page router — hash pages: #/home #/about #/story
     #/achievements #/testimonials #/donate. Plain anchors (#judiye etc.)
     still work: they open the page that contains them, then scroll. --- */
  var PAGES = ["home", "about", "story", "achievements", "testimonials", "donate", "privacy"];
  var curPage = "home";
  function showPage(name, anchor){
    if(PAGES.indexOf(name) === -1) name = "home";
    curPage = name;
    document.querySelectorAll("[data-page]").forEach(function(el){
      if(el.getAttribute("data-page") === name) el.removeAttribute("hidden");
      else el.setAttribute("hidden", "");
    });
    document.body.classList.toggle("sub", name !== "home");
    document.querySelectorAll("#topnav nav a[data-nav]").forEach(function(a){
      a.classList.toggle("active", a.getAttribute("data-nav") === name);
    });
    setMenu(false);
    updateBanner();
    if(anchor){
      var t = document.getElementById(anchor);
      if(t){ t.scrollIntoView(); if(typeof onScroll === "function") onScroll(); return; }
    }
    var de = document.documentElement, prevSb = de.style.scrollBehavior;
    de.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
    de.style.scrollBehavior = prevSb;
    if(typeof onScroll === "function") onScroll();
  }
  function routeFromHash(){
    var h = location.hash || "";
    if(h.indexOf("#/") === 0){ showPage(h.slice(2).split("/")[0], null); return; }
    if(h.length > 1){
      var t = document.getElementById(h.slice(1));
      if(t){
        var holder = t.closest ? t.closest("[data-page]") : null;
        showPage(holder ? holder.getAttribute("data-page") : "home", h.slice(1));
        return;
      }
    }
    showPage("home", null);
  }
  window.addEventListener("hashchange", routeFromHash);

  /* inner-page banner — title + breadcrumb taken from the active nav link (already in the current language) */
  function updateBanner(){
    var banner = document.getElementById("pageBanner");
    var link = document.querySelector('a[data-nav="' + curPage + '"]'); /* header nav, or footer for #/privacy */
    banner.hidden = curPage === "home" || !link;
    if(banner.hidden) return;
    document.getElementById("bannerTitle").textContent = link.textContent;
    document.getElementById("crumbHere").textContent = link.textContent;
  }

  /* mobile menu (hamburger) — below 961px the nav collapses into a dropdown */
  var menuBtn = document.querySelector("#topnav .menu-btn");
  function setMenu(open){
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    document.getElementById("topnav").classList.toggle("menu-open", open);
  }
  menuBtn.addEventListener("click", function(){ setMenu(menuBtn.getAttribute("aria-expanded") !== "true"); });
  document.getElementById("siteNav").addEventListener("click", function(e){ if(e.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", function(e){
    if(e.key === "Escape" && menuBtn.getAttribute("aria-expanded") === "true"){ setMenu(false); menuBtn.focus(); }
  });
  document.getElementById("fYear").textContent = new Date().getFullYear();

  /* ---------- bilingual Hindi / English — every content string ---------- */
  var HI_TITLE = document.title;
  var EN = window.DK_EN;
  var curLang = "hi";
  var WA_MSG = window.DK_WA_MSG;
  function swapAttr(sel, attr, keyAttr){
    document.querySelectorAll(sel).forEach(function(el){
      var store = "_hi_" + attr;
      if(el[store] === undefined) el[store] = el.getAttribute(attr) || "";
      var k = el.getAttribute(keyAttr);
      if(curLang === "en" && EN[k] !== undefined) el.setAttribute(attr, EN[k]);
      else el.setAttribute(attr, el[store]);
    });
  }
  function applyLang(lang){
    curLang = lang;
    document.documentElement.lang = lang;
    document.title = lang === "en" ? EN["doc.title"] : HI_TITLE;
    document.querySelectorAll("[data-i18n]").forEach(function(el){
      if(el._hi === undefined) el._hi = el.innerHTML;
      var k = el.getAttribute("data-i18n");
      el.innerHTML = (lang === "en" && EN[k] !== undefined) ? EN[k] : el._hi;
    });
    swapAttr("[data-i18n-cap]", "data-cap", "data-i18n-cap");
    swapAttr("[data-i18n-ph]", "placeholder", "data-i18n-ph");
    swapAttr("[data-i18n-aria]", "aria-label", "data-i18n-aria");
    swapAttr("[data-i18n-alt]", "alt", "data-i18n-alt");
    document.querySelectorAll(".lang-toggle button").forEach(function(b){
      b.classList.toggle("active", b.getAttribute("data-lang") === lang);
    });
    document.querySelectorAll('a[href^="https://wa.me/917857043185?text="]').forEach(function(a){
      a.href = "https://wa.me/917857043185?text=" + encodeURIComponent(WA_MSG[lang]);
    });
    var lbEl = document.getElementById("lightbox"), zb = document.getElementById("lb-zoom");
    if(zb && lbEl && !lbEl.classList.contains("zoomed")) zb.textContent = lang === "en" ? "Read in large size" : "बड़ा करके पढ़ें";
    updateBanner();
    if(typeof renderAdminMedia === "function"){ renderAdminMedia(); renderNotices(); applySettings(); }
  }
  document.querySelectorAll(".lang-toggle button").forEach(function(b){
    b.addEventListener("click", function(){ applyLang(b.getAttribute("data-lang")); });
  });

  /* reveal on scroll */
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target); } });
  }, {threshold: 0.05, rootMargin: "450px 0px 450px 0px"});
  document.querySelectorAll(".rv,.rv-l,.rv-r,.rv-img").forEach(function(el){ io.observe(el); });

  /* count-up stats */
  function countUp(el){
    var target = parseInt(el.getAttribute("data-count"), 10);
    if(reduceMotion || target < 100){ el.textContent = target.toLocaleString("en-IN"); return; }
    var start = null, dur = 1400;
    function step(ts){
      if(!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString("en-IN");
      if(p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var cio = new IntersectionObserver(function(entries){
    entries.forEach(function(e){ if(e.isIntersecting){ countUp(e.target); cio.unobserve(e.target); } });
  }, {threshold: 0.6});
  document.querySelectorAll("[data-count]").forEach(function(el){ cio.observe(el); });

  /* scroll-driven: progress bar, header shadow, timeline fill */
  var progress = document.getElementById("progress"),
      topnav = document.getElementById("topnav"),
      tl = document.getElementById("timeline"),
      tlFill = document.getElementById("tlFill"),
      ticking = false;
  function onScroll(){
    var y = window.scrollY || 0;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = (h > 0 ? (y / h) * 100 : 0) + "%";
    topnav.classList.toggle("scrolled", y > 40);
    document.getElementById("toTop").classList.toggle("show", y > 700);
    if(tl && tlFill){
      var r = tl.getBoundingClientRect();
      var filled = Math.min(Math.max(window.innerHeight * 0.72 - r.top, 0), r.height);
      tlFill.style.height = filled + "px";
    }
    ticking = false;
  }
  window.addEventListener("scroll", function(){ if(!ticking){ ticking = true; requestAnimationFrame(onScroll); } }, {passive: true});
  onScroll();
  routeFromHash();

  /* ---------- lightbox (gallery + press share it) ---------- */
  var lb = document.getElementById("lightbox"),
      lbImg = document.getElementById("lb-img"),
      lbCap = document.getElementById("lb-cap"),
      lbZoomBtn = document.getElementById("lb-zoom"),
      items = [], idx = 0;
  function collect(btn){
    var grid = btn.closest(".gal, .press-grid, .ruins-seq, .pcar-track");
    items = Array.prototype.slice.call(grid.querySelectorAll("button"));
    idx = items.indexOf(btn);
  }
  function render(){
    var btn = items[idx], img = btn.querySelector("img");
    lbImg.src = img.getAttribute("src");
    lbImg.alt = img.getAttribute("alt") || "";
    lbCap.textContent = btn.getAttribute("data-cap") || img.getAttribute("alt") || "";
    lb.classList.remove("zoomed");
    lbZoomBtn.textContent = curLang === "en" ? "Read in large size" : "बड़ा करके पढ़ें";
    document.getElementById("lb-prev").style.display = items.length > 1 ? "grid" : "none";
    document.getElementById("lb-next").style.display = items.length > 1 ? "grid" : "none";
    document.getElementById("lb-count").textContent = items.length > 1 ? (idx + 1) + " / " + items.length : "";
  }
  function openLb(btn){ collect(btn); render(); lb.classList.add("open"); document.body.style.overflow = "hidden"; }
  function closeLb(){ lb.classList.remove("open"); lb.classList.remove("zoomed"); document.body.style.overflow = ""; }
  /* delegated, so photos added from the admin panel open in the lightbox too */
  document.addEventListener("click", function(e){
    var b = e.target.closest && e.target.closest(".gal button, .press-card");
    if(b) openLb(b);
  });

  /* photos published from the admin panel (js/store.js) — appended after the built-in ones */
  var ZOOM_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>';
  function renderAdminMedia(){
    if(!window.DK_STORE) return;
    document.querySelectorAll("[data-admin-media]").forEach(function(el){ el.remove(); });
    [["gallery", "galGrid"], ["press", "pressGrid"]].forEach(function(pair){
      var box = document.getElementById(pair[1]);
      if(!box) return;
      DK_STORE.publishedMedia(pair[0]).forEach(function(m){
        var cap = (curLang === "en" && m.caption_en) ? m.caption_en : (m.caption || "");
        var b = document.createElement("button");
        b.type = "button";
        b.setAttribute("data-admin-media", "");
        b.setAttribute("data-cap", cap);
        var img = document.createElement("img");
        img.src = m.image; img.alt = cap; img.loading = "lazy";
        var capEl = document.createElement("span");
        capEl.textContent = cap;
        if(pair[0] === "gallery"){
          var ph = document.createElement("span"); ph.className = "gal-ph";
          var z = document.createElement("span"); z.className = "gal-zoom"; z.setAttribute("aria-hidden", "true"); z.innerHTML = ZOOM_SVG;
          ph.appendChild(img); ph.appendChild(z);
          capEl.className = "gal-cap";
          b.appendChild(ph); b.appendChild(capEl);
        } else {
          b.className = "press-card";
          capEl.className = "pc-head";
          b.appendChild(img); b.appendChild(capEl);
        }
        box.appendChild(b);
      });
    });
  }
  renderAdminMedia();

  /* notices & events from the admin panel — homepage section stays hidden while empty */
  function renderNotices(){
    var sec = document.getElementById("suchna"), ul = document.getElementById("noticeList");
    var items = window.DK_STORE ? DK_STORE.publishedNotices() : [];
    sec.classList.toggle("is-empty", !items.length);
    ul.textContent = "";
    items.forEach(function(n){
      var li = document.createElement("li"), when = document.createElement("time"), body = document.createElement("div"),
          h = document.createElement("h3"), p = document.createElement("p");
      if(n.date){
        when.dateTime = n.date;
        when.textContent = new Date(n.date + "T00:00").toLocaleDateString(curLang === "en" ? "en-IN" : "hi-IN", {day: "numeric", month: "long", year: "numeric"});
      }
      h.textContent = (curLang === "en" && n.title_en) ? n.title_en : n.title;
      p.textContent = (curLang === "en" && n.text_en) ? n.text_en : (n.text || "");
      body.appendChild(h); if(p.textContent) body.appendChild(p);
      li.appendChild(when); li.appendChild(body); ul.appendChild(li);
    });
  }
  renderNotices();

  /* site settings from the admin panel: real social links + announcement strip */
  function applySettings(){
    var st = window.DK_STORE ? DK_STORE.getSettings() : {};
    document.querySelectorAll("[data-social]").forEach(function(a){
      var url = st[a.getAttribute("data-social")];
      if(!/^https:\/\//.test(url || "")) return; /* keep the demo link until a real https URL is set */
      a.href = url;
      a.classList.remove("demo");
      a.querySelectorAll(".soc-demo, i").forEach(function(x){ x.remove(); });
      a.querySelectorAll('[data-i18n="soc.demo.note"]').forEach(function(x){ x.removeAttribute("data-i18n"); x.classList.add("soc-follow"); });
      a.querySelectorAll(".soc-follow").forEach(function(x){ x.textContent = curLang === "en" ? "Follow us" : "हमसे जुड़िए"; });
      a.childNodes.forEach(function(n){ if(n.nodeType === 3) n.textContent = n.textContent.replace(/\s*·\s*$/, " "); });
    });
    var ann = document.getElementById("announce");
    ann.textContent = st.announcement || "";
    ann.hidden = !st.announcement;
  }
  applySettings();

  /* skip link — focus the first visible content block without changing the route */
  document.querySelector(".skip-link").addEventListener("click", function(e){
    e.preventDefault();
    var t = document.querySelector(curPage === "home" ? "header.hero" : "#pageBanner");
    if(t){ t.setAttribute("tabindex", "-1"); t.focus(); t.scrollIntoView(); }
  });

  /* back to top */
  var toTop = document.getElementById("toTop");
  toTop.addEventListener("click", function(){
    window.scrollTo({top: 0, behavior: reduceMotion ? "auto" : "smooth"});
    var brand = document.querySelector("#topnav .brand"); if(brand) brand.focus({preventScroll: true});
  });

  /* contact form → admin inbox (संदेश) */
  var ctForm = document.getElementById("contactForm");
  ctForm.addEventListener("submit", function(e){
    e.preventDefault();
    var name = document.getElementById("ctName").value.trim(),
        phone = document.getElementById("ctPhone").value.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, ""),
        msg = document.getElementById("ctMsg").value.trim();
    var consentOk = document.getElementById("cConsent").checked && document.getElementById("cAdult").checked;
    var bad = [["cName", name.length >= 2, "ctName"], ["cPhone", /^[6-9]\d{9}$/.test(phone), "ctPhone"], ["cMsg", msg.length >= 2, "ctMsg"],
               ["cConsentWrap", consentOk, document.getElementById("cConsent").checked ? "cAdult" : "cConsent"]]
      .map(function(f){ document.getElementById(f[0]).classList.toggle("invalid", !f[1]); return f; })
      .filter(function(f){ return !f[1]; });
    if(bad.length){ document.getElementById(bad[0][2]).focus(); return; }
    var saved = window.DK_STORE && DK_STORE.submitMessage({name: name, phone: phone, subject: document.getElementById("ctSubject").value, message: msg});
    var out = document.getElementById("ctOk");
    out.classList.toggle("bad", !saved);
    out.textContent = saved
      ? (curLang === "en" ? "Thank you, " + name + "! Your message has reached the institution." : "धन्यवाद, " + name + "! आपका संदेश संस्था तक पहुँच गया है।")
      : (curLang === "en" ? "Could not send. Please message us on WhatsApp: +91 78570 43185" : "संदेश नहीं जा सका। कृपया WhatsApp करें: +91 78570 43185");
    if(saved) ctForm.reset();
  });

  /* DPDP rights request (privacy page) → admin → डेटा अनुरोध */
  document.getElementById("rightsForm").addEventListener("submit", function(e){
    e.preventDefault();
    var name = document.getElementById("rqName").value.trim(),
        phone = document.getElementById("rqPhone").value.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
    var bad = [["rName", name.length >= 2, "rqName"], ["rPhone", /^[6-9]\d{9}$/.test(phone), "rqPhone"]]
      .map(function(f){ document.getElementById(f[0]).classList.toggle("invalid", !f[1]); return f; })
      .filter(function(f){ return !f[1]; });
    if(bad.length){ document.getElementById(bad[0][2]).focus(); return; }
    var ref = window.DK_STORE && DK_STORE.submitRequest({type: document.getElementById("rqType").value, name: name, phone: phone, details: document.getElementById("rqDetails").value.trim()});
    var out = document.getElementById("rqOk");
    out.classList.toggle("bad", !ref);
    out.textContent = ref
      ? (curLang === "en" ? "Request received — reference " + ref + ". We will reply within 30 days." : "अनुरोध मिल गया — क्रमांक " + ref + "। हम 30 दिनों के भीतर जवाब देंगे।")
      : (curLang === "en" ? "Could not send. Please WhatsApp +91 78570 43185." : "अनुरोध नहीं जा सका। कृपया WhatsApp करें: +91 78570 43185");
    if(ref) e.target.reset();
  });
  document.getElementById("lb-close").addEventListener("click", closeLb);
  document.getElementById("lb-prev").addEventListener("click", function(){ idx = (idx - 1 + items.length) % items.length; render(); });
  document.getElementById("lb-next").addEventListener("click", function(){ idx = (idx + 1) % items.length; render(); });
  lbZoomBtn.addEventListener("click", function(){
    var z = lb.classList.toggle("zoomed");
    lbZoomBtn.textContent = z ? (curLang === "en" ? "Make smaller" : "छोटा करें") : (curLang === "en" ? "Read in large size" : "बड़ा करके पढ़ें");
    lb.scrollTop = 0;
  });
  lb.addEventListener("click", function(e){ if(e.target === lb) closeLb(); });
  document.addEventListener("keydown", function(e){
    if(!lb.classList.contains("open")) return;
    if(e.key === "Escape") closeLb();
    if(e.key === "ArrowLeft") document.getElementById("lb-prev").click();
    if(e.key === "ArrowRight") document.getElementById("lb-next").click();
  });

  /* homepage ruins sequence — same lightbox as the gallery */
  document.querySelectorAll(".ruins-seq button").forEach(function(b){
    b.addEventListener("click", function(){ openLb(b); });
  });

  /* ---------- homepage press carousel (the 16 cuttings) ---------- */
  var pcarTrack = document.getElementById("pcarTrack");
  if(pcarTrack){
    var pcarSlides = Array.prototype.slice.call(pcarTrack.querySelectorAll(".pcar-slide")),
        pcarDotsBox = document.getElementById("pcarDots"),
        pcarCount = document.getElementById("pcarCount"),
        pcarCur = 0, pcarDownLeft = 0;
    pcarSlides.forEach(function(s, i){
      var d = document.createElement("button");
      d.type = "button";
      d.className = "pcar-dot" + (i === 0 ? " on" : "");
      d.setAttribute("aria-label", (i + 1) + " / " + pcarSlides.length);
      d.addEventListener("click", function(){ pcarGo(i); });
      pcarDotsBox.appendChild(d);
    });
    function pcarStep(){ return pcarSlides.length ? pcarSlides[0].offsetWidth + 14 : 316; }
    function pcarGo(i){
      i = Math.max(0, Math.min(pcarSlides.length - 1, i));
      pcarTrack.scrollTo({left: i * pcarStep(), behavior: reduceMotion ? "auto" : "smooth"});
    }
    function pcarSync(){
      var i = Math.round(pcarTrack.scrollLeft / pcarStep());
      if(pcarTrack.scrollLeft >= pcarTrack.scrollWidth - pcarTrack.clientWidth - 2) i = pcarSlides.length - 1;
      i = Math.max(0, Math.min(pcarSlides.length - 1, i));
      if(i === pcarCur) return;
      pcarCur = i;
      Array.prototype.forEach.call(pcarDotsBox.children, function(d, j){ d.classList.toggle("on", j === i); });
      if(pcarCount) pcarCount.textContent = (i + 1) + " / " + pcarSlides.length;
    }
    var pcarTick = false;
    pcarTrack.addEventListener("scroll", function(){
      if(!pcarTick){ pcarTick = true; requestAnimationFrame(function(){ pcarSync(); pcarTick = false; }); }
    }, {passive: true});
    document.getElementById("pcarPrev").addEventListener("click", function(){ pcarGo(pcarCur - 1); });
    document.getElementById("pcarNext").addEventListener("click", function(){ pcarGo(pcarCur + 1); });
    /* a tap opens the lightbox; a swipe/drag that scrolled the track does not */
    pcarTrack.addEventListener("pointerdown", function(){ pcarDownLeft = pcarTrack.scrollLeft; });
    pcarSlides.forEach(function(b){
      b.addEventListener("click", function(){
        if(Math.abs(pcarTrack.scrollLeft - pcarDownLeft) > 8) return;
        openLb(b);
      });
    });
  }

  /* hero leader names — tap a name, see that person's photo large */
  function openSingle(src, cap, alt){
    var tmp = document.createElement("button");
    var im = document.createElement("img");
    im.setAttribute("src", src); im.setAttribute("alt", alt || "");
    tmp.appendChild(im); tmp.setAttribute("data-cap", cap || "");
    items = [tmp]; idx = 0; render();
    lb.classList.add("open"); document.body.style.overflow = "hidden";
  }
  document.querySelectorAll("[data-lb]").forEach(function(b){
    b.addEventListener("click", function(){
      var en = curLang === "en";
      openSingle(
        b.getAttribute("data-lb"),
        en ? (b.getAttribute("data-cap-en") || b.getAttribute("data-cap")) : b.getAttribute("data-cap"),
        en ? (b.getAttribute("data-lb-alt-en") || b.getAttribute("data-lb-alt")) : b.getAttribute("data-lb-alt")
      );
    });
  });

  /* lightbox swipe — next / previous photo on touch */
  var lbTouchX = null;
  lb.addEventListener("touchstart", function(e){ lbTouchX = e.changedTouches[0].clientX; }, {passive: true});
  lb.addEventListener("touchend", function(e){
    if(lbTouchX === null){ return; }
    var dx = e.changedTouches[0].clientX - lbTouchX; lbTouchX = null;
    if(lb.classList.contains("zoomed") || items.length < 2 || Math.abs(dx) < 48) return;
    idx = dx < 0 ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
    render();
  }, {passive: true});

  /* ---------- join form ---------- */
  var form = document.getElementById("joinForm"),
      customWrap = document.getElementById("customAmtWrap"),
      customAmt = document.getElementById("customAmt"),
      receipt = document.getElementById("receipt"),
      receiptData = null;
  form.addEventListener("change", function(e){
    if(e.target.name === "tier"){
      customWrap.classList.toggle("show", e.target.value === "custom");
      if(e.target.value === "custom") customAmt.focus();
    }
  });
  function setInvalid(id, bad){ document.getElementById(id).classList.toggle("invalid", bad); return !bad; }
  var ONES = ["","एक","दो","तीन","चार","पाँच","छह","सात","आठ","नौ","दस","ग्यारह","बारह","तेरह","चौदह","पन्द्रह","सोलह","सत्रह","अठारह","उन्नीस","बीस","इक्कीस","बाईस","तेईस","चौबीस","पच्चीस","छब्बीस","सत्ताईस","अट्ठाईस","उनतीस","तीस","इकतीस","बत्तीस","तैंतीस","चौंतीस","पैंतीस","छत्तीस","सैंतीस","अड़तीस","उनतालीस","चालीस","इकतालीस","बयालीस","तैंतालीस","चवालीस","पैंतालीस","छियालीस","सैंतालीस","अड़तालीस","उनचास","पचास","इक्यावन","बावन","तिरपन","चौवन","पचपन","छप्पन","सत्तावन","अट्ठावन","उनसठ","साठ","इकसठ","बासठ","तिरसठ","चौंसठ","पैंसठ","छियासठ","सड़सठ","अड़सठ","उनहत्तर","सत्तर","इकहत्तर","बहत्तर","तिहत्तर","चौहत्तर","पचहत्तर","छिहत्तर","सतहत्तर","अठहत्तर","उनासी","अस्सी","इक्यासी","बयासी","तिरासी","चौरासी","पचासी","छियासी","सत्तासी","अट्ठासी","नवासी","नब्बे","इक्यानवे","बानवे","तिरानवे","चौरानवे","पचानवे","छियानवे","सत्तानवे","अट्ठानवे","निन्यानवे"];
  function hindiWords(n){
    if(n <= 0) return "";
    var parts = [];
    var th = Math.floor(n / 1000); if(th){ parts.push(ONES[th] + " हज़ार"); n %= 1000; }
    var hu = Math.floor(n / 100); if(hu){ parts.push(ONES[hu] + " सौ"); n %= 100; }
    if(n) parts.push(ONES[n]);
    return parts.join(" ");
  }
  var EN_ONES = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  var EN_TENS = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function englishWords(n){
    if(n <= 0) return "Zero";
    var parts = [];
    var th = Math.floor(n / 1000); if(th){ parts.push(englishWords(th) + " Thousand"); n %= 1000; }
    var hu = Math.floor(n / 100); if(hu){ parts.push(EN_ONES[hu] + " Hundred"); n %= 100; }
    if(n >= 20){ parts.push(EN_TENS[Math.floor(n / 10)] + (n % 10 ? "-" + EN_ONES[n % 10] : "")); }
    else if(n){ parts.push(EN_ONES[n]); }
    return parts.join(" ");
  }
  function amountWords(amount){
    return curLang === "en" ? englishWords(amount) + " Rupees" : hindiWords(amount) + " रुपये";
  }
  form.addEventListener("submit", function(ev){
    ev.preventDefault();
    var name = document.getElementById("inName").value.trim();
    var phone = document.getElementById("inPhone").value.replace(/\D/g, "");
    var okName = setInvalid("fName", name.length < 2);
    var okPhone = setInvalid("fPhone", !/^[6-9]\d{9}$/.test(phone));
    var tierEl = form.querySelector('input[name="tier"]:checked');
    var amount = 0, tname = "";
    if(tierEl){
      tname = (curLang === "en" ? tierEl.getAttribute("data-tname-en") : null) || tierEl.getAttribute("data-tname");
      if(tierEl.value === "custom"){
        amount = parseInt(customAmt.value, 10);
        var badC = !(amount >= 1 && amount <= 1000000);
        customWrap.classList.toggle("invalid", badC);
        if(badC){ customAmt.focus(); return; }
      } else { amount = parseInt(tierEl.value, 10); }
    }
    /* DPDP: separate, unticked consent + adult confirmation before any data is stored */
    var okConsent = setInvalid("jConsentWrap", !(document.getElementById("jConsent").checked && document.getElementById("jAdult").checked));
    if(!okName){ document.getElementById("inName").focus(); return; }
    if(!okPhone){ document.getElementById("inPhone").focus(); return; }
    if(!okConsent){ document.getElementById(document.getElementById("jConsent").checked ? "jAdult" : "jConsent").focus(); return; }
    var now = new Date();
    /* saved as a pending membership request — visible in the admin panel (admin/) */
    var id = (window.DK_STORE && DK_STORE.submitMembership({name: name, phone: phone, place: document.getElementById("inPlace").value.trim(), tier: tname, amount: amount, msg: document.getElementById("inMsg").value.trim(), lang: curLang}))
      || "DK-" + now.getFullYear() + "-" + String(Math.floor(1000 + Math.random() * 9000));
    var dateStr = now.toLocaleDateString(curLang === "en" ? "en-IN" : "hi-IN", {day: "numeric", month: "long", year: "numeric"});
    receiptData = {id: id, name: name, phone: phone, place: document.getElementById("inPlace").value.trim(), tier: tname, amount: amount, date: dateStr, msg: document.getElementById("inMsg").value.trim()};
    var waText = curLang === "en" ?
      "Namaste, I wish to become a member of Deepankar Kunj.\n\n" +
      "Member No.: " + id + "\nName: " + name + "\nMobile: " + phone + "\n" +
      (receiptData.place ? "Village/City: " + receiptData.place + "\n" : "") +
      "Membership: " + tname + "\nAmount: ₹" + amount.toLocaleString("en-IN") + "\nDate: " + dateStr +
      (receiptData.msg ? "\nMessage: " + receiptData.msg : "") +
      "\n\nPlease share the details to complete my membership. Thank you!" :
      "नमस्ते, मैं दीपांकर-कुंज का सदस्य बनना चाहता/चाहती हूँ।\n\n" +
      "सदस्य क्रमांक: " + id + "\nनाम: " + name + "\nमोबाइल: " + phone + "\n" +
      (receiptData.place ? "गाँव/शहर: " + receiptData.place + "\n" : "") +
      "सदस्यता: " + tname + "\nराशि: ₹" + amount.toLocaleString("en-IN") + "\nदिनांक: " + dateStr +
      (receiptData.msg ? "\nसंदेश: " + receiptData.msg : "") +
      "\n\nकृपया मेरी सदस्यता पूरी करने की जानकारी दीजिए। धन्यवाद!";
    var waBtn = document.getElementById("waReceipt");
    waBtn.href = "https://wa.me/917857043185?text=" + encodeURIComponent(waText);
    waBtn.classList.add("show");
    document.getElementById("rId").textContent = id;
    document.getElementById("rName").textContent = name;
    document.getElementById("rTier").textContent = tname;
    document.getElementById("rAmt").textContent = "₹" + amount.toLocaleString("en-IN") + " (" + amountWords(amount) + ")";
    document.getElementById("rDate").textContent = dateStr;
    receipt.classList.add("show");
    receipt.scrollIntoView({behavior: reduceMotion ? "auto" : "smooth", block: "center"});
  });
  document.getElementById("resetForm").addEventListener("click", function(){
    form.reset();
    form.querySelector('input[name="tier"][value="51"]').checked = true;
    customWrap.classList.remove("show");
    receipt.classList.remove("show");
    document.getElementById("waReceipt").classList.remove("show");
    receiptData = null;
    document.getElementById("judiye").scrollIntoView({behavior: "smooth"});
  });

  /* downloadable receipt (canvas PNG) */
  document.getElementById("dlReceipt").addEventListener("click", function(){
    if(!receiptData) return;
    var c = document.createElement("canvas"); c.width = 1000; c.height = 620;
    var x = c.getContext("2d");
    var g = x.createLinearGradient(0, 0, 1000, 620);
    g.addColorStop(0, "#fffdf7"); g.addColorStop(1, "#f7e8c8");
    x.fillStyle = g; x.fillRect(0, 0, 1000, 620);
    x.strokeStyle = "#7c1d1d"; x.lineWidth = 6; x.strokeRect(18, 18, 964, 584);
    x.strokeStyle = "#c8862a"; x.lineWidth = 2; x.strokeRect(32, 32, 936, 556);
    var ENC = curLang === "en";
    x.textAlign = "center"; x.fillStyle = "#7c1d1d";
    x.font = "700 44px 'Tiro Devanagari Hindi', serif";
    x.fillText(ENC ? "Deepankar Kunj" : "दीपांकर-कुंज", 500, 105);
    x.font = "20px 'Mukta', sans-serif"; x.fillStyle = "#6b4e35";
    x.fillText(ENC ? "Amarpur, Banka (Bihar) · तमसो मा ज्योतिर्गमय" : "अमरपुर, बांका (बिहार) · ॥ तमसो मा ज्योतिर्गमय ॥", 500, 142);
    x.strokeStyle = "#e6b354"; x.beginPath(); x.moveTo(120, 168); x.lineTo(880, 168); x.stroke();
    x.fillStyle = "#2c1a10"; x.font = "700 30px 'Mukta', sans-serif";
    x.fillText(ENC ? "Membership Pledge Receipt" : "सदस्यता संकल्प रसीद", 500, 218);
    x.textAlign = "left"; x.font = "24px 'Mukta', sans-serif"; x.fillStyle = "#2c1a10";
    var rows = ENC ? [
      ["Member No.", receiptData.id],
      ["Name", receiptData.name],
      ["Membership", receiptData.tier],
      ["Amount", "₹" + receiptData.amount.toLocaleString("en-IN") + " (" + englishWords(receiptData.amount) + " Rupees)"],
      ["Date", receiptData.date]
    ] : [
      ["सदस्य क्रमांक", receiptData.id],
      ["नाम", receiptData.name],
      ["सदस्यता", receiptData.tier],
      ["राशि", "₹" + receiptData.amount.toLocaleString("en-IN") + " (" + hindiWords(receiptData.amount) + " रुपये)"],
      ["दिनांक", receiptData.date]
    ];
    if(receiptData.place) rows.push([ENC ? "Village / City" : "गाँव / शहर", receiptData.place]);
    rows.forEach(function(r, i){
      var y = 285 + i * 46;
      x.fillStyle = "#6b4e35"; x.fillText(r[0], 110, y);
      x.fillStyle = "#2c1a10"; x.font = "700 24px 'Mukta', sans-serif"; x.fillText(r[1], 340, y);
      x.font = "24px 'Mukta', sans-serif";
    });
    x.textAlign = "center"; x.fillStyle = "#6b4e35"; x.font = "19px 'Mukta', sans-serif";
    x.fillText(ENC ? "This receipt is proof of your membership pledge. To complete your membership, WhatsApp —" : "यह रसीद आपके सदस्यता-संकल्प का प्रमाण है। सदस्यता पूर्ण करने हेतु WhatsApp कीजिए —", 500, 545);
    x.fillText(ENC ? "Deepankar Kunj · WhatsApp: +91 78570 43185 · Thank you!" : "दीपांकर-कुंज · WhatsApp: +91 78570 43185 · धन्यवाद!", 500, 572);
    var a = document.createElement("a");
    a.download = "deepankar-kunj-rasid-" + receiptData.id + ".png";
    a.href = c.toDataURL("image/png");
    a.click();
  });
})();
