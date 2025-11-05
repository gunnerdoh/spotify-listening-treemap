let treevis, data;
let currentFile = "spotify-genres-short.json";

function preload() {
  data = loadJSON(currentFile);
}

function setup() {
    createCanvas(800, 800);

  createButton("Last 4 Weeks")
    .mousePressed(() => changeData("spotify-genres-short.json"));

  createButton("Last 6 Months")
    .mousePressed(() => changeData("spotify-genres-med.json"));

  createButton("Last Year")
    .mousePressed(() => changeData("spotify-genres-long.json"));
    
  loadTreemap();
}

function loadTreemap() {
  const properties = {
    children: "children",
    label: "name",
    value: "size"
  };

  let maxSize = 30;
  treevis = createTreemap(data, properties);
  treevis.setCorner(5);
  treevis.setInset(2);
  treevis.setBounds(50, 80, 700, 600);

  colorMode(HSB);
  treevis.onFill((level, maxLevel, node) => {
    let v = node.size || 0;
    let hue = map(v, 0, maxSize, 200, 360);
    fill(hue, 80, 90);
    noStroke();
  });

  treevis.onSelected((v, name) => console.log("Selected:", name));
}

// Fixed function
function changeData(fileName) {
  console.log("Loading:", fileName);
  loadJSON(
    fileName,
    (newData) => {
      data = newData;
      loadTreemap();
      redraw(); // Force a redraw
    },
    (error) => {
      console.error("Failed to load:", error);
    }
  );
}

function draw() {
  background(0);
  if (treevis) treevis.draw();
}

function mousePressed() {
  if (treevis) treevis.select(mouseX, mouseY);
}

function mouseClicked() {
  if (treevis) treevis.up(mouseX, mouseY);
}