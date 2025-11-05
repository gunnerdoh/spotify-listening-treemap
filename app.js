(function() {
  const clientId = "9ac8ad344c204db9aaed743a2f51e485";
  const redirectUri = "http://127.0.0.1:5500/index.html";
  const scopes = "user-read-private user-read-email user-top-read";

  document.addEventListener("DOMContentLoaded", () => {
    const loginButton = id("login");
    if (loginButton) {
      loginButton.addEventListener("click", () => {
        const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}` +
          `&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `&scope=${encodeURIComponent(scopes)}`;
        window.location.href = authUrl;
      });
    }

    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const token = params.get("access_token");

    if (token) {
      console.log("Access token received:", token);

      // 🧠 Fetch user profile from Spotify
      fetch("https://api.spotify.com/v1/me/top/artists?time_range=long_term&limit=50&offset=0", {
        headers: { Authorization: "Bearer " + token }
      })
        .then(res => res.json())
        .then(data => {
          // console.log(data)
          cleanData(data);
        })
        .catch(err => console.error("Error fetching profile:", err));
    }
  });

  function cleanData(data) {
    genresList = []
    data.items.forEach(song => {
      genresList.push(song.genres)
    });
    return formatJSON(genresList.flat())
  }

  function formatJSON(genres) {
    const genreCount = {};
    for (const g of genres) {
      genreCount[g] = (genreCount[g] || 0) + 1;
    }
    const formatted = {
      children: Object.entries(genreCount).map(([name, size]) => ({ name, size }))
    };
    console.log(formatted)

    const jsonString = JSON.stringify(formatted, null, 2);

    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "spotify-genres-long.json"; // filename
    a.style.display = "none"; // not visible
    document.body.appendChild(a);
    a.click();

    // Cleanup
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return formatted; 
  }

  function id(x) {
    return document.getElementById(x);
  }
}());
