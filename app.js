const clientId = "9ac8ad344c204db9aaed743a2f51e485";
const redirectUri = window.location.origin + window.location.pathname;
const scopes = "user-top-read user-read-private";

let accessToken = null;
let userProfile = null;

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
  if (window.setSpotifyLoading) window.setSpotifyLoading(true);

  try {
    userProfile = await fetchFromSpotify("https://api.spotify.com/v1/me");
    console.log(`🎧 Logged in as ${userProfile.display_name}`);
    window.spotifyDisplayName = userProfile.display_name;

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
    document.dispatchEvent(new CustomEvent("spotifyGenreDataLoaded", {
      detail: {
        data,
        range: "medium_term",
      },
    }));
    if (window.loadSpotifyGenreData) {
      window.loadSpotifyGenreData(data, "medium_term");
    } else if (window.setSpotifyLoading) {
      window.setSpotifyLoading(false);
    }

  } catch (err) {
    console.error("Init failed:", err);
    if (window.setSpotifyLoading) window.setSpotifyLoading(false);
  }
}

async function fetchGenreData(range) {
  const res = await fetchFromSpotify(
    `https://api.spotify.com/v1/me/top/artists?time_range=${range}&limit=50`
  );
  return tallyArtistGenres(res.items);
}

function tallyArtistGenres(artists) {
  const genreRules = [
    ["Hip-Hop & Rap", /\b(hip hop|rap|trap|drill|grime|rage|plugg|boom bap)\b/],
    ["Folk & Country", /\b(country|americana|bluegrass|folk|red dirt|outlaw|roots|singer-songwriter)\b/],
    ["Punk", /\b(punk|emo|hardcore|ska punk)\b/],
    ["Metal", /\b(metal|doom|sludge|blackgaze|deathcore|metalcore)\b/],
    ["R&B and Soul", /\b(r&b|soul|funk|motown|neo soul|quiet storm)\b/],
    ["Jazz", /\b(jazz|swing|bebop|bossa|ragtime|big band)\b/],
    ["Electronic", /\b(electronic|electronica|electro|techno|house|idm|edm|trance|ambient|dubstep|uk garage|future garage|garage house|jungle|drum and bass|trip hop|breakbeat|dance|new rave)\b/],
    ["Reggae & Ska", /\b(reggae|ska|dub|dancehall|rocksteady)\b/],
    ["World", /\b(afro|latin|brazilian|samba|mpb|cumbia|reggaeton|k-pop|j-pop|city pop|mandopop|cantopop|bollywood)\b/],
    ["Classical", /\b(classical|baroque|romantic|orchestra|orchestral|opera|choral|minimalism)\b/],
    ["Indie", /\b(indie|alternative|shoegaze|new wave|darkwave|cold wave|madchester|lo-fi|slowcore|post-punk)\b/],
    ["Pop", /\b(pop|hyperpop|synthpop|electropop|art pop|baroque pop|bedroom pop|dream pop|idol)\b/],
    ["Rock", /\b(rock|grunge|psychedelic|gothic|glam|surf|garage|yacht)\b/],
  ];

  const metaOrder = [
    "Rock",
    "Indie",
    "Pop",
    "Hip-Hop & Rap",
    "R&B and Soul",
    "Folk & Country",
    "Electronic",
    "Punk",
    "Metal",
    "Jazz",
    "Classical",
    "Reggae & Ska",
    "World",
    "Other",
  ];

  const crossGenreKeepers = new Set([
    "alt country",
    "country rock",
    "folk rock",
    "folk punk",
    "pop punk",
    "ska punk",
    "post-punk",
    "art pop",
    "baroque pop",
    "trip hop",
  ]);

  const findMeta = (genre) => {
    const normalized = genre.toLowerCase().replace(/-/g, " ");
    const match = genreRules.find(([, pattern]) => pattern.test(normalized));
    return match ? match[0] : "Other";
  };

  const getArtistPrimaryMetas = (artistGenres) => {
    const scores = {};
    artistGenres.forEach((genre) => {
      const meta = findMeta(genre);
      scores[meta] = (scores[meta] || 0) + 1;
    });

    const ranked = Object.entries(scores)
      .sort((a, b) => b[1] - a[1]);
    const topScore = ranked[0]?.[1] || 0;

    return new Set(
      ranked
        .filter(([, score]) => score === topScore || (topScore > 2 && score >= topScore - 1))
        .map(([meta]) => meta)
    );
  };

  const shouldCountGenre = (genre, primaryMetas) => {
    const lower = genre.toLowerCase();
    return primaryMetas.has(findMeta(genre)) || crossGenreKeepers.has(lower);
  };

  const metaCounts = {};
  artists.forEach((artist) => {
    const artistGenres = artist.genres || [];
    const primaryMetas = getArtistPrimaryMetas(artistGenres);

    artistGenres
      .filter((genre) => shouldCountGenre(genre, primaryMetas))
      .forEach((genre) => {
        const meta = findMeta(genre);
        if (!metaCounts[meta]) metaCounts[meta] = {};
        if (!metaCounts[meta][genre]) {
          metaCounts[meta][genre] = {
            size: 0,
          };
        }
        metaCounts[meta][genre].size += 1;
      });
  });

  return {
    children: Object.entries(metaCounts)
      .sort(([a], [b]) => metaOrder.indexOf(a) - metaOrder.indexOf(b))
      .map(([meta, subgenres]) => ({
        name: meta,
        children: Object.entries(subgenres)
          .sort(([, a], [, b]) => b.size - a.size)
          .map(([name, info]) => ({
            name,
            size: info.size,
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
  window.spotifyDisplayName = null;

  // Reset the UI
  const loginBtn = document.getElementById("loginButton");
  const logoutBtn = document.getElementById("logoutButton");
  const userInfo = document.getElementById("user-info");

  if (loginBtn) loginBtn.style.display = "inline-block";
  if (logoutBtn) logoutBtn.style.display = "none";
  if (userInfo) userInfo.textContent = "";

  if (window.treevis) {
    window.treevis = null;
  }

  window.location.href = redirectUri;
}
