/* DK_CARD — membership card (ID-card proportions, 1012×638 PNG), drawn on canvas.
   Shared by the admin panel and the member portal so both show exactly the same card.
   Usage: DK_CARD.make(member, "../") → Promise<canvas>;  DK_CARD.download(member, "../") */
(function(){
  "use strict";
  var BLUE = "#1e40c9", SAF = "#e8700a", INK = "#1d1a16", SOFT = "#57503f", LEAF = "#178a4c";
  var STATUS = { paid: ["सक्रिय सदस्य", LEAF], approved: ["स्वीकृत — भुगतान शेष", SAF], pending: ["अनुरोध लंबित", "#8a6d1f"], rejected: ["अस्वीकृत", "#b42318"] };

  function loadLogo(base){
    return new Promise(function(res){
      var img = new Image();
      img.onload = function(){ res(img); }; img.onerror = function(){ res(null); };
      img.src = (base || "") + "assets/logo.jpg";
    });
  }
  function fonts(){
    if(!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all(["40px 'Rozha One'", "800 30px 'Mukta'", "600 22px 'Mukta'"].map(function(f){ return document.fonts.load(f); }))
      .catch(function(){});
  }
  function fit(x, t, f, maxW){
    var size = +f.match(/(\d+)px/)[1]; x.font = f;
    while(x.measureText(t).width > maxW && size > 14){ size -= 1; x.font = f.replace(/\d+px/, size + "px"); }
  }
  function first(w){ return window.Intl && Intl.Segmenter ? new Intl.Segmenter("hi", { granularity: "grapheme" }).segment(w)[Symbol.iterator]().next().value.segment : Array.from(w)[0]; }
  function initials(name){
    var p = String(name || "").trim().split(/\s+/);
    return (p[0] ? first(p[0]) : "") + (p.length > 1 ? first(p[p.length - 1]) : "");
  }
  function date(iso){
    var d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleDateString("hi-IN", { day: "numeric", month: "long", year: "numeric" });
  }

  function draw(m, logo){
    var W = 1012, H = 638, c = document.createElement("canvas"); c.width = W; c.height = H;
    var x = c.getContext("2d");
    /* card body + rounded clip */
    x.beginPath(); x.roundRect ? x.roundRect(0, 0, W, H, 34) : x.rect(0, 0, W, H); x.clip();
    x.fillStyle = "#fff"; x.fillRect(0, 0, W, H);
    /* header band */
    var g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, BLUE); g.addColorStop(1, "#16309a");
    x.fillStyle = g; x.fillRect(0, 0, W, 168);
    x.fillStyle = SAF; x.fillRect(0, 168, W, 8);
    if(logo){
      x.save(); x.beginPath(); x.arc(98, 84, 60, 0, Math.PI * 2); x.fillStyle = "#fff"; x.fill(); x.clip();
      x.drawImage(logo, 42, 28, 112, 112); x.restore();
    }
    x.textAlign = "left"; x.fillStyle = "#fff"; x.font = "46px 'Rozha One', serif"; x.fillText("दीपांकर-कुंज", 184, 82);
    var w = x.measureText("दीपांकर-कुंज ").width;
    x.font = "800 24px 'Mukta', sans-serif"; x.fillStyle = "#ffd29a"; x.fillText("[NGO]", 184 + w, 76);
    x.font = "600 20px 'Mukta', sans-serif"; x.fillStyle = "rgba(255,255,255,.9)";
    x.fillText("पंजी. – 849 · वर्ष – 2010-11 · अमरपुर, बांका (बिहार)", 184, 120);
    x.textAlign = "right"; x.font = "800 22px 'Mukta', sans-serif"; x.fillStyle = "#fff"; x.fillText("सदस्यता पत्र", W - 44, 70);
    x.font = "600 18px 'Mukta', sans-serif"; x.fillStyle = "rgba(255,255,255,.8)"; x.fillText("MEMBERSHIP CARD", W - 44, 98);

    /* faint watermark */
    if(logo){ x.save(); x.globalAlpha = .05; x.drawImage(logo, W - 400, 210, 360, 360); x.restore(); }

    /* monogram */
    x.beginPath(); x.arc(150, 330, 92, 0, Math.PI * 2); x.fillStyle = "#fff4e6"; x.fill();
    x.lineWidth = 5; x.strokeStyle = SAF; x.stroke();
    x.textAlign = "center"; x.fillStyle = "#b8520a"; x.font = "64px 'Rozha One', serif"; x.fillText(initials(m.name), 150, 356);

    /* details */
    var X = 290, MAXW = W - X - 50;
    x.textAlign = "left";
    fit(x, m.name, "52px 'Rozha One', serif", MAXW); x.fillStyle = INK; x.fillText(m.name, X, 282);
    x.font = "800 34px 'Mukta', sans-serif"; x.fillStyle = BLUE; x.fillText(m.member_no, X, 334);
    var rows = [["श्रेणी", m.tier || "—"], ["सदस्य बने", date(m.paid_at || m.created_at)], ["स्थान", m.place || "—"]];
    rows.forEach(function(r, i){
      var y = 386 + i * 40;
      x.font = "600 21px 'Mukta', sans-serif"; x.fillStyle = SOFT; x.fillText(r[0], X, y);
      fit(x, r[1], "700 23px 'Mukta', sans-serif", MAXW - 130); x.fillStyle = INK; x.fillText(r[1], X + 130, y);
    });
    var st = STATUS[m.status] || STATUS.pending;
    x.font = "800 20px 'Mukta', sans-serif"; var sw = x.measureText(st[0]).width + 36;
    x.beginPath(); x.roundRect ? x.roundRect(70, 452, sw, 40, 20) : x.rect(70, 452, sw, 40);
    x.fillStyle = st[1]; x.fill(); x.fillStyle = "#fff"; x.textAlign = "left"; x.fillText(st[0], 88, 479);

    /* footer band */
    x.fillStyle = "#fbf7ef"; x.fillRect(0, H - 92, W, 92);
    x.fillStyle = SAF; x.fillRect(0, H - 92, W * .5, 5); x.fillStyle = BLUE; x.fillRect(W * .5, H - 92, W * .5, 5);
    x.textAlign = "left"; x.font = "24px 'Rozha One', serif"; x.fillStyle = "#c2245e"; x.fillText("॥ तमसो मा ज्योतिर्गमय ॥", 44, H - 36);
    x.textAlign = "right"; x.font = "800 22px 'Mukta', sans-serif"; x.fillStyle = LEAF; x.fillText("WhatsApp: +91 78570 43185", W - 44, H - 36);
    return c;
  }

  window.DK_CARD = {
    make: function(m, base){ return Promise.all([loadLogo(base), fonts()]).then(function(r){ return draw(m, r[0]); }); },
    download: function(m, base){
      return this.make(m, base).then(function(c){
        var a = document.createElement("a");
        a.download = "deepankar-kunj-card-" + m.member_no + ".png";
        a.href = c.toDataURL("image/png"); a.click();
      });
    }
  };
})();
