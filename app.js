const clientId = "9ac8ad344c204db9aaed743a2f51e485";
const redirectUri = window.location.origin + window.location.pathname;
const scopes = "user-top-read user-read-private";

let accessToken = null;
let userProfile = null;

// ───────────────────────────────────────────
// Auth flow
// ───────────────────────────────────────────
window.onload = async () => {
  const loginBtn = document.getElementById("loginButton");
  if (loginBtn) loginBtn.addEventListener("click", redirectToSpotifyAuth);

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
  }
};

// ───────────────────────────────────────────
// Spotify helper functions
// ───────────────────────────────────────────
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
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join("");
}

async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function fetchFromSpotify(endpoint) {
  const res = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Spotify error: ${res.statusText}`);
  return res.json();
}

async function initializeApp() {
  try {
    userProfile = await fetchFromSpotify("https://api.spotify.com/v1/me");
    console.log(`🎧 Logged in as ${userProfile.display_name}`);

    const loginBtn = document.getElementById("loginButton");
    const logoutBtn = document.getElementById("logoutButton");
    const userInfo = document.getElementById("user-info");

    // Update UI to show logged-in state
    if (loginBtn) loginBtn.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "inline-block";
    if (userInfo) userInfo.textContent = `🎧 Logged in as ${userProfile.display_name}`;

    // Bind logout button
    logoutBtn.addEventListener("click", logoutUser);

    // Fetch initial data
    const data = await fetchGenreData("medium_term");
    window.spotifyGenreData = data;
    window.spotifyFetchData = fetchGenreData;

    console.log("✅ Spotify data ready for treemap.");
  } catch (err) {
    console.error("Init failed:", err);
  }
}

async function fetchGenreData(range) {
  const res = await fetchFromSpotify(
    `https://api.spotify.com/v1/me/top/artists?time_range=${range}&limit=50`
  );
  const genres = res.items.flatMap((a) => a.genres);
  return tallyGenres(genres);
}

function tallyGenres(genres) {
  const metaMap = {
    Rock: ["rock", "grunge"],
    Punk: ["punk", "emo"], 
    Metal: ["metal"],
    Indie: ["indie", "alternative"],
    Pop: ["pop", "dance", "electro", "synth", "idol"],
    Rap: ["hip hop", "rap", "trap"],
    "Jazz and Blues": ["jazz", "swing", "bebop", "bossa", "blues", "soul"],
    Classical: ["classical", "baroque", "romantic", "orchestra"],
    Electronic: ["techno", "house", "idm", "edm", "trance", "drum and bass"],
    "Folk & Country": ["country", "bluegrass", "folk", "americana", "red dirt"],
    RnB: ["r&b", "soul", "funk", "motown"],
    World: ["afro", "latin", "reggae", "k-pop", "j-pop", "brazilian"],
  };

  const findMeta = (g) => {
    const lower = g.toLowerCase();
    for (const [meta, terms] of Object.entries(metaMap)) {
      if (terms.some((t) => lower.includes(t))) return meta;
    }
    return "Other";
  };

  const metaCounts = {};
  genres.forEach((g) => {
    const meta = findMeta(g);
    if (!metaCounts[meta]) metaCounts[meta] = {};
    metaCounts[meta][g] = (metaCounts[meta][g] || 0) + 1;
  });

  return {
    children: Object.entries(metaCounts).map(([meta, subgenres]) => ({
      name: meta,
      children: Object.entries(subgenres).map(([name, size]) => ({
        name,
        size,
      })),
    })),
  };
}

function logoutUser() {
  // Clear session and access token
  sessionStorage.removeItem("spotify_access_token");
  sessionStorage.removeItem("spotify_code_verifier");
  accessToken = null;
  userProfile = null;

  // Reset the UI
  const loginBtn = document.getElementById("loginButton");
  const logoutBtn = document.getElementById("logoutButton");
  const userInfo = document.getElementById("user-info");

  if (loginBtn) loginBtn.style.display = "inline-block";
  if (logoutBtn) logoutBtn.style.display = "none";
  if (userInfo) userInfo.textContent = "";

  // Optional: clear visualization
  if (window.treevis) {
    window.treevis = null;
  }

  // Redirect to base page
  window.location.href = redirectUri;
}
