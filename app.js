const clientId =  import.meta.env.VITE_clientId;
const redirectUri = import.meta.env.VITE_redirectUri;

const authEndpoint = "https://accounts.spotify.com/authorize";
const scopes = [
  "playlist-read-private",
  "playlist-read-collaborative",
  "playlist-modify-public",
  "playlist-modify-private",
  "user-read-private",
  "user-read-email",
];

const loginButton = document.getElementById("login-button");
const welcomeLoginButton = document.getElementById("welcome-login-button");
const authSection = document.getElementById("auth-section");
const menu = document.getElementById("menu");
const playlistsSection = document.getElementById("playlists-section");
const header = document.getElementById("header");
const welcomeScreen = document.getElementById("welcome-screen");
const playlistView = document.getElementById("playlist-view");
const searchResults = document.getElementById("search-results");
const playlistList = document.getElementById("playlist-list");
const playlistTracks = document.getElementById("playlist-tracks");
const resultsContainer = document.getElementById("results-container");
const songSearch = document.getElementById("song-search");
const userProfile = document.getElementById("user-profile");
const playlistName = document.getElementById("playlist-name");
const playlistDescription = document.getElementById("playlist-description");
const homeBtn = document.getElementById("home-btn");
const searchBtn = document.getElementById("search-btn");
const libraryBtn = document.getElementById("library-btn");
const createPlaylistBtn = document.getElementById("create-playlist-btn");

let currentUser = null;
let accessToken = null;
let currentPlaylistId = null;
let currentPlaylistTracks = [];
let allPlaylists = [];

document.addEventListener("DOMContentLoaded", function () {
  checkAuth();

  loginButton.addEventListener("click", handleLogin);
  welcomeLoginButton.addEventListener("click", handleLogin);
  songSearch.addEventListener("input", debounce(handleSearch, 500));
  homeBtn.addEventListener("click", () => showView("home"));
  searchBtn.addEventListener("click", () => showView("search"));
  libraryBtn.addEventListener("click", () => showView("library"));
  createPlaylistBtn.addEventListener("click", createNewPlaylist);
});

function checkAuth() {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  const token = params.get("access_token");

  if (token) {
    accessToken = token;
    window.history.pushState({}, document.title, window.location.pathname);
    fetchUserProfile();
  }
}

function handleLogin() {
  const authUrl = `${authEndpoint}?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${encodeURIComponent(
    scopes.join(" ")
  )}&response_type=token&show_dialog=true`;
  window.location.href = authUrl;
}

function fetchUserProfile() {
  fetch("https://api.spotify.com/v1/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
    .then((response) => response.json())
    .then((data) => {
      currentUser = data;
      updateUIAfterLogin();
      fetchUserPlaylists();
    })
    .catch((error) => {
      console.error("Error fetching user profile:", error);
    });
}

function updateUIAfterLogin() {
  authSection.style.display = "none";
  menu.style.display = "block";
  playlistsSection.style.display = "block";
  header.style.display = "flex";
  welcomeScreen.style.display = "none";

  userProfile.innerHTML = `
        <img src="${
          currentUser.images?.[0]?.url ||
          "https://i.scdn.co/image/ab6775700000ee8518a4a8a5d5d5d5d5d5d5d5d5"
        }" alt="${currentUser.display_name}">
        <span>${currentUser.display_name}</span>
    `;
}

function fetchUserPlaylists() {
  fetch("https://api.spotify.com/v1/me/playlists", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
    .then((response) => response.json())
    .then((data) => {
      allPlaylists = data.items;
      renderPlaylists(allPlaylists);
    })
    .catch((error) => {
      console.error("Error fetching playlists:", error);
    });
}

function renderPlaylists(playlists) {
  playlistList.innerHTML = "";

  playlists.forEach((playlist) => {
    const li = document.createElement("li");
    li.textContent = playlist.name;
    li.dataset.id = playlist.id;
    li.addEventListener("click", () => loadPlaylist(playlist));
    playlistList.appendChild(li);
  });
}

function loadPlaylist(playlist) {
  currentPlaylistId = playlist.id;

  document.querySelectorAll("#playlist-list li").forEach((li) => {
    li.classList.remove("active");
  });
  document
    .querySelector(`#playlist-list li[data-id="${playlist.id}"]`)
    .classList.add("active");

  playlistName.textContent = playlist.name;
  playlistDescription.textContent =
    playlist.description || `By ${playlist.owner.display_name}`;

  showView("home");

  fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
    .then((response) => response.json())
    .then((data) => {
      currentPlaylistTracks = data.items;
      renderPlaylistTracks(currentPlaylistTracks);
    })
    .catch((error) => {
      console.error("Error fetching playlist tracks:", error);
    });
}

// Render playlist tracks
function renderPlaylistTracks(tracks) {
  playlistTracks.innerHTML = "";

  if (tracks.length === 0) {
    playlistTracks.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-music"></i>
                <p>This playlist is empty</p>
            </div>
        `;
    return;
  }

  tracks.forEach((item, index) => {
    const track = item.track;
    const trackElement = document.createElement("div");
    trackElement.className = "track";
    trackElement.innerHTML = `
            <div class="track-number">${index + 1}</div>
            <div class="track-image">
                <img src="${track.album.images[2].url}" alt="${track.name}">
            </div>
            <div class="track-info">
                <div class="track-title">${track.name}</div>
                <div class="track-artist">${track.artists
                  .map((artist) => artist.name)
                  .join(", ")}</div>
            </div>
            <div class="track-duration">${formatDuration(
              track.duration_ms
            )}</div>
            <div class="track-actions">
                <button class="remove-button" data-track-uri="${track.uri}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

    trackElement
      .querySelector(".remove-button")
      .addEventListener("click", (e) => {
        e.stopPropagation();
        removeTrackFromPlaylist(track.uri);
      });

    playlistTracks.appendChild(trackElement);
  });
}

// Handle search
function handleSearch() {
  const query = songSearch.value.trim();

  if (query.length === 0) {
    showView("home");
    return;
  }

  showView("search");
  resultsContainer.innerHTML = '<div class="loading">Searching...</div>';

  fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(
      query
    )}&type=track&limit=20`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )
    .then((response) => response.json())
    .then((data) => {
      renderSearchResults(data.tracks.items);
    })
    .catch((error) => {
      console.error("Error searching:", error);
      resultsContainer.innerHTML =
        '<div class="error">Error searching for tracks</div>';
    });
}

function renderSearchResults(tracks) {
  resultsContainer.innerHTML = "";

  if (tracks.length === 0) {
    resultsContainer.innerHTML =
      '<div class="empty-state">No results found</div>';
    return;
  }

  tracks.forEach((track) => {
    const resultCard = document.createElement("div");
    resultCard.className = "result-card";
    resultCard.innerHTML = `
            <div class="result-image">
                <img src="${track.album.images[1].url}" alt="${track.name}">
                <div class="play-icon">
                    <i class="fas fa-play"></i>
                </div>
            </div>
            <div class="result-title">${track.name}</div>
            <div class="result-artist">${track.artists
              .map((artist) => artist.name)
              .join(", ")}</div>
            <div class="result-actions">
                <button class="add-button" data-track-uri="${track.uri}">
                    Add to Playlist
                </button>
            </div>
        `;

    resultCard.querySelector(".add-button").addEventListener("click", (e) => {
      e.stopPropagation();
      addTrackToPlaylist(track.uri);
    });

    resultsContainer.appendChild(resultCard);
  });
}

function addTrackToPlaylist(trackUri) {
  if (!currentPlaylistId) {
    alert("Please select a playlist first");
    return;
  }

  const addButton = document.querySelector(
    `.add-button[data-track-uri="${trackUri}"]`
  );
  const originalText = addButton.innerHTML;
  addButton.innerHTML = '<i class="fas fa-spinner loading-spinner"></i>';
  addButton.disabled = true;

  fetch(
    `https://api.spotify.com/v1/playlists/${currentPlaylistId}/tracks?uris=${trackUri}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  )
    .then((response) => response.json())
    .then(() => {
      // Refresh the playlist
      fetchUserPlaylists();
      const playlist = allPlaylists.find((p) => p.id === currentPlaylistId);
      if (playlist) loadPlaylist(playlist);

      // Reset button
      addButton.innerHTML = originalText;
      addButton.disabled = false;
    })
    .catch((error) => {
      console.error("Error adding track:", error);
      addButton.innerHTML = "Error";
      setTimeout(() => {
        addButton.innerHTML = originalText;
        addButton.disabled = false;
      }, 2000);
    });
}

function removeTrackFromPlaylist(trackUri) {
  if (!currentPlaylistId) return;

  fetch(`https://api.spotify.com/v1/playlists/${currentPlaylistId}/tracks`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tracks: [{ uri: trackUri }],
    }),
  })
    .then((response) => response.json())
    .then(() => {
      // Refresh the playlist
      fetchUserPlaylists();
      const playlist = allPlaylists.find((p) => p.id === currentPlaylistId);
      if (playlist) loadPlaylist(playlist);
    })
    .catch((error) => {
      console.error("Error removing track:", error);
    });
}

function createNewPlaylist() {
  const playlistName = prompt("Enter playlist name:");
  if (!playlistName) return;

  fetch(`https://api.spotify.com/v1/users/${currentUser.id}/playlists`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: playlistName,
      description: "Created with Spotify Playlist Manager",
      public: false,
    }),
  })
    .then((response) => response.json())
    .then((playlist) => {
      // Refresh playlists
      fetchUserPlaylists();
      // Load the new playlist
      loadPlaylist(playlist);
    })
    .catch((error) => {
      console.error("Error creating playlist:", error);
    });
}

function showView(view) {
  playlistView.style.display = "none";
  searchResults.style.display = "none";

  // Update active menu item
  homeBtn.classList.remove("active");
  searchBtn.classList.remove("active");
  libraryBtn.classList.remove("active");

  switch (view) {
    case "home":
      playlistView.style.display = "block";
      homeBtn.classList.add("active");
      break;
    case "search":
      searchResults.style.display = "block";
      searchBtn.classList.add("active");
      break;
    case "library":
      playlistView.style.display = "block";
      libraryBtn.classList.add("active");
      break;
  }
}

// Helper function to format duration
function formatDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

// Debounce function for search
function debounce(func, wait) {
  let timeout;
  return function () {
    const context = this,
      args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}
