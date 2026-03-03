(() => {
  const STORAGE_KEY = "fleur_wellbeing_add_tracker_clean_v1";

  const FOOD_TAGS = [
    { key: "sugar", label: "Suiker/zoet" },
    { key: "alcohol", label: "Alcohol" },
    { key: "lateMeal", label: "Laat gegeten" },
    { key: "highCarb", label: "Veel koolhydraten" },
    { key: "highProtein", label: "Veel eiwit" },
    { key: "ultraProcessed", label: "Ultra-processed" },
    { key: "highFiber", label: "Vezelrijk" },
    { key: "spicy", label: "Pittig" },
    { key: "hydrated", label: "Goed gedronken" }
  ];

  const PHASES = [
    { key: "menstrual", label: "Menstruatie" },
    { key: "follicular", label: "Folliculair" },
    { key: "ovulation", label: "Ovulatie" },
    { key: "luteal", label: "Luteaal" }
  ];

  const pad2 = (n) => String(n).padStart(2, "0");
  const toISODate = (d) => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  const todayISO = toISODate(new Date());

  const DEFAULT_ENTRY = (dateISO) => ({
    dateISO,
    energyLevel: null,
    focusLevel: null,
    symptomLoad: null,
    sleepQuality: null,
    sleepHours: null,
    wokeRested: null,
    stressLevel: null,
    caffeineTiming: "none",
    screenLate: null,
    medsAsPlanned: null,
    energyGivers: ["", "", ""],
    food: { breakfast: "", lunch: "", dinner: "", snacks: "" },
    foodTags: {},
    cycle: { bleeding: "none", cycleDay: "", phase: "unknown", symptoms: "" },
    activities: { didSport: null, sportMinutes: null, didMusic: null, musicMinutes: null },
    notes: "",
    savedAt: null
  });

  function safeJsonParse(raw, fallback){
    try { const v = JSON.parse(raw); return v ?? fallback; } catch { return fallback; }
  }

  function deepMerge(obj, patch){
    const out = JSON.parse(JSON.stringify(obj));
    for (const k in patch){
      if (patch[k] && typeof patch[k] === "object" && !Array.isArray(patch[k])){
        out[k] = { ...(out[k]||{}), ...patch[k] };
      } else {
        out[k] = patch[k];
      }
    }
    return out;
  }

  function normalizeEntries(arr){
    const byDate = {};
    (Array.isArray(arr) ? arr : []).forEach(e => {
      if (!e?.dateISO) return;
      const base = DEFAULT_ENTRY(e.dateISO);
      const merged = deepMerge(base, e);
      merged.foodTags = merged.foodTags || {};
      byDate[e.dateISO] = merged;
    });
    return byDate;
  }

  function loadEntries(){
    const rawNew = localStorage.getItem(STORAGE_KEY);
    if (rawNew) return normalizeEntries(safeJsonParse(rawNew, []));

    const oldKeys = ["fleur_daily_tracker_v4","fleur_daily_tracker_v3","fleur_daily_tracker_v2","fleur_daily_tracker_v1"];
    for (const k of oldKeys){
      const raw = localStorage.getItem(k);
      if (raw){
        const migrated = normalizeEntries(safeJsonParse(raw, []));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.values(migrated)));
        return migrated;
      }
    }
    return {};
  }

  function saveEntries(byDate){
    const arr = Object.values(byDate).sort((a,b)=>a.dateISO.localeCompare(b.dateISO));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  }

  function getOrCreate(byDate, iso){
    return byDate[iso] ?? DEFAULT_ENTRY(iso);
  }

  function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

  function fmt(v){
    if (v == null) return "—";
    return (Math.round(v*10)/10).toString();
  }

  function fmtDateTime(iso){
    try{
      if (!iso) return "";
      const d = new Date(iso);
      const y = d.getFullYear();
      const m = String(d.getMonth()+1).padStart(2,"0");
      const da = String(d.getDate()).padStart(2,"0");
      const hh = String(d.getHours()).padStart(2,"0");
      const mm = String(d.getMinutes()).padStart(2,"0");
      return `${y}-${m}-${da} ${hh}:${mm}`;
    }catch{ return ""; }
  }

  function avg(nums){
    const valid = nums.filter(n => typeof n === "number" && !Number.isNaN(n));
    if (!valid.length) return null;
    return valid.reduce((a,b)=>a+b,0) / valid.length;
  }

  function countValid(nums){
    return nums.filter(n => typeof n === "number" && !Number.isNaN(n)).length;
  }


function boolToSelectValue(v){
  if (v === true) return "true";
  if (v === false) return "false";
  return "null";
}
function selectValueToBool(v){
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

function isEntryFilled(e){
  if (!e) return false;
  const anyScore = [e.energyLevel, e.focusLevel, e.symptomLoad, e.sleepQuality, e.stressLevel].some(x => typeof x === "number");
  const anyText = (e.notes && e.notes.trim().length) ||
    (e.food && Object.values(e.food).some(s => (s||"").trim().length)) ||
    (e.energyGivers && e.energyGivers.some(s => (s||"").trim().length)) ||
    (e.cycle && ((e.cycle.cycleDay||"").trim().length || (e.cycle.symptoms||"").trim().length || e.cycle.bleeding !== "none" || e.cycle.phase !== "unknown")) ||
    (e.activities && (typeof e.activities.sportMinutes === "number" || typeof e.activities.musicMinutes === "number"));
  const anyBools = [e.wokeRested, e.screenLate, e.medsAsPlanned, e.activities?.didSport, e.activities?.didMusic].some(v => v === true || v === false);
  const anyTags = e.foodTags && Object.values(e.foodTags).some(v => v === true);
  return !!(anyScore || anyText || anyBools || anyTags);
}

function renderDateChips(){
  if (!dateChips) return;
  dateChips.innerHTML = "";
  const base = new Date();
  // show last 14 days including today
  for (let i=13;i>=0;i--){
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    const iso = toISODate(d);
    const e = entriesByDate[iso];
    const filled = isEntryFilled(e);
    const b = document.createElement("button");
    b.type = "button";
    const isSelected = (iso === selectedISO);
      const pending = isSelected && dirty && draft && isEntryFilled(draft);
      b.className = "chip" + ((filled || pending) ? " filled" : "") + (pending ? " pending" : "") + (isSelected ? " active" : "");
    b.textContent = iso.slice(8,10);
    b.title = iso;
    b.addEventListener("click", () => setSelectedDate(iso));
    dateChips.appendChild(b);
  }
  if (dateStatus){
    const e = entriesByDate[selectedISO];
    dateStatus.textContent = "Status: " + (isEntryFilled(e) ? "Ingevuld" : "Nog open");
  }
}


  let entriesByDate = loadEntries();
  let selectedISO = todayISO;
  let draft = null;
  let dirty = false;

  const $ = (id) => document.getElementById(id);

  const tabLog = $("tabLog");
  const tabDash = $("tabDash");
  const viewLog = $("viewLog");
  const viewDash = $("viewDash");

  const datePicker = $("datePicker");
  const btnPrevDay = $("btnPrevDay");
  const btnNextDay = $("btnNextDay");
  const dateChips = $("dateChips");
  const dateStatus = $("dateStatus");

  const exportImport = $("exportImport");
  const btnExportImport = $("btnExportImport");
  const btnResetCache = $("btnResetCache");
  const btnCloseExport = $("btnCloseExport");
  const exportText = $("exportText");
  const importText = $("importText");
  const btnImport = $("btnImport");
  const btnCopyExport = $("btnCopyExport");

  const saveBtn = $("saveBtn");
  const unsavedHint = $("unsavedHint");
  const toast = $("toast");

  const energyLevel = $("energyLevel");
  const focusLevel = $("focusLevel");
  const symptomLoad = $("symptomLoad");
  const sleepQuality = $("sleepQuality");

  const energyLevelVal = $("energyLevelVal");
  const focusLevelVal = $("focusLevelVal");
  const symptomLoadVal = $("symptomLoadVal");
  const sleepQualityVal = $("sleepQualityVal");

  const sleepHours = $("sleepHours");
  const caffeineTiming = $("caffeineTiming");

  const stressLevel = $("stressLevel");
  const stressLevelVal = $("stressLevelVal");

  const giver1 = $("giver1");
  const giver2 = $("giver2");
  const giver3 = $("giver3");

  const foodBreakfast = $("foodBreakfast");
  const foodLunch = $("foodLunch");
  const foodDinner = $("foodDinner");
  const foodSnacks = $("foodSnacks");
  const foodTagsWrap = $("foodTags");

  const cycleBleeding = $("cycleBleeding");
  const cycleDay = $("cycleDay");
  const cyclePhase = $("cyclePhase");
  const cycleSymptoms = $("cycleSymptoms");

  const sportMinutes = $("sportMinutes");
  const musicMinutes = $("musicMinutes");

  const notes = $("notes");

  const wokeRestedSelect = $("wokeRestedSelect");
  const screenLateSelect = $("screenLateSelect");
  const medsAsPlannedSelect = $("medsAsPlannedSelect");
  const didSportSelect = $("didSportSelect");
  const didMusicSelect = $("didMusicSelect");

  const cWeek = $("chartWeek");
  const cMonth = $("chartMonth");
  const cAct = $("chartActivity");
  const cScat = $("chartScatter");
  const cPhase = $("chartPhase");
  const kpiWrap = $("kpis");
  const insightsWrap = $("insights");
  const tagCompareWrap = $("tagComparisons");

  function setDirty(v){
    dirty = v;
    if (unsavedHint) unsavedHint.textContent = dirty ? "Wijzigingen nog niet opgeslagen" : "Alles is opgeslagen";
    updateStatusPill();
  }

  function updateStatusPill(){
    if (!dateStatus) return;
    const saved = entriesByDate[selectedISO];
    const savedFilled = isEntryFilled(saved);
    const draftFilled = draft ? isEntryFilled(draft) : false;
    const hasUnsaved = dirty && draftFilled;

    if (hasUnsaved){
      dateStatus.className = "statuspill warn";
      dateStatus.textContent = "Nog niet opgeslagen";
      return;
    }

    if (savedFilled){
      dateStatus.className = "statuspill ok";
      const when = saved?.savedAt ? ` • ${fmtDateTime(saved.savedAt)}` : "";
      dateStatus.textContent = "Lokaal opgeslagen ✅" + when;
    } else {
      dateStatus.className = "statuspill warn";
      dateStatus.textContent = "Nog open";
    }
  }

function showToast(msg){
    if (!toast) return;
    toast.textContent = msg;
    toast.style.display = "block";
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { toast.style.display = "none"; }, 1800);
  }

  function setTab(which){
    const isLog = which === "log";
    tabLog.classList.toggle("active", isLog);
    tabDash.classList.toggle("active", !isLog);
    viewLog.style.display = isLog ? "" : "none";
    viewDash.style.display = isLog ? "none" : "";
    if (!isLog) renderDashboard();
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "instant" }));
  }

  tabLog.addEventListener("click", () => setTab("log"));
  tabDash.addEventListener("click", () => setTab("dash"));

  function setSelectedDate(iso){
    selectedISO = iso;
    datePicker.value = selectedISO;
    draft = JSON.parse(JSON.stringify(getOrCreate(entriesByDate, selectedISO)));
    draft._touched = draft._touched || {};
    setDirty(false);
    renderForm();
    renderDateChips();
    updateStatusPill();
  }

  btnPrevDay.addEventListener("click", () => {
    const d = new Date(selectedISO);
    d.setDate(d.getDate() - 1);
    setSelectedDate(toISODate(d));
  });

  btnNextDay.addEventListener("click", () => {
    const d = new Date(selectedISO);
    d.setDate(d.getDate() + 1);
    setSelectedDate(toISODate(d));
  });

  datePicker.addEventListener("change", (e) => setSelectedDate(e.target.value));

  btnExportImport.addEventListener("click", () => {
    exportImport.style.display = "";
    exportText.value = JSON.stringify(Object.values(entriesByDate).sort((a,b)=>a.dateISO.localeCompare(b.dateISO)), null, 2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  btnCloseExport.addEventListener("click", () => exportImport.style.display = "none");


if (btnResetCache){
  btnResetCache.addEventListener("click", async () => {
    try{
      // Try to activate newest SW quickly
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({ type: "SKIP_WAITING" });
      }

      // Unregister SW (keeps your saved localStorage data intact)
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }

      // Clear caches (offline files)
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }

      alert("Cache gereset. De app wordt opnieuw geladen.");
      location.reload();
    }catch(e){
      alert("Cache reset lukte niet helemaal. Probeer Safari volledig te sluiten en opnieuw te openen.");
    }
  });
}


  btnCopyExport.addEventListener("click", async () => {
    try{
      await navigator.clipboard.writeText(exportText.value);
      alert("Gekopieerd!");
    }catch{
      exportText.select();
      document.execCommand("copy");
      alert("Gekopieerd (fallback)!");
    }
  });

  btnImport.addEventListener("click", () => {
    const arr = safeJsonParse(importText.value, null);
    if (!Array.isArray(arr)) return alert("Import mislukt: verwacht een JSON array met entries.");
    const byDate = {};
    arr.forEach(e => { if (e?.dateISO) byDate[e.dateISO] = deepMerge(DEFAULT_ENTRY(e.dateISO), e); });
    entriesByDate = byDate;
    saveEntries(entriesByDate);
    alert("Import gelukt!");
    setSelectedDate(selectedISO);
  });

  function renderFoodTags(){
    if (!foodTagsWrap) return;
    foodTagsWrap.innerHTML = "";
    const tags = draft.foodTags || {};
    FOOD_TAGS.forEach(t => {
      const isOn = !!tags[t.key];
      const el = document.createElement("label");
      el.className = "badge" + (isOn ? " active" : "");
      el.innerHTML = `<input type="checkbox" ${isOn ? "checked" : ""} /> <span>${t.label}</span>`;
      const sync = (checked) => {
        draft.foodTags = { ...(draft.foodTags || {}), [t.key]: !!checked };
        el.classList.toggle("active", !!checked);
        markDirty();
      };
      el.addEventListener("click", (ev) => {
        if (ev.target && ev.target.tagName !== "INPUT") {
          const cb = el.querySelector("input");
          cb.checked = !cb.checked;
          sync(cb.checked);
        }
      });
      el.querySelector("input").addEventListener("click", (ev) => {
        ev.stopPropagation();
        sync(ev.target.checked);
      });
      foodTagsWrap.appendChild(el);
    });
  }

  function markTouched(key){
    draft._touched = draft._touched || {};
    draft._touched[key] = true;
  }

  function markDirty(){
    setDirty(true);
    renderEmptyFlags();
    renderDateChips();
    updateStatusPill();
  }

  function emptyFlagHTML(isEmpty){
    return isEmpty ? '<span class="empty-flag">LEEG</span>' : "";
  }

  function renderEmptyFlags(){
    const mappings = [
      ["energyLevel", draft.energyLevel, energyLevelVal],
      ["focusLevel", draft.focusLevel, focusLevelVal],
      ["symptomLoad", draft.symptomLoad, symptomLoadVal],
      ["sleepQuality", draft.sleepQuality, sleepQualityVal],
      ["stressLevel", draft.stressLevel, stressLevelVal],
    ];
    for (const [k, v, el] of mappings){
      if (!el) continue;
      const touched = !!(draft._touched && draft._touched[k]);
      const isEmpty = (v == null) && !touched;
      el.innerHTML = (v == null ? "—" : String(v)) + emptyFlagHTML(isEmpty);
    }
  }

  function bind(){
    energyLevel.addEventListener("input", (e) => { markTouched("energyLevel"); draft.energyLevel = Number(e.target.value); markDirty(); });
    focusLevel.addEventListener("input", (e) => { markTouched("focusLevel"); draft.focusLevel = Number(e.target.value); markDirty(); });
    symptomLoad.addEventListener("input", (e) => { markTouched("symptomLoad"); draft.symptomLoad = Number(e.target.value); markDirty(); });
    sleepQuality.addEventListener("input", (e) => { markTouched("sleepQuality"); draft.sleepQuality = Number(e.target.value); markDirty(); });

    sleepHours.addEventListener("input", (e) => {
      markTouched("sleepHours");
      draft.sleepHours = (e.target.value === "" ? null : clamp(Number(e.target.value||0),0,24));
      markDirty();
    });

    stressLevel.addEventListener("input", (e) => { markTouched("stressLevel"); draft.stressLevel = Number(e.target.value); markDirty(); });

    caffeineTiming.addEventListener("change", (e) => { draft.caffeineTiming = e.target.value; markDirty(); });

    const giverHandler = () => { draft.energyGivers = [giver1.value, giver2.value, giver3.value].slice(0,3); markDirty(); };
    giver1.addEventListener("input", giverHandler);
    giver2.addEventListener("input", giverHandler);
    giver3.addEventListener("input", giverHandler);

    foodBreakfast.addEventListener("input", (e) => { draft.food.breakfast = e.target.value; markDirty(); });
    foodLunch.addEventListener("input", (e) => { draft.food.lunch = e.target.value; markDirty(); });
    foodDinner.addEventListener("input", (e) => { draft.food.dinner = e.target.value; markDirty(); });
    foodSnacks.addEventListener("input", (e) => { draft.food.snacks = e.target.value; markDirty(); });

    cycleBleeding.addEventListener("change", (e) => { draft.cycle.bleeding = e.target.value; markDirty(); });
    cycleDay.addEventListener("input", (e) => { draft.cycle.cycleDay = e.target.value; markDirty(); });
    cyclePhase.addEventListener("change", (e) => { draft.cycle.phase = e.target.value; markDirty(); });
    cycleSymptoms.addEventListener("input", (e) => { draft.cycle.symptoms = e.target.value; markDirty(); });

    sportMinutes.addEventListener("input", (e) => { draft.activities.sportMinutes = (e.target.value === "" ? null : clamp(Number(e.target.value||0),0,600)); markDirty(); });
    musicMinutes.addEventListener("input", (e) => { draft.activities.musicMinutes = (e.target.value === "" ? null : clamp(Number(e.target.value||0),0,600)); markDirty(); });

    notes.addEventListener("input", (e) => { draft.notes = e.target.value; markDirty(); });

    
// Bool selects
if (wokeRestedSelect) wokeRestedSelect.addEventListener("change", (e) => { draft.wokeRested = selectValueToBool(e.target.value); markDirty(); });
if (screenLateSelect) screenLateSelect.addEventListener("change", (e) => { draft.screenLate = selectValueToBool(e.target.value); markDirty(); });
if (medsAsPlannedSelect) medsAsPlannedSelect.addEventListener("change", (e) => { draft.medsAsPlanned = selectValueToBool(e.target.value); markDirty(); });
if (didSportSelect) didSportSelect.addEventListener("change", (e) => { draft.activities.didSport = selectValueToBool(e.target.value); markDirty(); });
if (didMusicSelect) didMusicSelect.addEventListener("change", (e) => { draft.activities.didMusic = selectValueToBool(e.target.value); markDirty(); });

    saveBtn.addEventListener("click", () => {
      const toSave = JSON.parse(JSON.stringify(draft));
      delete toSave._touched;
      toSave.savedAt = new Date().toISOString();

      entriesByDate = { ...entriesByDate, [selectedISO]: toSave };
      saveEntries(entriesByDate);

      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = safeJsonParse(raw, []);
      const ok = Array.isArray(parsed) && parsed.some(e => e && e.dateISO === selectedISO && e.savedAt === toSave.savedAt);

      setDirty(false);
      renderDateChips();
      updateStatusPill();
      showToast(ok ? `Opgeslagen ✅: ${selectedISO}` : `Let op: opslaan niet bevestigd`);
    });
  }

  function renderForm(){
    energyLevel.value = (draft.energyLevel == null ? 5 : draft.energyLevel);
    focusLevel.value = (draft.focusLevel == null ? 5 : draft.focusLevel);
    symptomLoad.value = (draft.symptomLoad == null ? 5 : draft.symptomLoad);
    sleepQuality.value = (draft.sleepQuality == null ? 5 : draft.sleepQuality);

    sleepHours.value = (draft.sleepHours == null ? "" : draft.sleepHours);
    stressLevel.value = (draft.stressLevel == null ? 5 : draft.stressLevel);

    giver1.value = draft.energyGivers?.[0] ?? "";
    giver2.value = draft.energyGivers?.[1] ?? "";
    giver3.value = draft.energyGivers?.[2] ?? "";

    foodBreakfast.value = draft.food?.breakfast ?? "";
    foodLunch.value = draft.food?.lunch ?? "";
    foodDinner.value = draft.food?.dinner ?? "";
    foodSnacks.value = draft.food?.snacks ?? "";
    renderFoodTags();

    cycleBleeding.value = draft.cycle?.bleeding ?? "none";
    cycleDay.value = draft.cycle?.cycleDay ?? "";
    cyclePhase.value = draft.cycle?.phase ?? "unknown";
    cycleSymptoms.value = draft.cycle?.symptoms ?? "";

    sportMinutes.value = (draft.activities?.sportMinutes == null ? "" : draft.activities.sportMinutes);
    musicMinutes.value = (draft.activities?.musicMinutes == null ? "" : draft.activities.musicMinutes);

    notes.value = draft.notes ?? "";
    caffeineTiming.value = draft.caffeineTiming || "none";


if (wokeRestedSelect) wokeRestedSelect.value = boolToSelectValue(draft.wokeRested);
if (screenLateSelect) screenLateSelect.value = boolToSelectValue(draft.screenLate);
if (medsAsPlannedSelect) medsAsPlannedSelect.value = boolToSelectValue(draft.medsAsPlanned);
if (didSportSelect) didSportSelect.value = boolToSelectValue(draft.activities.didSport);
if (didMusicSelect) didMusicSelect.value = boolToSelectValue(draft.activities.didMusic);

    // NOTE: renderTri(...) calls removed (dropdowns are used instead)

    renderEmptyFlags();
  }

  // Dashboard data
  function allSavedEntries(){
    return Object.values(entriesByDate).filter(e => e && e.dateISO);
  }

  function computeRange(endISO, daysBack){
    const end = new Date(endISO);
    const start = new Date(end);
    start.setDate(start.getDate() - daysBack + 1);
    const out = [];
    for (let i=0;i<daysBack;i++){
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = toISODate(d);
      const e = entriesByDate[iso];
      out.push({
        iso,
        label: iso.slice(8,10) + "-" + iso.slice(5,7),
        energy: typeof e?.energyLevel === "number" ? e.energyLevel : null,
        focus: typeof e?.focusLevel === "number" ? e.focusLevel : null,
        symptomLoad: typeof e?.symptomLoad === "number" ? e.symptomLoad : null,
        sleepQ: typeof e?.sleepQuality === "number" ? e.sleepQuality : null,
        sportMin: typeof e?.activities?.sportMinutes === "number" ? e.activities.sportMinutes : 0,
        musicMin: typeof e?.activities?.musicMinutes === "number" ? e.activities.musicMinutes : 0
      });
    }
    return out;
  }

  function computeAllTimeData(){
    return allSavedEntries().map(e => ({
      iso: e.dateISO,
      energy: typeof e.energyLevel === "number" ? e.energyLevel : null,
      focus: typeof e.focusLevel === "number" ? e.focusLevel : null,
      symptomLoad: typeof e.symptomLoad === "number" ? e.symptomLoad : null,
      sleepQ: typeof e.sleepQuality === "number" ? e.sleepQuality : null,
      sportMin: typeof e.activities?.sportMinutes === "number" ? e.activities.sportMinutes : 0,
      musicMin: typeof e.activities?.musicMinutes === "number" ? e.activities.musicMinutes : 0,
      phase: e.cycle?.phase ?? "unknown",
      stress: typeof e.stressLevel === "number" ? e.stressLevel : null,
      caffeineTiming: e.caffeineTiming ?? "none",
      screenLate: e.screenLate === true,
      tags: e.foodTags || {}
    }));
  }

  function renderKPIsFrom(data){
    const items = [
      { k: "Gem. energie", v: fmt(avg(data.map(d=>d.energy))) },
      { k: "Gem. focus", v: fmt(avg(data.map(d=>d.focus))) },
      { k: "Gem. klachtenlast", v: fmt(avg(data.map(d=>d.symptomLoad))) },
      { k: "Gem. slaapkwaliteit", v: fmt(avg(data.map(d=>d.sleepQ))) },
      { k: "Sport (min)", v: String(data.reduce((a,d)=>a+(d.sportMin||0),0)) },
      { k: "Muziek (min)", v: String(data.reduce((a,d)=>a+(d.musicMin||0),0)) }
    ];
    kpiWrap.innerHTML = "";
    items.forEach(it=>{
      const el=document.createElement("div");
      el.className="kpi";
      el.innerHTML=`<div class="k">${it.k}</div><div class="v">${it.v}</div>`;
      kpiWrap.appendChild(el);
    });
  }

  function computePhaseAverages(data){
    const groups = {};
    PHASES.forEach(p => groups[p.key] = { label: p.label, energy: [], focus: [], sleepQ: [] });
    data.forEach(d => {
      if (!groups[d.phase]) return;
      if (typeof d.energy === "number") groups[d.phase].energy.push(d.energy);
      if (typeof d.focus === "number") groups[d.phase].focus.push(d.focus);
      if (typeof d.sleepQ === "number") groups[d.phase].sleepQ.push(d.sleepQ);
    });
    return PHASES.map(p => {
      const g = groups[p.key];
      return { label: g.label, energy: avg(g.energy), focus: avg(g.focus), sleepQ: avg(g.sleepQ) };
    });
  }

  function diffMeans(a, b){
    const av = avg(a), bv = avg(b);
    if (av == null || bv == null) return null;
    return av - bv;
  }

  function renderInsights(data){
    const MIN_N = 4;
    const insights = [];

    const eve = data.filter(d=>d.caffeineTiming==="evening").map(d=>d.sleepQ);
    const notEve = data.filter(d=>d.caffeineTiming!=="evening").map(d=>d.sleepQ);
    if (countValid(eve) >= MIN_N && countValid(notEve) >= MIN_N){
      const delta = diffMeans(notEve, eve);
      insights.push({ title:"Cafeïne (avond) ↔ slaap", desc:`Gem. slaapkwaliteit zonder avondcafeïne is ${fmt(delta)} punt hoger (positief = beter).` });
    }

    const late = data.filter(d=>d.screenLate).map(d=>d.sleepQ);
    const notLate = data.filter(d=>!d.screenLate).map(d=>d.sleepQ);
    if (countValid(late) >= MIN_N && countValid(notLate) >= MIN_N){
      const delta = diffMeans(notLate, late);
      insights.push({ title:"Scherm na 21:00 ↔ slaap", desc:`Gem. slaapkwaliteit zonder laat scherm is ${fmt(delta)} punt hoger (positief = beter).` });
    }

    const highStress = data.filter(d=>typeof d.stress==="number" && d.stress>=7);
    const lowStress = data.filter(d=>typeof d.stress==="number" && d.stress<=3);
    if (highStress.length >= MIN_N && lowStress.length >= MIN_N){
      const deltaFocus = diffMeans(lowStress.map(d=>d.focus), highStress.map(d=>d.focus));
      const deltaSym = diffMeans(highStress.map(d=>d.symptomLoad), lowStress.map(d=>d.symptomLoad));
      insights.push({ title:"Stress/prikkels ↔ focus/klachten", desc:`Bij lage stress (0–3) is focus gemiddeld ${fmt(deltaFocus)} punt hoger; klachtenlast bij hoge stress (7–10) is gemiddeld ${fmt(deltaSym)} punt hoger.` });
    }

    const phaseAvg = computePhaseAverages(data);
    const focusPhases = phaseAvg.filter(p=>p.focus!=null);
    if (focusPhases.length >= 2){
      const best = [...focusPhases].sort((a,b)=>b.focus-a.focus)[0];
      const worst = [...focusPhases].sort((a,b)=>a.focus-b.focus)[0];
      const delta = best.focus - worst.focus;
      if (delta >= 0.5){
        insights.push({ title:"Cyclusfase ↔ focus", desc:`In je data is focus in "${best.label}" gemiddeld ${fmt(delta)} punt hoger dan in "${worst.label}".` });
      }
    }

    insightsWrap.innerHTML = "";
    (insights.slice(0,3).length ? insights.slice(0,3) : [{ title:"Nog te weinig data", desc:"Log een paar weken consistent (incl. stress/scherm/fase) en kom terug." }])
      .forEach(it=>{
        const el=document.createElement("div");
        el.className="insight";
        el.innerHTML=`<div class="t">${it.title}</div><div class="d">${it.desc}</div>`;
        insightsWrap.appendChild(el);
      });
  }

  function renderTagComparisons(data){
    if (!tagCompareWrap) return;
    const MIN_N = 4;
    const metrics = [
      { key: "focus", label: "Focus", get: (d)=>d.focus },
      { key: "sleepQ", label: "Slaapkwaliteit", get: (d)=>d.sleepQ },
      { key: "symptomLoad", label: "Klachtenlast", get: (d)=>d.symptomLoad },
      { key: "energy", label: "Energie", get: (d)=>d.energy }
    ];
    const rows = [];
    FOOD_TAGS.forEach(t => {
      metrics.forEach(m => {
        const on = data.filter(d => d.tags && d.tags[t.key]).map(m.get);
        const off = data.filter(d => !(d.tags && d.tags[t.key])).map(m.get);
        const nOn = countValid(on), nOff = countValid(off);
        if (nOn >= MIN_N && nOff >= MIN_N){
          const delta = avg(on) - avg(off);
          rows.push({ title: `${t.label} → ${m.label}`, desc: `Met: ${fmt(avg(on))} (n=${nOn}) • Zonder: ${fmt(avg(off))} (n=${nOff}) • Δ=${fmt(delta)}` });
        }
      });
    });

    function deltaAbs(desc){
      const m = /Δ=([—0-9\.-]+)/.exec(desc);
      if (!m || m[1] === "—") return 0;
      const v = Number(m[1]);
      return Number.isFinite(v) ? Math.abs(v) : 0;
    }
    rows.sort((a,b)=>deltaAbs(b.desc)-deltaAbs(a.desc));

    tagCompareWrap.innerHTML = "";
    if (!rows.length){
      tagCompareWrap.innerHTML = `<div class="compare-row"><div class="h">Nog te weinig data</div><div class="m">Log minimaal ~1–2 weken en gebruik je tags. Daarna verschijnen vergelijkingen met n= per groep.</div></div>`;
      return;
    }
    rows.slice(0,10).forEach(r=>{
      const el=document.createElement("div");
      el.className="compare-row";
      el.innerHTML = `<div class="h"><span>${r.title}</span></div><div class="m">${r.desc}</div>`;
      tagCompareWrap.appendChild(el);
    });
  }

  // Canvas charts
  function clearCanvas(c){ const ctx=c.getContext("2d"); ctx.clearRect(0,0,c.width,c.height); return ctx; }
  function drawAxes(ctx, w, h, pad){
    ctx.strokeStyle="rgba(0,0,0,0.18)";
    ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(pad, pad);
    ctx.lineTo(pad, h-pad);
    ctx.lineTo(w-pad, h-pad);
    ctx.stroke();
  }
  function drawLineSeries(ctx, points, w, h, pad, yMin, yMax, alpha){
    const usableW=w-pad*2, usableH=h-pad*2;
    ctx.strokeStyle=`rgba(0,0,0,${alpha})`;
    ctx.lineWidth=2;
    ctx.beginPath();
    points.forEach((p,i)=>{
      const x=pad+(i/(points.length-1||1))*usableW;
      const y=pad+(1-((p-yMin)/(yMax-yMin||1)))*usableH;
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
  }
  function drawBars(ctx, seriesA, seriesB, w, h, pad){
    const usableW=w-pad*2, usableH=h-pad*2;
    const n=Math.max(seriesA.length,1);
    const maxV=Math.max(1,...seriesA,...seriesB);
    const groupW=usableW/n;
    const barW=Math.max(2,groupW*0.35);
    for(let i=0;i<n;i++){
      const a=seriesA[i]||0, b=seriesB[i]||0;
      const x0=pad+i*groupW;
      const ha=(a/maxV)*usableH, hb=(b/maxV)*usableH;
      ctx.fillStyle="rgba(0,0,0,0.55)";
      ctx.fillRect(x0+groupW*0.18,(h-pad)-ha,barW,ha);
      ctx.fillStyle="rgba(0,0,0,0.28)";
      ctx.fillRect(x0+groupW*0.55,(h-pad)-hb,barW,hb);
    }
  }
  function drawScatter(ctx, pts, w, h, pad, xMin, xMax, yMin, yMax){
    const usableW=w-pad*2, usableH=h-pad*2;
    ctx.fillStyle="rgba(0,0,0,0.55)";
    pts.forEach(p=>{
      const x=pad+((p.x-xMin)/(xMax-xMin||1))*usableW;
      const y=pad+(1-((p.y-yMin)/(yMax-yMin||1)))*usableH;
      ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2); ctx.fill();
    });
  }
  function drawLabelsX(ctx, labels, w, h, pad){
    const usableW=w-pad*2;
    ctx.fillStyle="rgba(0,0,0,0.55)";
    ctx.font="12px ui-sans-serif, system-ui, -apple-system";
    const step=Math.ceil(labels.length/7);
    labels.forEach((lab,i)=>{
      if(i%step!==0 && i!==labels.length-1) return;
      const x=pad+(i/(labels.length-1||1))*usableW;
      ctx.fillText(lab,x-14,h-pad+18);
    });
  }
  function drawGroupedBars(ctx, labels, seriesList, w, h, pad){
    const usableW=w-pad*2, usableH=h-pad*2;
    const n=Math.max(labels.length,1);
    const maxV=10;
    const groupW=usableW/n;
    const barW=Math.max(6,groupW*0.18);
    const offsets=seriesList.map((_,idx)=>(idx-(seriesList.length-1)/2)*(barW*1.2));
    for(let i=0;i<n;i++){
      const xCenter=pad+i*groupW+groupW/2;
      seriesList.forEach((s,si)=>{
        const v=s.values[i];
        const hv=((v==null?0:v)/maxV)*usableH;
        ctx.fillStyle=`rgba(0,0,0,${s.alpha})`;
        ctx.fillRect(xCenter+offsets[si]-barW/2,(h-pad)-hv,barW,hv);
      });
    }
    drawLabelsX(ctx,labels,w,h,pad);
  }

  function renderDashboard(){
    const week = computeRange(selectedISO, 7);
    const month = computeRange(selectedISO, 30);
    const allData = computeAllTimeData();

    renderKPIsFrom(allData);
    renderInsights(allData);
    renderTagComparisons(allData);

    // phase chart (all-time)
    {
      const phaseAvg = computePhaseAverages(allData);
      const labels = phaseAvg.map(p=>p.label);
      const ctx = clearCanvas(cPhase);
      const w = cPhase.width, h = cPhase.height, pad = 34;
      drawAxes(ctx,w,h,pad);
      drawGroupedBars(ctx, labels, [
        { alpha: 0.55, values: phaseAvg.map(p=>p.energy) },
        { alpha: 0.28, values: phaseAvg.map(p=>p.focus) },
        { alpha: 0.18, values: phaseAvg.map(p=>p.sleepQ) }
      ], w,h,pad);
    }

    // week chart relative
    {
      const ctx = clearCanvas(cWeek);
      const w = cWeek.width, h = cWeek.height, pad = 34;
      drawAxes(ctx,w,h,pad);
      drawLineSeries(ctx, week.map(d=>d.energy ?? 0), w,h,pad,0,10,0.55);
      drawLineSeries(ctx, week.map(d=>d.focus ?? 0), w,h,pad,0,10,0.28);
      drawLineSeries(ctx, week.map(d=>d.sleepQ ?? 0), w,h,pad,0,10,0.18);
      drawLabelsX(ctx, week.map(d=>d.label), w,h,pad);
    }

    // month chart relative (incl symptomLoad faint)
    {
      const ctx = clearCanvas(cMonth);
      const w = cMonth.width, h = cMonth.height, pad = 34;
      drawAxes(ctx,w,h,pad);
      drawLineSeries(ctx, month.map(d=>d.energy ?? 0), w,h,pad,0,10,0.55);
      drawLineSeries(ctx, month.map(d=>d.focus ?? 0), w,h,pad,0,10,0.28);
      drawLineSeries(ctx, month.map(d=>d.sleepQ ?? 0), w,h,pad,0,10,0.18);
      drawLineSeries(ctx, month.map(d=>d.symptomLoad ?? 0), w,h,pad,0,10,0.10);
      drawLabelsX(ctx, month.map(d=>d.label), w,h,pad);
    }

    // activities
    {
      const ctx = clearCanvas(cAct);
      const w = cAct.width, h = cAct.height, pad = 34;
      drawAxes(ctx,w,h,pad);
      drawBars(ctx, month.map(d=>d.sportMin), month.map(d=>d.musicMin), w,h,pad);
      drawLabelsX(ctx, month.map(d=>d.label), w,h,pad);
    }

    // scatter week
    {
      const pts = week.filter(d=>typeof d.energy==="number" && typeof d.focus==="number").map(d=>({x:d.energy,y:d.focus}));
      const ctx = clearCanvas(cScat);
      const w = cScat.width, h = cScat.height, pad = 34;
      drawAxes(ctx,w,h,pad);
      drawScatter(ctx, pts, w,h,pad,0,10,0,10);
    }
  }

  // Init
  bind();
  setSelectedDate(todayISO);

  window.addEventListener("pageshow", () => {
    try { renderForm(); renderDateChips(); updateStatusPill(); } catch {}
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      try { await navigator.serviceWorker.register("./service-worker.js", { scope: "./" }); } catch {}
    });
  }
})();
