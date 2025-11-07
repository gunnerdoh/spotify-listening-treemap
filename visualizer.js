let treevis, data;

let currentFile = "spotify-genres-short.json";
let hasSpotifyData = false;

function preload() {
  if (!window.spotifyGenreData) {
    data = loadJSON(currentFile);
  } else {
    data = window.spotifyGenreData;
    hasSpotifyData = true;
  }
}

function setup() {
  // Get a reference to the canvas
  let canvas = createCanvas(800, 800)
    .style("border", "2px solid #000")
    .style("margin", "10px");
  let buttonContainer = createDiv('');

  buttonContainer.position(canvas.position().x, canvas.position().y + 700);

  buttonContainer.style('width', '800px'); 
  buttonContainer.style('display', 'flex'); 
  buttonContainer.style('justify-content', 'center');
  buttonContainer.style('align-items', 'center'); 
  buttonContainer.style('gap', '15px');

  let label = createSpan('over the last...');
  label.parent(buttonContainer); 
  label.style('font-family', 'Arial');
  label.style('font-size', '16px');

  createButton("4 Weeks")
    .parent(buttonContainer) 
    .mousePressed(() => changeData("short_term"))
    .style("font-weight", "800")
    .style("padding", "5px");

  createButton("6 Months")
    .parent(buttonContainer) 
    .mousePressed(() => changeData("medium_term"))
    .style("font-weight", "800")
    .style("padding", "5px");

  createButton("Year")
    .parent(buttonContainer) // Add to the div
    .mousePressed(() => changeData("long_term"))
    .style("font-weight", "800")
    .style("padding", "5px");
  
  loadTreemap();
}
function draw() {
  background(240);
  if (treevis) treevis.draw();
  drawTitle();
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
}

function changeData(range) {
  console.log("Loading data for:", range);

  // If Spotify data was fetched, use it dynamically
  if (window.spotifyFetchData) {
    window.spotifyFetchData(range).then((newData) => {
      if (newData) {
        data = newData;
        loadTreemap();
        redraw();
      }
    });
  } else {
    // fallback to local files if no Spotify
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

function drawTitle() {
  fill(0);
  textAlign(CENTER);
  textSize(24);
  textStyle(BOLD);
  text(
    "Most Listened-to Genres on Spotify",
    width / 2,
    50
  );
  textSize(14);
}

function mousePressed() {
  if (treevis) treevis.select(mouseX, mouseY);
}

function mouseClicked() {
  if (treevis) treevis.up(mouseX, mouseY);
}
