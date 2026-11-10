/* Deepankar-Kunj admin panel — demo version.
   Data: js/store.js (browser localStorage, shared with the website on the same origin).
   shortcut: demo password checked in the browser — anyone can read it in this file.
   Replace with real login (Supabase Auth / server) before going live. */
(function(){
  "use strict";
  var DEMO_PASSWORD = "dk@2010";
  var S = window.DK_STORE;
  var $ = function(id){ return document.getElementById(id); };

  var STATUS = { pending: "लंबित", approved: "स्वीकृत", paid: "भुगतान प्राप्त", rejected: "अस्वीकृत" };
  var MODE = { cash: "नकद", upi: "UPI", bank: "बैंक ट्रांसफ़र", cheque: "चेक", other: "अन्य" };
  var VIEWS = { dashboard: "डैशबोर्ड", members: "सदस्य", donations: "दान", media: "गैलरी व अख़बार",
                messages: "संदेश", notices: "सूचनाएँ", settings: "सेटिंग्स", privacy: "डेटा अनुरोध (DPDP)" };

  function esc(v){
    return String(v == null ? "" : v).replace(/[&<>"']/g, function(c){
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function rupees(n){ return "₹" + Number(n || 0).toLocaleString("en-IN"); }
  function fmtDate(iso){
    var d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleDateString("hi-IN", { day: "numeric", month: "short", year: "numeric" });
  }
  var toastTimer;
  function toast(msg){
    var t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function(){ t.classList.remove("show"); }, 2400);
  }

  /* ---------- login ---------- */
  function loggedIn(){ try { return sessionStorage.getItem("dk_admin") === "1"; } catch(e){ return false; } }
  function showApp(){
    var ok = loggedIn();
    $("login").hidden = ok; $("app").hidden = !ok;
    if(ok) route(); else $("pw").focus();
  }
  $("loginForm").addEventListener("submit", function(e){
    e.preventDefault();
    if($("pw").value !== DEMO_PASSWORD){ $("loginErr").textContent = "पासवर्ड ग़लत है।"; $("pw").select(); return; }
    try { sessionStorage.setItem("dk_admin", "1"); } catch(err){}
    S.log("login", "एडमिन लॉगिन");
    $("pw").value = ""; $("loginErr").textContent = "";
    showApp();
  });
  $("logout").addEventListener("click", function(){
    try { sessionStorage.removeItem("dk_admin"); } catch(err){}
    showApp();
  });

  /* ---------- sidebar + routing (#dashboard, #members, #donations, #media) ---------- */
  function setNav(open){
    $("app").classList.toggle("nav-open", open);
    $("scrim").hidden = !open;
    $("menuBtn").setAttribute("aria-expanded", open ? "true" : "false");
  }
  $("menuBtn").addEventListener("click", function(){ setNav(!$("app").classList.contains("nav-open")); });
  $("scrim").addEventListener("click", function(){ setNav(false); });
  document.addEventListener("keydown", function(e){ if(e.key === "Escape") setNav(false); });

  function current(){ var v = location.hash.slice(1); return VIEWS[v] ? v : "dashboard"; }
  function route(){
    if(!loggedIn()) return;
    var v = current();
    document.querySelectorAll(".view").forEach(function(s){ s.hidden = s.getAttribute("data-view") !== v; });
    document.querySelectorAll(".sb-nav a").forEach(function(a){
      var on = a.getAttribute("data-view") === v;
      a.classList.toggle("active", on);
      if(on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    $("viewTitle").textContent = VIEWS[v];
    document.title = VIEWS[v] + " — एडमिन · दीपांकर-कुंज";
    setNav(false);
    render();
  }
  window.addEventListener("hashchange", route);
  /* a membership submitted on the website in another tab shows up here immediately */
  window.addEventListener("storage", function(){ if(loggedIn()) render(); });

  function render(){
    var pending = S.list("members").filter(function(m){ return m.status === "pending"; }).length;
    $("pendingBadge").hidden = !pending; $("pendingBadge").textContent = pending;
    var unread = S.list("messages").filter(function(m){ return !m.read; }).length;
    $("unreadBadge").hidden = !unread; $("unreadBadge").textContent = unread;
    var openReq = S.list("requests").filter(function(r){ return r.status === "open"; }).length;
    $("dprBadge").hidden = !openReq; $("dprBadge").textContent = openReq;
    ({ dashboard: renderDashboard, members: renderMembers, donations: renderDonations, media: renderMedia,
       messages: renderMessages, notices: renderNotices, settings: renderSettings, privacy: renderPrivacy })[current()]();
  }

  /* ---------- dashboard ---------- */
  function renderDashboard(){
    var members = S.list("members"), donations = S.list("donations");
    var now = new Date(), ym = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
    var sum = function(arr, f){ return arr.reduce(function(t, r){ return t + (Number(r[f]) || 0); }, 0); };
    var cards = [
      ["कुल सदस्य", members.filter(function(m){ return m.status !== "rejected"; }).length, "var(--board)"],
      ["लंबित अनुरोध", members.filter(function(m){ return m.status === "pending"; }).length, "var(--rani)"],
      ["कुल दान", rupees(sum(donations, "amount")), "var(--leaf)"],
      ["इस महीने का दान", rupees(sum(donations.filter(function(d){ return (d.donated_on || "").slice(0, 7) === ym; }), "amount")), "var(--saffron)"]
    ];
    $("stats").innerHTML = cards.map(function(c){
      return '<div class="stat" style="--c:' + c[2] + '"><span>' + esc(c[0]) + "</span><b>" + esc(c[1]) + "</b></div>";
    }).join("");
    $("recentMembers").innerHTML = members.length ? members.slice(0, 5).map(function(m){
      return '<div class="mini-row"><div><b>' + esc(m.name) + "</b><small>" + esc(m.member_no) + " · " + esc(fmtDate(m.created_at)) +
        '</small></div><span class="status st-' + esc(m.status) + '">' + esc(STATUS[m.status]) + "</span></div>";
    }).join("") : '<p class="empty">अभी कोई अनुरोध नहीं। वेबसाइट के “सदस्य बनिए” फ़ॉर्म से अनुरोध यहाँ आएँगे।</p>';
    $("recentDonations").innerHTML = donations.length ? donations.slice(0, 5).map(function(d){
      return '<div class="mini-row"><div><b>' + esc(d.donor_name) + "</b><small>" + esc(d.receipt_no) + " · " + esc(fmtDate(d.donated_on)) +
        "</small></div><b>" + esc(rupees(d.amount)) + "</b></div>";
    }).join("") : '<p class="empty">अभी कोई दान दर्ज नहीं है।</p>';
  }

  /* ---------- members ---------- */
  $("mSearch").addEventListener("input", renderMembers);
  $("mStatus").addEventListener("change", renderMembers);
  function renderMembers(){
    var q = $("mSearch").value.trim().toLowerCase(), st = $("mStatus").value;
    var rows = S.list("members").filter(function(m){
      return (!st || m.status === st) && (!q || [m.name, m.phone, m.member_no, m.place].join(" ").toLowerCase().indexOf(q) !== -1);
    });
    var head = "<thead><tr><th>क्रमांक</th><th>नाम</th><th>मोबाइल</th><th>सदस्यता</th><th>स्थिति</th><th></th></tr></thead>";
    if(!rows.length){ $("mTable").innerHTML = head + '<tbody><tr><td colspan="6" class="empty">कोई सदस्य नहीं मिला।</td></tr></tbody>'; return; }
    $("mTable").innerHTML = head + "<tbody>" + rows.map(function(m){
      var opts = Object.keys(STATUS).map(function(k){
        return '<option value="' + k + '"' + (k === m.status ? " selected" : "") + ">" + STATUS[k] + "</option>";
      }).join("");
      return "<tr><td><b>" + esc(m.member_no) + '</b><span class="sub">' + esc(fmtDate(m.created_at)) + "</span></td>" +
        "<td>" + esc(m.name) + '<span class="sub">' + esc(m.place) + (m.message ? " · “" + esc(m.message) + "”" : "") + "</span>" +
          '<span class="sub">' + (m.consent ? "✓ सहमति " + esc(fmtDate(m.consent.at)) : "कार्यालय से जोड़ा — लिखित सहमति रखें") + "</span></td>" +
        '<td><a href="tel:+91' + esc(m.phone) + '">' + esc(m.phone) + "</a></td>" +
        "<td>" + esc(m.tier) + '<span class="sub">' + esc(rupees(m.amount)) + "</span></td>" +
        '<td><select data-status="' + esc(m.id) + '" aria-label="स्थिति बदलें">' + opts + "</select></td>" +
        '<td><div class="actions"><a class="btn btn-sm" target="_blank" rel="noopener" href="https://wa.me/91' + esc(m.phone) + '">WhatsApp</a>' +
        '<button type="button" class="btn btn-sm btn-danger" data-del-member="' + esc(m.id) + '">हटाएँ</button></div></td></tr>';
    }).join("") + "</tbody>";
  }
  $("mTable").addEventListener("change", function(e){
    var id = e.target.getAttribute("data-status");
    if(id){ S.update("members", id, { status: e.target.value }); S.log("update", "सदस्य स्थिति → " + e.target.value); toast("स्थिति बदल दी गई"); render(); }
  });
  $("mTable").addEventListener("click", function(e){
    var id = e.target.getAttribute("data-del-member");
    if(id && confirm("इस सदस्य को हटाना है? यह वापस नहीं आएगा।")){ S.remove("members", id); S.log("erase", "एक सदस्य हटाया"); toast("सदस्य हटा दिया गया"); render(); }
  });
  $("mAddBtn").addEventListener("click", function(){ $("mForm").hidden = false; $("mForm").elements.name.focus(); });
  $("mForm").addEventListener("submit", function(e){
    e.preventDefault();
    var f = e.target;
    if(!f.checkValidity()){ f.reportValidity(); return; }
    var no = S.submitMembership({ name: f.elements.name.value.trim(), phone: f.elements.phone.value.trim(), place: f.elements.place.value.trim(),
      tier: "कार्यालय से जोड़ा गया", amount: parseInt(f.elements.amount.value, 10), viaAdmin: true });
    if(!no){ toast("सेव नहीं हुआ — ब्राउज़र स्टोरेज भरा है"); return; }
    f.reset(); f.hidden = true; toast("सदस्य जोड़ा गया — " + no); render();
  });

  /* ---------- donations ---------- */
  $("dSearch").addEventListener("input", renderDonations);
  function renderDonations(){
    var q = $("dSearch").value.trim().toLowerCase();
    var rows = S.list("donations").filter(function(d){
      return !q || [d.donor_name, d.receipt_no, d.phone, d.purpose].join(" ").toLowerCase().indexOf(q) !== -1;
    });
    var head = "<thead><tr><th>रसीद</th><th>दाता</th><th>उद्देश्य</th><th>माध्यम</th><th style='text-align:right'>राशि</th><th></th></tr></thead>";
    if(!rows.length){ $("dTable").innerHTML = head + '<tbody><tr><td colspan="6" class="empty">कोई दान दर्ज नहीं है।</td></tr></tbody>'; return; }
    $("dTable").innerHTML = head + "<tbody>" + rows.map(function(d){
      return "<tr><td><b>" + esc(d.receipt_no) + '</b><span class="sub">' + esc(fmtDate(d.donated_on)) + "</span></td>" +
        "<td>" + esc(d.donor_name) + '<span class="sub">' + esc([d.phone, d.place].filter(Boolean).join(" · ")) + "</span></td>" +
        "<td>" + esc(d.purpose || "—") + "</td><td>" + esc(MODE[d.mode] || d.mode) + "</td>" +
        '<td class="num"><b>' + esc(rupees(d.amount)) + "</b></td>" +
        '<td><div class="actions"><button type="button" class="btn btn-sm" data-print="' + esc(d.id) + '">रसीद</button>' +
        '<button type="button" class="btn btn-sm btn-danger" data-del-donation="' + esc(d.id) + '">हटाएँ</button></div></td></tr>';
    }).join("") + "</tbody>";
  }
  $("dAddBtn").addEventListener("click", function(){
    var f = $("dForm"); f.hidden = false;
    f.elements.donated_on.value = today(); /* local date, not UTC */
    f.elements.donor_name.focus();
  });
  $("dForm").addEventListener("submit", function(e){
    e.preventDefault();
    var f = e.target;
    if(!f.checkValidity()){ f.reportValidity(); return; }
    var rec = S.add("donations", {
      receipt_no: S.newReceiptNo(), donor_name: f.elements.donor_name.value.trim(), phone: f.elements.phone.value.trim(),
      place: f.elements.place.value.trim(), amount: parseInt(f.elements.amount.value, 10), mode: f.elements.mode.value,
      donated_on: f.elements.donated_on.value, purpose: f.elements.purpose.value.trim()
    });
    if(!rec){ toast("सेव नहीं हुआ — ब्राउज़र स्टोरेज भरा है"); return; }
    f.reset(); f.hidden = true; toast("दान दर्ज हुआ — " + rec.receipt_no); render();
  });
  $("dTable").addEventListener("click", function(e){
    var del = e.target.getAttribute("data-del-donation"), pr = e.target.getAttribute("data-print");
    if(del && confirm("यह दान-प्रविष्टि हटानी है?")){ S.remove("donations", del); toast("प्रविष्टि हटा दी गई"); render(); }
    if(pr){ printReceipt(S.list("donations").filter(function(d){ return d.id === pr; })[0]); }
  });
  function printReceipt(d){
    if(!d) return;
    var w = window.open("", "_blank", "width=720,height=640");
    if(!w){ toast("पॉप-अप ब्लॉक है — इसे अनुमति दीजिए"); return; }
    var logo = new URL("../assets/logo.jpg", location.href).href;
    w.document.write('<!doctype html><html lang="hi"><head><meta charset="utf-8"><title>' + esc(d.receipt_no) + '</title>' +
      '<style>body{font-family:Mukta,system-ui,sans-serif;padding:40px;color:#1d1a16}.r{border:2px solid #1d1a16;padding:28px;max-width:560px;margin:auto}' +
      'h1{margin:6px 0 0;font-size:1.6rem}.c{text-align:center}.c img{width:70px;border-radius:50%}table{width:100%;margin-top:18px;border-collapse:collapse}' +
      'td{padding:8px 0;border-bottom:1px solid #ddd}td:first-child{color:#5d5646;width:40%}.sig{margin-top:48px;text-align:right}</style></head><body><div class="r">' +
      '<div class="c"><img src="' + esc(logo) + '" alt=""><h1>दीपांकर-कुंज [NGO]</h1><div>अमरपुर, बांका (बिहार) · पंजी. – 849, 2010-11</div><h2>दान रसीद</h2></div>' +
      "<table><tr><td>रसीद क्रमांक</td><td><b>" + esc(d.receipt_no) + "</b></td></tr><tr><td>दिनांक</td><td>" + esc(fmtDate(d.donated_on)) + "</td></tr>" +
      "<tr><td>दाता</td><td>" + esc(d.donor_name) + "</td></tr><tr><td>राशि</td><td><b>" + esc(rupees(d.amount)) + "</b></td></tr>" +
      "<tr><td>माध्यम</td><td>" + esc(MODE[d.mode] || d.mode) + "</td></tr><tr><td>उद्देश्य</td><td>" + esc(d.purpose || "—") + "</td></tr></table>" +
      '<p class="sig">हस्ताक्षर — सचिव, दीपांकर-कुंज</p></div><script>onload=function(){print()}<\/script></body></html>');
    w.document.close();
  }

  /* ---------- CSV export (UTF-8 BOM so Excel shows Hindi correctly) ---------- */
  function downloadCsv(name, cols, rows){
    if(!confirm("इस फ़ाइल में लोगों की निजी जानकारी होगी। इसे केवल संस्था के काम के लिए, सुरक्षित जगह रखिए और किसी से साझा मत कीजिए। डाउनलोड करें?")) return;
    S.log("export", name + " (" + rows.length + " पंक्तियाँ)");
    var cell = function(v){ v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var csv = "﻿" + [cols.map(function(c){ return cell(c[1]); }).join(",")].concat(rows.map(function(r){
      return cols.map(function(c){ return cell(r[c[0]]); }).join(",");
    })).join("\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = name + "-" + new Date().toISOString().slice(0, 10) + ".csv";
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
  }
  $("mExport").addEventListener("click", function(){
    downloadCsv("deepankar-kunj-members", [["member_no","क्रमांक"],["name","नाम"],["phone","मोबाइल"],["place","गाँव/शहर"],["tier","सदस्यता"],["amount","राशि"],["status","स्थिति"],["message","संदेश"],["created_at","दिनांक"]], S.list("members"));
  });
  $("dExport").addEventListener("click", function(){
    downloadCsv("deepankar-kunj-donations", [["receipt_no","रसीद"],["donated_on","दिनांक"],["donor_name","दाता"],["phone","मोबाइल"],["place","गाँव/शहर"],["amount","राशि"],["mode","माध्यम"],["purpose","उद्देश्य"]], S.list("donations"));
  });

  document.querySelectorAll("[data-cancel]").forEach(function(b){
    b.addEventListener("click", function(){ var f = b.closest("form"); f.reset(); f.hidden = true; });
  });

  /* ---------- media (gallery + press) ---------- */
  /* shrink to max 1400px JPEG so photos fit in localStorage (~5 MB total) */
  function toDataUrl(file){
    return new Promise(function(resolve, reject){
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function(){
        var scale = Math.min(1, 1400 / Math.max(img.width, img.height));
        var c = document.createElement("canvas");
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = function(){ URL.revokeObjectURL(url); reject(); };
      img.src = url;
    });
  }
  $("uForm").addEventListener("submit", function(e){
    e.preventDefault();
    var f = e.target, file = f.elements.file.files[0];
    $("uErr").textContent = "";
    if(!f.checkValidity()){ f.reportValidity(); return; }
    if(!/^image\/(jpeg|png|webp)$/.test(file.type)){ $("uErr").textContent = "केवल JPG, PNG या WebP तस्वीर चुनिए।"; return; }
    toDataUrl(file).then(function(dataUrl){
      var rec = S.add("media", { kind: f.elements.kind.value, image: dataUrl, caption: f.elements.caption.value.trim(),
        caption_en: f.elements.caption_en.value.trim(), published: true, sort: Date.now() });
      if(!rec){ $("uErr").textContent = "जगह नहीं बची — ब्राउज़र स्टोरेज भर गया है। पुरानी तस्वीरें हटाइए।"; return; }
      f.reset(); toast("तस्वीर जोड़ी गई — वेबसाइट पर दिख रही है"); render();
    }, function(){ $("uErr").textContent = "यह तस्वीर खुल नहीं पाई। दूसरी फ़ाइल चुनिए।"; });
  });
  function renderMedia(){
    var all = S.list("media");
    $("mediaGrid").innerHTML = all.length ? all.map(function(m){
      return '<div class="m-card' + (m.published ? "" : " off") + '"><img src="' + esc(m.image) + '" alt="' + esc(m.caption) + '" loading="lazy" />' +
        '<div class="m-body"><span class="m-cap">' + esc(m.caption) + '</span><span class="sub muted">' + (m.kind === "press" ? "अख़बार" : "गैलरी") +
        " · " + (m.published ? "वेबसाइट पर दिख रही" : "छिपी हुई") + "</span>" +
        '<div class="m-row"><button type="button" class="btn btn-sm" data-toggle="' + esc(m.id) + '">' + (m.published ? "छिपाएँ" : "दिखाएँ") + "</button>" +
        '<button type="button" class="btn btn-sm btn-danger" data-del-media="' + esc(m.id) + '">हटाएँ</button></div></div></div>';
    }).join("") : '<p class="empty">अभी कोई तस्वीर नहीं जोड़ी गई। वेबसाइट की मूल तस्वीरें अपनी जगह पर हैं — यहाँ से नई जोड़िए।</p>';
  }
  $("mediaGrid").addEventListener("click", function(e){
    var t = e.target.getAttribute("data-toggle"), d = e.target.getAttribute("data-del-media");
    if(t){
      var m = S.list("media").filter(function(x){ return x.id === t; })[0];
      if(m){ S.update("media", t, { published: !m.published }); toast(m.published ? "तस्वीर छिपा दी गई" : "तस्वीर वेबसाइट पर दिख रही है"); render(); }
    }
    if(d && confirm("यह तस्वीर हटानी है?")){ S.remove("media", d); toast("तस्वीर हटा दी गई"); render(); }
  });

  /* ---------- messages (website contact form) ---------- */
  $("cSearch").addEventListener("input", renderMessages);
  function renderMessages(){
    var q = $("cSearch").value.trim().toLowerCase();
    var rows = S.list("messages").filter(function(m){
      return !q || [m.name, m.phone, m.subject, m.message].join(" ").toLowerCase().indexOf(q) !== -1;
    });
    $("msgList").innerHTML = rows.length ? rows.map(function(m){
      return '<article class="panel msg' + (m.read ? "" : " unread") + '"><div class="msg-head"><div><b>' + esc(m.name) + "</b> " +
        '<span class="status st-' + (m.subject === "स्वयंसेवक" ? "approved" : "pending") + '">' + esc(m.subject) + "</span>" +
        '<span class="sub muted">' + esc(m.phone) + " · " + esc(fmtDate(m.created_at)) + "</span></div>" +
        '<div class="actions"><a class="btn btn-sm" target="_blank" rel="noopener" href="https://wa.me/91' + esc(m.phone) + '">WhatsApp</a>' +
        '<button type="button" class="btn btn-sm" data-read="' + esc(m.id) + '">' + (m.read ? "अपठित करें" : "पढ़ लिया") + "</button>" +
        '<button type="button" class="btn btn-sm btn-danger" data-del-msg="' + esc(m.id) + '">हटाएँ</button></div></div>' +
        '<p class="msg-body">' + esc(m.message) + "</p></article>";
    }).join("") : '<p class="empty panel">अभी कोई संदेश नहीं। वेबसाइट के “हमारे बारे में → संदेश भेजिए” फ़ॉर्म से संदेश यहाँ आएँगे।</p>';
  }
  $("msgList").addEventListener("click", function(e){
    var r = e.target.getAttribute("data-read"), d = e.target.getAttribute("data-del-msg");
    if(r){ var m = S.list("messages").filter(function(x){ return x.id === r; })[0]; if(m){ S.update("messages", r, { read: !m.read }); render(); } }
    if(d && confirm("यह संदेश हटाना है?")){ S.remove("messages", d); S.log("erase", "एक संदेश हटाया"); toast("संदेश हटा दिया गया"); render(); }
  });
  $("cExport").addEventListener("click", function(){
    downloadCsv("deepankar-kunj-messages", [["created_at","दिनांक"],["name","नाम"],["phone","मोबाइल"],["subject","विषय"],["message","संदेश"]], S.list("messages"));
  });

  /* ---------- notices ---------- */
  function renderNotices(){
    var rows = S.list("notices").slice().sort(function(a, b){ return (b.date || "").localeCompare(a.date || ""); });
    var head = "<thead><tr><th>दिनांक</th><th>सूचना</th><th>स्थिति</th><th></th></tr></thead>";
    if(!rows.length){ $("nTable").innerHTML = head + '<tbody><tr><td colspan="4" class="empty">अभी कोई सूचना नहीं।</td></tr></tbody>'; return; }
    $("nTable").innerHTML = head + "<tbody>" + rows.map(function(n){
      return "<tr><td><b>" + esc(fmtDate(n.date + "T00:00")) + "</b></td><td>" + esc(n.title) + '<span class="sub">' + esc(n.text) + "</span></td>" +
        '<td><span class="status ' + (n.published ? "st-paid" : "st-rejected") + '">' + (n.published ? "प्रकाशित" : "छिपी हुई") + "</span></td>" +
        '<td><div class="actions"><button type="button" class="btn btn-sm" data-ntoggle="' + esc(n.id) + '">' + (n.published ? "छिपाएँ" : "दिखाएँ") + "</button>" +
        '<button type="button" class="btn btn-sm btn-danger" data-del-notice="' + esc(n.id) + '">हटाएँ</button></div></td></tr>';
    }).join("") + "</tbody>";
  }
  function today(){ var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  $("nForm").elements.date.value = today();
  $("nForm").addEventListener("submit", function(e){
    e.preventDefault();
    var f = e.target;
    if(!f.checkValidity()){ f.reportValidity(); return; }
    var rec = S.add("notices", { title: f.elements.title.value.trim(), title_en: f.elements.title_en.value.trim(), date: f.elements.date.value,
      text: f.elements.text.value.trim(), text_en: f.elements.text_en.value.trim(), published: true });
    if(!rec){ toast("सेव नहीं हुआ — ब्राउज़र स्टोरेज भरा है"); return; }
    f.reset(); f.elements.date.value = today();
    toast("सूचना प्रकाशित — वेबसाइट पर दिख रही है"); render();
  });
  $("nTable").addEventListener("click", function(e){
    var t = e.target.getAttribute("data-ntoggle"), d = e.target.getAttribute("data-del-notice");
    if(t){ var n = S.list("notices").filter(function(x){ return x.id === t; })[0]; if(n){ S.update("notices", t, { published: !n.published }); render(); } }
    if(d && confirm("यह सूचना हटानी है?")){ S.remove("notices", d); toast("सूचना हटा दी गई"); render(); }
  });

  /* ---------- settings ---------- */
  var SOCIAL = ["instagram", "facebook", "youtube", "x"];
  function renderSettings(){
    var st = S.getSettings(), f = $("sForm");
    f.elements.announcement.value = st.announcement || "";
    SOCIAL.forEach(function(k){ f.elements[k].value = st[k] || ""; });
  }
  $("sForm").addEventListener("submit", function(e){
    e.preventDefault();
    var f = e.target, st = { announcement: f.elements.announcement.value.trim() };
    $("sErr").textContent = "";
    for(var i = 0; i < SOCIAL.length; i++){
      var v = f.elements[SOCIAL[i]].value.trim();
      if(v && !/^https:\/\/\S+\.\S+/.test(v)){ $("sErr").textContent = "लिंक https:// से शुरू होना चाहिए।"; f.elements[SOCIAL[i]].focus(); return; }
      st[SOCIAL[i]] = v;
    }
    toast(S.saveSettings(st) ? "सेटिंग्स सेव हो गईं — वेबसाइट रीफ़्रेश करके देखिए" : "सेव नहीं हुआ");
  });
  $("wipe").addEventListener("click", function(){
    if(!confirm("सारे सदस्य, दान, तस्वीरें, संदेश, सूचनाएँ, अनुरोध और सेटिंग्स मिट जाएँगी (कामकाज का लॉग नहीं)। पक्का?")) return;
    /* the processing log (dk_log) is kept on purpose — DPDP Rule 8(3) */
    ["dk_members","dk_donations","dk_media","dk_messages","dk_notices","dk_settings","dk_requests","dk_seq"].forEach(function(k){
      try { localStorage.removeItem(k); } catch(err){}
    });
    S.log("erase", "सारा डेमो डेटा मिटाया (लॉग सुरक्षित)");
    toast("डेमो डेटा मिटा दिया गया"); render();
  });

  /* ---------- DPDP: rights requests, lookup / erasure, retention, log ---------- */
  var DAY = 864e5;
  function renderPrivacy(){
    var reqs = S.list("requests");
    var head = "<thead><tr><th>क्रमांक</th><th>प्रकार</th><th>व्यक्ति</th><th>जवाब की अंतिम तिथि</th><th>स्थिति</th><th></th></tr></thead>";
    $("rTable").innerHTML = head + "<tbody>" + (reqs.length ? reqs.map(function(r){
      var due = new Date(new Date(r.created_at).getTime() + 30 * DAY), late = r.status === "open" && Date.now() > due;
      return "<tr><td><b>" + esc(r.ref) + '</b><span class="sub">' + esc(fmtDate(r.created_at)) + "</span></td>" +
        "<td>" + esc(r.type) + '<span class="sub">' + esc(r.details) + "</span></td>" +
        "<td>" + esc(r.name) + '<span class="sub">' + esc(r.phone) + "</span></td>" +
        "<td" + (late ? ' class="late"' : "") + ">" + esc(fmtDate(due)) + (late ? " — समय निकल गया" : "") + "</td>" +
        '<td><span class="status ' + (r.status === "open" ? "st-pending" : "st-paid") + '">' + (r.status === "open" ? "खुला" : "पूरा") + "</span></td>" +
        '<td><div class="actions"><button type="button" class="btn btn-sm" data-lookup="' + esc(r.phone) + '">डेटा</button>' +
        '<button type="button" class="btn btn-sm" data-rdone="' + esc(r.id) + '">' + (r.status === "open" ? "पूरा हुआ" : "फिर खोलें") + "</button></div></td></tr>";
    }).join("") : '<tr><td colspan="6" class="empty">कोई अनुरोध नहीं। वेबसाइट की गोपनीयता सूचना के नीचे के फ़ॉर्म से अनुरोध यहाँ आते हैं।</td></tr>') + "</tbody>";
    var logs = S.list("log").slice(0, 200);
    $("logTable").innerHTML = "<thead><tr><th>समय</th><th>काम</th><th>विवरण</th></tr></thead><tbody>" + (logs.length ? logs.map(function(l){
      return "<tr><td>" + esc(new Date(l.created_at).toLocaleString("hi-IN")) + "</td><td>" + esc(l.action) + "</td><td>" + esc(l.detail) + "</td></tr>";
    }).join("") : '<tr><td colspan="3" class="empty">अभी कोई प्रविष्टि नहीं।</td></tr>') + "</tbody>";
  }
  $("rTable").addEventListener("click", function(e){
    var ph = e.target.getAttribute("data-lookup"), dn = e.target.getAttribute("data-rdone");
    if(ph){ $("lookupForm").elements.phone.value = ph; showPerson(ph); $("lookupForm").scrollIntoView({ behavior: "smooth" }); }
    if(dn){
      var r = S.list("requests").filter(function(x){ return x.id === dn; })[0];
      if(r){ S.update("requests", dn, { status: r.status === "open" ? "done" : "open", closed_at: new Date().toISOString() });
        S.log("request", r.ref + (r.status === "open" ? " पूरा किया" : " फिर खोला")); render(); }
    }
  });
  function showPerson(phone){
    var pick = function(k){ return S.list(k).filter(function(r){ return r.phone === phone; }); };
    var m = pick("members"), c = pick("messages"), d = pick("donations"), q = pick("requests");
    S.log("access", "मोबाइल …" + phone.slice(-4) + " का डेटा देखा");
    var block = function(title, rows, fmt){
      return "<h3>" + esc(title) + " (" + rows.length + ")</h3>" + (rows.length ? "<ul>" + rows.map(function(r){ return "<li>" + fmt(r) + "</li>"; }).join("") + "</ul>" : '<p class="muted">कुछ नहीं</p>');
    };
    $("lookupOut").innerHTML = '<div class="person">' +
      block("सदस्यता", m, function(r){ return esc(r.member_no) + " · " + esc(r.name) + " · " + esc(r.place) + " · " + esc(rupees(r.amount)) + " · " + esc(STATUS[r.status]) + (r.consent ? " · सहमति " + esc(fmtDate(r.consent.at)) : ""); }) +
      block("संदेश", c, function(r){ return esc(fmtDate(r.created_at)) + " · " + esc(r.subject) + " · “" + esc(r.message) + "”"; }) +
      block("दान (क़ानूनन रखा जाता है)", d, function(r){ return esc(r.receipt_no) + " · " + esc(r.donor_name) + " · " + esc(rupees(r.amount)); }) +
      block("अधिकार अनुरोध", q, function(r){ return esc(r.ref) + " · " + esc(r.type); }) +
      ((m.length || c.length) ? '<div class="form-actions"><button type="button" class="btn btn-danger" data-erase="' + esc(phone) + '">सदस्यता व संदेश मिटाएँ</button></div>' : "") +
      "</div>";
  }
  $("lookupForm").addEventListener("submit", function(e){
    e.preventDefault();
    var f = e.target;
    if(!f.checkValidity()){ f.reportValidity(); return; }
    showPerson(f.elements.phone.value.trim());
  });
  $("lookupOut").addEventListener("click", function(e){
    var ph = e.target.getAttribute("data-erase");
    if(!ph || !confirm("मोबाइल " + ph + " की सारी सदस्यता और संदेश हमेशा के लिए मिट जाएँगे। (व्यक्ति के कहे बिना मिटा रहे हैं तो उसे 48 घंटे पहले सूचित करें।) आगे बढ़ें?")) return;
    var n = S.eraseByPhone(ph);
    toast(n.members + " सदस्यता, " + n.messages + " संदेश मिटाए गए");
    showPerson(ph); render();
  });
  $("purgeOld").addEventListener("click", function(){
    var cutoff = Date.now() - 365 * DAY, old = function(r, f){ return new Date(r[f] || r.created_at).getTime() < cutoff; };
    var msgs = S.list("messages").filter(function(m){ return m.read && old(m, "created_at"); });
    var reqs = S.list("requests").filter(function(r){ return r.status !== "open" && old(r, "closed_at"); });
    if(!msgs.length && !reqs.length){ toast("1 वर्ष से पुराना कोई रिकॉर्ड नहीं"); return; }
    if(!confirm(msgs.length + " संदेश और " + reqs.length + " पूरे अनुरोध मिटाए जाएँगे। आगे बढ़ें?")) return;
    msgs.forEach(function(m){ S.remove("messages", m.id); });
    reqs.forEach(function(r){ S.remove("requests", r.id); });
    S.log("erase", "रिटेंशन: " + msgs.length + " संदेश, " + reqs.length + " अनुरोध (1 वर्ष से पुराने)");
    toast("पुराने रिकॉर्ड मिटा दिए गए"); render();
  });
  $("logExport").addEventListener("click", function(){
    downloadCsv("deepankar-kunj-processing-log", [["created_at","समय"],["action","काम"],["detail","विवरण"]], S.list("log"));
  });

  showApp();
})();
