/* One login for everyone: an email → admin panel or member portal (whichever the account belongs to),
   a member number (DK-…) → member portal. The session is shared on this site, so /admin/ and /member/
   open already logged in. What anyone may see is still decided by the database (is_admin / RLS). */
(function(){
  "use strict";
  var $ = function(id){ return document.getElementById(id); };
  var S = window.DK_STORE, sb = S && S.client;
  function isEmail(v){ return v.indexOf("@") !== -1; }
  function isMemberNo(v){ return /^DK-\d{4}-\d+$/.test(v); }
  function norm(v){ return v.trim().toUpperCase().replace(/\s+/g, ""); }

  function fieldErr(id, msg){ $(id + "Err").textContent = msg || ""; $("f" + id.charAt(0).toUpperCase() + id.slice(1)).classList.toggle("bad", !!msg); }
  function alertMsg(msg){ $("err").textContent = msg || ""; $("err").hidden = !msg; }
  function busy(on){
    $("btn").disabled = on;
    $("btn").innerHTML = on ? '<span class="spin" aria-hidden="true"></span><span>लॉगिन हो रहा है…</span>' : "<span>लॉगिन करें</span>";
  }

  /* live hint: tell people which kind of login we understood */
  $("who").addEventListener("input", function(){
    var v = this.value.trim(), chip = $("chip");
    fieldErr("who", "");
    if(!v){ chip.hidden = true; return; }
    chip.hidden = false;
    chip.classList.toggle("mail", isEmail(v));
    chip.textContent = isEmail(v) ? "ईमेल" : "सदस्य क्रमांक";
  });
  $("pw").addEventListener("input", function(){ fieldErr("pw", ""); });
  $("eye").addEventListener("click", function(){
    var show = $("pw").type === "password";
    $("pw").type = show ? "text" : "password";
    this.setAttribute("aria-pressed", show); this.setAttribute("aria-label", show ? "पासवर्ड छिपाएँ" : "पासवर्ड दिखाएँ");
    $("pw").focus();
  });

  /* where a signed-in account belongs */
  function go(){
    return S.rpc("is_admin").then(function(admin){
      if(admin){ location.replace("../admin/"); return; }
      return sb.auth.getUser().then(function(u){
        var uid = u.data && u.data.user && u.data.user.id;
        return sb.from("members").select("id").eq("user_id", uid).maybeSingle();
      }).then(function(r){
        if(r && r.data){ location.replace("../member/"); return; }
        return sb.auth.signOut().then(function(){ throw { msg: "यह खाता किसी सदस्यता या एडमिन सूची से जुड़ा नहीं है। WhatsApp पर संस्था से संपर्क कीजिए।" }; });
      });
    });
  }

  $("form").addEventListener("submit", function(e){
    e.preventDefault();
    alertMsg("");
    var raw = $("who").value.trim(), pw = $("pw").value, no = norm(raw);
    var bad = false;
    if(!raw){ fieldErr("who", "सदस्य क्रमांक या ईमेल लिखिए।"); bad = true; }
    else if(!isEmail(raw) && !isMemberNo(no)){ fieldErr("who", "सदस्य क्रमांक ऐसे लिखिए: DK-2026-1001 — या अपना ईमेल।"); bad = true; }
    if(!pw){ fieldErr("pw", "पासवर्ड लिखिए।"); if(!bad) $("pw").focus(); bad = true; }
    if(bad){ if($("whoErr").textContent) $("who").focus(); return; }
    if(!sb){ alertMsg("सर्वर से जुड़ नहीं पाए — इंटरनेट जाँचकर पेज रीफ़्रेश कीजिए।"); return; }

    busy(true);
    var email = isEmail(raw) ? Promise.resolve(raw.toLowerCase()) : S.rpc("member_login_email", { p_member_no: no }).then(function(m){
      if(!m) throw { field: "who", msg: "इस क्रमांक का खाता अभी सक्रिय नहीं है — नीचे “कोड से पासवर्ड बनाइए” चुनिए।" };
      return m;
    });
    email.then(function(em){ return sb.auth.signInWithPassword({ email: em, password: pw }); })
      .then(function(res){
        if(res.error) throw /Invalid login/i.test(res.error.message)
          ? { field: "pw", msg: "पासवर्ड ग़लत है — दोबारा लिखिए।" }
          : { msg: res.error.message };
        return go();
      })
      .catch(function(err){
        busy(false);
        var msg = (err && err.msg) || "इंटरनेट कनेक्शन जाँचकर दोबारा कोशिश कीजिए।";
        if(err && err.field){ fieldErr(err.field, msg); $(err.field).select(); } else alertMsg(msg);
      });
  });

  if(!sb){ alertMsg("सर्वर से जुड़ नहीं पाए — इंटरनेट जाँचकर पेज रीफ़्रेश कीजिए।"); return; }
  /* already signed in → straight to the right place */
  sb.auth.getSession().then(function(r){ if(r.data && r.data.session) go().catch(function(){}); });
  $("who").focus();
})();
