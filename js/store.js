/* DK_STORE — demo data layer shared by the website (index.html) and the admin panel (admin/).
   Everything lives in this browser's localStorage, so website + admin must be opened
   from the same origin (e.g. http://localhost:8000 or the same Netlify domain).
   shortcut: per-browser, unsecured demo storage (~5 MB); swap these functions for API calls
   to a real backend (Supabase / server) before collecting real member data. */
(function(){
  "use strict";
  var KEY = { members: "dk_members", donations: "dk_donations", media: "dk_media", messages: "dk_messages",
              notices: "dk_notices", settings: "dk_settings", requests: "dk_requests", log: "dk_log", seq: "dk_seq" };
  /* DPDP: version of the privacy notice (index.html #/privacy) a person agreed to — bump when the notice changes */
  var NOTICE_VERSION = "v1-2026-11-10";
  function consent(){ return { at: new Date().toISOString(), notice: NOTICE_VERSION }; }

  function read(k, fallback){
    try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? fallback : v; }
    catch(e){ return fallback; }
  }
  function write(k, v){
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch(e){ return false; } /* quota full or storage blocked */
  }
  function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function nextNo(prefix, seqKey){
    var seq = read(KEY.seq, {});
    seq[seqKey] = (seq[seqKey] || 1000) + 1;
    write(KEY.seq, seq);
    return prefix + "-" + new Date().getFullYear() + "-" + seq[seqKey];
  }

  function list(kind){ return read(KEY[kind], []); }
  /* returns the saved record, or null if the browser refused to store it */
  function add(kind, rec){
    var all = list(kind);
    rec.id = uid();
    rec.created_at = new Date().toISOString();
    all.unshift(rec);
    return write(KEY[kind], all) ? rec : null;
  }
  function update(kind, id, patch){
    var all = list(kind);
    all.forEach(function(r){ if(r.id === id) Object.assign(r, patch); });
    return write(KEY[kind], all);
  }
  function remove(kind, id){
    return write(KEY[kind], list(kind).filter(function(r){ return r.id !== id; }));
  }

  /* DPDP Rule 8(3): processing log, kept at least one year — entries are never edited */
  function log(action, detail){
    add("log", { action: action, detail: detail || "" });
  }

  window.DK_STORE = {
    list: list, add: add, update: update, remove: remove, log: log, NOTICE_VERSION: NOTICE_VERSION,
    /* website join form → a pending membership request; returns its member number */
    submitMembership: function(d){
      var rec = add("members", {
        member_no: nextNo("DK", "member"), name: d.name, phone: d.phone, place: d.place || "",
        tier: d.tier || "", amount: d.amount, message: d.msg || "", lang: d.lang || "hi", status: "pending", notes: "",
        consent: d.viaAdmin ? null : consent()
      });
      if(rec) log("collect", "सदस्यता अनुरोध " + rec.member_no + (d.viaAdmin ? " (कार्यालय द्वारा)" : " (वेबसाइट फ़ॉर्म, सहमति सहित)"));
      return rec ? rec.member_no : null;
    },
    /* website contact form → admin inbox */
    submitMessage: function(d){
      var rec = add("messages", { name: d.name, phone: d.phone, subject: d.subject, message: d.message, read: false, consent: consent() });
      if(rec) log("collect", "संपर्क संदेश (वेबसाइट फ़ॉर्म, सहमति सहित)");
      return rec;
    },
    /* DPDP rights request (access / correction / erasure / withdraw consent / grievance / nominate) */
    submitRequest: function(d){
      var rec = add("requests", { type: d.type, name: d.name, phone: d.phone, details: d.details || "", status: "open", ref: nextNo("DPR", "request") });
      if(rec) log("request", "अधिकार अनुरोध " + rec.ref + " — " + d.type);
      return rec ? rec.ref : null;
    },
    /* erase a person's membership + messages by mobile number; donation records are kept
       because accounting / tax law requires them (DPDP Rule 8 allows retention required by law) */
    eraseByPhone: function(phone){
      var counts = {};
      ["members", "messages"].forEach(function(k){
        var all = list(k), keep = all.filter(function(r){ return r.phone !== phone; });
        counts[k] = all.length - keep.length;
        write(KEY[k], keep);
      });
      log("erase", "मोबाइल …" + String(phone).slice(-4) + ": " + counts.members + " सदस्यता, " + counts.messages + " संदेश मिटाए");
      return counts;
    },
    /* notices shown on the homepage, newest event date first */
    publishedNotices: function(){
      return list("notices").filter(function(n){ return n.published; })
        .sort(function(a, b){ return (b.date || "").localeCompare(a.date || ""); });
    },
    /* site settings: social links + announcement strip */
    getSettings: function(){ return read(KEY.settings, {}); },
    saveSettings: function(obj){ return write(KEY.settings, obj); },
    newReceiptNo: function(){ return nextNo("DKD", "donation"); },
    publishedMedia: function(kind){
      return list("media").filter(function(m){ return m.published && m.kind === kind; })
        .sort(function(a, b){ return (a.sort || 0) - (b.sort || 0); });
    }
  };
})();
