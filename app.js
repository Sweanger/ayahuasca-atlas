/* Ayahuasca Retreat Atlas — interactive map explorer.
   Reads window.RETREATS (from data.js). No build step; opens via file://. */
(function () {
  "use strict";
  const DATA = (window.RETREATS || []).map((r, i) => ({ ...r, _i: i }));

  const AFFIL = {
    "indigenous-led":                       { label: "Indigenous-led",            color: "#2d6a4f" },
    "indigenous-healers-on-staff":          { label: "Indigenous healers on staff", color: "#52b788" },
    "trained-in-lineage-non-indigenous":    { label: "Trained in lineage",        color: "#e9c46a" },
    "no-stated-affiliation":                { label: "No stated affiliation",     color: "#bc6c25" },
    "unclear":                              { label: "Unclear",                   color: "#adb5bd" },
  };
  const affColor = (a) => (AFFIL[a] && AFFIL[a].color) || "#adb5bd";
  const affLabel = (a) => (AFFIL[a] && AFFIL[a].label) || "Unclear";

  // ---- map ----------------------------------------------------------------
  const map = L.map("map", { worldCopyJump: true, scrollWheelZoom: true })
    .setView([5, -55], 3);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: "abcd", maxZoom: 19,
  }).addTo(map);
  const cluster = L.markerClusterGroup({ maxClusterRadius: 45, spiderfyOnMaxZoom: true });
  map.addLayer(cluster);

  const markerFor = {};
  DATA.forEach((r) => {
    if (r.lat == null || r.lng == null) return;
    const opts = r.maps_only
      ? { radius: 5, weight: 1, color: "#8a8f98", dashArray: "2 2",
          fillColor: "#c9ccd1", fillOpacity: 0.45 }
      : { radius: 7, weight: 1.5, color: "#fff",
          fillColor: affColor(r.indigenous), fillOpacity: 0.9 };
    const m = L.circleMarker([r.lat, r.lng], opts);
    m.bindPopup(() => popupHTML(r), { maxWidth: 300 });
    r._marker = m;
    markerFor[r._i] = m;
  });

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  function priceStr(r) {
    if (r.price_night_min == null && r.price_night_max == null) return null;
    const lo = r.price_night_min, hi = r.price_night_max;
    return "$" + (lo != null ? lo : "?") + (hi != null && hi !== lo ? "–" + hi : "") + " / night";
  }

  function popupHTML(r) {
    if (r.maps_only) {
      const rv = r.review && r.review.rating != null
        ? `<div class="row"><span class="k">Google:</span> ${r.review.rating} (${r.review.count ?? "?"})</div>` : "";
      return `<div class="pop">
        <h3>${esc(r.name)}</h3>
        <div class="loc">${esc(r.address || r.country || "location approx.")}</div>
        <div class="row"><span class="aff-badge" style="background:#8a8f98">Maps-only lead · unverified</span></div>
        ${r.phone ? `<div class="row"><span class="k">Phone:</span> ${esc(r.phone)}</div>` : ""}
        ${rv}
        <div class="src">No website found — Google Maps pin only. Relevance &amp; ayahuasca facilitation NOT confirmed.</div>
      </div>`;
    }
    const loc = [r.city, r.region, r.country].filter(Boolean).join(", ");
    const rows = [];
    const p = priceStr(r);
    if (p) rows.push(`<div class="row"><span class="k">Price:</span> ${esc(p)} USD${
      r.price_total_min ? ` &middot; total $${r.price_total_min}${r.price_total_max && r.price_total_max !== r.price_total_min ? "–" + r.price_total_max : ""}` : ""}</div>`);
    if (r.nights.length) rows.push(`<div class="row"><span class="k">Lengths:</span> ${r.nights.join(", ")} nights</div>`);
    const meds = ["ayahuasca", ...r.medicines.map(m => m.toLowerCase())];
    rows.push(`<div class="row"><span class="k">Medicines:</span> ${esc([...new Set(meds)].slice(0, 8).join(", "))}</div>`);
    if (r.lineage.length) rows.push(`<div class="row"><span class="k">Lineage:</span> ${esc(r.lineage.join(", "))}</div>`);
    if (r.healers_n) rows.push(`<div class="row"><span class="k">Named healers:</span> ${r.healers_n}</div>`);
    if (r.review && r.review.rating != null) rows.push(`<div class="row"><span class="k">Reviews:</span> ${r.review.rating} (${r.review.count ?? "?"}, ${esc(r.review.source || "")})</div>`);
    const site = r.website ? `<div class="row"><a href="${esc(r.website)}" target="_blank" rel="noopener">Official website ↗</a></div>` : "";
    const srcs = (r.source_urls || []).slice(0, 4)
      .map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener">source ${i + 1}</a>`).join(" · ");
    return `<div class="pop">
      <h3>${esc(r.name)}</h3>
      <div class="loc">${esc(loc || "location unknown")}${r.setting ? " · " + esc(r.setting) : ""}</div>
      <div class="row"><span class="aff-badge" style="background:${affColor(r.indigenous)}">${esc(affLabel(r.indigenous))}</span></div>
      ${rows.join("")}
      ${site}
      <div class="src">${srcs} · confidence: ${esc(r.confidence || "?")}</div>
    </div>`;
  }

  // ---- filter UI ----------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const uniq = (arr) => [...new Set(arr)].sort();

  // country dropdown
  const countrySel = $("country");
  uniq(DATA.map(r => r.country).filter(Boolean)).forEach(c => {
    const o = document.createElement("option"); o.value = c; o.textContent = c; countrySel.appendChild(o);
  });

  // affiliation checkboxes (only those present)
  const presentAff = uniq(DATA.map(r => r.indigenous || "unclear"));
  presentAff.forEach(a => addCheck("affiliation", "aff", a, `
    <span class="dot" style="background:${affColor(a)}"></span>${affLabel(a)}`,
    DATA.filter(r => (r.indigenous || "unclear") === a).length));

  // medicine checkboxes (other medicines, normalized)
  const medCounts = {};
  DATA.forEach(r => r.medicines.forEach(m => {
    const k = m.toLowerCase().trim(); if (k) medCounts[k] = (medCounts[k] || 0) + 1;
  }));
  Object.keys(medCounts).sort((a, b) => medCounts[b] - medCounts[a]).slice(0, 14)
    .forEach(m => addCheck("medicines", "med", m, esc(m), medCounts[m]));

  // organization-type checkboxes (populated once classification has run)
  const otCounts = {};
  DATA.forEach(r => (r.org_type || []).forEach(t => otCounts[t] = (otCounts[t] || 0) + 1));
  Object.keys(otCounts).sort((a, b) => otCounts[b] - otCounts[a])
    .forEach(t => addCheck("orgtype", "ot", t, esc(t), otCounts[t]));
  if (!Object.keys(otCounts).length) {
    $("orgtype").innerHTML = '<span class="loc" style="font-size:12px">Run atlas/classify.py to populate.</span>';
  }

  function addCheck(containerId, cls, value, labelHTML, count) {
    const l = document.createElement("label");
    l.className = "cbx";
    l.innerHTML = `<input type="checkbox" class="${cls}" value="${esc(value)}">
      <span>${labelHTML}</span><span class="count-tag">${count}</span>`;
    $(containerId).appendChild(l);
  }

  // price bounds
  const nightly = DATA.map(r => r.price_night_max ?? r.price_night_min).filter(v => v != null);
  const gMin = nightly.length ? Math.floor(Math.min(...nightly)) : 0;
  const gMax = nightly.length ? Math.ceil(Math.max(...nightly)) : 1500;
  $("priceMin").placeholder = gMin; $("priceMax").placeholder = gMax;

  // ---- filtering ----------------------------------------------------------
  function checked(cls) {
    return [...document.querySelectorAll("input." + cls + ":checked")].map(i => i.value);
  }

  function passes(r) {
    const q = $("search").value.trim().toLowerCase();
    if (q) {
      const hay = [r.name, r.country, r.region, r.city].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (countrySel.value && r.country !== countrySel.value) return false;

    // Maps-only leads: unverified, so gated solely by search + country + their toggle.
    if (r.maps_only) return $("showLeads").checked;

    const affs = checked("aff");
    if (affs.length && !affs.includes(r.indigenous || "unclear")) return false;

    const meds = checked("med");
    if (meds.length) {
      const have = new Set(r.medicines.map(m => m.toLowerCase().trim()));
      if (!meds.some(m => have.has(m))) return false;
    }

    const ots = checked("ot");
    if (ots.length && !ots.some(t => (r.org_type || []).includes(t))) return false;
    // null classification = unknown -> not filtered out
    if ($("hidePractitioners").checked && r.is_practitioner === true) return false;
    if ($("facilitatesOnly").checked && r.facilitates_ayahuasca === false) return false;

    const pn = r.price_night_max ?? r.price_night_min;
    const lo = $("priceMin").value === "" ? null : +$("priceMin").value;
    const hi = $("priceMax").value === "" ? null : +$("priceMax").value;
    if (pn == null) { if (!$("includeUnpriced").checked) return false; }
    else {
      if (lo != null && pn < lo) return false;
      if (hi != null && pn > hi) return false;
    }

    if ($("hasSite").checked && !r.website) return false;
    if ($("hasScholarship").checked && r.scholarships !== true) return false;
    if ($("hasScreening").checked && r.screening !== true) return false;
    if (!$("includeClosed").checked && r.status && r.status !== "active") return false;
    return true;
  }

  let lastShown = [];
  function apply() {
    const shown = DATA.filter(passes);
    lastShown = shown;
    cluster.clearLayers();
    const markers = shown.filter(r => r._marker).map(r => r._marker);
    cluster.addLayers(markers);
    renderList(shown);
    renderTable(shown);
    $("count").textContent = shown.length;
    $("geocount").textContent = markers.length;
  }

  // ---- table view ---------------------------------------------------------
  const TABLE_COLS = [
    { key: "name", label: "Name", get: r => r.name || "" },
    { key: "country", label: "Country", get: r => r.country || "" },
    { key: "setting", label: "Setting", get: r => r.setting || "" },
    { key: "price", label: "$/night", get: r => r.price_night_max ?? r.price_night_min ?? -1, num: true },
    { key: "affiliation", label: "Affiliation", get: r => affLabel(r.indigenous) },
    { key: "healers", label: "Healers", get: r => r.healers_n || 0, num: true },
    { key: "status", label: "Status", get: r => r.status || "active" },
    { key: "added", label: "Added", get: r => (r.date_added || "").slice(0, 10) },
  ];
  let sortKey = "name", sortDir = 1;

  function renderTable(shown) {
    const head = $("table-head");
    if (!head.childElementCount) {
      TABLE_COLS.forEach(c => {
        const th = document.createElement("th");
        th.textContent = c.label;
        th.dataset.key = c.key;
        th.onclick = () => {
          sortDir = (sortKey === c.key) ? -sortDir : 1;
          sortKey = c.key;
          renderTable(lastShown);
        };
        head.appendChild(th);
      });
    }
    const col = TABLE_COLS.find(c => c.key === sortKey);
    const rows = [...shown].sort((a, b) => {
      const av = col.get(a), bv = col.get(b);
      const cmp = col.num ? av - bv : String(av).localeCompare(String(bv));
      return cmp * sortDir;
    });
    head.querySelectorAll("th").forEach(th =>
      th.classList.toggle("sorted", th.dataset.key === sortKey));

    const body = $("table-body");
    body.innerHTML = "";
    rows.slice(0, 1000).forEach(r => {
      const tr = document.createElement("tr");
      if (r.status && r.status !== "active") tr.className = "closed";
      const price = r.price_night_max ?? r.price_night_min;
      tr.innerHTML = `
        <td>${r.website ? `<a href="${esc(r.website)}" target="_blank" rel="noopener">${esc(r.name)}</a>` : esc(r.name)}</td>
        <td>${esc(r.country || "—")}</td>
        <td>${esc(r.setting || "—")}</td>
        <td class="num">${price != null ? "$" + price : "—"}</td>
        <td><span class="pill" style="background:${affColor(r.indigenous)}">${esc(affLabel(r.indigenous))}</span></td>
        <td class="num">${r.healers_n || "—"}</td>
        <td><span class="status status-${(r.status || "active")}">${esc(r.status || "active")}</span></td>
        <td class="num muted">${esc((r.date_added || "").slice(0, 10))}</td>`;
      tr.onclick = (e) => {
        if (e.target.tagName === "A") return;
        if (r._marker) { setView("map"); map.flyTo([r.lat, r.lng], Math.max(map.getZoom(), 7));
          cluster.zoomToShowLayer(r._marker, () => r._marker.openPopup()); }
      };
      body.appendChild(tr);
    });
  }

  function setView(v) {
    document.querySelectorAll("#view-toggle button").forEach(b =>
      b.classList.toggle("active", b.dataset.view === v));
    $("map").style.display = v === "map" ? "" : "none";
    $("table-view").hidden = v !== "table";
    if (v === "map") setTimeout(() => map.invalidateSize(), 0);
  }
  document.querySelectorAll("#view-toggle button").forEach(b =>
    b.addEventListener("click", () => setView(b.dataset.view)));

  function renderList(shown) {
    const box = $("results");
    box.innerHTML = "";
    shown.slice(0, 300).forEach(r => {
      const card = document.createElement("div");
      card.className = "rcard" + (r._marker ? "" : " nogeo");
      const p = priceStr(r);
      card.innerHTML = `<h3>${esc(r.name)}</h3>
        <div class="loc">${esc([r.city, r.country].filter(Boolean).join(", ") || "location unknown")}</div>
        <div class="tags">
          <span class="tag aff" style="background:${affColor(r.indigenous)}">${esc(affLabel(r.indigenous))}</span>
          ${p ? `<span class="tag price">${esc(p)}</span>` : ""}
          ${r.website ? `<span class="tag">site</span>` : ""}
        </div>`;
      card.onclick = () => {
        if (r._marker) {
          map.flyTo([r.lat, r.lng], Math.max(map.getZoom(), 7));
          cluster.zoomToShowLayer(r._marker, () => r._marker.openPopup());
        }
      };
      box.appendChild(card);
    });
    if (shown.length > 300) {
      const more = document.createElement("div");
      more.className = "loc"; more.style.padding = "6px 2px";
      more.textContent = `+${shown.length - 300} more — narrow filters to see them.`;
      box.appendChild(more);
    }
  }

  // ---- wiring -------------------------------------------------------------
  ["input", "change"].forEach(ev => {
    document.getElementById("sidebar").addEventListener(ev, apply);
  });
  $("reset").addEventListener("click", () => {
    $("search").value = ""; countrySel.value = "";
    const defaultOn = new Set(["includeUnpriced", "includeClosed",
                               "hidePractitioners", "facilitatesOnly"]);
    document.querySelectorAll("#sidebar input[type=checkbox]").forEach(c => {
      c.checked = defaultOn.has(c.id);
    });
    $("priceMin").value = ""; $("priceMax").value = "";
    apply();
  });

  // ---- coverage panel + legend -------------------------------------------
  function renderCoverage() {
    const c = window.COVERAGE || {};
    const el = $("coverage");
    if (!c.discovered) { el.style.display = "none"; return; }
    const inProgress = (c.extracted || 0) < (c.crawled || 0);
    const pct = c.discovered ? Math.round(100 * (c.with_official_site || 0) / c.discovered) : 0;
    el.innerHTML = `
      <div class="cov-head">Collection status ${inProgress ? '<span class="live">● building</span>' : '<span class="done">complete</span>'}</div>
      <div class="cov-grid">
        <div><b>${c.discovered}</b><span>discovered</span></div>
        <div><b>${c.with_official_site}</b><span>official sites (${pct}%)</span></div>
        <div><b>${c.sites_via_gapfill}</b><span>found via search</span></div>
        <div><b>${c.extracted}</b><span>profiled</span></div>
      </div>
      ${c.maps_only_leads ? `<div class="cov-note">+ ${c.maps_only_leads} website-less <b>Maps-only leads</b> (unverified) — toggle "show Maps-only leads" to view.</div>` : ""}
      ${inProgress ? `<div class="cov-note">Extraction runs after crawling — the map fills to all ${c.discovered} centers when it completes. Reload after a refresh.</div>` : ""}`;
  }

  function renderLegend() {
    const box = $("legend-items");
    const present = new Set(DATA.map(r => r.indigenous || "unclear"));
    Object.keys(AFFIL).filter(k => present.has(k)).forEach(k => {
      const row = document.createElement("div");
      row.className = "legend-row";
      row.innerHTML = `<span class="dot" style="background:${AFFIL[k].color}"></span>${AFFIL[k].label}`;
      box.appendChild(row);
    });
    if (DATA.some(r => r.maps_only)) {
      const row = document.createElement("div");
      row.className = "legend-row";
      row.innerHTML = `<span class="dot" style="background:#c9ccd1;border:1px dashed #8a8f98"></span>Maps-only lead (unverified)`;
      box.appendChild(row);
    }
  }

  renderCoverage();
  renderLegend();
  apply();
  const mapped = DATA.filter(r => r._marker).map(r => r._marker.getLatLng());
  if (mapped.length) map.fitBounds(L.latLngBounds(mapped).pad(0.2));
})();
