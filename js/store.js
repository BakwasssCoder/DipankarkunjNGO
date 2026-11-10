/* DK_STORE — demo data layer shared by the website (index.html) and the admin panel (admin/).
   Everything lives in this browser's localStorage, so website + admin must be opened
   from the same origin (e.g. http://localhost:8000 or the same Netlify domain).
   shortcut: per-browser, unsecured demo storage (~5 MB); swap these functions for API calls
   to a real backend (Supabase / server) before collecting real member data. */
(function(){
  "use strict";
  var KEY = { members: "dk_members", donations: "dk_donations", media: "dk_media", seq: "dk_seq" };

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

  window.DK_STORE = {
    list: list, add: add, update: update, remove: remove,
    /* website join form → a pending membership request; returns its member number */
    submitMembership: function(d){
      var rec = add("members", {
        member_no: nextNo("DK", "member"), name: d.name, phone: d.phone, place: d.place || "",
        tier: d.tier || "", amount: d.amount, message: d.msg || "", lang: d.lang || "hi", status: "pending", notes: ""
      });
      return rec ? rec.member_no : null;
    },
    newReceiptNo: function(){ return nextNo("DKD", "donation"); },
    publishedMedia: function(kind){
      return list("media").filter(function(m){ return m.published && m.kind === kind; })
        .sort(function(a, b){ return (a.sort || 0) - (b.sort || 0); });
    }
  };
})();
