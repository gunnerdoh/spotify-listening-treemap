const clientId = "9ac8ad344c204db9aaed743a2f51e485";
const redirectUri = window.location.origin + window.location.pathname;
const scopes = "user-top-read user-read-private";

let accessToken = null;
let userProfile = null;
let treevis, currentData, p5canvas;

window.onload = async () => {
  const loginBtn = document.getElementById("loginButton");
  loginBtn.addEventListener("click", redirectToSpotifyAuth);

  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");

  if (code) {
    try {
      accessToken = await getAccessToken(code);
      sessionStorage.setItem("spotify_access_token", accessToken);
      window.history.pushState({}, "", redirectUri);
      await initializeApp();
    } catch (err) {
      console.error("Token exchange failed:", err);
      alert("Login error. Try again!");
    }
  } else if (sessionStorage.getItem("spotify_access_token")) {
    accessToken = sessionStorage.getItem("spotify_access_token");
    await initializeApp();
  } else {
    showLogin();
  }
};

function showLogin() {
  document.getElementById("login-container").style.display = "flex";
  document.getElementById("viz-container").style.display = "none";
}

async function initializeApp() {
  try {
    userProfile = await fetchFromSpotify("https://api.spotify.com/v1/me");
    if (!userProfile) throw new Error("Profile fetch failed");

    document.getElementById("login-container").style.display = "none";
    document.getElementById("viz-container").style.display = "block";

    if (!p5canvas) new p5();
    await fetchAndRedraw("short_term");
  } catch (err) {
    console.error("Init failed:", err);
    sessionStorage.removeItem("spotify_access_token");
    showLogin();
  }
}

async function redirectToSpotifyAuth() {
  const verifier = generateRandomString(128);
  const challenge = await generateCodeChallenge(verifier);
  sessionStorage.setItem("spotify_code_verifier", verifier);

  const authUrl = new URL("https://accounts.spotify.com/authorize");
  authUrl.search = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: scopes,
    code_challenge_method: "S256",
    code_challenge: challenge,
  });
  window.location.href = authUrl;
}

async function getAccessToken(code) {
  const verifier = sessionStorage.getItem("spotify_code_verifier");
  if (!verifier) throw new Error("Missing PKCE verifier");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  });

  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.access_token;
}

function generateRandomString(length) {
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () =>
    possible.charAt(Math.floor(Math.random() * possible.length))
  ).join("");
}

async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) % 100;
}

async function fetchFromSpotify(endpoint) {
  const res = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401) {
    sessionStorage.removeItem("spotify_access_token");
    showLogin();
    return null;
  }
  if (!res.ok) throw new Error(`Spotify error: ${res.statusText}`);
  return res.json();
}

async function fetchGenreData(range) {
  const data = await fetchFromSpotify(
    `https://api.spotify.com/v1/me/top/artists?time_range=${range}&limit=50`
  );
  if (!data) return null;
  const genres = data.items.flatMap((a) => a.genres);
  return tallyGenres(genres);
}

// ====================
// Build flat JSON with meta-genres
// ====================
function tallyGenres(genres) {
  // Define meta-genre keyword mapping
  const metaMap = {
    rock: ["rock", "metal", "punk", "grunge", "emo"],
    pop: ["pop", "dance", "electro", "synth", "idol"],
    rap: ["hip hop", "rap", "trap"],
    jazz: ["jazz", "swing", "bebop", "bossa", "blues", "soul"],
    classical: ["classical", "baroque", "romantic", "orchestra"],
    electronic: ["techno", "house", "idm", "edm", "trance", "drum and bass"],
    country: ["country", "bluegrass", "folk", "americana"],
    rnb: ["r&b", "soul", "funk", "motown"],
    world: ["afro", "latin", "reggae", "k-pop", "j-pop", "brazilian"],
  };

  const findMeta = (g) => {
    const lower = g.toLowerCase();
    for (const [meta, terms] of Object.entries(metaMap)) {
      if (terms.some((t) => lower.includes(t))) return meta;
    }
    return "other";
  };

  // Step 1: Count all genres within their meta-category
  const metaCounts = {};
  genres.forEach((g) => {
    const meta = findMeta(g);
    if (!metaCounts[meta]) metaCounts[meta] = {};
    metaCounts[meta][g] = (metaCounts[meta][g] || 0) + 1;
  });

  // Step 2: Build nested JSON structure for p5.treevis
  const formatted = {
    name: "genres",
    children: Object.entries(metaCounts).map(([meta, subgenres]) => ({
      name: meta,
      children: Object.entries(subgenres).map(([name, size]) => ({
        name,
        size,
      })),
    })),
  };

  return formatted;
}

window.setup = function () {
  p5canvas = createCanvas(1200, 800);
  p5canvas.parent("viz-container");
  colorMode(HSB);
  noLoop();

  const makeBtn = (txt, x, range) =>
    createButton(txt)
      .position(x, 720)
      .style("font-weight", "800")
      .style("padding", "5px")
      .parent("viz-container")
      .mousePressed(() => fetchAndRedraw(range));

  makeBtn("Last 4 Weeks", 140, "short_term");
  makeBtn("Last 6 Months", 360, "medium_term");
  makeBtn("Last Year", 600, "long_term");
};

window.draw = function () {
  background(0, 0, 95);
  if (treevis) {
    treevis.draw();
    drawTopGenres();
  }
  drawTitle();
};
function loadTreemap() {
  if (!currentData?.children?.length) {
    background(240);
    fill(0);
    textAlign(CENTER);
    textSize(20);
    text("No genre data found.", width / 2, height / 2);
    return;
  }

  const properties = {
    children: "children",
    label: "name",
    value: "size"
  };

  let maxSize = Math.max(...currentData.children.map(c => c.size), 30);
  treevis = createTreemap(currentData, properties);
  treevis.setCorner(0);
  treevis.setInset(3);
  treevis.setBounds(50, 80, 700, 600);
  treevis.setTextStyle(13, 'Arial');

  colorMode(HSB);

  const metaColors = {
    rock: 20,         
    pop: 300,         
    rap: 260,         
    jazz: 210,        
    classical: 90,    
    electronic: 160,  
    country: 40,     
    rnb: 330,      
    world: 60,      
    other: 0       
  };
  treevis.onFill((level, maxLevel, node) => {
    noStroke();
  
    // Root node
    if (level === 0) {
      fill(255);
      return;
    }
  
    // Level 1 → meta-genre blocks
    if (level === 1) {
      const hue = map(hash(node.name), 0, 100, 0, 360);
      fill(hue, 70, 85);
      return;
    }
  
    // Level 2 → individual genres inside a meta block
    if (level === 2) {
      const parentName = node.parent ? node.parent.name : "";
      const parentHue = map(hash(parentName), 0, 100, 0, 360);
      const offset = map(hash(node.name), 0, 100, -10, 10);
      const hue = (parentHue + offset + 360) % 360;
      fill(hue, 65, 75);
      return;
    }
  
    // Anything deeper (shouldn't happen but safe fallback)
    fill(0, 0, 90);
  });
  

  treevis.onSelected((v, name) => console.log("Selected:", name));
  redraw();
}


function getTopMetaCategories() {
  console.log(currentData);
  return currentData?.children
    ? [...currentData.children].sort((a, b) => b.size - a.size).slice(0, 5)
    : [];
}

function drawTitle() {
  fill(0);
  textAlign(RIGHT);
  textSize(24);
  textStyle(BOLD);
  const name = userProfile?.display_name || "User";
  text(`Most Listened-to Genres for ${name}`, width / 1.85, 50);
  textSize(14);
}

async function fetchAndRedraw(timeRange) {
  try {
    const newData = await fetchGenreData(timeRange);
    if (newData) {
      currentData = newData;
      // Wait until the p5 environment exists
      if (typeof window.draw === "function") {
        loadTreemap();
      } else {
        console.warn("p5 not initialized yet");
      }
    }
  } catch (err) {
    console.error("Failed to fetch and redraw:", err);
  }
}


function drawTopGenres() {
  const top = getTopMetaCategories();
  const boxX = 770,
    boxY = 80,
    boxW = 300,
    boxH = 200;

  fill(255);
  noStroke();
  rect(boxX, boxY, boxW, boxH, 5);

  fill(0);
  textAlign(LEFT);
  textSize(18);
  textStyle(BOLD);
  text("Top Genres", boxX + 20, boxY + 30);

  textSize(16);
  textStyle(NORMAL);
  top.forEach((g, i) =>
    text(`${i + 1}. ${g.name}`, boxX + 20, boxY + 60 + i * 25)
  );
}

window.mousePressed = () => {
  if (treevis && mouseX > 0 && mouseY > 0 && mouseX < width && mouseY < height)
    treevis.select(mouseX, mouseY);
};

window.mouseClicked = () => {
  if (treevis && mouseX > 0 && mouseY > 0 && mouseX < width && mouseY < height)
    treevis.up(mouseX, mouseY);
};
