/* Deepankar-Kunj admin panel — live version on Supabase.
   Login: Supabase Auth (email + password); only emails in the `admins` table get any data —
   that rule is enforced by Row Level Security in the database, not by this file.
   Data: js/store.js keeps an in-memory copy (loadAll) that every save refreshes. */
(function(){
  "use strict";
  var S = window.DK_STORE, sb = S.client;
  var $ = function(id){ return document.getElementById(id); };

  var STATUS = { pending: "लंबित", approved: "स्वीकृत", paid: "भुगतान प्राप्त", rejected: "अस्वीकृत" };
  var MODE = { cash: "नकद", upi: "UPI", bank: "बैंक ट्रांसफ़र", cheque: "चेक", other: "अन्य" };
  var VIEWS = { dashboard: "डैशबोर्ड", members: "सदस्य", donations: "दान", connect: "सदस्य-संपर्क", media: "गैलरी व अख़बार",
                messages: "संदेश", notices: "सूचनाएँ", settings: "सेटिंग्स", privacy: "डेटा अनुरोध (DPDP)" };
  var authed = false, visitsTotal = null;

  function esc(v){
    return String(v == null ? "" : v).replace(/[&<>"']/g, function(c){
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function rupees(n){ return "₹" + Number(n || 0).toLocaleString("en-IN"); }
  function fmtDate(iso){
    if(!iso) return "";
    var d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + "T00:00" : iso);
    return isNaN(d) ? "" : d.toLocaleDateString("hi-IN", { day: "numeric", month: "short", year: "numeric" });
  }
  function today(){ var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function first(w){ return window.Intl && Intl.Segmenter ? new Intl.Segmenter("hi", { granularity: "grapheme" }).segment(w)[Symbol.iterator]().next().value.segment : Array.from(w)[0]; }
  function initials(name){ var p = String(name || "").trim().split(/\s+/); return (p[0] ? first(p[0]) : "") + (p.length > 1 ? first(p[p.length - 1]) : ""); }
  function byId(kind, id){ return S.list(kind).filter(function(r){ return r.id === id; })[0]; }
  function memberName(id){ var m = byId("members", id); return m ? m.name + " (" + m.member_no + ")" : "—"; }

  var toastTimer;
  function toast(msg, bad){
    var t = $("toast"); t.textContent = msg; t.classList.toggle("bad", !!bad); t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function(){ t.classList.remove("show"); }, 3200);
  }
  /* database errors → plain Hindi */
  function fail(e){
    var m = (e && (e.message || e.error_description)) || "";
    var map = [[/already paid/, "यह सदस्य पहले से भुगतान-प्राप्त है"], [/not allowed|permission|row-level/i, "इस काम की अनुमति नहीं है"],
               [/membership not active/, "पहले सदस्यता स्वीकृत कीजिए"], [/Failed to fetch|NetworkError/i, "इंटरनेट कनेक्शन जाँचिए"]];
    for(var i = 0; i < map.length; i++) if(map[i][0].test(m)) { toast(map[i][1], true); return; }
    toast("सेव नहीं हुआ" + (m ? " — " + m : ""), true);
  }
  function busy(on){ $("syncState").textContent = on ? "सिंक हो रहा है…" : "लाइव डेटाबेस"; $("syncState").classList.toggle("busy", on); }
  function reload(){
    busy(true);
    return Promise.all([S.loadAll(), S.rpc("visit_total").then(function(n){ visitsTotal = Number(n) || 0; }, function(){})])
      .then(function(){ busy(false); render(); }, function(e){ busy(false); fail(e); });
  }
  /* run a save, then refresh everything (keeps cards, ledger and badges consistent) */
  function save(promise, okMsg){
    return promise.then(function(r){ if(okMsg) toast(typeof okMsg === "function" ? okMsg(r) : okMsg); return reload().then(function(){ return r; }); }, function(e){ fail(e); throw e; });
  }

  /* ---------- login (Supabase Auth) ---------- */
  function showLogin(msg){
    authed = false; $("login").hidden = false; $("app").hidden = true;
    $("loginErr").textContent = msg || ""; $("email").focus();
  }
  function enter(){
    return S.rpc("is_admin").then(function(isAdmin){
      if(!isAdmin){ return sb.auth.signOut().then(function(){ showLogin("यह ईमेल एडमिन सूची में नहीं है।"); }); }
      authed = true; $("login").hidden = true; $("app").hidden = false;
      route(); return reload();
    });
  }
  $("loginForm").addEventListener("submit", function(e){
    e.preventDefault();
    var email = $("email").value.trim().toLowerCase(), pw = $("pw").value;
    if(!email || !pw){ $("loginErr").textContent = "ईमेल और पासवर्ड दोनों लिखिए।"; return; }
    $("loginBtn").disabled = true; $("loginErr").textContent = "";
    sb.auth.signInWithPassword({ email: email, password: pw }).then(function(res){
      $("loginBtn").disabled = false;
      if(res.error){ $("loginErr").textContent = /Invalid login/i.test(res.error.message) ? "ईमेल या पासवर्ड ग़लत है।" : res.error.message; $("pw").select(); return; }
      $("pw").value = "";
      S.log("login", "एडमिन लॉगिन");
      return enter();
    }, function(){ $("loginBtn").disabled = false; $("loginErr").textContent = "इंटरनेट कनेक्शन जाँचिए।"; });
  });
  $("logout").addEventListener("click", function(){ sb.auth.signOut().then(function(){ showLogin(); }); });
  $("refreshBtn").addEventListener("click", reload);

  /* ---------- sidebar + routing ---------- */
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
    if(!authed) return;
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
  /* pick up new website submissions when the admin comes back to the tab */
  document.addEventListener("visibilitychange", function(){ if(authed && !document.hidden) reload(); });

  function render(){
    if(!authed) return;
    var pending = S.list("members").filter(function(m){ return m.status === "pending"; }).length;
    $("pendingBadge").hidden = !pending; $("pendingBadge").textContent = pending;
    var unread = S.list("messages").filter(function(m){ return !m.read; }).length;
    $("unreadBadge").hidden = !unread; $("unreadBadge").textContent = unread;
    var openReq = S.list("requests").filter(function(r){ return r.status === "open"; }).length;
    $("dprBadge").hidden = !openReq; $("dprBadge").textContent = openReq;
    ({ dashboard: renderDashboard, members: renderMembers, donations: renderDonations, connect: renderConnect, media: renderMedia,
       messages: renderMessages, notices: renderNotices, settings: renderSettings, privacy: renderPrivacy })[current()]();
  }

  /* ---------- dashboard ---------- */
  function sum(arr, f){ return arr.reduce(function(t, r){ return t + (Number(r[f]) || 0); }, 0); }
  function renderDashboard(){
    var members = S.list("members"), donations = S.list("donations");
    var ym = today().slice(0, 7);
    var due = members.filter(function(m){ return m.status === "pending" || m.status === "approved"; });
    var cards = [
      ["कुल सदस्य", members.filter(function(m){ return m.status !== "rejected"; }).length, "var(--board)"],
      ["भुगतान-प्राप्त सदस्य", members.filter(function(m){ return m.status === "paid"; }).length, "var(--leaf)"],
      ["लंबित अनुरोध", members.filter(function(m){ return m.status === "pending"; }).length, "var(--rani)"],
      ["बकाया संकल्प राशि", rupees(sum(due, "amount")), "var(--saffron)"],
      ["कुल प्राप्त राशि", rupees(sum(donations, "amount")), "var(--leaf)"],
      ["इस महीने प्राप्त", rupees(sum(donations.filter(function(d){ return (d.donated_on || "").slice(0, 7) === ym; }), "amount")), "var(--board)"],
      ["पोर्टल पर सक्रिय", members.filter(function(m){ return m.user_id; }).length, "var(--rani)"],
      ["वेबसाइट आगंतुक", visitsTotal == null ? "—" : visitsTotal.toLocaleString("en-IN"), "var(--saffron)"]
    ];
    $("stats").innerHTML = cards.map(function(c){
      return '<div class="stat" style="--c:' + c[2] + '"><span>' + esc(c[0]) + "</span><b>" + esc(c[1]) + "</b></div>";
    }).join("");
    $("recentMembers").innerHTML = members.length ? members.slice(0, 6).map(function(m){
      return '<div class="mini-row"><div><b>' + esc(m.name) + "</b><small>" + esc(m.member_no) + " · " + esc(rupees(m.amount)) + " · " + esc(fmtDate(m.created_at)) +
        '</small></div><span class="status st-' + esc(m.status) + '">' + esc(STATUS[m.status]) + "</span></div>";
    }).join("") : '<p class="empty">अभी कोई अनुरोध नहीं। वेबसाइट के “सदस्य बनिए” फ़ॉर्म से अनुरोध यहाँ आएँगे।</p>';
    $("recentDonations").innerHTML = donations.length ? donations.slice(0, 6).map(function(d){
      return '<div class="mini-row"><div><b>' + esc(d.donor_name) + "</b><small>" + esc(d.receipt_no) + " · " + esc(MODE[d.mode] || d.mode) + " · " + esc(fmtDate(d.donated_on)) +
        "</small></div><b>" + esc(rupees(d.amount)) + "</b></div>";
    }).join("") : '<p class="empty">अभी कोई राशि दर्ज नहीं है।</p>';
  }

  /* ---------- members (cards) ---------- */
  ["mSearch", "mStatus", "mSort"].forEach(function(id){ $(id).addEventListener(id === "mSearch" ? "input" : "change", renderMembers); });
  function renderMembers(){
    var q = $("mSearch").value.trim().toLowerCase(), st = $("mStatus").value, sort = $("mSort").value;
    var rows = S.list("members").filter(function(m){
      return (!st || m.status === st) && (!q || [m.name, m.phone, m.member_no, m.place].join(" ").toLowerCase().indexOf(q) !== -1);
    }).slice();
    rows.sort({
      new: function(a, b){ return b.created_at.localeCompare(a.created_at); },
      old: function(a, b){ return a.created_at.localeCompare(b.created_at); },
      amount: function(a, b){ return b.amount - a.amount; },
      name: function(a, b){ return a.name.localeCompare(b.name, "hi"); }
    }[sort]);
    $("mCount").textContent = rows.length + " सदस्य · कुल संकल्प " + rupees(sum(rows, "amount")) + " · प्राप्त " + rupees(sum(rows, "paid_amount"));
    if(!rows.length){ $("mGrid").innerHTML = '<p class="empty panel">कोई सदस्य नहीं मिला।</p>'; return; }
    $("mGrid").innerHTML = rows.map(function(m){
      var paid = m.status === "paid", active = paid || m.status === "approved";
      var opts = ["pending", "approved", "rejected"].map(function(k){
        return '<option value="' + k + '"' + (k === m.status ? " selected" : "") + ">" + STATUS[k] + "</option>";
      }).join("");
      var pay = paid
        ? '<span class="ok">' + esc(rupees(m.paid_amount)) + " · " + esc(MODE[m.payment_mode] || m.payment_mode || "") + " · " + esc(fmtDate(m.paid_at)) + (m.payment_ref ? " · " + esc(m.payment_ref) : "") + "</span>"
        : '<span class="due">' + esc(rupees(m.amount)) + " बकाया</span>";
      var portal = m.user_id ? '<span class="ok">सक्रिय</span>' : (m.activation_code ? "कोड जारी — सक्रिय होना बाकी" : "—");
      return '<article class="mcard is-' + esc(m.status) + '">' +
        '<header><span class="avatar" aria-hidden="true">' + esc(initials(m.name)) + "</span>" +
          "<div><h3>" + esc(m.name) + "</h3><small>" + esc(m.member_no) + " · " + esc(fmtDate(m.created_at)) + (m.source === "office" ? " · कार्यालय" : "") + "</small></div>" +
          '<span class="status st-' + esc(m.status) + '">' + esc(STATUS[m.status]) + "</span></header>" +
        "<dl>" +
          '<dt>मोबाइल</dt><dd><a href="tel:+91' + esc(m.phone) + '">' + esc(m.phone) + "</a></dd>" +
          "<dt>स्थान</dt><dd>" + esc(m.place || "—") + "</dd>" +
          "<dt>श्रेणी</dt><dd>" + esc(m.tier || "—") + "</dd>" +
          "<dt>भुगतान</dt><dd>" + pay + "</dd>" +
          "<dt>पोर्टल</dt><dd>" + portal + "</dd>" +
          "<dt>सहमति</dt><dd>" + (m.consent_at ? "✓ " + esc(fmtDate(m.consent_at)) : "कार्यालय से — लिखित सहमति रखें") + "</dd>" +
        "</dl>" +
        (m.message ? '<p class="quote">“' + esc(m.message) + "”</p>" : "") +
        '<footer class="mc-actions">' +
          (paid ? '<button type="button" class="btn btn-sm" data-act="unpay" data-id="' + esc(m.id) + '">भुगतान रद्द</button>'
                : '<button type="button" class="btn btn-sm btn-primary" data-act="pay" data-id="' + esc(m.id) + '">भुगतान दर्ज</button>') +
          (paid ? "" : '<select data-act="status" data-id="' + esc(m.id) + '" aria-label="स्थिति बदलें">' + opts + "</select>") +
          '<button type="button" class="btn btn-sm" data-act="card" data-id="' + esc(m.id) + '">कार्ड</button>' +
          (active ? '<button type="button" class="btn btn-sm" data-act="code" data-id="' + esc(m.id) + '">' + (m.user_id ? "पासवर्ड रीसेट कोड" : "लॉगिन कोड") + "</button>" : "") +
          '<a class="btn btn-sm" target="_blank" rel="noopener" href="https://wa.me/91' + esc(m.phone) + '">WhatsApp</a>' +
          '<button type="button" class="btn btn-sm btn-danger" data-act="del" data-id="' + esc(m.id) + '">हटाएँ</button>' +
        "</footer></article>";
    }).join("");
  }
  $("mGrid").addEventListener("change", function(e){
    if(e.target.getAttribute("data-act") !== "status") return;
    var id = e.target.getAttribute("data-id"), v = e.target.value, m = byId("members", id);
    save(S.update("members", id, { status: v, updated_at: new Date().toISOString() }), "स्थिति: " + STATUS[v])
      .then(function(){ S.log("update", m.member_no + " स्थिति → " + v); }, function(){});
  });
  $("mGrid").addEventListener("click", function(e){
    var b = e.target.closest("[data-act]"); if(!b || b.tagName === "SELECT") return;
    var id = b.getAttribute("data-id"), m = byId("members", id), act = b.getAttribute("data-act");
    if(!m) return;
    if(act === "pay") openPay(m);
    if(act === "unpay" && confirm(m.member_no + " का भुगतान रद्द करना है? दान-रजिस्टर की उसकी प्रविष्टि भी हट जाएगी.")){
      save(S.rpc("unmark_member_paid", { p_member: id }), "भुगतान रद्द किया गया").catch(function(){});
    }
    if(act === "card") openCard(m);
    if(act === "code") issueCode(m);
    if(act === "del" && confirm(m.name + " (" + m.member_no + ") को हटाना है? यह वापस नहीं आएगा। (दान-रजिस्टर की प्रविष्टि बनी रहेगी)")){
      save(S.remove("members", id), "सदस्य हटा दिया गया").then(function(){ S.log("erase", m.member_no + " सदस्य हटाया"); }, function(){});
    }
  });
  $("mAddBtn").addEventListener("click", function(){ $("mForm").hidden = false; $("mForm").elements.name.focus(); });
  $("mForm").addEventListener("submit", function(e){
    e.preventDefault();
    var f = e.target;
    if(!f.checkValidity()){ f.reportValidity(); return; }
    save(S.rpc("admin_add_member", { p_name: f.elements.name.value.trim(), p_phone: f.elements.phone.value.trim(),
      p_place: f.elements.place.value.trim(), p_amount: parseInt(f.elements.amount.value, 10), p_tier: "कार्यालय से जोड़ा गया" }),
      function(no){ return "सदस्य जोड़ा गया — " + no; })
      .then(function(){ f.reset(); f.hidden = true; }, function(){});
  });

  /* dialogs */
  document.querySelectorAll("dialog [data-close]").forEach(function(b){ b.addEventListener("click", function(){ b.closest("dialog").close(); }); });
  var payFor = null;
  function openPay(m){
    payFor = m;
    var f = $("payForm"); f.reset();
    f.elements.amount.value = m.amount; f.elements.date.value = today(); f.elements.mode.value = "upi";
    $("payWho").textContent = m.name + " · " + m.member_no + " · संकल्प " + rupees(m.amount);
    $("payErr").textContent = "";
    $("payDlg").showModal(); f.elements.amount.focus();
  }
  $("payForm").addEventListener("submit", function(e){
    e.preventDefault();
    var f = e.target, amt = parseInt(f.elements.amount.value, 10);
    if(!(amt >= 1) || !f.elements.date.value){ $("payErr").textContent = "राशि और दिनांक सही भरिए।"; return; }
    var btn = f.querySelector('[type="submit"]'); btn.disabled = true;
    save(S.rpc("mark_member_paid", { p_member: payFor.id, p_amount: amt, p_mode: f.elements.mode.value,
      p_ref: f.elements.ref.value.trim(), p_date: f.elements.date.value }),
      function(no){ return "भुगतान दर्ज — रसीद " + no; })
      .then(function(){ btn.disabled = false; $("payDlg").close(); }, function(){ btn.disabled = false; });
  });
  var cardFor = null;
  function openCard(m){
    cardFor = m; $("cardPreview").innerHTML = '<p class="muted">कार्ड बन रहा है…</p>';
    $("cardDlg").showModal();
    DK_CARD.make(m, "../").then(function(c){ $("cardPreview").textContent = ""; $("cardPreview").appendChild(c); });
  }
  $("cardDl").addEventListener("click", function(){ if(cardFor) DK_CARD.download(cardFor, "../"); });
  function issueCode(m){
    if(m.user_id && !confirm(m.name + " का पोर्टल पहले से सक्रिय है। नया कोड देने पर पुराना पासवर्ड बंद हो जाएगा और सदस्य को नया पासवर्ड बनाना होगा। आगे बढ़ें?")) return;
    save(S.rpc("admin_issue_code", { p_member: m.id })).then(function(code){
      var url = new URL("../member/", location.href).href;
      $("codeVal").textContent = code;
      $("codeHelp").textContent = "सदस्य " + url + " खोलें → “पहली बार / नया पासवर्ड” → सदस्य क्रमांक " + m.member_no + " और यह कोड डालकर अपना पासवर्ड बनाएँ।";
      $("codeWa").href = "https://wa.me/91" + m.phone + "?text=" + encodeURIComponent(
        "नमस्ते " + m.name + " जी,\nदीपांकर-कुंज सदस्य-पोर्टल के लिए आपका विवरण:\nसदस्य क्रमांक: " + m.member_no + "\nलॉगिन कोड: " + code +
        "\n\n" + url + " खोलें → “पहली बार / नया पासवर्ड” चुनें और अपना पासवर्ड बनाएँ।\nयह कोड किसी से साझा न करें।");
      $("codeDlg").showModal();
    }, function(){});
  }

  /* ---------- donations ---------- */
  $("dSearch").addEventListener("input", renderDonations);
  function renderDonations(){
    var q = $("dSearch").value.trim().toLowerCase();
    var rows = S.list("donations").filter(function(d){
      return !q || [d.donor_name, d.receipt_no, d.phone, d.purpose, d.payment_ref].join(" ").toLowerCase().indexOf(q) !== -1;
    });
    var head = "<thead><tr><th>रसीद</th><th>दाता</th><th>उद्देश्य</th><th>माध्यम</th><th style='text-align:right'>राशि</th><th></th></tr></thead>";
    if(!rows.length){ $("dTable").innerHTML = head + '<tbody><tr><td colspan="6" class="empty">कोई दान दर्ज नहीं है।</td></tr></tbody>'; return; }
    $("dTable").innerHTML = head + "<tbody>" + rows.map(function(d){
      return "<tr><td><b>" + esc(d.receipt_no) + '</b><span class="sub">' + esc(fmtDate(d.donated_on)) + "</span></td>" +
        "<td>" + esc(d.donor_name) + '<span class="sub">' + esc([d.phone, d.place].filter(Boolean).join(" · ")) + "</span></td>" +
        "<td>" + esc(d.purpose || "—") + (d.member_id ? '<span class="sub">सदस्यता शुल्क</span>' : "") + "</td>" +
        "<td>" + esc(MODE[d.mode] || d.mode) + (d.payment_ref ? '<span class="sub">' + esc(d.payment_ref) + "</span>" : "") + "</td>" +
        '<td class="num"><b>' + esc(rupees(d.amount)) + "</b></td>" +
        '<td><div class="actions"><button type="button" class="btn btn-sm" data-print="' + esc(d.id) + '">रसीद</button>' +
        (d.member_id ? "" : '<button type="button" class="btn btn-sm btn-danger" data-del-donation="' + esc(d.id) + '">हटाएँ</button>') + "</div></td></tr>";
    }).join("") + "</tbody>";
  }
  $("dAddBtn").addEventListener("click", function(){
    var f = $("dForm"); f.hidden = false;
    f.elements.donated_on.value = today();
    f.elements.donor_name.focus();
  });
  $("dForm").addEventListener("submit", function(e){
    e.preventDefault();
    var f = e.target;
    if(!f.checkValidity()){ f.reportValidity(); return; }
    save(S.rpc("add_donation", { p_name: f.elements.donor_name.value.trim(), p_phone: f.elements.phone.value.trim(),
      p_place: f.elements.place.value.trim(), p_amount: parseInt(f.elements.amount.value, 10), p_mode: f.elements.mode.value,
      p_ref: f.elements.payment_ref.value.trim(), p_date: f.elements.donated_on.value, p_purpose: f.elements.purpose.value.trim() }),
      function(no){ return "दान दर्ज हुआ — " + no; })
      .then(function(){ f.reset(); f.hidden = true; }, function(){});
  });
  $("dTable").addEventListener("click", function(e){
    var del = e.target.getAttribute("data-del-donation"), pr = e.target.getAttribute("data-print");
    if(del && confirm("यह दान-प्रविष्टि हटानी है?")) save(S.remove("donations", del), "प्रविष्टि हटा दी गई").then(function(){ S.log("erase", "एक दान-प्रविष्टि हटाई"); }, function(){});
    if(pr) printReceipt(byId("donations", pr));
  });
  function printReceipt(d){
    if(!d) return;
    var w = window.open("", "_blank", "width=720,height=640");
    if(!w){ toast("पॉप-अप ब्लॉक है — इसे अनुमति दीजिए", true); return; }
    var logo = new URL("../assets/logo.jpg", location.href).href;
    w.document.write('<!doctype html><html lang="hi"><head><meta charset="utf-8"><title>' + esc(d.receipt_no) + '</title>' +
      '<style>body{font-family:Mukta,system-ui,sans-serif;padding:40px;color:#1d1a16}.r{border:2px solid #1e40c9;padding:28px;max-width:560px;margin:auto}' +
      'h1{margin:6px 0 0;font-size:1.6rem}.c{text-align:center}.c img{width:70px;border-radius:50%}table{width:100%;margin-top:18px;border-collapse:collapse}' +
      'td{padding:8px 0;border-bottom:1px dotted #b9b0a0}td:first-child{color:#5d5646;width:40%}.sig{margin-top:48px;text-align:right}</style></head><body><div class="r">' +
      '<div class="c"><img src="' + esc(logo) + '" alt=""><h1>दीपांकर-कुंज [NGO]</h1><div>सोसाइटीज़ रजिस्ट्रेशन एक्ट 21, 1860 · पंजी. – 849 · वर्ष – 2010-11</div><div>अमरपुर, बांका (बिहार) – 813101</div><h2>दान रसीद</h2></div>' +
      "<table><tr><td>रसीद क्रमांक</td><td><b>" + esc(d.receipt_no) + "</b></td></tr><tr><td>दिनांक</td><td>" + esc(fmtDate(d.donated_on)) + "</td></tr>" +
      "<tr><td>दाता</td><td>" + esc(d.donor_name) + "</td></tr><tr><td>राशि</td><td><b>" + esc(rupees(d.amount)) + "</b></td></tr>" +
      "<tr><td>माध्यम</td><td>" + esc(MODE[d.mode] || d.mode) + (d.payment_ref ? " · " + esc(d.payment_ref) : "") + "</td></tr><tr><td>उद्देश्य</td><td>" + esc(d.purpose || "—") + "</td></tr></table>" +
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
    a.download = name + "-" + today() + ".csv";
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
  }
  $("mExport").addEventListener("click", function(){
    downloadCsv("deepankar-kunj-members", [["member_no","क्रमांक"],["name","नाम"],["phone","मोबाइल"],["place","गाँव/शहर"],["tier","सदस्यता"],["amount","संकल्प राशि"],
      ["status","स्थिति"],["paid_amount","प्राप्त राशि"],["payment_mode","माध्यम"],["payment_ref","लेन-देन"],["paid_at","भुगतान दिनांक"],["message","संदेश"],["created_at","दिनांक"]], S.list("members"));
  });
  $("dExport").addEventListener("click", function(){
    downloadCsv("deepankar-kunj-donations", [["receipt_no","रसीद"],["donated_on","दिनांक"],["donor_name","दाता"],["phone","मोबाइल"],["place","गाँव/शहर"],
      ["amount","राशि"],["mode","माध्यम"],["payment_ref","लेन-देन"],["purpose","उद्देश्य"]], S.list("donations"));
  });
  document.querySelectorAll("form [data-cancel]").forEach(function(b){
    b.addEventListener("click", function(){ var f = b.closest("form"); f.reset(); f.hidden = true; });
  });

  /* ---------- सदस्य-संपर्क: notifications, tasks, achievements ---------- */
  function fillMemberSelects(){
    var active = S.list("members").filter(function(m){ return m.status === "approved" || m.status === "paid"; })
      .sort(function(a, b){ return a.name.localeCompare(b.name, "hi"); });
    var opts = active.map(function(m){ return '<option value="' + esc(m.id) + '">' + esc(m.name) + " — " + esc(m.member_no) + "</option>"; }).join("");
    document.querySelectorAll("[data-member-select]").forEach(function(sel){
      var keep = sel.value;
      sel.innerHTML = (sel.getAttribute("data-member-select") === "all" ? '<option value="">सभी सक्रिय सदस्य (' + active.length + ")</option>" : '<option value="">— सदस्य चुनिए —</option>') + opts;
      sel.value = keep;
    });
  }
  function miniList(rows, fmt, kind){
    return rows.length ? rows.slice(0, 40).map(function(r){
      return '<div class="mini-row"><div>' + fmt(r) + '</div><button type="button" class="btn btn-sm btn-danger" data-del-kind="' + kind + '" data-id="' + esc(r.id) + '" aria-label="हटाएँ">×</button></div>';
    }).join("") : '<p class="empty">अभी कुछ नहीं।</p>';
  }
  function renderConnect(){
    fillMemberSelects();
    $("ntList").innerHTML = miniList(S.list("notifications"), function(n){
      return "<b>" + esc(n.title) + "</b><small>" + (n.member_id ? esc(memberName(n.member_id)) : "सभी सदस्य") + " · " + esc(fmtDate(n.created_at)) + "</small>";
    }, "notifications");
    $("tkList").innerHTML = miniList(S.list("tasks"), function(t){
      return "<b>" + esc(t.title) + "</b><small>" + esc(memberName(t.member_id)) + (t.due_on ? " · " + esc(fmtDate(t.due_on)) + " तक" : "") + "</small>" +
        '<span class="status ' + (t.status === "done" ? "st-paid" : "st-pending") + '">' + (t.status === "done" ? "पूरा" : "बाकी") + "</span>";
    }, "tasks");
    $("acList").innerHTML = miniList(S.list("achievements"), function(a){
      return "<b>" + esc(a.title) + "</b><small>" + esc(memberName(a.member_id)) + " · " + esc(fmtDate(a.awarded_on)) + "</small>";
    }, "achievements");
  }
  $("ntForm").addEventListener("submit", function(e){
    e.preventDefault(); var f = e.target;
    if(!f.checkValidity()){ f.reportValidity(); return; }
    save(S.add("notifications", { member_id: f.elements.member_id.value || null, title: f.elements.title.value.trim(), body: f.elements.body.value.trim() }),
      "सूचना भेज दी गई").then(function(){ f.reset(); }, function(){});
  });
  $("tkForm").addEventListener("submit", function(e){
    e.preventDefault(); var f = e.target;
    if(!f.checkValidity()){ f.reportValidity(); return; }
    var who = f.elements.member_id.value, title = f.elements.title.value.trim(), details = f.elements.details.value.trim(), due = f.elements.due_on.value || null;
    var p = who ? S.add("tasks", { member_id: who, title: title, details: details, due_on: due })
                : S.rpc("admin_task_all", { p_title: title, p_details: details, p_due: due });
    save(p, function(n){ return who ? "कार्य सौंपा गया" : n + " सदस्यों को कार्य सौंपा गया"; }).then(function(){ f.reset(); }, function(){});
  });
  $("acForm").addEventListener("submit", function(e){
    e.preventDefault(); var f = e.target;
    if(!f.checkValidity()){ f.reportValidity(); return; }
    save(S.add("achievements", { member_id: f.elements.member_id.value, title: f.elements.title.value.trim(), details: f.elements.details.value.trim(),
      awarded_on: f.elements.awarded_on.value || today() }), "उपलब्धि दर्ज हुई").then(function(){ f.reset(); }, function(){});
  });
  $("app").addEventListener("click", function(e){
    var b = e.target.closest("[data-del-kind]"); if(!b) return;
    if(confirm("यह प्रविष्टि हटानी है?")) save(S.remove(b.getAttribute("data-del-kind"), b.getAttribute("data-id")), "हटा दिया गया").catch(function(){});
  });

  /* ---------- media (gallery + press) → Supabase Storage ---------- */
  function toJpeg(file){
    return new Promise(function(resolve, reject){
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function(){
        var scale = Math.min(1, 1600 / Math.max(img.width, img.height));
        var c = document.createElement("canvas");
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function(b){ b ? resolve(b) : reject(); }, "image/jpeg", 0.85);
      };
      img.onerror = function(){ URL.revokeObjectURL(url); reject(); };
      img.src = url;
    });
  }
  $("uForm").addEventListener("submit", function(e){
    e.preventDefault();
    var f = e.target, file = f.elements.file.files[0], btn = f.querySelector('[type="submit"]');
    $("uErr").textContent = "";
    if(!f.checkValidity()){ f.reportValidity(); return; }
    if(!/^image\/(jpeg|png|webp)$/.test(file.type)){ $("uErr").textContent = "केवल JPG, PNG या WebP तस्वीर चुनिए।"; return; }
    btn.disabled = true;
    var kind = f.elements.kind.value, path = kind + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + ".jpg";
    toJpeg(file).then(function(blob){
      return sb.storage.from("media").upload(path, blob, { contentType: "image/jpeg" });
    }, function(){ throw new Error("यह तस्वीर खुल नहीं पाई। दूसरी फ़ाइल चुनिए।"); }).then(function(res){
      if(res.error) throw res.error;
      var url = sb.storage.from("media").getPublicUrl(path).data.publicUrl;
      return save(S.add("media", { kind: kind, image: url, storage_path: path, caption: f.elements.caption.value.trim(),
        caption_en: f.elements.caption_en.value.trim(), published: true, sort: Date.now() }), "तस्वीर जोड़ी गई — वेबसाइट पर दिख रही है");
    }).then(function(){ btn.disabled = false; f.reset(); }, function(err){ btn.disabled = false; $("uErr").textContent = (err && err.message) || "अपलोड नहीं हुआ।"; });
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
    if(t){ var m = byId("media", t); if(m) save(S.update("media", t, { published: !m.published }), m.published ? "तस्वीर छिपा दी गई" : "तस्वीर वेबसाइट पर दिख रही है").catch(function(){}); }
    if(d && confirm("यह तस्वीर हटानी है?")){
      var rec = byId("media", d);
      var rm = rec && rec.storage_path ? sb.storage.from("media").remove([rec.storage_path]) : Promise.resolve();
      save(rm.then(function(){ return S.remove("media", d); }), "तस्वीर हटा दी गई").catch(function(){});
    }
  });

  /* ---------- messages ---------- */
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
    if(r){ var m = byId("messages", r); if(m) save(S.update("messages", r, { read: !m.read })).catch(function(){}); }
    if(d && confirm("यह संदेश हटाना है?")) save(S.remove("messages", d), "संदेश हटा दिया गया").then(function(){ S.log("erase", "एक संदेश हटाया"); }, function(){});
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
      return "<tr><td><b>" + esc(fmtDate(n.date)) + "</b></td><td>" + esc(n.title) + '<span class="sub">' + esc(n.text) + "</span></td>" +
        '<td><span class="status ' + (n.published ? "st-paid" : "st-rejected") + '">' + (n.published ? "प्रकाशित" : "छिपी हुई") + "</span></td>" +
        '<td><div class="actions"><button type="button" class="btn btn-sm" data-ntoggle="' + esc(n.id) + '">' + (n.published ? "छिपाएँ" : "दिखाएँ") + "</button>" +
        '<button type="button" class="btn btn-sm btn-danger" data-del-notice="' + esc(n.id) + '">हटाएँ</button></div></td></tr>';
    }).join("") + "</tbody>";
  }
  $("nForm").elements.date.value = today();
  $("nForm").addEventListener("submit", function(e){
    e.preventDefault();
    var f = e.target;
    if(!f.checkValidity()){ f.reportValidity(); return; }
    save(S.add("notices", { title: f.elements.title.value.trim(), title_en: f.elements.title_en.value.trim(), date: f.elements.date.value,
      text: f.elements.text.value.trim(), text_en: f.elements.text_en.value.trim(), published: true }), "सूचना प्रकाशित — वेबसाइट पर दिख रही है")
      .then(function(){ f.reset(); f.elements.date.value = today(); }, function(){});
  });
  $("nTable").addEventListener("click", function(e){
    var t = e.target.getAttribute("data-ntoggle"), d = e.target.getAttribute("data-del-notice");
    if(t){ var n = byId("notices", t); if(n) save(S.update("notices", t, { published: !n.published })).catch(function(){}); }
    if(d && confirm("यह सूचना हटानी है?")) save(S.remove("notices", d), "सूचना हटा दी गई").catch(function(){});
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
    save(S.saveSettings(st), "सेटिंग्स सेव हो गईं — वेबसाइट रीफ़्रेश करके देखिए").catch(function(){});
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
        "<td" + (late ? ' class="late"' : "") + ">" + esc(fmtDate(due.toISOString())) + (late ? " — समय निकल गया" : "") + "</td>" +
        '<td><span class="status ' + (r.status === "open" ? "st-pending" : "st-paid") + '">' + (r.status === "open" ? "खुला" : "पूरा") + "</span></td>" +
        '<td><div class="actions"><button type="button" class="btn btn-sm" data-lookup="' + esc(r.phone) + '">डेटा</button>' +
        '<button type="button" class="btn btn-sm" data-rdone="' + esc(r.id) + '">' + (r.status === "open" ? "पूरा हुआ" : "फिर खोलें") + "</button></div></td></tr>";
    }).join("") : '<tr><td colspan="6" class="empty">कोई अनुरोध नहीं। वेबसाइट की गोपनीयता सूचना के नीचे के फ़ॉर्म से अनुरोध यहाँ आते हैं।</td></tr>') + "</tbody>";
    var logs = S.list("log").slice(0, 200);
    $("logTable").innerHTML = "<thead><tr><th>समय</th><th>काम</th><th>विवरण</th><th>किसने</th></tr></thead><tbody>" + (logs.length ? logs.map(function(l){
      return "<tr><td>" + esc(new Date(l.created_at).toLocaleString("hi-IN")) + "</td><td>" + esc(l.action) + "</td><td>" + esc(l.detail) + "</td><td>" + esc(l.actor) + "</td></tr>";
    }).join("") : '<tr><td colspan="4" class="empty">अभी कोई प्रविष्टि नहीं।</td></tr>') + "</tbody>";
  }
  $("rTable").addEventListener("click", function(e){
    var ph = e.target.getAttribute("data-lookup"), dn = e.target.getAttribute("data-rdone");
    if(ph){ $("lookupForm").elements.phone.value = ph; showPerson(ph); $("lookupForm").scrollIntoView({ behavior: "smooth" }); }
    if(dn){
      var r = byId("requests", dn);
      if(r) save(S.update("requests", dn, { status: r.status === "open" ? "done" : "open", closed_at: new Date().toISOString() }))
        .then(function(){ S.log("request", r.ref + (r.status === "open" ? " फिर खोला" : " पूरा किया")); }, function(){});
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
      block("सदस्यता", m, function(r){ return esc(r.member_no) + " · " + esc(r.name) + " · " + esc(r.place) + " · " + esc(rupees(r.amount)) + " · " + esc(STATUS[r.status]) + (r.consent_at ? " · सहमति " + esc(fmtDate(r.consent_at)) : ""); }) +
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
    save(S.rpc("erase_by_phone", { p_phone: ph }), function(n){ return n.members + " सदस्यता, " + n.messages + " संदेश मिटाए गए"; })
      .then(function(){ showPerson(ph); }, function(){});
  });
  $("purgeOld").addEventListener("click", function(){
    var cutoff = Date.now() - 365 * DAY, old = function(r, f){ return new Date(r[f] || r.created_at).getTime() < cutoff; };
    var msgs = S.list("messages").filter(function(m){ return m.read && old(m, "created_at"); });
    var reqs = S.list("requests").filter(function(r){ return r.status !== "open" && old(r, "closed_at"); });
    if(!msgs.length && !reqs.length){ toast("1 वर्ष से पुराना कोई रिकॉर्ड नहीं"); return; }
    if(!confirm(msgs.length + " संदेश और " + reqs.length + " पूरे अनुरोध मिटाए जाएँगे। आगे बढ़ें?")) return;
    var jobs = msgs.map(function(m){ return S.remove("messages", m.id); }).concat(reqs.map(function(r){ return S.remove("requests", r.id); }));
    save(Promise.all(jobs), "पुराने रिकॉर्ड मिटा दिए गए")
      .then(function(){ S.log("erase", "रिटेंशन: " + msgs.length + " संदेश, " + reqs.length + " अनुरोध (1 वर्ष से पुराने)"); }, function(){});
  });
  $("logExport").addEventListener("click", function(){
    downloadCsv("deepankar-kunj-processing-log", [["created_at","समय"],["action","काम"],["detail","विवरण"],["actor","किसने"]], S.list("log"));
  });

  /* ---------- start ---------- */
  if(!sb){ showLogin("डेटाबेस से जुड़ नहीं पाए — इंटरनेट जाँचकर पेज रीफ़्रेश कीजिए।"); $("loginBtn").disabled = true; return; }
  /* show the login straight away; switch to the panel if a saved session turns up */
  showLogin();
  sb.auth.getSession().then(function(res){
    if(res.data && res.data.session) enter().catch(function(){ showLogin("डेटाबेस से जुड़ नहीं पाए।"); });
  });
})();
