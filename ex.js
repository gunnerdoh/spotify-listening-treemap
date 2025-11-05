let treevis, data;
let currentFile = "spotify-genres-short.json";

function preload() {
    data = loadJSON(currentFile);
}

function setup() {
    createCanvas(1200, 1200);

    createButton("Last 4 Weeks")
        .position(140, 720)
        .mousePressed(() => changeData("spotify-genres-short.json"))
        .style('font-weight', '800')
        .style('padding', '5px');

    createButton("Last 6 Months")
        .position(360, 720)
        .mousePressed(() => changeData("spotify-genres-med.json"))
        .style('font-weight', '800')
        .style('padding', '5px');

    createButton("Last Year")
    .position(600, 720)
    .mousePressed(() => changeData("spotify-genres-long.json"))
    .style('font-weight', '800')
    .style('padding', '5px');
    loadTreemap();
}

function draw() {
    background(240);
    if (treevis) treevis.draw();
    drawTitle();
}

function loadTreemap() {
    draw()
    const properties = {
        children: "children",
        label: "name",
        value: "size"
    };

    let maxSize = 30;
    treevis = createTreemap(data, properties);
    treevis.setCorner(0);
    treevis.setInset(3);
    treevis.setBounds(50, 80, 700, 600);
    treevis.setTextStyle(13, 'Arial');

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

  
  stroke(255, 255, 255, 30);
  strokeWeight(0);
});

  treevis.onSelected((v, name) => console.log("Selected:", name));
}

function getTopMetaCategories() {
  let categories = [];
  
  if (data && data.children) {
    data.children.forEach(category => {
      let totalSize = 0;
      
    function sumSizes(node) {
        if (node.size) {
          totalSize += node.size;
        }
        if (node.children) {
          node.children.forEach(child => sumSizes(child));
        }
      }
      
      sumSizes(category);
      categories.push({ name: category.name, size: totalSize });
    });
  }
  
  categories.sort((a, b) => b.size - a.size);
  return categories.slice(0, 5);
}

function changeData(fileName) {
  console.log("Loading:", fileName);
  loadJSON(
    fileName,
    (newData) => {
      data = newData;
      loadTreemap();
      redraw();
    },
    (error) => {
      console.error("Failed to load:", error);
    }
  );
}

function drawTitle() {
    fill(0);
    textAlign(RIGHT);
    textSize(24);
    textStyle(BOLD);
    text("Most Listened-to Genres on Spotify for user @gunna97", width / 1.85, 50);
    textSize(14)
}

function drawTopGenres() {
    let topCategories = getTopMetaCategories();
    let boxX = 770;
    let boxY = 80;
    let boxWidth = 200;
    let boxHeight = 200;
    
    fill(255);
    noStroke();
    rect(boxX, boxY, boxWidth, boxHeight, 5);
    
    fill(0);
    textAlign(LEFT);
    textSize(18);
    textStyle(BOLD);
    text("Categories", boxX + 20, boxY + 30);
    
    textSize(16);
    textStyle(NORMAL);
    topCategories.forEach((category, i) => {
      let y = boxY + 60 + i * 25;
      text(`${i + 1}. ${category.name}`, boxX + 20, y);
    });
}

function mousePressed() {
  if (treevis) treevis.select(mouseX, mouseY);
}

function mouseClicked() {
  if (treevis) treevis.up(mouseX, mouseY);
}