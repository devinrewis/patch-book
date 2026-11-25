/**
 * ARP Patch Notes — Standalone Multi-Patchbook Web App
 * Infinite canvas, straight grid-snapped arrows, local persistence & URL sharing.
 */
(function () {
  const GRID = 20;
  const PARALLEL_SNAP_PX = 28;

  const clone = (obj) => JSON.parse(JSON.stringify(obj));
  const uid = (prefix = "id") => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

  // =========================================================================
  // APPLICATION STATE (MULTI-PATCHBOOK)
  // =========================================================================
  const defaultState = {
    books: [
      {
        id: "book_1",
        name: "My Patchbook",
        activePatchId: window.DEFAULT_DATA.patches[0].id,
        patches: clone(window.DEFAULT_DATA.patches),
      },
    ],
    activeBookId: "book_1",
    templates: clone(window.DEFAULT_DATA.templates),
    theme: "dark",
  };

  let state = PatchStorage.loadLocal(clone(defaultState));

  let mode = "edit"; // "edit" | "perform"
  let view = { x: 20, y: 20, scale: 1 };

  // Interaction state
  let draggingModule = null;
  let panning = null;
  let wiring = null; // { type: "audio"|"cv", fromId, startX, startY }
  let selectedConnId = null;
  let activeParamTargetModId = null;
  let toastTimer = null;

  // =========================================================================
  // DOM REFERENCES
  // =========================================================================
  const dom = {
    bookSelect: document.getElementById("book-select"),
    btnNewBook: document.getElementById("btn-new-book"),
    btnRenameBook: document.getElementById("btn-rename-book"),
    btnDeleteBook: document.getElementById("btn-delete-book"),
    btnSidebarNewBook: document.getElementById("btn-sidebar-new-book"),
    bookList: document.getElementById("book-list"),

    patchNameInput: document.getElementById("patch-name-input"),
    saveStatus: document.getElementById("save-status"),
    btnModeEdit: document.getElementById("btn-mode-edit"),
    btnModePerform: document.getElementById("btn-mode-perform"),
    btnFitView: document.getElementById("btn-fit-view"),
    btnTheme: document.getElementById("btn-theme"),
    btnShare: document.getElementById("btn-share"),
    btnExport: document.getElementById("btn-export"),
    btnImport: document.getElementById("btn-import"),
    fileImportInput: document.getElementById("file-import-input"),

    btnPrevPage: document.getElementById("btn-prev-page"),
    btnNextPage: document.getElementById("btn-next-page"),
    pageCounter: document.getElementById("page-counter"),
    pageTabs: document.getElementById("page-tabs"),
    btnAddPageBar: document.getElementById("btn-add-page-bar"),

    patchList: document.getElementById("patch-list"),
    templateGrid: document.getElementById("template-grid"),
    btnNewPatch: document.getElementById("btn-new-patch"),
    btnNewBlankModule: document.getElementById("btn-new-blank-module"),

    canvasViewport: document.getElementById("canvas-viewport"),
    canvasStage: document.getElementById("canvas-stage"),
    arrowsGroup: document.getElementById("arrows-group"),
    dragWire: document.getElementById("drag-wire"),
    modulesLayer: document.getElementById("modules-layer"),

    performPageLabel: document.getElementById("perform-page-label"),
    performTitle: document.getElementById("perform-title"),
    performNextTitle: document.getElementById("perform-next-title"),

    connPopover: document.getElementById("conn-popover"),
    connPopoverType: document.getElementById("conn-popover-type"),
    connOutLabel: document.getElementById("conn-out-label"),
    connInLabel: document.getElementById("conn-in-label"),
    btnDeleteConn: document.getElementById("btn-delete-conn"),
    btnSaveConn: document.getElementById("btn-save-conn"),
    btnCloseConnPopover: document.getElementById("btn-close-conn-popover"),

    paramPopover: document.getElementById("param-popover"),
    newParamName: document.getElementById("new-param-name"),
    newParamType: document.getElementById("new-param-type"),
    switchLabelsWrap: document.getElementById("switch-labels-wrap"),
    newParamSwitchLabels: document.getElementById("new-param-switch-labels"),
    btnConfirmAddParam: document.getElementById("btn-confirm-add-param"),
    btnCloseParamPopover: document.getElementById("btn-close-param-popover"),

    btnZoomIn: document.getElementById("btn-zoom-in"),
    btnZoomOut: document.getElementById("btn-zoom-out"),
    zoomReadout: document.getElementById("zoom-readout"),
    toast: document.getElementById("toast"),
  };

  // =========================================================================
  // HELPERS
  // =========================================================================
  function getActiveBook() {
    let book = state.books.find((b) => b.id === state.activeBookId);
    if (!book && state.books.length > 0) {
      book = state.books[0];
      state.activeBookId = book.id;
    }
    return book;
  }

  function getActivePatchIndex() {
    const book = getActiveBook();
    if (!book || !book.patches.length) return 0;
    const idx = book.patches.findIndex((p) => p.id === book.activePatchId);
    return idx >= 0 ? idx : 0;
  }

  function getActivePatch() {
    const book = getActiveBook();
    if (!book || !book.patches.length) return null;
    const idx = getActivePatchIndex();
    book.activePatchId = book.patches[idx].id;
    return book.patches[idx];
  }

  function persist() {
    const ok = PatchStorage.saveLocal(state);
    dom.saveStatus.textContent = ok ? "● Saved locally" : "⚠ Storage full";
  }

  function showToast(msg, durationMs = 2800) {
    dom.toast.textContent = msg;
    dom.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      dom.toast.hidden = true;
    }, durationMs);
  }

  function screenToCanvas(clientX, clientY) {
    const rect = dom.canvasViewport.getBoundingClientRect();
    return {
      x: (clientX - rect.left - view.x) / view.scale,
      y: (clientY - rect.top - view.y) / view.scale,
    };
  }

  function applyTransform() {
    dom.canvasStage.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
    // Keep infinite dot grid aligned with pan & zoom
    const gridPx = GRID * view.scale;
    dom.canvasViewport.style.backgroundSize = `${gridPx}px ${gridPx}px`;
    dom.canvasViewport.style.backgroundPosition = `${view.x}px ${view.y}px`;
    dom.zoomReadout.textContent = `${Math.round(view.scale * 100)}%`;
  }

  function applyTheme() {
    const theme = state.theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", theme);
    dom.btnTheme.textContent = theme === "dark" ? "☀ Light" : "☾ Dark";
  }

  function switchToBook(bookId) {
    if (!state.books.some((b) => b.id === bookId)) return;
    state.activeBookId = bookId;
    closePopovers();
    persist();
    renderAll();
    requestAnimationFrame(() => {
      renderConnections();
      fitDiagramToView();
    });
  }

  function switchToPageIndex(idx) {
    const book = getActiveBook();
    if (!book || idx < 0 || idx >= book.patches.length) return;
    book.activePatchId = book.patches[idx].id;
    closePopovers();
    persist();
    renderAll();
    if (mode === "perform") {
      requestAnimationFrame(() => {
        renderConnections();
        fitDiagramToView();
      });
    }
  }

  // =========================================================================
  // PATCHBOOK CRUD
  // =========================================================================
  function createNewBook() {
    const suggested = `Patchbook ${state.books.length + 1}`;
    const name = window.prompt("New Patchbook Name:", suggested);
    if (name === null) return;
    const cleanName = name.trim() || suggested;
    const firstPage = {
      id: uid("patch"),
      name: "01 - New Patch",
      modules: [],
      connections: [],
    };
    const newBook = {
      id: uid("book"),
      name: cleanName,
      activePatchId: firstPage.id,
      patches: [firstPage],
    };
    state.books.push(newBook);
    state.activeBookId = newBook.id;
    closePopovers();
    persist();
    renderAll();
    fitDiagramToView();
    showToast(`Created patchbook "${cleanName}"`);
  }

  function renameActiveBook() {
    const book = getActiveBook();
    if (!book) return;
    const name = window.prompt("Rename Patchbook:", book.name);
    if (name === null) return;
    book.name = name.trim() || book.name;
    persist();
    renderTopBar();
    renderSidebar();
  }

  function deleteBook(bookId) {
    const book = state.books.find((b) => b.id === bookId);
    if (!book) return;
    if (state.books.length <= 1) {
      showToast("Cannot delete your only patchbook");
      return;
    }
    if (!confirm(`Delete patchbook "${book.name}" and all ${book.patches.length} of its pages?`)) {
      return;
    }
    state.books = state.books.filter((b) => b.id !== bookId);
    if (state.activeBookId === bookId) {
      state.activeBookId = state.books[0].id;
    }
    closePopovers();
    persist();
    renderAll();
    fitDiagramToView();
    showToast(`Deleted patchbook "${book.name}"`);
  }

  function addBookFromData(name, rawPatches) {
    // Re-key IDs so imported/shared books never collide with existing ones
    const pages = rawPatches.map((p) => ({
      ...clone(p),
      id: uid("patch"),
    }));
    const newBook = {
      id: uid("book"),
      name: name || "Shared Patchbook",
      activePatchId: pages[0].id,
      patches: pages,
    };
    state.books.push(newBook);
    state.activeBookId = newBook.id;
    persist();
    return newBook;
  }

  // =========================================================================
  // RENDERING: TOP BAR, PAGE-FLIPPER BAR, SIDEBAR
  // =========================================================================
  function renderTopBar() {
    const book = getActiveBook();
    const patch = getActivePatch();
    if (!book || !patch) return;

    // Patchbook dropdown
    dom.bookSelect.innerHTML = "";
    state.books.forEach((b) => {
      const opt = document.createElement("option");
      opt.value = b.id;
      opt.textContent = b.name;
      if (b.id === book.id) opt.selected = true;
      dom.bookSelect.appendChild(opt);
    });
    dom.btnDeleteBook.disabled = state.books.length <= 1;

    dom.patchNameInput.value = patch.name;

    const idx = getActivePatchIndex();
    const total = book.patches.length;
    dom.performPageLabel.textContent = `${book.name.toUpperCase()} • PAGE ${idx + 1} OF ${total}`;
    dom.performTitle.textContent = patch.name;

    const nextPatch = book.patches[idx + 1];
    dom.performNextTitle.textContent = nextPatch
      ? `${idx + 2}. ${nextPatch.name}`
      : "End of Patchbook";
  }

  function renderPageBar() {
    const book = getActiveBook();
    if (!book) return;
    const idx = getActivePatchIndex();
    const total = book.patches.length;

    dom.pageCounter.textContent = `${idx + 1} / ${total}`;
    dom.btnPrevPage.disabled = idx <= 0;
    dom.btnNextPage.disabled = idx >= total - 1;

    dom.pageTabs.innerHTML = "";
    book.patches.forEach((patch, i) => {
      const btn = document.createElement("button");
      btn.className = "page-tab" + (i === idx ? " active" : "");
      btn.innerHTML = `<span class="page-tab-num">${i + 1}.</span>${escapeHtml(patch.name)}`;
      btn.addEventListener("click", () => switchToPageIndex(i));
      dom.pageTabs.appendChild(btn);
    });

    const activeTab = dom.pageTabs.querySelector(".page-tab.active");
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }

  function renderSidebar() {
    const activeBook = getActiveBook();
    if (!activeBook) return;

    // Patchbooks list
    dom.bookList.innerHTML = "";
    state.books.forEach((book) => {
      const li = document.createElement("li");
      li.className = "patch-item" + (book.id === activeBook.id ? " active" : "");
      const meta = `${book.patches.length} page${book.patches.length === 1 ? "" : "s"}`;

      li.innerHTML = `
        <div class="patch-item-info">
          <div class="patch-item-name">${escapeHtml(book.name)}</div>
          <div class="patch-item-meta">${escapeHtml(meta)}</div>
        </div>
        ${state.books.length > 1 ? `<button class="patch-item-del" title="Delete patchbook">×</button>` : ""}
      `;

      li.addEventListener("click", (e) => {
        if (e.target.classList.contains("patch-item-del")) {
          e.stopPropagation();
          deleteBook(book.id);
          return;
        }
        switchToBook(book.id);
      });

      dom.bookList.appendChild(li);
    });

    // Pages in active book
    dom.patchList.innerHTML = "";
    activeBook.patches.forEach((patch, i) => {
      const li = document.createElement("li");
      li.className = "patch-item" + (patch.id === activeBook.activePatchId ? " active" : "");

      const meta = `Page ${i + 1} • ${patch.modules.length} mod${patch.modules.length === 1 ? "" : "s"}`;

      li.innerHTML = `
        <div class="patch-item-info">
          <div class="patch-item-name">${escapeHtml(patch.name)}</div>
          <div class="patch-item-meta">${escapeHtml(meta)}</div>
        </div>
        ${activeBook.patches.length > 1 ? `<button class="patch-item-del" title="Delete page">×</button>` : ""}
      `;

      li.addEventListener("click", (e) => {
        if (e.target.classList.contains("patch-item-del")) {
          e.stopPropagation();
          if (confirm(`Delete page "${patch.name}"?`)) {
            activeBook.patches = activeBook.patches.filter((p) => p.id !== patch.id);
            if (activeBook.activePatchId === patch.id) {
              activeBook.activePatchId = activeBook.patches[0].id;
            }
            persist();
            renderAll();
          }
          return;
        }
        switchToPageIndex(i);
      });

      dom.patchList.appendChild(li);
    });

    // Module Library Templates
    dom.templateGrid.innerHTML = "";
    state.templates.forEach((tpl) => {
      const btn = document.createElement("button");
      btn.className = "template-card";
      btn.innerHTML = `
        <div class="template-card-title">${escapeHtml(tpl.title)}</div>
        <div class="template-card-meta">${tpl.params.length} params</div>
      `;
      btn.addEventListener("click", () => addModuleFromTemplate(tpl));
      dom.templateGrid.appendChild(btn);
    });
  }

  // =========================================================================
  // RENDERING: MODULES (AUTO-RESIZING BLOCKS)
  // =========================================================================
  function renderModules() {
    const patch = getActivePatch();
    dom.modulesLayer.innerHTML = "";
    if (!patch) return;

    patch.modules.forEach((mod) => {
      const el = document.createElement("div");
      el.className = "module-block";
      el.dataset.id = mod.id;
      el.style.left = `${mod.x}px`;
      el.style.top = `${mod.y}px`;

      const header = document.createElement("div");
      header.className = "module-header";

      const titleInput = document.createElement("input");
      titleInput.className = "module-title-input";
      titleInput.value = mod.title;
      titleInput.addEventListener("mousedown", (e) => e.stopPropagation());
      titleInput.addEventListener("change", () => {
        mod.title = titleInput.value.trim() || "MODULE";
        persist();
      });

      const actions = document.createElement("div");
      actions.className = "module-actions";

      const btnSaveTpl = document.createElement("button");
      btnSaveTpl.className = "mod-act-btn";
      btnSaveTpl.title = "Save module to Library";
      btnSaveTpl.textContent = "★";
      btnSaveTpl.addEventListener("mousedown", (e) => e.stopPropagation());
      btnSaveTpl.addEventListener("click", () => saveModuleAsTemplate(mod));

      const btnDup = document.createElement("button");
      btnDup.className = "mod-act-btn";
      btnDup.title = "Duplicate module";
      btnDup.textContent = "⧉";
      btnDup.addEventListener("mousedown", (e) => e.stopPropagation());
      btnDup.addEventListener("click", () => duplicateModule(mod));

      const btnDel = document.createElement("button");
      btnDel.className = "mod-act-btn del";
      btnDel.title = "Delete module";
      btnDel.textContent = "×";
      btnDel.addEventListener("mousedown", (e) => e.stopPropagation());
      btnDel.addEventListener("click", () => deleteModule(mod.id));

      actions.append(btnSaveTpl, btnDup, btnDel);
      header.append(titleInput, actions);

      header.addEventListener("mousedown", (e) => {
        if (mode === "perform") return;
        if (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON") return;
        e.stopPropagation();
        const pt = screenToCanvas(e.clientX, e.clientY);
        draggingModule = {
          mod,
          el,
          offsetX: pt.x - mod.x,
          offsetY: pt.y - mod.y,
        };
        el.classList.add("dragging");
      });

      const paramsWrap = document.createElement("div");
      paramsWrap.className = "module-params";
      mod.params.forEach((param) => {
        paramsWrap.appendChild(createParamRow(mod, param));
      });

      const footer = document.createElement("div");
      footer.className = "module-footer";
      const addParamBtn = document.createElement("button");
      addParamBtn.className = "add-param-btn";
      addParamBtn.textContent = "+ Add Parameter";
      addParamBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openAddParamPopover(mod.id, e.clientX, e.clientY);
      });
      footer.appendChild(addParamBtn);

      const ports = [
        { cls: "port-audio-in", type: "audio", dir: "in", title: "Audio In (Left)" },
        { cls: "port-audio-out", type: "audio", dir: "out", title: "Audio Out (Right) — Drag to connect" },
        { cls: "port-cv-in", type: "cv", dir: "in", title: "CV In (Bottom)" },
        { cls: "port-cv-out", type: "cv", dir: "out", title: "CV Out (Top) — Drag to connect" },
      ];

      ports.forEach((pInfo) => {
        const port = document.createElement("div");
        port.className = `port-handle ${pInfo.cls}`;
        port.dataset.modId = mod.id;
        port.dataset.portType = pInfo.type;
        port.dataset.portDir = pInfo.dir;
        port.title = pInfo.title;

        if (pInfo.dir === "out") {
          port.addEventListener("mousedown", (e) => {
            if (mode === "perform") return;
            e.stopPropagation();
            const pt = screenToCanvas(e.clientX, e.clientY);
            wiring = {
              type: pInfo.type,
              fromId: mod.id,
              startX: pt.x,
              startY: pt.y,
            };
            highlightValidTargets(pInfo.type, mod.id);
          });
        }

        el.appendChild(port);
      });

      el.append(header, paramsWrap, footer);
      dom.modulesLayer.appendChild(el);
    });

    requestAnimationFrame(renderConnections);
  }

  function createParamRow(mod, param) {
    const row = document.createElement("div");
    row.className = "param-row";

    const nameInput = document.createElement("input");
    nameInput.className = "param-name-input";
    nameInput.value = param.name;
    nameInput.addEventListener("change", () => {
      param.name = nameInput.value.trim() || "PARAM";
      persist();
    });

    const controlWrap = document.createElement("div");
    controlWrap.className = "param-control-wrap";

    if (param.type === "knob") {
      controlWrap.appendChild(createKnobWidget(param));
    } else if (param.type === "slider") {
      controlWrap.appendChild(createSliderWidget(param));
    } else if (param.type === "switch3") {
      controlWrap.appendChild(createSwitchWidget(param));
    } else if (param.type === "dropdown") {
      controlWrap.appendChild(createDropdownWidget(param));
    }

    const removeBtn = document.createElement("button");
    removeBtn.className = "param-remove-btn";
    removeBtn.title = "Remove parameter";
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => {
      mod.params = mod.params.filter((p) => p.id !== param.id);
      persist();
      renderModules();
    });

    row.append(nameInput, controlWrap, removeBtn);
    return row;
  }

  // =========================================================================
  // PARAMETER WIDGETS: KNOB, SLIDER, 3-WAY SWITCH
  // =========================================================================
  function createKnobWidget(param) {
    const wrap = document.createElement("div");
    wrap.className = "knob-wrap";

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 36 36");
    svg.setAttribute("class", "knob-svg");

    const track = document.createElementNS(svgNS, "path");
    track.setAttribute("class", "knob-track");
    track.setAttribute("d", describeArc(18, 18, 14, -135, 135));

    const arc = document.createElementNS(svgNS, "path");
    arc.setAttribute("class", "knob-arc");

    const body = document.createElementNS(svgNS, "circle");
    body.setAttribute("class", "knob-body");
    body.setAttribute("cx", "18");
    body.setAttribute("cy", "18");
    body.setAttribute("r", "9.5");

    const pointer = document.createElementNS(svgNS, "line");
    pointer.setAttribute("class", "knob-pointer");
    pointer.setAttribute("x1", "18");
    pointer.setAttribute("y1", "18");

    svg.append(track, arc, body, pointer);

    const valText = document.createElement("span");
    valText.className = "param-val-text";

    function updateVisual() {
      const v = clamp(param.value, 0, 1);
      const angleDeg = -135 + v * 270;
      const rad = ((angleDeg - 90) * Math.PI) / 180;
      const px = 18 + Math.cos(rad) * 8.5;
      const py = 18 + Math.sin(rad) * 8.5;
      pointer.setAttribute("x2", px.toFixed(2));
      pointer.setAttribute("y2", py.toFixed(2));
      arc.setAttribute("d", v > 0.005 ? describeArc(18, 18, 14, -135, angleDeg) : "");
      valText.textContent = (v * 10).toFixed(1);
    }

    updateVisual();

    svg.addEventListener("mousedown", (e) => {
      if (mode === "perform") return;
      e.stopPropagation();
      const startY = e.clientY;
      const startVal = param.value;

      function onMove(ev) {
        const dy = startY - ev.clientY;
        param.value = clamp(startVal + dy / 110, 0, 1);
        updateVisual();
      }
      function onUp() {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        persist();
      }
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    });

    svg.addEventListener("dblclick", (e) => {
      if (mode === "perform") return;
      e.stopPropagation();
      param.value = 0.5;
      updateVisual();
      persist();
    });

    wrap.append(svg, valText);
    return wrap;
  }

  function createSliderWidget(param) {
    const wrap = document.createElement("div");
    wrap.className = "slider-wrap";

    const input = document.createElement("input");
    input.type = "range";
    input.className = "arp-slider";
    input.min = "0";
    input.max = "1";
    input.step = "0.01";
    input.value = param.value;

    const valText = document.createElement("span");
    valText.className = "param-val-text";
    valText.textContent = (param.value * 10).toFixed(1);

    input.addEventListener("mousedown", (e) => e.stopPropagation());
    input.addEventListener("input", () => {
      param.value = parseFloat(input.value);
      valText.textContent = (param.value * 10).toFixed(1);
    });
    input.addEventListener("change", () => persist());

    wrap.append(input, valText);
    return wrap;
  }

  function createSwitchWidget(param) {
    const group = document.createElement("div");
    group.className = "switch3-group";
    const labels =
      Array.isArray(param.labels) && param.labels.length >= 2
        ? param.labels
        : ["LO", "MID", "HI"];

    labels.forEach((lbl, idx) => {
      const btn = document.createElement("button");
      btn.className = "switch3-btn" + (param.value === idx ? " active" : "");
      btn.textContent = lbl;
      btn.addEventListener("mousedown", (e) => e.stopPropagation());
      btn.addEventListener("click", () => {
        if (mode === "perform") return;
        param.value = idx;
        group.querySelectorAll(".switch3-btn").forEach((b, i) => {
          b.classList.toggle("active", i === idx);
        });
        persist();
      });
      group.appendChild(btn);
    });

    return group;
  }

  function createDropdownWidget(param) {
    const select = document.createElement("select");
    select.className = "arp-dropdown";
    const labels =
      Array.isArray(param.labels) && param.labels.length >= 1
        ? param.labels
        : ["OPT 1", "OPT 2", "OPT 3"];

    labels.forEach((lbl, idx) => {
      const opt = document.createElement("option");
      opt.value = String(idx);
      opt.textContent = lbl;
      if (param.value === idx) opt.selected = true;
      select.appendChild(opt);
    });

    select.addEventListener("mousedown", (e) => e.stopPropagation());
    select.addEventListener("change", () => {
      if (mode === "perform") return;
      param.value = parseInt(select.value, 10) || 0;
      persist();
    });

    return select;
  }

  function polarToCartesian(cx, cy, r, angleInDegrees) {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: cx + r * Math.cos(angleInRadians),
      y: cy + r * Math.sin(angleInRadians),
    };
  }

  function describeArc(cx, cy, r, startAngle, endAngle) {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
  }

  // =========================================================================
  // RENDERING: STRAIGHT ARROWS WITH PARALLEL GRID SNAP + END LABELS
  // =========================================================================
  function getModuleBox(modId) {
    const el = dom.modulesLayer.querySelector(`.module-block[data-id="${modId}"]`);
    const patch = getActivePatch();
    if (!patch) return null;
    const mod = patch.modules.find((m) => m.id === modId);
    if (!el || !mod) return null;
    return {
      x: mod.x,
      y: mod.y,
      w: el.offsetWidth,
      h: el.offsetHeight,
    };
  }

  function renderConnections() {
    const patch = getActivePatch();
    const svgNS = "http://www.w3.org/2000/svg";
    dom.arrowsGroup.innerHTML = "";
    if (!patch) return;

    const outGroups = {};
    const inGroups = {};
    patch.connections.forEach((c) => {
      const ok = `${c.from}:${c.type}`;
      const ik = `${c.to}:${c.type}`;
      (outGroups[ok] = outGroups[ok] || []).push(c.id);
      (inGroups[ik] = inGroups[ik] || []).push(c.id);
    });

    patch.connections.forEach((conn) => {
      const fromBox = getModuleBox(conn.from);
      const toBox = getModuleBox(conn.to);
      if (!fromBox || !toBox) return;

      const outList = outGroups[`${conn.from}:${conn.type}`];
      const inList = inGroups[`${conn.to}:${conn.type}`];
      const outFrac = (outList.indexOf(conn.id) + 1) / (outList.length + 1);
      const inFrac = (inList.indexOf(conn.id) + 1) / (inList.length + 1);

      let x1, y1, x2, y2;

      if (conn.type === "audio") {
        x1 = fromBox.x + fromBox.w;
        y1 = fromBox.y + 34 + (fromBox.h - 42) * outFrac;
        x2 = toBox.x;
        y2 = toBox.y + 34 + (toBox.h - 42) * inFrac;

        if (Math.abs(y1 - y2) <= PARALLEL_SNAP_PX) {
          const minY = Math.max(fromBox.y + 34, toBox.y + 34);
          const maxY = Math.min(fromBox.y + fromBox.h - 10, toBox.y + toBox.h - 10);
          if (minY <= maxY) {
            const snappedY = clamp((y1 + y2) / 2, minY, maxY);
            y1 = snappedY;
            y2 = snappedY;
          }
        }
      } else {
        x1 = fromBox.x + 24 + (fromBox.w - 48) * outFrac;
        y1 = fromBox.y;
        x2 = toBox.x + 24 + (toBox.w - 48) * inFrac;
        y2 = toBox.y + toBox.h;

        if (Math.abs(x1 - x2) <= PARALLEL_SNAP_PX) {
          const minX = Math.max(fromBox.x + 20, toBox.x + 20);
          const maxX = Math.min(fromBox.x + fromBox.w - 20, toBox.x + toBox.w - 20);
          if (minX <= maxX) {
            const snappedX = clamp((x1 + x2) / 2, minX, maxX);
            x1 = snappedX;
            x2 = snappedX;
          }
        }
      }

      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const endX = x2 - ux * 3;
      const endY = y2 - uy * 3;
      const pathD = `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${endX.toFixed(1)} ${endY.toFixed(1)}`;

      let outLblPos, inLblPos;
      if (conn.type === "audio") {
        const outOffset = Math.min(14, len * 0.2);
        const inOffset = Math.min(14, len * 0.2);
        outLblPos = {
          x: x1 + ux * outOffset + 2,
          y: y1 + uy * outOffset - 10,
          anchor: dx >= 0 ? "start" : "end",
        };
        inLblPos = {
          x: x2 - ux * inOffset - 2,
          y: y2 - uy * inOffset - 10,
          anchor: dx >= 0 ? "end" : "start",
        };
      } else {
        const outOffset = Math.min(16, len * 0.22);
        const inOffset = Math.min(18, len * 0.22);
        outLblPos = {
          x: x1 + ux * outOffset + 8,
          y: y1 + uy * outOffset + 3,
          anchor: "start",
        };
        inLblPos = {
          x: x2 - ux * inOffset + 8,
          y: y2 - uy * inOffset + 4,
          anchor: "start",
        };
      }

      const g = document.createElementNS(svgNS, "g");
      g.setAttribute("class", "conn-group");
      g.dataset.id = conn.id;

      const hitPath = document.createElementNS(svgNS, "path");
      hitPath.setAttribute("class", "conn-hit-path");
      hitPath.setAttribute("d", pathD);

      const isSelected = conn.id === selectedConnId;
      const visPath = document.createElementNS(svgNS, "path");
      visPath.setAttribute("class", `conn-path ${conn.type}${isSelected ? " selected" : ""}`);
      visPath.setAttribute("d", pathD);
      visPath.setAttribute(
        "marker-end",
        isSelected
          ? "url(#arrow-selected)"
          : conn.type === "audio"
          ? "url(#arrow-audio)"
          : "url(#arrow-cv)"
      );

      g.append(hitPath, visPath);

      if (conn.outLabel) {
        g.appendChild(createSvgLabel(conn.outLabel, outLblPos.x, outLblPos.y, outLblPos.anchor, conn.type));
      }
      if (conn.inLabel) {
        g.appendChild(createSvgLabel(conn.inLabel, inLblPos.x, inLblPos.y, inLblPos.anchor, conn.type));
      }

      g.addEventListener("click", (e) => {
        if (mode === "perform") return;
        e.stopPropagation();
        openConnPopover(conn, e.clientX, e.clientY);
      });

      dom.arrowsGroup.appendChild(g);
    });
  }

  function createSvgLabel(text, x, y, anchor, type) {
    const svgNS = "http://www.w3.org/2000/svg";
    const group = document.createElementNS(svgNS, "g");
    const charW = 6.1;
    const padX = 5;
    const w = text.length * charW + padX * 2;
    const h = 16;

    let rectX = x;
    if (anchor === "end") rectX = x - w;
    else if (anchor === "middle") rectX = x - w / 2;

    const rect = document.createElementNS(svgNS, "rect");
    rect.setAttribute("class", `conn-label-bg ${type}`);
    rect.setAttribute("x", rectX);
    rect.setAttribute("y", y - 11);
    rect.setAttribute("width", w);
    rect.setAttribute("height", h);

    const txt = document.createElementNS(svgNS, "text");
    txt.setAttribute("class", "conn-label-text");
    txt.setAttribute("x", rectX + padX);
    txt.setAttribute("y", y);
    txt.textContent = text;

    group.append(rect, txt);
    return group;
  }

  // =========================================================================
  // MODULE & PAGE CRUD
  // =========================================================================
  function createNewPage() {
    const book = getActiveBook();
    if (!book) return;
    const n = book.patches.length + 1;
    const newPatch = {
      id: uid("patch"),
      name: `${String(n).padStart(2, "0")} - New Patch`,
      modules: [],
      connections: [],
    };
    book.patches.push(newPatch);
    book.activePatchId = newPatch.id;
    closePopovers();
    persist();
    renderAll();
  }

  function addModuleFromTemplate(tpl) {
    const patch = getActivePatch();
    if (!patch) return;

    const rect = dom.canvasViewport.getBoundingClientRect();
    const center = screenToCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const snapX = Math.round((center.x - 110 + (Math.random() * 40 - 20)) / GRID) * GRID;
    const snapY = Math.round((center.y - 80 + (Math.random() * 40 - 20)) / GRID) * GRID;

    const newMod = {
      id: uid("mod"),
      title: tpl.title,
      x: snapX,
      y: snapY,
      params: tpl.params.map((p) => ({ ...clone(p), id: uid("p") })),
    };

    patch.modules.push(newMod);
    persist();
    renderModules();
    renderSidebar();
  }

  function saveModuleAsTemplate(mod) {
    const existing = state.templates.find((t) => t.title.toLowerCase() === mod.title.toLowerCase());
    const tplObj = {
      id: existing ? existing.id : uid("tpl"),
      title: mod.title,
      category: "CUSTOM",
      params: mod.params.map((p) => ({
        name: p.name,
        type: p.type,
        value: p.value,
        ...(p.labels ? { labels: [...p.labels] } : {}),
      })),
    };
    if (existing) {
      Object.assign(existing, tplObj);
    } else {
      state.templates.push(tplObj);
    }
    persist();
    renderSidebar();
    showToast(`Saved "${mod.title}" to Module Library`);
  }

  function duplicateModule(mod) {
    const patch = getActivePatch();
    const copy = clone(mod);
    copy.id = uid("mod");
    copy.x += 40;
    copy.y += 40;
    copy.params.forEach((p) => (p.id = uid("p")));
    patch.modules.push(copy);
    persist();
    renderModules();
    renderSidebar();
  }

  function deleteModule(modId) {
    const patch = getActivePatch();
    patch.modules = patch.modules.filter((m) => m.id !== modId);
    patch.connections = patch.connections.filter((c) => c.from !== modId && c.to !== modId);
    persist();
    renderModules();
    renderSidebar();
  }

  // =========================================================================
  // POPOVERS
  // =========================================================================
  function closePopovers() {
    dom.connPopover.hidden = true;
    dom.paramPopover.hidden = true;
    selectedConnId = null;
    activeParamTargetModId = null;
    renderConnections();
  }

  function openConnPopover(conn, clientX, clientY) {
    closePopovers();
    selectedConnId = conn.id;
    renderConnections();

    dom.connPopoverType.textContent =
      conn.type === "audio" ? "AUDIO ARROW (L → R)" : "CV ARROW (BOTTOM → TOP)";
    dom.connOutLabel.value = conn.outLabel || "";
    dom.connInLabel.value = conn.inLabel || "";

    const rect = dom.canvasViewport.getBoundingClientRect();
    const left = clamp(clientX - rect.left + 10, 12, rect.width - 255);
    const top = clamp(clientY - rect.top + 10, 12, rect.height - 190);
    dom.connPopover.style.left = `${left}px`;
    dom.connPopover.style.top = `${top}px`;
    dom.connPopover.hidden = false;
    dom.connOutLabel.focus();
  }

  function openAddParamPopover(modId, clientX, clientY) {
    closePopovers();
    activeParamTargetModId = modId;
    dom.newParamName.value = "";
    dom.newParamType.value = "knob";
    dom.switchLabelsWrap.hidden = true;

    const rect = dom.canvasViewport.getBoundingClientRect();
    const left = clamp(clientX - rect.left - 80, 12, rect.width - 255);
    const top = clamp(clientY - rect.top - 40, 12, rect.height - 220);
    dom.paramPopover.style.left = `${left}px`;
    dom.paramPopover.style.top = `${top}px`;
    dom.paramPopover.hidden = false;
    dom.newParamName.focus();
  }

  // =========================================================================
  // WIRING & POINTER INTERACTIONS (INFINITE CANVAS — NO WALLS)
  // =========================================================================
  function hideDragWire() {
    dom.dragWire.style.display = "none";
    dom.dragWire.setAttribute("d", "");
  }

  function highlightValidTargets(type, fromId) {
    dom.modulesLayer.querySelectorAll(".port-handle").forEach((el) => {
      const isMatch =
        el.dataset.portType === type &&
        el.dataset.portDir === "in" &&
        el.dataset.modId !== fromId;
      el.classList.toggle("valid-target", isMatch);
    });
  }

  function clearTargetHighlights() {
    dom.modulesLayer.querySelectorAll(".port-handle.valid-target").forEach((el) => {
      el.classList.remove("valid-target");
    });
  }

  window.addEventListener("mousemove", (e) => {
    if (draggingModule) {
      const pt = screenToCanvas(e.clientX, e.clientY);
      // Unbounded infinite canvas: allow any negative or positive grid coordinates
      const nx = Math.round((pt.x - draggingModule.offsetX) / GRID) * GRID;
      const ny = Math.round((pt.y - draggingModule.offsetY) / GRID) * GRID;
      draggingModule.mod.x = nx;
      draggingModule.mod.y = ny;
      draggingModule.el.style.left = `${nx}px`;
      draggingModule.el.style.top = `${ny}px`;
      renderConnections();
    } else if (panning) {
      view.x = panning.startViewX + (e.clientX - panning.startX);
      view.y = panning.startViewY + (e.clientY - panning.startY);
      applyTransform();
    } else if (wiring) {
      const pt = screenToCanvas(e.clientX, e.clientY);
      dom.dragWire.style.display = "block";
      dom.dragWire.setAttribute("d", `M ${wiring.startX} ${wiring.startY} L ${pt.x} ${pt.y}`);
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (draggingModule) {
      draggingModule.el.classList.remove("dragging");
      draggingModule = null;
      persist();
    }
    if (panning) {
      dom.canvasViewport.classList.remove("panning");
      panning = null;
    }
    if (wiring) {
      hideDragWire();
      clearTargetHighlights();

      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (
        target &&
        target.classList.contains("port-handle") &&
        target.dataset.portDir === "in" &&
        target.dataset.portType === wiring.type &&
        target.dataset.modId !== wiring.fromId
      ) {
        const patch = getActivePatch();
        const newConn = {
          id: uid("c"),
          type: wiring.type,
          from: wiring.fromId,
          to: target.dataset.modId,
          outLabel: wiring.type === "audio" ? "OUT" : "CV OUT",
          inLabel: wiring.type === "audio" ? "IN" : "CV IN",
        };
        patch.connections.push(newConn);
        persist();
        renderConnections();
        openConnPopover(newConn, e.clientX, e.clientY);
      }
      wiring = null;
    }
  });

  dom.canvasViewport.addEventListener("mousedown", (e) => {
    const isInteractive =
      e.target.closest(".module-block") ||
      e.target.closest(".conn-group") ||
      e.target.closest(".conn-popover") ||
      e.target.closest(".param-popover") ||
      e.target.closest(".canvas-controls");
    if (!isInteractive) {
      closePopovers();
      panning = {
        startX: e.clientX,
        startY: e.clientY,
        startViewX: view.x,
        startViewY: view.y,
      };
      dom.canvasViewport.classList.add("panning");
    }
  });

  dom.canvasViewport.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const rect = dom.canvasViewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      const newScale = clamp(view.scale * zoomFactor, 0.35, 2.0);

      view.x = mouseX - ((mouseX - view.x) / view.scale) * newScale;
      view.y = mouseY - ((mouseY - view.y) / view.scale) * newScale;
      view.scale = newScale;
      applyTransform();
    },
    { passive: false }
  );

  // =========================================================================
  // FIT TO VIEW
  // =========================================================================
  function fitDiagramToView() {
    const patch = getActivePatch();
    if (!patch || patch.modules.length === 0) {
      view = { x: 20, y: 20, scale: 1 };
      applyTransform();
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    patch.modules.forEach((m) => {
      const box = getModuleBox(m.id) || { x: m.x, y: m.y, w: 228, h: 180 };
      minX = Math.min(minX, box.x);
      minY = Math.min(minY, box.y);
      maxX = Math.max(maxX, box.x + box.w);
      maxY = Math.max(maxY, box.y + box.h);
    });

    const rect = dom.canvasViewport.getBoundingClientRect();
    const padTop = mode === "perform" ? 80 : 40;
    const pad = 48;
    const availW = rect.width - pad * 2;
    const availH = rect.height - padTop - pad;
    const contentW = Math.max(200, maxX - minX);
    const contentH = Math.max(200, maxY - minY);

    const scale = clamp(Math.min(availW / contentW, availH / contentH), 0.4, 1.15);
    view.scale = scale;
    view.x = pad + (availW - contentW * scale) / 2 - minX * scale;
    view.y = padTop + (availH - contentH * scale) / 2 - minY * scale;
    applyTransform();
  }

  // =========================================================================
  // UI EVENT BINDINGS
  // =========================================================================
  dom.bookSelect.addEventListener("change", () => switchToBook(dom.bookSelect.value));
  dom.btnNewBook.addEventListener("click", createNewBook);
  dom.btnSidebarNewBook.addEventListener("click", createNewBook);
  dom.btnRenameBook.addEventListener("click", renameActiveBook);
  dom.btnDeleteBook.addEventListener("click", () => {
    const book = getActiveBook();
    if (book) deleteBook(book.id);
  });

  dom.patchNameInput.addEventListener("change", () => {
    const patch = getActivePatch();
    if (!patch) return;
    patch.name = dom.patchNameInput.value.trim() || "Untitled Patch";
    persist();
    renderTopBar();
    renderPageBar();
    renderSidebar();
  });

  dom.btnModeEdit.addEventListener("click", () => {
    mode = "edit";
    document.body.classList.remove("perform-mode");
    dom.btnModeEdit.classList.add("active");
    dom.btnModePerform.classList.remove("active");
    requestAnimationFrame(renderConnections);
  });

  dom.btnModePerform.addEventListener("click", () => {
    mode = "perform";
    closePopovers();
    document.body.classList.add("perform-mode");
    dom.btnModePerform.classList.add("active");
    dom.btnModeEdit.classList.remove("active");
    requestAnimationFrame(() => {
      renderConnections();
      fitDiagramToView();
    });
  });

  dom.btnFitView.addEventListener("click", fitDiagramToView);

  dom.btnTheme.addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    applyTheme();
    persist();
  });

  dom.btnZoomIn.addEventListener("click", () => {
    view.scale = Math.min(2.0, view.scale * 1.15);
    applyTransform();
  });

  dom.btnZoomOut.addEventListener("click", () => {
    view.scale = Math.max(0.35, view.scale / 1.15);
    applyTransform();
  });

  // Page Flipping Controls & Keyboard Shortcuts
  dom.btnPrevPage.addEventListener("click", () => {
    switchToPageIndex(getActivePatchIndex() - 1);
  });

  dom.btnNextPage.addEventListener("click", () => {
    switchToPageIndex(getActivePatchIndex() + 1);
  });

  window.addEventListener("keydown", (e) => {
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      switchToPageIndex(getActivePatchIndex() - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      switchToPageIndex(getActivePatchIndex() + 1);
    } else if (e.key === "Escape") {
      closePopovers();
    }
  });

  window.addEventListener("resize", () => {
    requestAnimationFrame(renderConnections);
  });

  // New Page & Blank Module
  dom.btnNewPatch.addEventListener("click", createNewPage);
  dom.btnAddPageBar.addEventListener("click", createNewPage);

  dom.btnNewBlankModule.addEventListener("click", () => {
    addModuleFromTemplate({
      title: "MODULE",
      params: [{ name: "PARAM 1", type: "knob", value: 0.5 }],
    });
  });

  // Connection Popover Actions
  dom.btnCloseConnPopover.addEventListener("click", closePopovers);
  dom.btnSaveConn.addEventListener("click", () => {
    const patch = getActivePatch();
    const conn = patch.connections.find((c) => c.id === selectedConnId);
    if (conn) {
      conn.outLabel = dom.connOutLabel.value.trim();
      conn.inLabel = dom.connInLabel.value.trim();
      persist();
    }
    closePopovers();
  });

  dom.btnDeleteConn.addEventListener("click", () => {
    const patch = getActivePatch();
    patch.connections = patch.connections.filter((c) => c.id !== selectedConnId);
    persist();
    closePopovers();
  });

  // Add Parameter Popover Actions
  dom.btnCloseParamPopover.addEventListener("click", closePopovers);
  dom.newParamType.addEventListener("change", () => {
    const t = dom.newParamType.value;
    dom.switchLabelsWrap.hidden = t !== "switch3" && t !== "dropdown";
  });

  dom.btnConfirmAddParam.addEventListener("click", () => {
    const patch = getActivePatch();
    const mod = patch.modules.find((m) => m.id === activeParamTargetModId);
    if (!mod) return;

    const type = dom.newParamType.value;
    const name = dom.newParamName.value.trim().toUpperCase() || "PARAM";
    const isDiscrete = type === "switch3" || type === "dropdown";
    const paramObj = {
      id: uid("p"),
      name,
      type,
      value: isDiscrete ? 0 : 0.5,
    };

    if (isDiscrete) {
      const parts = dom.newParamSwitchLabels.value
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      paramObj.labels = parts.length >= 2 ? parts : ["LO", "MID", "HI"];
    }

    mod.params.push(paramObj);
    persist();
    closePopovers();
    renderModules();
  });

  // Share Current Patchbook Only via URL
  dom.btnShare.addEventListener("click", async () => {
    const book = getActiveBook();
    if (!book) return;
    try {
      const url = await PatchStorage.buildShareUrl(book);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        showToast(`Share link copied for "${book.name}"!`);
      } else {
        window.prompt(`Copy share link for "${book.name}":`, url);
      }
    } catch (err) {
      console.error("Share failed:", err);
      const url = await PatchStorage.buildShareUrl(book);
      window.prompt(`Copy share link for "${book.name}":`, url);
    }
  });

  // Export Current Patchbook JSON
  dom.btnExport.addEventListener("click", () => {
    const book = getActiveBook();
    if (!book) return;
    const payload = {
      v: 2,
      book: {
        name: book.name,
        patches: book.patches,
      },
      templates: state.templates,
    };
    const safeFile = book.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "patchbook";
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeFile}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported "${book.name}"`);
  });

  // Import Patchbook JSON (saves as a new patchbook)
  dom.btnImport.addEventListener("click", () => dom.fileImportInput.click());
  dom.fileImportInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        let importedBook = null;

        if (parsed && parsed.book && Array.isArray(parsed.book.patches) && parsed.book.patches.length > 0) {
          importedBook = addBookFromData(parsed.book.name || "Imported Patchbook", parsed.book.patches);
        } else if (parsed && Array.isArray(parsed.patches) && parsed.patches.length > 0) {
          importedBook = addBookFromData(file.name.replace(/\.json$/i, ""), parsed.patches);
        } else if (parsed && Array.isArray(parsed.books) && parsed.books.length > 0) {
          parsed.books.forEach((b) => {
            if (b && Array.isArray(b.patches) && b.patches.length > 0) {
              importedBook = addBookFromData(b.name || "Imported Patchbook", b.patches);
            }
          });
        }

        if (importedBook) {
          renderAll();
          fitDiagramToView();
          showToast(`Imported patchbook "${importedBook.name}"`);
        } else {
          alert("Could not find any patch pages in this JSON file.");
        }
      } catch (err) {
        alert("Invalid JSON patchbook file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // =========================================================================
  // INITIALIZE
  // =========================================================================
  function renderAll() {
    applyTheme();
    renderTopBar();
    renderPageBar();
    renderSidebar();
    renderModules();
  }

  async function init() {
    const shared = await PatchStorage.parseSharedFromUrl();
    if (shared) {
      // Automatically save the shared patchbook as a brand-new patchbook on this machine
      const savedBook = addBookFromData(shared.name, shared.patches);
      PatchStorage.clearUrlHash();
      renderAll();
      setTimeout(fitDiagramToView, 60);
      showToast(`Saved shared patchbook "${savedBook.name}" as a new patchbook!`, 3600);
      return;
    }

    if (!PatchStorage.hasLocalSave()) {
      persist();
    }

    renderAll();
    setTimeout(fitDiagramToView, 60);
  }

  init();
})();
