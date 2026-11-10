(function(){
  "use strict";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* loader: keep the logo intro briefly, then reveal the site */
  var loader = document.getElementById("loader"), loaderDone = false, loadStart = Date.now();
  function dismissLoader(){
    if(loaderDone) return; loaderDone = true;
    loader.classList.add("done");
    document.body.classList.remove("loading");
    setTimeout(function(){ if(loader.parentNode) loader.parentNode.removeChild(loader); }, 750);
  }
  window.addEventListener("load", function(){
    var wait = Math.max(0, 4000 - (Date.now() - loadStart));
    setTimeout(dismissLoader, reduceMotion ? 0 : wait);
  });
  setTimeout(dismissLoader, 4900); /* never trap the visitor behind the intro */

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
  var PAGES = ["home", "about", "story", "achievements", "testimonials", "donate"];
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
    var navEl = document.getElementById("topnav");
    if(name !== "home"){
      navEl.classList.add("show");
      navEl.setAttribute("aria-hidden", "false");
      document.body.style.paddingTop = navEl.offsetHeight + "px";
    } else {
      document.body.style.paddingTop = "";
    }
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
  window.addEventListener("resize", function(){
    if(curPage !== "home") document.body.style.paddingTop = document.getElementById("topnav").offsetHeight + "px";
  });
  window.addEventListener("load", function(){
    if(curPage !== "home") document.body.style.paddingTop = document.getElementById("topnav").offsetHeight + "px";
  });

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

  /* scroll-driven: progress bar, top nav, timeline fill */
  var progress = document.getElementById("progress"),
      topnav = document.getElementById("topnav"),
      tl = document.getElementById("timeline"),
      tlFill = document.getElementById("tlFill"),
      sticky = document.getElementById("stickyCta"),
      joinSec = document.getElementById("judiye"),
      joinVisible = false, ticking = false;
  var jio = new IntersectionObserver(function(entries){
    entries.forEach(function(e){ joinVisible = e.isIntersecting; });
  }, {threshold: 0.08});
  jio.observe(joinSec);
  function onScroll(){
    var y = window.scrollY || 0;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = (h > 0 ? (y / h) * 100 : 0) + "%";
    var past = curPage !== "home" || y > window.innerHeight * 0.82;
    topnav.classList.toggle("show", past);
    topnav.setAttribute("aria-hidden", past ? "false" : "true");
    sticky.classList.toggle("show", past && !joinVisible);
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
  document.querySelectorAll(".gal button, .press-card").forEach(function(b){
    b.addEventListener("click", function(){ openLb(b); });
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
    if(!okName){ document.getElementById("inName").focus(); return; }
    if(!okPhone){ document.getElementById("inPhone").focus(); return; }
    var now = new Date();
    var id = "DK-" + now.getFullYear() + "-" + String(Math.floor(1000 + Math.random() * 9000));
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
