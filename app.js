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
  const toISODate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
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

    // ✅ NEW: Protein anchors (A)
    proteinAnchors: { breakfast: false, lunch: false, dinner: false },

    notes: "",
    savedAt: null
  });

  function safeJsonParse(raw, fallback) {
    try {
      const v = JSON.parse(raw);
      return v ?? fallback;
    } catch {
      return fallback;
    }
  }

  function deepMerge(obj, patch) {
    const out = JSON.parse(JSON.stringify(obj));
    for (const k in patch) {
      if (patch[k] && typeof patch[k] === "object" && !Array.isArray(patch[k])) {
        out[k] = { ...(out[k] || {}), ...patch[k] };
      } else {
        out[k] = patch[k];
      }
    }
    return out;
  }

  function normalizeEntries(arr) {
    const byDate = {};
    (Array.isArray(arr) ? arr : []).forEach((e) => {
      if (!e?.dateISO) return;
      const base = DEFAULT_ENTRY(e.dateISO);
      const merged = deepMerge(base, e);

      merged.foodTags = merged.foodTags || {};

      // ✅ Ensure proteinAnchors shape exists even for older saved data
      merged.proteinAnchors = merged.proteinAnchors || {};
      merged.proteinAnchors.breakfast = !!merged.proteinAnchors.breakfast;
      merged.proteinAnchors.lunch = !!merged.proteinAnchors.lunch;
      merged.proteinAnchors.dinner = !!merged.proteinAnchors.dinner;

      byDate[e.dateISO] = merged;
    });
    return byDate;
  }

  function loadEntries() {
    const rawNew = localStorage.getItem(STORAGE_KEY);
    if (rawNew) return normalizeEntries(safeJsonParse(rawNew, []));

    const oldKeys = [
      "fleur_daily_tracker_v4",
      "fleur_daily_tracker_v3",
      "fleur_daily_tracker_v2",
      "fleur_daily_tracker_v1"
    ];
    for (const k of oldKeys) {
      const raw = localStorage.getItem(k);
      if (raw) {
        const migrated = normalizeEntries(safeJsonParse(raw, []));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.values(migrated)));
        return migrated;
      }
    }
    return {};
  }

  function saveEntries(byDate) {
    const arr = Object.values(byDate).sort((a, b) => a.dateISO.localeCompare(b.dateISO));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  }

  function getOrCreate(byDate, iso) {
    return byDate[iso] ?? DEFAULT_ENTRY(iso);
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function fmt(v) {
    if (v == null) return "—";
    return (Math.round(v * 10) / 10).toString();
  }

  function fmtDateTime(iso) {
    try {
      if (!iso) return "";
      const d = new Date(iso);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const da = String(d.getDate()).padStart(2, "0");
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${y}-${m}-${da} ${hh}:${mm}`;
    } catch {
      return "";
    }
  }

  function avg(nums) {
    const valid = nums.filter((n) => typeof n === "number" && !Number.isNaN(n));
    if (!valid.length) return null;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
  }

  function countValid(nums) {
    return nums.filter((n) => typeof n === "number" && !Number.isNaN(n)).length;
  }

  function boolToSelectValue(v) {
    if (v === true) return "true";
    if (v === false) return "false";
    return "null";
  }
  function selectValueToBool(v) {
    if (v === "true") return true;
    if (v === "false") return false;
    return null;
  }

  function proteinAnchorsTotal(e) {
    const p = e?.proteinAnchors || {};
    const b = p.breakfast ? 1 : 0;
    const l = p.lunch ? 1 : 0;
    const d = p.dinner ? 1 : 0;
    return b + l + d; // 0..3
  }

  function isEntryFilled(e) {
    if (!e) return false;
    const anyScore = [e.energyLevel, e.focusLevel, e.symptomLoad, e.sleepQuality, e.stressLevel].some(
      (x) => typeof x === "number"
    );
    const anyText =
      (e.notes && e.notes.trim().length) ||
      (e.food && Object.values(e.food).some((s) => (s || "").trim().length)) ||
      (e.energyGivers && e.energyGivers.some((s) => (s || "").trim().length)) ||
      (e.cycle &&
        ((e.cycle.cycleDay || "").trim().length ||
          (e.cycle.symptoms || "").trim().length ||
          e.cycle.bleeding !== "none" ||
          e.cycle.phase !== "unknown")) ||
      (e.activities && (typeof e.activities.sportMinutes === "number" || typeof e.activities.musicMinutes === "number"));

    const anyBools = [
      e.wokeRested,
      e.screenLate,
      e.medsAsPlanned,
      e.activities?.didSport,
      e.activities?.didMusic
    ].some((v) => v === true || v === false);

    const anyTags = e.foodTags && Object.values(e.foodTags).some((v) => v === true);

    const anyAnchors = proteinAnchorsTotal(e) > 0;
    return !!(anyScore || anyText || anyBools || anyTags || anyAnchors);
  }

  function renderDateChips() {
    if (!dateChips) return;
    dateChips.innerHTML = "";
    const base = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      const iso = toISODate(d);
      const e = entriesByDate[iso];
      const filled = isEntryFilled(e);
      const b = document.createElement("button");
      b.type = "button";
      const isSelected = iso === selectedISO;
      const pending = isSelected && dirty && draft && isEntryFilled(draft);
      b.className =
        "chip" + (filled || pending ? " filled" : "") + (pending ? " pending" : "") + (isSelected ? " active" : "");
      b.textContent = iso.slice(8, 10);
      b.title = iso;
      b.addEventListener("click", () => setSelectedDate(iso));
      dateChips.appendChild(b);
    }
    if (dateStatus) {
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

  const proteinAnchorBreakfast = $("proteinAnchorBreakfast");
  const proteinAnchorLunch = $("proteinAnchorLunch");
  const proteinAnchorDinner = $("proteinAnchorDinner");

  const cWeek = $("chartWeek");
  const cMonth = $("chartMonth");
  const cAct = $("chartActivity");
  const cScat = $("chartScatter");
  const cPhase = $("chartPhase");
  const kpiWrap = $("kpis");
  const insightsWrap = $("insights");
  const tagCompareWrap = $("tagComparisons");

  function setDirty(v) {
    dirty = v;
    if (unsavedHint) unsavedHint.textContent = dirty ? "Wijzigingen nog niet opgeslagen" : "Alles is opgeslagen";
    updateStatusPill();
  }

  function updateStatusPill() {
    if (!dateStatus) return;
    const saved = entriesByDate[selectedISO];
    const savedFilled = isEntryFilled(saved);
    const draftFilled = draft ? isEntryFilled(draft) : false;
    const hasUnsaved = dirty && draftFilled;

    if (hasUnsaved) {
      dateStatus.className = "small-note statuspill warn";
      dateStatus.textContent = "Nog niet opgeslagen";
      return;
    }

    if (savedFilled) {
      dateStatus.className = "small-note statuspill ok";
      const when = saved?.savedAt ? ` • ${fmtDateTime(saved.savedAt)}` : "";
      dateStatus.textContent = "Lokaal opgeslagen ✅" + when;
    } else {
      dateStatus.className = "small-note statuspill warn";
      dateStatus.textContent = "Nog open";
    }
  }

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.style.display = "block";
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      toast.style.display = "none";
    }, 1800);
  }

  function setTab(which) {
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

  function setSelectedDate(iso) {
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
    exportText.value = JSON.stringify(Object.values(entriesByDate).sort((a, b) => a.dateISO.localeCompare(b.dateISO)), null, 2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  btnCloseExport.addEventListener("click", () => (exportImport.style.display = "none"));

  btnCopyExport?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(exportText.value);
      alert("Gekopieerd!");
    } catch {
      exportText.select();
      document.execCommand("copy");
      alert("Gekopieerd (fallback)!");
    }
  });

  btnImport?.addEventListener("click", () => {
    const arr = safeJsonParse(importText.value, null);
    if (!Array.isArray(arr)) return alert("Import mislukt: verwacht een JSON array met entries.");
    const byDate = {};
    arr.forEach((e) => {
      if (e?.dateISO) byDate[e.dateISO] = deepMerge(DEFAULT_ENTRY(e.dateISO), e);
    });
    entriesByDate = byDate;
    saveEntries(entriesByDate);
    alert("Import gelukt!");
    setSelectedDate(selectedISO);
  });

  function renderFoodTags() {
    if (!foodTagsWrap) return;
    foodTagsWrap.innerHTML = "";
    const tags = draft.foodTags || {};
    FOOD_TAGS.forEach((t) => {
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

  function markTouched(key) {
    draft._touched = draft._touched || {};
    draft._touched[key] = true;
  }

  function markDirty() {
    setDirty(true);
    renderEmptyFlags();
    renderDateChips();
    updateStatusPill();
  }

  function emptyFlagHTML(isEmpty) {
    return isEmpty ? '<span class="empty-flag">LEEG</span>' : "";
  }

  function renderEmptyFlags() {
    const mappings = [
      ["energyLevel", draft.energyLevel, energyLevelVal],
      ["focusLevel", draft.focusLevel, focusLevelVal],
      ["symptomLoad", draft.symptomLoad, symptomLoadVal],
      ["sleepQuality", draft.sleepQuality, sleepQualityVal],
      ["stressLevel", draft.stressLevel, stressLevelVal]
    ];
    for (const [k, v, el] of mappings) {
      if (!el) continue;
      const touched = !!(draft._touched && draft._touched[k]);
      const isEmpty = v == null && !touched;
      el.innerHTML = (v == null ? "—" : String(v)) + emptyFlagHTML(isEmpty);
    }
  }

  function bind() {
    energyLevel.addEventListener("input", (e) => {
      markTouched("energyLevel");
      draft.energyLevel = Number(e.target.value);
      markDirty();
    });
    focusLevel.addEventListener("input", (e) => {
      markTouched("focusLevel");
      draft.focusLevel = Number(e.target.value);
      markDirty();
    });
    symptomLoad.addEventListener("input", (e) => {
      markTouched("symptomLoad");
      draft.symptomLoad = Number(e.target.value);
      markDirty();
    });
    sleepQuality.addEventListener("input", (e) => {
      markTouched("sleepQuality");
      draft.sleepQuality = Number(e.target.value);
      markDirty();
    });

    sleepHours.addEventListener("input", (e) => {
      markTouched("sleepHours");
      draft.sleepHours = e.target.value === "" ? null : clamp(Number(e.target.value || 0), 0, 24);
      markDirty();
    });

    stressLevel.addEventListener("input", (e) => {
      markTouched("stressLevel");
      draft.stressLevel = Number(e.target.value);
      markDirty();
    });

    caffeineTiming.addEventListener("change", (e) => {
      draft.caffeineTiming = e.target.value;
      markDirty();
    });

    const giverHandler = () => {
      draft.energyGivers = [giver1.value, giver2.value, giver3.value].slice(0, 3);
      markDirty();
    };
    giver1.addEventListener("input", giverHandler);
    giver2.addEventListener("input", giverHandler);
    giver3.addEventListener("input", giverHandler);

    foodBreakfast.addEventListener("input", (e) => {
      draft.food.breakfast = e.target.value;
      markDirty();
    });
    foodLunch.addEventListener("input", (e) => {
      draft.food.lunch = e.target.value;
      markDirty();
    });
    foodDinner.addEventListener("input", (e) => {
      draft.food.dinner = e.target.value;
      markDirty();
    });
    foodSnacks.addEventListener("input", (e) => {
      draft.food.snacks = e.target.value;
      markDirty();
    });

    cycleBleeding.addEventListener("change", (e) => {
      draft.cycle.bleeding = e.target.value;
      markDirty();
    });
    cycleDay.addEventListener("input", (e) => {
      draft.cycle.cycleDay = e.target.value;
      markDirty();
    });
    cyclePhase.addEventListener("change", (e) => {
      draft.cycle.phase = e.target.value;
      markDirty();
    });
    cycleSymptoms.addEventListener("input", (e) => {
      draft.cycle.symptoms = e.target.value;
      markDirty();
    });

    sportMinutes.addEventListener("input", (e) => {
      draft.activities.sportMinutes = e.target.value === "" ? null : clamp(Number(e.target.value || 0), 0, 600);
      markDirty();
    });
    musicMinutes.addEventListener("input", (e) => {
      draft.activities.musicMinutes = e.target.value === "" ? null : clamp(Number(e.target.value || 0), 0, 600);
      markDirty();
    });

    notes.addEventListener("input", (e) => {
      draft.notes = e.target.value;
      markDirty();
    });

    wokeRestedSelect?.addEventListener("change", (e) => {
      draft.wokeRested = selectValueToBool(e.target.value);
      markDirty();
    });
    screenLateSelect?.addEventListener("change", (e) => {
      draft.screenLate = selectValueToBool(e.target.value);
      markDirty();
    });
    medsAsPlannedSelect?.addEventListener("change", (e) => {
      draft.medsAsPlanned = selectValueToBool(e.target.value);
      markDirty();
    });
    didSportSelect?.addEventListener("change", (e) => {
      draft.activities.didSport = selectValueToBool(e.target.value);
      markDirty();
    });
    didMusicSelect?.addEventListener("change", (e) => {
      draft.activities.didMusic = selectValueToBool(e.target.value);
      markDirty();
    });

    const ensureProteinAnchors = () => {
      draft.proteinAnchors = draft.proteinAnchors || { breakfast: false, lunch: false, dinner: false };
      draft.proteinAnchors.breakfast = !!draft.proteinAnchors.breakfast;
      draft.proteinAnchors.lunch = !!draft.proteinAnchors.lunch;
      draft.proteinAnchors.dinner = !!draft.proteinAnchors.dinner;
    };

    proteinAnchorBreakfast?.addEventListener("change", (e) => {
      ensureProteinAnchors();
      draft.proteinAnchors.breakfast = !!e.target.checked;
      markDirty();
    });
    proteinAnchorLunch?.addEventListener("change", (e) => {
      ensureProteinAnchors();
      draft.proteinAnchors.lunch = !!e.target.checked;
      markDirty();
    });
    proteinAnchorDinner?.addEventListener("change", (e) => {
      ensureProteinAnchors();
      draft.proteinAnchors.dinner = !!e.target.checked;
      markDirty();
    });

    saveBtn.addEventListener("click", () => {
      const toSave = JSON.parse(JSON.stringify(draft));
      delete toSave._touched;
      toSave.savedAt = new Date().toISOString();

      entriesByDate = { ...entriesByDate, [selectedISO]: toSave };
      saveEntries(entriesByDate);

      setDirty(false);
      renderDateChips();
      updateStatusPill();
      showToast(`Opgeslagen ✅: ${selectedISO}`);
    });
  }

  function renderForm() {
    energyLevel.value = draft.energyLevel == null ? 0 : draft.energyLevel;
    focusLevel.value = draft.focusLevel == null ? 0 : draft.focusLevel;
    symptomLoad.value = draft.symptomLoad == null ? 0 : draft.symptomLoad;
    sleepQuality.value = draft.sleepQuality == null ? 0 : draft.sleepQuality;

    sleepHours.value = draft.sleepHours == null ? "" : draft.sleepHours;
    stressLevel.value = draft.stressLevel == null ? 0 : draft.stressLevel;

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

    sportMinutes.value = draft.activities?.sportMinutes == null ? "" : draft.activities.sportMinutes;
    musicMinutes.value = draft.activities?.musicMinutes == null ? "" : draft.activities.musicMinutes;

    notes.value = draft.notes ?? "";
    caffeineTiming.value = draft.caffeineTiming || "none";

    wokeRestedSelect && (wokeRestedSelect.value = boolToSelectValue(draft.wokeRested));
    screenLateSelect && (screenLateSelect.value = boolToSelectValue(draft.screenLate));
    medsAsPlannedSelect && (medsAsPlannedSelect.value = boolToSelectValue(draft.medsAsPlanned));
    didSportSelect && (didSportSelect.value = boolToSelectValue(draft.activities.didSport));
    didMusicSelect && (didMusicSelect.value = boolToSelectValue(draft.activities.didMusic));

    draft.proteinAnchors = draft.proteinAnchors || { breakfast: false, lunch: false, dinner: false };
    proteinAnchorBreakfast && (proteinAnchorBreakfast.checked = !!draft.proteinAnchors.breakfast);
    proteinAnchorLunch && (proteinAnchorLunch.checked = !!draft.proteinAnchors.lunch);
    proteinAnchorDinner && (proteinAnchorDinner.checked = !!draft.proteinAnchors.dinner);

    renderEmptyFlags();
  }

  // Dashboard helpers
  function computeRange(endISO, daysBack) {
    const end = new Date(endISO);
    const start = new Date(end);
    start.setDate(start.getDate() - daysBack + 1);
    const out = [];
    for (let i = 0; i < daysBack; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = toISODate(d);
      const e = entriesByDate[iso];
      out.push({
        iso,
        label: iso.slice(8, 10) + "-" + iso.slice(5, 7),
        energy: typeof e?.energyLevel === "number" ? e.energyLevel : null,
        focus: typeof e?.focusLevel === "number" ? e.focusLevel : null,
        symptomLoad: typeof e?.symptomLoad === "number" ? e.symptomLoad : null,
        sleepQ: typeof e?.sleepQuality === "number" ? e.sleepQuality : null,
        sportMin: typeof e?.activities?.sportMinutes === "number" ? e.activities.sportMinutes : 0,
        musicMin: typeof e?.activities?.musicMinutes === "number" ? e.activities.musicMinutes : 0,
        sleepHours: typeof e?.sleepHours === "number" ? e.sleepHours : null,
        anchors: proteinAnchorsTotal(e)
      });
    }
    return out;
  }

  function computeAllTimeData() {
    return Object.values(entriesByDate)
      .filter((e) => e && e.dateISO)
      .map((e) => ({
        iso: e.dateISO,
        energy: typeof e.energyLevel === "number" ? e.energyLevel : null,
        focus: typeof e.focusLevel === "number" ? e.focusLevel : null,
        symptomLoad: typeof e.symptomLoad === "number" ? e.symptomLoad : null,
        sleepQ: typeof e.sleepQuality === "number" ? e.sleepQuality : null,
        sleepHours: typeof e.sleepHours === "number" ? e.sleepHours : null,
        sportMin: typeof e.activities?.sportMinutes === "number" ? e.activities.sportMinutes : 0,
        musicMin: typeof e.activities?.musicMinutes === "number" ? e.activities.musicMinutes : 0,
        phase: e.cycle?.phase ?? "unknown",
        stress: typeof e.stressLevel === "number" ? e.stressLevel : null,
        caffeineTiming: e.caffeineTiming ?? "none",
        screenLate: e.screenLate === true,
        tags: e.foodTags || {},
        anchors: proteinAnchorsTotal(e)
      }));
  }

  function renderKPIsFrom(data) {
    const items = [
      { k: "Gem. energie", v: fmt(avg(data.map((d) => d.energy))) },
      { k: "Gem. focus", v: fmt(avg(data.map((d) => d.focus))) },
      { k: "Gem. klachtenlast", v: fmt(avg(data.map((d) => d.symptomLoad))) },
      { k: "Gem. slaapkwaliteit", v: fmt(avg(data.map((d) => d.sleepQ))) },
      { k: "Sport (min)", v: String(data.reduce((a, d) => a + (d.sportMin || 0), 0)) },
      { k: "Muziek (min)", v: String(data.reduce((a, d) => a + (d.musicMin || 0), 0)) }
    ];
    kpiWrap.innerHTML = "";
    items.forEach((it) => {
      const el = document.createElement("div");
      el.className = "kpi";
      el.innerHTML = `<div class="k">${it.k}</div><div class="v">${it.v}</div>`;
      kpiWrap.appendChild(el);
    });
  }

  function computePhaseAverages(data) {
    const groups = {};
    PHASES.forEach((p) => (groups[p.key] = { label: p.label, energy: [], focus: [], sleepQ: [] }));
    data.forEach((d) => {
      if (!groups[d.phase]) return;
      if (typeof d.energy === "number") groups[d.phase].energy.push(d.energy);
      if (typeof d.focus === "number") groups[d.phase].focus.push(d.focus);
      if (typeof d.sleepQ === "number") groups[d.phase].sleepQ.push(d.sleepQ);
    });
    return PHASES.map((p) => {
      const g = groups[p.key];
      return { label: g.label, energy: avg(g.energy), focus: avg(g.focus), sleepQ: avg(g.sleepQ) };
    });
  }

  function diffMeans(a, b) {
    const av = avg(a), bv = avg(b);
    if (av == null || bv == null) return null;
    return av - bv;
  }

  function renderProteinAnchorBlock(data) {
    if (!tagCompareWrap) return;
    const valid = data.filter((d) => typeof d.energy === "number");
    if (valid.length < 6) return;

    const groups = [0, 1, 2, 3].map((k) => ({
      k,
      items: valid.filter((d) => d.anchors === k)
    }));

    const avgRows = groups
      .filter((g) => g.items.length >= 3)
      .map((g) => ({ k: g.k, n: g.items.length, avgEnergy: avg(g.items.map((x) => x.energy)) }));

    const dipRows = groups
      .filter((g) => g.items.length >= 3)
      .map((g) => {
        const dips = g.items.filter((x) => typeof x.energy === "number" && x.energy <= 4).length;
        return { k: g.k, n: g.items.length, dipPct: (dips / g.items.length) * 100 };
      });

    const cells = [
      { label: "0–1 anker + slaap <6u", fn: (d) => (d.anchors <= 1) && (typeof d.sleepHours === "number" && d.sleepHours < 6) },
      { label: "2–3 ankers + slaap <6u", fn: (d) => (d.anchors >= 2) && (typeof d.sleepHours === "number" && d.sleepHours < 6) },
      { label: "0–1 anker + slaap ≥6u", fn: (d) => (d.anchors <= 1) && (typeof d.sleepHours === "number" && d.sleepHours >= 6) },
      { label: "2–3 ankers + slaap ≥6u", fn: (d) => (d.anchors >= 2) && (typeof d.sleepHours === "number" && d.sleepHours >= 6) }
    ].map((c) => {
      const subset = data.filter((d) => typeof d.energy === "number" && c.fn(d));
      const n = subset.length;
      const dips = subset.filter((d) => d.energy <= 4).length;
      return { label: c.label, n, dipPct: n ? (dips / n) * 100 : null };
    });

    const block = document.createElement("div");
    block.className = "compare-row";

    const avgTxt = avgRows.length ? avgRows.map((r) => `${r.k}: ${fmt(r.avgEnergy)} (n=${r.n})`).join(" • ")
      : "Nog te weinig data per groep (min. ~3 dagen per # ankers).";

    const dipTxt = dipRows.length ? dipRows.map((r) => `${r.k}: ${fmt(r.dipPct)}% (n=${r.n})`).join(" • ")
      : "Nog te weinig data per groep (min. ~3 dagen per # ankers).";

    const cellTxt = cells.filter((c) => c.n >= 3)
      .map((c) => `${c.label}: ${fmt(c.dipPct)}% (n=${c.n})`).join(" • ");

    block.innerHTML = `
      <div class="h"><span>Eiwit-ankers (ontbijt/lunch/avond)</span></div>
      <div class="m"><b>Gem. energie per # ankers:</b> ${avgTxt}</div>
      <div class="m"><b>Kans op energiedip (energie ≤4) per # ankers:</b> ${dipTxt}</div>
      <div class="m"><b>Combi slaap & ankers (dip-kans):</b> ${cellTxt || "Nog te weinig data voor de 2×2 (min. ~3 per cel)."} </div>
    `;
    tagCompareWrap.prepend(block);
  }

  function renderInsights(data) {
    const MIN_N = 4;
    const insights = [];

    const eve = data.filter((d) => d.caffeineTiming === "evening").map((d) => d.sleepQ);
    const notEve = data.filter((d) => d.caffeineTiming !== "evening").map((d) => d.sleepQ);
    if (countValid(eve) >= MIN_N && countValid(notEve) >= MIN_N) {
      const delta = diffMeans(notEve, eve);
      insights.push({ title: "Cafeïne (avond) ↔ slaap", desc: `Gem. slaapkwaliteit zonder avondcafeïne is ${fmt(delta)} punt hoger (positief = beter).` });
    }

    const late = data.filter((d) => d.screenLate).map((d) => d.sleepQ);
    const notLate = data.filter((d) => !d.screenLate).map((d) => d.sleepQ);
    if (countValid(late) >= MIN_N && countValid(notLate) >= MIN_N) {
      const delta = diffMeans(notLate, late);
      insights.push({ title: "Scherm na 21:00 ↔ slaap", desc: `Gem. slaapkwaliteit zonder laat scherm is ${fmt(delta)} punt hoger (positief = beter).` });
    }

    const highStress = data.filter((d) => typeof d.stress === "number" && d.stress >= 7);
    const lowStress = data.filter((d) => typeof d.stress === "number" && d.stress <= 3);
    if (highStress.length >= MIN_N && lowStress.length >= MIN_N) {
      const deltaFocus = diffMeans(lowStress.map((d) => d.focus), highStress.map((d) => d.focus));
      const deltaSym = diffMeans(highStress.map((d) => d.symptomLoad), lowStress.map((d) => d.symptomLoad));
      insights.push({
        title: "Stress/prikkels ↔ focus/klachten",
        desc: `Bij lage stress (0–3) is focus gemiddeld ${fmt(deltaFocus)} punt hoger; klachtenlast bij hoge stress (7–10) is gemiddeld ${fmt(deltaSym)} punt hoger.`
      });
    }

    const phaseAvg = computePhaseAverages(data);
    const focusPhases = phaseAvg.filter((p) => p.focus != null);
    if (focusPhases.length >= 2) {
      const best = [...focusPhases].sort((a, b) => b.focus - a.focus)[0];
      const worst = [...focusPhases].sort((a, b) => a.focus - b.focus)[0];
      const delta = best.focus - worst.focus;
      if (delta >= 0.5) {
        insights.push({ title: "Cyclusfase ↔ focus", desc: `In je data is focus in "${best.label}" gemiddeld ${fmt(delta)} punt hoger dan in "${worst.label}".` });
      }
    }

    insightsWrap.innerHTML = "";
    (insights.slice(0, 3).length ? insights.slice(0, 3) : [{ title: "Nog te weinig data", desc: "Log minimaal ~1–2 weken consistent en kom terug." }])
      .forEach((it) => {
        const el = document.createElement("div");
        el.className = "insight";
        el.innerHTML = `<div class="t">${it.title}</div><div class="d">${it.desc}</div>`;
        insightsWrap.appendChild(el);
      });
  }

  function renderTagComparisons(data) {
    if (!tagCompareWrap) return;
    tagCompareWrap.innerHTML = "";
    renderProteinAnchorBlock(data);

    const MIN_N = 4;
    const metrics = [
      { label: "Focus", get: (d) => d.focus },
      { label: "Slaapkwaliteit", get: (d) => d.sleepQ },
      { label: "Klachtenlast", get: (d) => d.symptomLoad },
      { label: "Energie", get: (d) => d.energy }
    ];

    const rows = [];
    FOOD_TAGS.forEach((t) => {
      metrics.forEach((m) => {
        const on = data.filter((d) => d.tags && d.tags[t.key]).map(m.get);
        const off = data.filter((d) => !(d.tags && d.tags[t.key])).map(m.get);
        const nOn = countValid(on), nOff = countValid(off);
        if (nOn >= MIN_N && nOff >= MIN_N) {
          const delta = avg(on) - avg(off);
          rows.push({ title: `${t.label} → ${m.label}`, desc: `Met: ${fmt(avg(on))} (n=${nOn}) • Zonder: ${fmt(avg(off))} (n=${nOff}) • Δ=${fmt(delta)}` });
        }
      });
    });

    rows.sort((a, b) => {
      const da = Math.abs(Number((/Δ=([—0-9\.-]+)/.exec(a.desc) || [,"0"])[1]) || 0);
      const db = Math.abs(Number((/Δ=([—0-9\.-]+)/.exec(b.desc) || [,"0"])[1]) || 0);
      return db - da;
    });

    if (!rows.length) {
      const msg = document.createElement("div");
      msg.className = "compare-row";
      msg.innerHTML = `<div class="h">Nog te weinig data</div><div class="m">Log minimaal ~1–2 weken en gebruik je tags. Daarna verschijnen vergelijkingen met n= per groep.</div>`;
      tagCompareWrap.appendChild(msg);
      return;
    }

    rows.slice(0, 10).forEach((r) => {
      const el = document.createElement("div");
      el.className = "compare-row";
      el.innerHTML = `<div class="h"><span>${r.title}</span></div><div class="m">${r.desc}</div>`;
      tagCompareWrap.appendChild(el);
    });
  }

  // Charts: keep your existing drawing functions (your current app already has them)
  // For brevity here we reuse what you already have in your app.js.

  function renderDashboard() {
    const week = computeRange(selectedISO, 7);
    const month = computeRange(selectedISO, 30);
    const allData = computeAllTimeData();

    renderKPIsFrom(allData);
    renderInsights(allData);
    renderTagComparisons(allData);

    // NOTE: your existing chart drawing code should remain here unchanged
  }

  bind();
  setSelectedDate(todayISO);

  window.addEventListener("pageshow", () => {
    try {
      renderForm();
      renderDateChips();
      updateStatusPill();
    } catch {}
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      try {
        await navigator.serviceWorker.register("./service-worker.js", { scope: "./" });
      } catch {}
    });
  }
})();