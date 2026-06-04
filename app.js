let speciesData = [];
let currentTreeRoot = null;
let svg, g;

const NOTES_KEY = "plantFieldApp_notes_v1";

const state = {
  search: "",
  explo: "",
  plot: "",
  family: "",
  maxRank: ""
};

const clean = x => (x ?? "").toString();

function loadNotes() {
  return JSON.parse(localStorage.getItem(NOTES_KEY) || "{}");
}

function saveNotes(notes) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

function getSpeciesId(d) {
  return d.Species || d.display_name || d.species;
}

async function loadData() {
  const response = await fetch("data/species.json?v=" + Date.now());
  speciesData = await response.json();

  console.log("Loaded species:", speciesData.length);

  initFilters();
  initTree();
  render();
}

function initFilters() {

  const searchInput = document.getElementById("searchInput");
  const exploFilter = document.getElementById("exploFilter");
  const plotFilter = document.getElementById("plotFilter");
  const familyFilter = document.getElementById("familyFilter");
  const rankFilter = document.getElementById("rankFilter");

  fillSelect(exploFilter, ["AEG", "HEG", "SEG"]);

  fillSelect(
    plotFilter,
    unique(speciesData.flatMap(d => d.plots || [])).sort(plotSort)
  );

  fillSelect(
    familyFilter,
    unique(speciesData.map(d => d.family)).sort()
  );

  searchInput.addEventListener("input", e => {
    state.search = e.target.value.trim().toLowerCase();
    render();
  });

  exploFilter.addEventListener("change", e => {
    state.explo = e.target.value;
    render();
  });

  plotFilter.addEventListener("change", e => {
    state.plot = e.target.value;
    render();
  });

  familyFilter.addEventListener("change", e => {
    state.family = e.target.value;
    render();
  });

  rankFilter.addEventListener("change", e => {
    state.maxRank = e.target.value;
    render();
  });

  document.getElementById("resetFilters").addEventListener("click", () => {

    state.search = "";
    state.explo = "";
    state.plot = "";
    state.family = "";
    state.maxRank = "";

    searchInput.value = "";
    exploFilter.value = "";
    plotFilter.value = "";
    familyFilter.value = "";
    rankFilter.value = "";

    render();
  });

  document.getElementById("expandAll").addEventListener("click", () => {
    expandAll(currentTreeRoot);
    updateTree(currentTreeRoot);
  });

  document.getElementById("collapseAll").addEventListener("click", () => {
    collapseBelowDepth(currentTreeRoot, 2);
    updateTree(currentTreeRoot);
  });
}

function fillSelect(sel, values) {

  values.filter(Boolean).forEach(v => {

    const opt = document.createElement("option");

    opt.value = v;
    opt.textContent = v;

    sel.appendChild(opt);
  });
}

function unique(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function plotSort(a,b) {

  const order = {
    AEG: 1,
    HEG: 2,
    SEG: 3
  };

  const pa = clean(a).slice(0,3);
  const pb = clean(b).slice(0,3);

  if ((order[pa] || 99) !== (order[pb] || 99)) {
    return (order[pa] || 99) - (order[pb] || 99);
  }

  return a.localeCompare(b, undefined, { numeric: true });
}

function initTree() {

  svg = d3.select("#tree")
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%");

  g = svg.append("g")
    .attr("transform", "translate(20,30)");

  svg.call(
    d3.zoom()
      .scaleExtent([0.2, 4])
      .on("zoom", event => {
        g.attr("transform", event.transform);
      })
  );
}

function passesFilters(d) {

  const searchTarget = [
    d.kingdom,
    d.phylum,
    d.class,
    d.order,
    d.family,
    d.genus,
    d.species,
    d.display_name,
    d.german_name
  ].join(" ").toLowerCase();

  const plotRanks = d.plot_ranks || [];

  const plotOk =
    !state.plot ||
    plotRanks.some(p => p.Plot_ID === state.plot);

  const exploOk =
    !state.explo ||
    plotRanks.some(p => clean(p.Plot_ID).startsWith(state.explo));

  const rankOk =
    !state.maxRank ||
    plotRanks.some(p => {

      const plotMatch =
        !state.plot ||
        p.Plot_ID === state.plot;

      const exploMatch =
        !state.explo ||
        clean(p.Plot_ID).startsWith(state.explo);

      return (
        plotMatch &&
        exploMatch &&
        Number(p.Rank_3_years) <= Number(state.maxRank)
      );
    });

  return (
    (!state.search || searchTarget.includes(state.search)) &&
    plotOk &&
    exploOk &&
    (!state.family || d.family === state.family) &&
    rankOk
  );
}

function render() {

  const filtered = speciesData.filter(passesFilters);

  document.getElementById("matchCount").textContent =
    `${filtered.length} Arten angezeigt`;

  const treeData = buildTree(filtered);

  currentTreeRoot = d3.hierarchy(treeData);

  collapseBelowDepth(
    currentTreeRoot,
    state.search || state.plot || state.family || state.explo || state.maxRank
      ? 99
      : 2
  );

  updateTree(currentTreeRoot);
}

function buildTree(rows) {

  const root = {
    name: "Plants",
    children: []
  };

  const ranks = [
    "kingdom",
    "phylum",
    "class",
    "order",
    "family",
    "genus",
    "species"
  ];

  rows.forEach(row => {

    let node = root;

    ranks.forEach(rank => {

      const value = clean(row[rank]) || "unknown";

      if (!node.children) node.children = [];

      let child = node.children.find(c => c.name === value);

      if (!child) {

        child = {
          name: value,
          rank,
          children: []
        };

        node.children.push(child);
      }

      node = child;
    });

    node.meta = row;

    delete node.children;
  });

  sortTree(root);

  return root;
}

function sortTree(node) {

  if (!node.children) return;

  node.children.sort((a,b) => a.name.localeCompare(b.name));

  node.children.forEach(sortTree);
}

function collapseBelowDepth(root, depth) {

  root.each(d => {

    if (d.depth >= depth && d.children) {

      d._children = d.children;
      d.children = null;
    }
  });
}

function expandAll(root) {

  root.each(d => {

    if (d._children) {

      d.children = d._children;
      d._children = null;
    }
  });
}

function updateTree(root) {

  g.selectAll("*").remove();

  const tree = d3.tree().nodeSize([26, 170]);

  tree(root);

  const links = root.links();
  const nodes = root.descendants();

  g.selectAll(".link")
    .data(links)
    .enter()
    .append("path")
    .attr("class", "link")
    .attr(
      "d",
      d3.linkHorizontal()
        .x(d => d.y)
        .y(d => d.x)
    );

  const node = g.selectAll(".node")
    .data(nodes)
    .enter()
    .append("g")
    .attr("class", d => `node ${d.data.meta ? "leaf" : ""}`)
    .attr("transform", d => `translate(${d.y},${d.x})`)
    .on("click", (event, d) => {

      event.stopPropagation();

      if (d.data.meta) {
        showSpecies(d.data.meta);
        return;
      }

      if (d.children) {
        d._children = d.children;
        d.children = null;
      } else {
        d.children = d._children;
        d._children = null;
      }

      updateTree(root);
    });

  node.append("circle")
    .attr("r", 4.5);

  node.append("text")
    .attr("x", 9)
    .text(d => d.data.name + (d._children ? " +" : ""));
}

async function showSpecies(d) {

  const notes = loadNotes();

  const id = getSpeciesId(d);

  const saved = notes[id] || {};

  const fieldChars =
    saved.field_characteristics ??
    d.field_characteristics ??
    "";

  const confusion =
    saved.confusion_species ??
    d.confusion_species ??
    "";

  const extraNotes =
    saved.notes ??
    d.notes ??
    "";

  const selectedPlotRank =
    state.plot && d.plot_ranks
      ? d.plot_ranks.find(p => p.Plot_ID === state.plot)
      : null;

  const rankRows =
    selectedPlotRank
      ? `
        <tr><th>Plot</th><td>${selectedPlotRank.Plot_ID}</td></tr>
        <tr><th>Rank auf Plot</th><td>${selectedPlotRank.Rank_3_years}</td></tr>
      `
      : `
        <tr><th>Plots</th><td>${(d.plots || []).join(", ") || "–"}</td></tr>
      `;

  const viewer = document.getElementById("viewer");

  viewer.innerHTML = `

    <h2 class="species-title">
      <em>${d.species || d.display_name || d.Species || "unknown"}</em>
    </h2>

    <div class="badges">
      ${badge(d.german_name)}
      ${badge(d.family)}
      ${badge(d.genus)}
      ${badge(d.difficulty)}
    </div>

    <table class="detail-table">
      ${rankRows}
      <tr>
        <th>Taxonomie</th>
        <td>${[d.class, d.order, d.family, d.genus].filter(Boolean).join(" › ")}</td>
      </tr>
    </table>

    <h3>Bestimmungsmerkmale</h3>

    <textarea
      id="fieldCharsInput"
      class="edit-box"
      placeholder="Bestimmungsmerkmale eintragen..."
    >${escapeHtml(fieldChars)}</textarea>

    <h3>Verwechslungsarten</h3>

    <textarea
      id="confusionInput"
      class="edit-box"
      placeholder="Verwechslungsarten eintragen..."
    >${escapeHtml(confusion)}</textarea>

    <h3>Notizen</h3>

    <textarea
      id="notesInput"
      class="edit-box"
      placeholder="Weitere Notizen..."
    >${escapeHtml(extraNotes)}</textarea>

    <button id="saveSpeciesNotes" class="save-button">
      Speichern
    </button>

    <span id="saveStatus" class="small"></span>

    <h3>Eigene Bilder</h3>

    <div class="image-grid" id="localImages"></div>

    <h3>iNaturalist Bilder</h3>

    <div class="image-grid" id="inatImages">
      Lade Bilder...
    </div>
  `;

  document.getElementById("saveSpeciesNotes")
    .addEventListener("click", () => {

      const notes = loadNotes();

      notes[id] = {

        field_characteristics:
          document.getElementById("fieldCharsInput").value,

        confusion_species:
          document.getElementById("confusionInput").value,

        notes:
          document.getElementById("notesInput").value
      };

      saveNotes(notes);

      document.getElementById("saveStatus").textContent =
        "Gespeichert.";

      setTimeout(() => {
        document.getElementById("saveStatus").textContent = "";
      }, 1500);
    });

  loadLocalImages(d);

  loadINaturalistImages(
    d.species ||
    d.display_name ||
    d.Species
  );
}

function badge(x) {

  return x
    ? `<span class="badge">${escapeHtml(x)}</span>`
    : "";
}

function escapeHtml(str) {

  return clean(str).replace(
    /[&<>'"]/g,
    c => ({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      "'":"&#39;",
      "\"":"&quot;"
    }[c])
  );
}

function loadLocalImages(d) {

  const target = document.getElementById("localImages");

  const imgs = d.local_images || [];

  target.innerHTML =
    imgs.length
      ? imgs.map(src =>
          `<img src="${src}" loading="lazy">`
        ).join("")
      : "<p class='small'>Keine eigenen Bilder hinterlegt.</p>";
}

async function loadINaturalistImages(name) {

  const target = document.getElementById("inatImages");

  try {

    const url =
      "https://api.inaturalist.org/v1/observations?taxon_name=" +
      encodeURIComponent(name) +
      "&quality_grade=research&photos=true&place_id=7207&per_page=6&captive=false";

    const response = await fetch(url);

    const data = await response.json();

    const imgs = (data.results || [])
      .filter(o => o.photos && o.photos.length)
      .slice(0, 6)
      .map(o =>
        o.photos[0].url.replace("square", "medium")
      );

    target.innerHTML =
      imgs.length
        ? imgs.map(src =>
            `<img src="${src}" loading="lazy">`
          ).join("")
        : "<p class='small'>Keine iNaturalist-Bilder gefunden.</p>";

  } catch (e) {

    target.innerHTML =
      "<p class='small'>iNaturalist konnte nicht geladen werden.</p>";
  }
}

loadData();

