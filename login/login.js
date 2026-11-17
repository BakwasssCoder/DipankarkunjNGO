/* One login for everyone: an email → admin panel, a member number (DK-…) → member portal.
   The session is shared on this site, so /admin/ and /member/ open already logged in.
   Who may see what is still decided by the database (is_admin / RLS), not by this redirect. */
(function(){
  "use strict";
  var S = window.DK_STORE, sb = S.client;
  var $ = function(id){ return document.getElementById(id); };
  function isEmail(v){ return v.indexOf("@") !== -1; }

  $("who").addEventListener("input", function(){
    var v = this.value.trim();
    $("whoHint").textContent = !v ? "सदस्य: अपना सदस्य क्रमांक लिखिए · एडमिन: ईमेल" : isEmail(v) ? "एडमिन लॉगिन" : "सदस्य लॉगिन";
  });

  /* where a signed-in account belongs */
  function go(){
    return S.rpc("is_admin").then(function(admin){
      if(admin){ location.href = "../admin/"; return; }
      return sb.auth.getUser().then(function(u){
        var uid = u.data && u.data.user && u.data.user.id;
        return sb.from("members").select("id").eq("user_id", uid).maybeSingle();
      }).then(function(r){
        if(r && r.data){ location.href = "../member/"; return; }
        return sb.auth.signOut().then(function(){ throw { msg: "यह खाता किसी सदस्यता या एडमिन सूची से जुड़ा नहीं है।" }; });
      });
    });
  }

  $("form").addEventListener("submit", function(e){
    e.preventDefault();
    var who = $("who").value.trim(), pw = $("pw").value;
    $("err").textContent = "";
    if(!who || !pw){ $("err").textContent = "सदस्य क्रमांक / ईमेल और पासवर्ड दोनों लिखिए।"; return; }
    var no = who.toUpperCase().replace(/\s+/g, "");
    if(!isEmail(who) && !/^DK-\d{4}-\d+$/.test(no)){ $("err").textContent = "सदस्य क्रमांक ऐसे लिखिए: DK-2026-1001"; return; }
    $("btn").disabled = true;
    var email = isEmail(who) ? Promise.resolve(who.toLowerCase()) : S.rpc("member_login_email", { p_member_no: no }).then(function(m){
      if(!m) throw { msg: "यह सदस्य क्रमांक अभी पोर्टल पर सक्रिय नहीं है — संस्था से मिले कोड से पहले पासवर्ड बनाइए।" };
      return m;
    });
    email.then(function(em){ return sb.auth.signInWithPassword({ email: em, password: pw }); })
      .then(function(res){
        if(res.error) throw { msg: /Invalid login/i.test(res.error.message) ? "क्रमांक / ईमेल या पासवर्ड ग़लत है।" : res.error.message };
        return go();
      })
      .catch(function(err){ $("btn").disabled = false; $("err").textContent = (err && err.msg) || "इंटरनेट कनेक्शन जाँचिए।"; $("pw").select(); });
  });

  if(!sb){ $("err").textContent = "डेटाबेस से जुड़ नहीं पाए — इंटरनेट जाँचकर पेज रीफ़्रेश कीजिए।"; $("btn").disabled = true; return; }
  /* already signed in → straight to the right panel */
  sb.auth.getSession().then(function(r){ if(r.data && r.data.session) go().catch(function(){}); });
  $("who").focus();
})();
