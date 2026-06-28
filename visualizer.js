let treevis, data;

let currentFile = "spotify-genres-short.json";
let hasSpotifyData = false;
let nodeBounds = [];
let hoveredNode = null;
let rangeButtons = {};
let selectedRange = "short_term";
let isVisualizerReady = false;
let pendingSpotifyData = null;
let isSpotifyLoading = false;

function preload() {
  if (!window.spotifyGenreData) {
    data = loadJSON(currentFile);
  } else {
    data = window.spotifyGenreData;
    hasSpotifyData = true;
  }
}

function setup() {
  let frame = createDiv('');
  frame.id('viz-frame');

  let canvas = createCanvas(800, 800)
    .parent(frame)
    .style("border", "2px solid #000")
    .style("display", "block");
  let buttonContainer = createDiv('').parent(frame);

  buttonContainer.class('range-controls');
  buttonContainer.style('display', 'flex'); 
  buttonContainer.style('justify-content', 'center');
  buttonContainer.style('align-items', 'center'); 
  buttonContainer.style('gap', '15px');

  let label = createSpan('over the last...');
  label.parent(buttonContainer); 
  label.style('font-family', 'Arial');
  label.style('font-size', '16px');
  label.style('font-weight', '400');

  rangeButtons = {
    short_term: createRangeButton("4 Weeks", "short_term", buttonContainer),
    medium_term: createRangeButton("6 Months", "medium_term", buttonContainer),
    long_term: createRangeButton("Year", "long_term", buttonContainer),
  };
  updateSelectedRange(selectedRange);

  const exampleNote = createP('');
  exampleNote.id('example-note');
  exampleNote.parent(frame);
  exampleNote.html('This is an example using a snapshot from <a href="https://gunnerdoh.dev" target="_blank" rel="noopener noreferrer">my</a> Spotify account.');

  const explanation = document.getElementById("app-explanation");
  if (explanation) document.body.appendChild(explanation);
  const logicExplanation = document.getElementById("logic-explanation");
  if (logicExplanation) document.body.appendChild(logicExplanation);

  isVisualizerReady = true;
  if (pendingSpotifyData) {
    loadSpotifyGenreData(pendingSpotifyData.data, pendingSpotifyData.range);
    pendingSpotifyData = null;
  } else if (window.spotifyGenreData) {
    loadSpotifyGenreData(window.spotifyGenreData, "medium_term");
  }
  
  loadTreemap();
}

function createRangeButton(label, range, parent) {
  return createButton(label)
    .parent(parent)
    .class("range-button")
    .mousePressed(() => changeData(range));
}

function updateSelectedRange(range) {
  selectedRange = range;
  Object.entries(rangeButtons).forEach(([buttonRange, button]) => {
    if (buttonRange === range) {
      button.addClass("is-selected");
    } else {
      button.removeClass("is-selected");
    }
  });
}

function draw() {
  background(240);
  nodeBounds = [];
  if (treevis) treevis.draw();
  hoveredNode = findHoveredNode();
  drawTitle();
  drawLoadingOverlay();
  drawTooltip();
}

function loadTreemap() {
  if (!data) return;
  const properties = {
    children: "children",
    label: "name",
    value: "size",
  };

  let maxSize = 30;
  treevis = createTreemap(data, properties);
  treevis.setCorner(0);
  treevis.setInset(3);
  treevis.setBounds(50, 80, 700, 600);
  treevis.setTextStyle(13, "Arial");

  colorMode(HSB);
  treevis.onFill((level, maxLevel, node) => {
    let v = node.size || 0;

    if (level === 0) {
      let hue = map(hash(node.name), 0, 100, 0, 360);
      fill(hue, 70, 85);
    } else if (level === 1) {
      let hue = map(v, 0, maxSize, 180, 320);
      fill(hue, 65, 90);
    } else {
      let hue = map(v, 0, maxSize, 200, 280);
      fill(hue, 75, 95);
    }

    noStroke();
  });

  treevis.onSelected((v, name) => console.log("Selected:", name));
  treevis.onDraw((name, label, x, y, w, h, node, level, maxLevel, numChildren) => {
    nodeBounds.push({ name, x, y, w, h, node, level, numChildren });

    treevis.__fill__(level, maxLevel, node);
    rect(x, y, w, h);

    textAlign(LEFT);
    fill(0);
    text(label, x + 1, y + 13);
  });
}

function changeData(range) {
  console.log("Loading data for:", range);
  updateSelectedRange(range);

  if (window.spotifyFetchData) {
    setSpotifyLoading(true);
    window.spotifyFetchData(range)
      .then((newData) => {
        if (newData) {
          hasSpotifyData = true;
          data = newData;
          loadTreemap();
        }
      })
      .catch((error) => console.error("Failed to load Spotify data:", error))
      .finally(() => {
        setSpotifyLoading(false);
        redraw();
      });
  } else {
    const fileMap = {
      short_term: "spotify-genres-short.json",
      medium_term: "spotify-genres-med.json",
      long_term: "spotify-genres-long.json",
    };
    loadJSON(
      fileMap[range],
      (newData) => {
        data = newData;
        loadTreemap();
        redraw();
      },
      (error) => console.error("Failed to load:", error)
    );
  }
}

function loadSpotifyGenreData(newData, range = "medium_term") {
  if (!isVisualizerReady) {
    pendingSpotifyData = { data: newData, range };
    return;
  }

  hasSpotifyData = true;
  data = newData;
  const exampleNote = document.getElementById("example-note");
  if (exampleNote) exampleNote.style.display = "none";
  updateSelectedRange(range);
  loadTreemap();
  setSpotifyLoading(false);
  redraw();
}

window.loadSpotifyGenreData = loadSpotifyGenreData;
window.setSpotifyLoading = setSpotifyLoading;

document.addEventListener("spotifyGenreDataLoaded", (event) => {
  const { data: newData, range } = event.detail;
  loadSpotifyGenreData(newData, range);
});

function drawTitle() {
  const title = window.spotifyDisplayName
    ? `${window.spotifyDisplayName}'s Most Listened-to Genres`
    : "Spotify Genre Treemap";

  fill(0);
  textAlign(CENTER);
  textSize(24);
  textStyle(BOLD);
  text(title, width / 2, 50);
  textSize(14);
}

function findHoveredNode() {
  if (!nodeBounds.length) return null;

  const hits = nodeBounds.filter(({ x, y, w, h, level }) => (
    level > 1 &&
    mouseX >= x &&
    mouseX <= x + w &&
    mouseY >= y &&
    mouseY <= y + h
  ));

  if (!hits.length) return null;
  return hits.sort((a, b) => (a.w * a.h) - (b.w * b.h))[0];
}

function drawTooltip() {
  if (!hoveredNode) return;

  const title = hoveredNode.name || "Genre";
  const lines = [title];

  const paddingX = 9;
  const paddingY = 7;
  const lineHeight = 22;
  textSize(13);
  textStyle(BOLD);
  const boxWidth = Math.min(
    340,
    Math.max(...lines.map((line) => textWidth(line))) + paddingX * 2
  );
  const boxHeight = lines.length * lineHeight + paddingY * 2;
  let boxX = mouseX + 14;
  let boxY = mouseY + 14;

  if (boxX + boxWidth > width) boxX = mouseX - boxWidth - 14;
  if (boxY + boxHeight > height) boxY = mouseY - boxHeight - 14;

  fill(0, 0, 12, 0.92);
  stroke(0, 0, 100);
  rect(boxX, boxY, boxWidth, boxHeight);
  noStroke();
  fill(0, 0, 100);
  textAlign(LEFT);
  text(lines[0], boxX + paddingX, boxY + paddingY + textAscent());
  textStyle(NORMAL);
  for (let i = 1; i < lines.length; i++) {
    text(lines[i], boxX + paddingX, boxY + paddingY + textAscent() + lineHeight * i);
  }
}

function setSpotifyLoading(isLoading) {
  isSpotifyLoading = isLoading;
  if (isVisualizerReady) redraw();
}

function drawLoadingOverlay() {
  if (!isSpotifyLoading) return;

  const mapX = 50;
  const mapY = 80;
  const mapW = 700;
  const mapH = 600;

  fill(0, 0, 95, 0.78);
  noStroke();
  rect(mapX, mapY, mapW, mapH);

  fill(0, 0, 45);
  textAlign(CENTER, CENTER);
  textSize(24);
  textStyle(BOLD);
  text("loading", mapX + mapW / 2, mapY + mapH / 2);
  textStyle(NORMAL);
}

function trimTooltipLine(line) {
  if (line.length <= 38) return line;
  return `${line.slice(0, 35)}...`;
}

function mousePressed() {
  if (treevis) treevis.select(mouseX, mouseY);
}

function mouseClicked() {
  if (treevis) treevis.up(mouseX, mouseY);
}
