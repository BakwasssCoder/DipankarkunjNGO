/* Member portal. Login = member number + password (no email/SMS needed).
   Behind the scenes each member has a Supabase Auth account with a derived email
   "<member_no>-<code>@members.deepankarkunj.org"; the database (claim_member) only links it
   to a membership when the admin-issued code matches. RLS lets a member read only their own rows. */
(function(){
  "use strict";
  var S = window.DK_STORE, sb = S.client;
  var $ = function(id){ return document.getElementById(id); };
  var me = null;

  function esc(v){
    return String(v == null ? "" : v).replace(/[&<>"']/g, function(c){
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtDate(iso){
    if(!iso) return "";
    var d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + "T00:00" : iso);
    return isNaN(d) ? "" : d.toLocaleDateString("hi-IN", { day: "numeric", month: "long", year: "numeric" });
  }
  function rupees(n){ return "₹" + Number(n || 0).toLocaleString("en-IN"); }
  var toastTimer;
  function toast(msg){ var t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(function(){ t.classList.remove("show"); }, 2800); }
  function normNo(v){ return v.trim().toUpperCase().replace(/\s+/g, ""); }

  /* ---------- gate: login / activate ---------- */
  function tab(login){
    $("tabLogin").setAttribute("aria-selected", login); $("tabAct").setAttribute("aria-selected", !login);
    $("loginForm").hidden = !login; $("actForm").hidden = login;
    (login ? $("lNo") : $("aNo")).focus();
  }
  $("tabLogin").addEventListener("click", function(){ tab(true); });
  $("tabAct").addEventListener("click", function(){ tab(false); });
  function showGate(msg){ me = null; $("gate").hidden = false; $("home").hidden = true; if(msg) $("lErr").textContent = msg; }

  $("loginForm").addEventListener("submit", function(e){
    e.preventDefault();
    var no = normNo($("lNo").value), pw = $("lPw").value, btn = e.target.querySelector("button");
    $("lErr").textContent = "";
    if(!/^DK-\d{4}-\d+$/.test(no) || !pw){ $("lErr").textContent = "सदस्य क्रमांक (जैसे DK-2026-1001) और पासवर्ड लिखिए।"; return; }
    btn.disabled = true;
    S.rpc("member_login_email", { p_member_no: no }).then(function(email){
      if(!email) throw { msg: "यह क्रमांक अभी पोर्टल पर सक्रिय नहीं है — “पहली बार” टैब से कोड डालकर पासवर्ड बनाइए।" };
      return sb.auth.signInWithPassword({ email: email, password: pw });
    }).then(function(res){
      btn.disabled = false;
      if(res.error){ $("lErr").textContent = "पासवर्ड ग़लत है।"; $("lPw").select(); return; }
      $("lPw").value = ""; load();
    }, function(err){ btn.disabled = false; $("lErr").textContent = (err && err.msg) || "इंटरनेट कनेक्शन जाँचिए।"; });
  });

  $("actForm").addEventListener("submit", function(e){
    e.preventDefault();
    var no = normNo($("aNo").value), code = $("aCode").value.trim(), pw = $("aPw").value, btn = e.target.querySelector("button");
    $("aErr").textContent = "";
    if(!/^DK-\d{4}-\d+$/.test(no)){ $("aErr").textContent = "सही सदस्य क्रमांक लिखिए, जैसे DK-2026-1001।"; return; }
    if(!/^\d{6}$/.test(code)){ $("aErr").textContent = "लॉगिन कोड 6 अंकों का है।"; return; }
    if(pw.length < 8){ $("aErr").textContent = "पासवर्ड कम से कम 8 अक्षर का रखिए।"; return; }
    if(pw !== $("aPw2").value){ $("aErr").textContent = "दोनों पासवर्ड एक जैसे नहीं हैं।"; return; }
    btn.disabled = true;
    var email = no.toLowerCase() + "-" + code + "@members.deepankarkunj.org";
    sb.auth.signUp({ email: email, password: pw }).then(function(res){
      if(res.error){
        /* the account may already exist if a previous attempt got halfway — try signing in */
        if(/registered|exists/i.test(res.error.message)) return sb.auth.signInWithPassword({ email: email, password: pw });
        throw res.error;
      }
      if(!res.data.session) throw { msg: "पोर्टल अभी पूरी तरह चालू नहीं है — कृपया संस्था को बताइए।" }; /* email confirmation is on in Supabase */
      return res;
    }).then(function(res){
      if(res.error) throw { msg: "यह कोड पहले इस्तेमाल हो चुका है — नया कोड माँगिए।" };
      return S.rpc("claim_member", { p_member_no: no, p_code: code });
    }).then(function(){
      btn.disabled = false; e.target.reset(); toast("पासवर्ड बन गया — स्वागत है!"); load();
    }, function(err){
      btn.disabled = false;
      var m = (err && (err.msg || err.message)) || "";
      $("aErr").textContent = /invalid code/.test(m) ? "सदस्य क्रमांक या कोड ग़लत है।" :
        /not active/.test(m) ? "आपकी सदस्यता अभी स्वीकृत नहीं हुई है।" : (err && err.msg) || "पासवर्ड नहीं बन सका। दोबारा कोशिश कीजिए।";
      sb.auth.signOut();
    });
  });
  $("logout").addEventListener("click", function(){ sb.auth.signOut().then(function(){ location.replace("../login/"); }); });

  /* ---------- dashboard ---------- */
  function load(){
    /* filter by our own user id — RLS would also let an admin session read every member */
    return sb.auth.getUser().then(function(u){
      var uid = u.data && u.data.user && u.data.user.id;
      if(!uid) throw new Error("no session");
      return sb.from("members").select("*").eq("user_id", uid).maybeSingle();
    }).then(function(res){
      if(res.error || !res.data){ return sb.auth.signOut().then(function(){ showGate("यह खाता किसी सदस्यता से जुड़ा नहीं है।"); }); }
      me = res.data;
      return Promise.all([
        sb.from("notifications").select("*").or("member_id.is.null,member_id.eq." + me.id).order("created_at", { ascending: false }).limit(50),
        sb.from("tasks").select("*").eq("member_id", me.id).order("created_at", { ascending: false }),
        sb.from("achievements").select("*").eq("member_id", me.id).order("awarded_on", { ascending: false })
      ]).then(function(r){
        $("gate").hidden = true; $("home").hidden = false;
        render(r[0].data || [], r[1].data || [], r[2].data || []);
      });
    }, function(){ showGate("इंटरनेट कनेक्शन जाँचिए।"); });
  }
  var STATUS = { paid: "सक्रिय सदस्य", approved: "स्वीकृत — सदस्यता शुल्क बाकी", pending: "अनुरोध लंबित", rejected: "अस्वीकृत" };
  function render(notes, tasks, achs){
    $("hello").textContent = "नमस्ते, " + me.name + " जी";
    $("helloSub").textContent = me.member_no + " · " + (me.tier || "सदस्य") + " · " + (STATUS[me.status] || "");
    var open = tasks.filter(function(t){ return t.status !== "done"; }).length;
    var stats = [["बाकी कार्य", open], ["पूरे कार्य", tasks.length - open], ["उपलब्धियाँ", achs.length],
                 [me.status === "paid" ? "सदस्यता शुल्क" : "संकल्प राशि", rupees(me.paid_amount || me.amount)]];
    $("pStats").innerHTML = stats.map(function(s){ return '<div class="stat"><span>' + esc(s[0]) + "</span><b>" + esc(s[1]) + "</b></div>"; }).join("");

    DK_CARD.make(me, "../").then(function(c){ $("cardPreview").textContent = ""; $("cardPreview").appendChild(c); });

    $("nList").innerHTML = notes.length ? notes.map(function(n){
      return '<article class="note"><h3>' + esc(n.title) + "</h3>" + (n.body ? "<p>" + esc(n.body) + "</p>" : "") +
        "<small>" + esc(fmtDate(n.created_at)) + (n.member_id ? " · केवल आपके लिए" : " · सभी सदस्यों के लिए") + "</small></article>";
    }).join("") : '<p class="empty">अभी कोई सूचना नहीं।</p>';

    $("tList").innerHTML = tasks.length ? tasks.map(function(t){
      var done = t.status === "done";
      return '<label class="task' + (done ? " done" : "") + '"><input type="checkbox" data-task="' + esc(t.id) + '"' + (done ? " checked" : "") + " />" +
        "<span><b>" + esc(t.title) + "</b>" + (t.details ? "<small>" + esc(t.details) + "</small>" : "") +
        "<small>" + (t.due_on ? "अंतिम तिथि: " + esc(fmtDate(t.due_on)) : "") + (done && t.done_at ? " · पूरा: " + esc(fmtDate(t.done_at)) : "") + "</small></span></label>";
    }).join("") : '<p class="empty">अभी कोई कार्य नहीं सौंपा गया।</p>';

    $("aList").innerHTML = achs.length ? achs.map(function(a){
      return '<article class="ach"><span class="ach-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="M8.5 14 7 22l5-3 5 3-1.5-8"/></svg></span>' +
        "<div><h3>" + esc(a.title) + "</h3>" + (a.details ? "<p>" + esc(a.details) + "</p>" : "") + "<small>" + esc(fmtDate(a.awarded_on)) + "</small></div></article>";
    }).join("") : '<p class="empty">आपकी उपलब्धियाँ यहाँ दिखेंगी — संस्था के कार्यों में भाग लीजिए!</p>';
  }
  $("tList").addEventListener("change", function(e){
    var id = e.target.getAttribute("data-task"); if(!id) return;
    e.target.disabled = true;
    S.rpc("member_complete_task", { p_task: id, p_done: e.target.checked }).then(function(){
      toast(e.target.checked ? "बहुत बढ़िया — कार्य पूरा!" : "कार्य फिर से बाकी में"); load();
    }, function(){ e.target.disabled = false; e.target.checked = !e.target.checked; toast("सेव नहीं हुआ — इंटरनेट जाँचिए"); });
  });
  $("cardDl").addEventListener("click", function(){ if(me) DK_CARD.download(me, "../"); });

  /* ---------- start ---------- */
  if(!sb){ showGate("डेटाबेस से जुड़ नहीं पाए — इंटरनेट जाँचकर पेज रीफ़्रेश कीजिए।"); return; }
  /* show the login straight away; open the dashboard if a saved session turns up */
  showGate(); tab(location.hash !== "#activate");
  sb.auth.getSession().then(function(res){
    if(res.data && res.data.session) load();
    else if(location.hash !== "#activate") location.replace("../login/");   /* activation stays here */
  });
})();
