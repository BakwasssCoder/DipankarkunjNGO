/* DK_STORE — data layer shared by the website, the admin panel (admin/) and the member portal (member/).
   Backend: Supabase (js/supabase-config.js). Permissions live in the database (supabase/schema.sql):
   the website can only submit forms and read published content; admins read/write everything;
   members read only their own rows.
   Reads in the admin panel come from an in-memory cache filled by loadAll(); every write goes to
   the database first and only then updates the cache, so the screen never shows unsaved data.
   shortcut: loadAll() fetches whole tables (≤5000 rows each) — fine for an NGO; add paging if it grows. */
(function(){
  "use strict";
  /* DPDP: version of the privacy notice (index.html #/privacy) a person agreed to — bump when the notice changes */
  var NOTICE_VERSION = "v1-2026-11-10";
  var cfg = window.DK_SUPABASE || {};
  var sb = (window.supabase && cfg.url && cfg.key) ? window.supabase.createClient(cfg.url, cfg.key) : null;
  var TABLE = { members: "members", donations: "donations", media: "media", messages: "messages", notices: "notices",
                requests: "requests", log: "activity_log", notifications: "notifications", tasks: "tasks", achievements: "achievements" };
  var cache = { settings: {} };
  Object.keys(TABLE).forEach(function(k){ cache[k] = []; });

  function need(){ if(!sb) throw new Error("Supabase not loaded"); return sb; }
  function ok(res){ if(res.error) throw res.error; return res.data; }
  function fetchAll(kind){
    return need().from(TABLE[kind]).select("*").order("created_at", { ascending: false }).limit(5000)
      .then(ok).then(function(rows){ cache[kind] = rows || []; return cache[kind]; });
  }
  function loadSettings(){
    return need().from("settings").select("data").eq("id", 1).maybeSingle()
      .then(ok).then(function(r){ cache.settings = (r && r.data) || {}; return cache.settings; });
  }
  function rpc(fn, args){ return need().rpc(fn, args || {}).then(ok); }

  window.DK_STORE = {
    ready: !!sb, client: sb, NOTICE_VERSION: NOTICE_VERSION, rpc: rpc,
    list: function(kind){ return cache[kind] || []; },

    /* ---------- admin ---------- */
    loadAll: function(){
      return Promise.all(Object.keys(TABLE).map(fetchAll).concat([loadSettings()]));
    },
    add: function(kind, rec){
      return need().from(TABLE[kind]).insert(rec).select().single().then(ok)
        .then(function(r){ cache[kind].unshift(r); return r; });
    },
    update: function(kind, id, patch){
      return need().from(TABLE[kind]).update(patch).eq("id", id).then(ok).then(function(){
        cache[kind].forEach(function(r){ if(r.id === id) Object.assign(r, patch); });
      });
    },
    remove: function(kind, id){
      return need().from(TABLE[kind]).delete().eq("id", id).then(ok).then(function(){
        cache[kind] = cache[kind].filter(function(r){ return r.id !== id; });
      });
    },
    /* processing log — failures are swallowed so logging never blocks real work */
    log: function(action, detail){
      if(!sb) return Promise.resolve();
      return sb.from("activity_log").insert({ action: action, detail: detail || "" }).then(function(){}, function(){});
    },
    saveSettings: function(obj){
      return need().from("settings").upsert({ id: 1, data: obj, updated_at: new Date().toISOString() }).then(ok)
        .then(function(){ cache.settings = obj; });
    },

    /* ---------- website (public) ---------- */
    loadPublic: function(){
      if(!sb) return Promise.resolve();
      return Promise.all([
        sb.from("notices").select("*").eq("published", true).then(ok).then(function(r){ cache.notices = r || []; }),
        sb.from("media").select("*").eq("published", true).then(ok).then(function(r){ cache.media = r || []; }),
        loadSettings()
      ]);
    },
    publishedNotices: function(){
      return cache.notices.filter(function(n){ return n.published; })
        .sort(function(a, b){ return (b.date || "").localeCompare(a.date || ""); });
    },
    publishedMedia: function(kind){
      return cache.media.filter(function(m){ return m.published && m.kind === kind; })
        .sort(function(a, b){ return (a.sort || 0) - (b.sort || 0); });
    },
    getSettings: function(){ return cache.settings || {}; },
    /* each resolves to the reference number, or rejects (network / validation / rate limit) */
    submitMembership: function(d){
      return rpc("submit_membership", { p_name: d.name, p_phone: d.phone, p_place: d.place || "", p_tier: d.tier || "",
        p_amount: d.amount, p_message: d.msg || "", p_lang: d.lang || "hi", p_notice: NOTICE_VERSION });
    },
    submitMessage: function(d){
      return rpc("submit_message", { p_name: d.name, p_phone: d.phone, p_subject: d.subject, p_message: d.message, p_notice: NOTICE_VERSION });
    },
    submitRequest: function(d){
      return rpc("submit_request", { p_type: d.type, p_name: d.name, p_phone: d.phone, p_details: d.details || "" });
    },
    /* +1 once per browser session; otherwise just read the total */
    visits: function(){
      var counted = false;
      try { counted = sessionStorage.getItem("dk_visit") === "1"; } catch(e){}
      return rpc(counted ? "visit_total" : "count_visit").then(function(n){
        try { sessionStorage.setItem("dk_visit", "1"); } catch(e){}
        return Number(n) || 0;
      });
    }
  };
})();
