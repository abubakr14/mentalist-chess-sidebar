
const API = "https://api.chess.com/pub";
const CLUB_ID = "mentalist";
const DATA_URL = "./data.json";

const leaderboard = document.getElementById("leaderboard");
const tabs = document.querySelectorAll(".tab");

let clubData = {};
let currentMode = "blitz";
let refreshing = false;

const $ = id => document.getElementById(id);

async function apiFetch(url) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${url}`);
  }

  return response.json();
}

function setText(id, value) {
  const element = $(id);
  if (element) element.textContent = value ?? "—";
}

function addPlayerRow(container, player, rank, rating) {
  const row = document.createElement("div");
  row.className = "player-row";

  const position = document.createElement("span");
  position.className = "player-rank";
  position.textContent = `#${rank}`;

  const link = document.createElement("a");
  link.textContent = player.username;
  link.href =
    "https://www.chess.com/member/" +
    encodeURIComponent(player.username);
  link.target = "_blank";
  link.rel = "noopener noreferrer";

  const score = document.createElement("span");
  score.className = "player-rating";
  score.textContent = Math.round(rating).toLocaleString();

  row.append(position, link, score);
  container.appendChild(row);
}

// Fetch ratings for a limited number of club members.
async function getMemberRatings(members) {
  const results = [];
  const usernames = [
    ...new Set(members.map(m => m.username).filter(Boolean))
  ].slice(0, 50);

  let position = 0;

  async function worker() {
    while (position < usernames.length) {
      const username = usernames[position++];

      try {
        const stats = await apiFetch(
          `${API}/player/${encodeURIComponent(username)}/stats`
        );

        const ratings = {};

        for (const mode of ["blitz", "bullet", "rapid"]) {
          const rating = stats[`chess_${mode}`]?.last?.rating;

          if (Number.isFinite(rating)) {
            ratings[mode] = rating;
          }
        }

        results.push({ username, ratings });

      } catch (error) {
        console.warn("Could not retrieve:", username, error);
      }
    }
  }

  await Promise.all(
    Array.from({ length: 4 }, () => worker())
  );

  return results;
}

// Retrieve Chess.com global title lists and match club members.
async function getTitledMembers(members) {
  const titles = ["GM", "IM", "FM", "CM", "WGM", "WIM", "WFM", "WCM"];

  const clubNames = new Set(
    members.map(m => m.username.toLowerCase())
  );

  const found = [];

  await Promise.all(titles.map(async title => {
    try {
      const data = await apiFetch(`${API}/titled/${title}`);

      for (const username of data.players || []) {
        if (clubNames.has(username.toLowerCase())) {
          found.push({ username, title });
        }
      }
    } catch (error) {
      console.warn("Title lookup failed:", title, error);
    }
  }));

  return found;
}

// Display leaderboard.
function renderLeaderboard(mode) {
  if (!leaderboard) return;

  currentMode = mode;
  leaderboard.replaceChildren();

  const players = (clubData.ratings || [])
    .filter(player => Number.isFinite(player.ratings[mode]))
    .sort((a, b) =>
      b.ratings[mode] - a.ratings[mode]
    )
    .slice(0, 10);

  if (!players.length) {
    leaderboard.textContent =
      "No rating information available yet.";
    return;
  }

  players.forEach((player, index) => {
    addPlayerRow(
      leaderboard,
      player,
      index + 1,
      player.ratings[mode]
    );
  });
}

// Display titled players.
function renderTitledPlayers() {
  const container = $("titled-players");
  if (!container) return;

  container.replaceChildren();

  const players = clubData.titledPlayers || [];

  if (!players.length) {
    container.textContent =
      "No verified titled players found in the retrieved member sample.";
    return;
  }

  players.forEach((player, index) => {
    const row = document.createElement("div");
    row.className = "player-row";

    const rank = document.createElement("span");
    rank.className = "player-rank";
    rank.textContent = player.title;

    const link = document.createElement("a");
    link.href =
      "https://www.chess.com/member/" +
      encodeURIComponent(player.username);
    link.textContent = player.username;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    row.append(rank, link);
    container.appendChild(row);
  });
}

// Display real club statistics.
function renderStatistics() {
  const profile = clubData.profile || {};
  const members = clubData.members || {};

  setText("member-count", profile.members_count);
  setText("total-members", profile.members_count);
  setText("active-members", members.weekly?.length ?? "—");
  setText("new-members", members.monthly?.length ?? "—");

  const matches = clubData.matches || {};
  const matchCount =
    (matches.registered?.length || 0) +
    (matches.in_progress?.length || 0);

  setText("club-matches", matchCount);
}

// Display weekly and monthly activity.
function renderActivityChart() {
  const container = $("activity-chart");
  if (!container) return;

  container.replaceChildren();

  const values = [
    { label: "Weekly", count: clubData.members?.weekly?.length || 0 },
    { label: "Monthly", count: clubData.members?.monthly?.length || 0 }
  ];

  const max = Math.max(1, ...values.map(v => v.count));

  const chart = document.createElement("div");
  chart.style.cssText =
    "display:flex;align-items:end;height:100px;gap:15px;";

  values.forEach(item => {
    const column = document.createElement("div");
    column.style.cssText =
      "flex:1;text-align:center;color:#a99a78;font-size:10px;";

    const bar = document.createElement("div");
    bar.style.cssText =
      `height:${Math.max(4, item.count / max * 70)}px;` +
      "max-width:55px;margin:auto;background:#d4af57;" +
      "border-radius:5px 5px 0 0;";

    const number = document.createElement("div");
    number.textContent = item.count;

    const label = document.createElement("div");
    label.textContent = item.label;

    column.append(bar, number, label);
    chart.appendChild(column);
  });

  container.appendChild(chart);
}

// Display club activity information.
function renderActivityFeed() {
  const container = $("activity-feed");
  if (!container) return;

  container.replaceChildren();

  const profile = clubData.profile || {};
  const weekly = clubData.members?.weekly?.length || 0;
  const monthly = clubData.members?.monthly?.length || 0;

  const lines = [
    `Club: ${profile.name || "Mentalist"}`,
    `Weekly active members: ${weekly}`,
    `Monthly active members: ${monthly}`,
    `Last club activity: ${
      profile.last_activity
        ? new Date(profile.last_activity * 1000).toLocaleString()
        : "Unavailable"
    }`
  ];

  lines.forEach(line => {
    const p = document.createElement("p");
    p.textContent = line;
    container.appendChild(p);
  });
}

// Display club matches.
function renderEvents() {
  const container = $("upcoming-matches");
  if (!container) return;

  container.replaceChildren();

  const matches = clubData.matches || {};
  const events = [
    ...(matches.registered || []),
    ...(matches.in_progress || [])
  ];

  if (!events.length) {
    container.textContent =
      "No registered or ongoing club matches found.";
    return;
  }

  events.forEach(event => {
    const p = document.createElement("p");
    p.textContent =
      `${event.name || "Club match"} — ${event.status || "Scheduled"}`;

    container.appendChild(p);
  });
}

// Load optional existing announcements and tournaments.
async function loadExtraData() {
  try {
    const response = await fetch(
      `${DATA_URL}?refresh=${Date.now()}`,
      { cache: "no-store" }
    );

    if (!response.ok) return {};

    return await response.json();
  } catch {
    return {};
  }
}

function renderExtraData(extra) {
  const announcements = $("announcements");
  const tournaments = $("upcoming-tournaments");

  if (announcements) {
    announcements.replaceChildren();

    const items = extra.announcements || [];

    if (!items.length) {
      announcements.textContent =
        "Welcome to Mentalist. Stay sharp and keep improving!";
    }

    items.forEach(item => {
      const p = document.createElement("p");
      p.textContent = item.title || item.message || "";
      announcements.appendChild(p);
    });
  }

  if (tournaments) {
    tournaments.textContent =
      "Tournament information is not currently supplied by the club matches endpoint.";
  }
}

// Main refresh function.
async function refreshClubData() {
  if (refreshing) return;

  refreshing = true;

  const button = $("refresh-button");
  const updated = $("last-updated");

  if (button) {
    button.disabled = true;
    button.textContent = "↻ FETCHING CHESS.COM DATA...";
  }

  try {
    const [profile, members, matches, extra] =
      await Promise.all([
        apiFetch(`${API}/club/${CLUB_ID}`),
        apiFetch(`${API}/club/${CLUB_ID}/members`),
        apiFetch(`${API}/club/${CLUB_ID}/matches`),
        loadExtraData()
      ]);

    const memberList = members.all_time || [];

    clubData = {
      profile,
      members,
      matches,
      ratings: [],
      titledPlayers: [],
      extra
    };

    // Retrieve ratings and titled players.
    const [ratings, titledPlayers] = await Promise.all([
      getMemberRatings(memberList),
      getTitledMembers(memberList)
    ]);

    clubData.ratings = ratings;
    clubData.titledPlayers = titledPlayers;

    renderStatistics();
    renderLeaderboard(currentMode);
    renderTitledPlayers();
    renderActivityChart();
    renderActivityFeed();
    renderEvents();
    renderExtraData(extra);

    if (updated) {
      updated.textContent =
        "Last refreshed: " + new Date().toLocaleString();
    }

    if (button) button.textContent = "✓ DATA UPDATED";

  } catch (error) {
    console.error("Mentalist API error:", error);

    if (button) button.textContent = "⚠ API ERROR";

    if (updated) {
      updated.textContent =
        "Could not retrieve Chess.com data. Try again.";
    }

  } finally {
    refreshing = false;

    if (button) {
      button.disabled = false;

      if (button.textContent === "✓ DATA UPDATED") {
        setTimeout(() => {
          button.textContent = "↻ REFRESH CLUB DATA";
        }, 2500);
      }
    }
  }
}

// Leaderboard tabs.
tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(item => item.classList.remove("active"));
    tab.classList.add("active");
    renderLeaderboard(tab.dataset.type);
  });
});

// Make refresh function available to the HTML button.
window.refreshClubData = refreshClubData;

// Automatically retrieve data on page load.
refreshClubData();
