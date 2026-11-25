
const DATA_URL = "./data.json";
const API = "https://api.chess.com/pub";
const CLUB_ID = "mentalist";
const leaderboard = document.getElementById("leaderboard");
const tabs = document.querySelectorAll(".tab");

let clubData = null;
let currentMode = "blitz";

// Safely create text elements
function createText(tag, text, className = "") {
  const element = document.createElement(tag);
  element.textContent = text ?? "";
  if (className) element.className = className;
  return element;
}

// Create a player row
function createPlayerRow(player, rank, rating) {
  const row = document.createElement("div");
  row.className = "player-row";

  const position = createText("span", `#${rank}`, "player-rank");

  const link = document.createElement("a");
  link.textContent = player.username;
  link.href = `https://www.chess.com/member/${encodeURIComponent(player.username)}`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";

  const score = createText(
    "span",
    Number.isFinite(Number(rating))
      ? Math.round(Number(rating)).toLocaleString()
      : "—",
    "player-rating"
  );

  row.append(position, link, score);
  return row;
}

// Display Top 10 leaderboard
function renderLeaderboard(mode) {
  currentMode = mode;
  leaderboard.replaceChildren();

  const players = [...(clubData?.leaderboards?.[mode] || [])]
    .filter(player => Number.isFinite(Number(player.rating)))
    .sort((a, b) => Number(b.rating) - Number(a.rating))
    .slice(0, 10);

  if (!players.length) {
    leaderboard.textContent = "Leaderboard data is not available yet.";
    return;
  }

  players.forEach((player, index) => {
    leaderboard.appendChild(
      createPlayerRow(player, index + 1, player.rating)
    );
  });
}

// Handle leaderboard tabs
tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(item => item.classList.remove("active"));
    tab.classList.add("active");
    renderLeaderboard(tab.dataset.type);
  });
});

// Display titled players
function renderTitledPlayers() {
  const container = document.getElementById("titled-players");
  container.replaceChildren();

  const players = [...(clubData?.titled_players || [])]
    .sort((a, b) => Number(b.rating) - Number(a.rating));

  if (!players.length) {
    container.textContent = "No verified titled members found yet.";
    return;
  }

  players.forEach((player, index) => {
    container.appendChild(
      createPlayerRow(player, index + 1, player.rating)
    );
  });
}

// Display club statistics
function renderStatistics() {
  const stats = clubData?.statistics || {};

  document.getElementById("member-count").textContent =
    stats.total_members ?? "—";

  document.getElementById("total-members").textContent =
    stats.total_members ?? "—";

  document.getElementById("active-members").textContent =
    stats.active_members ?? "—";

  document.getElementById("new-members").textContent =
    stats.new_members ?? "—";

  document.getElementById("club-matches").textContent =
    stats.club_matches ?? "—";
}

// Display member activity chart
function renderActivityChart() {
  const container = document.getElementById("activity-chart");
  container.replaceChildren();

  const values = clubData?.activity_chart || [];

  if (!values.length) {
    container.textContent = "Activity history is being collected.";
    return;
  }

  const chart = document.createElement("div");
  chart.style.cssText =
    "display:flex;align-items:end;height:90px;gap:8px;";

  const max = Math.max(1, ...values.map(item => Number(item.count) || 0));

  values.forEach(item => {
    const column = document.createElement("div");
    column.style.cssText =
      "flex:1;display:flex;flex-direction:column;align-items:center;height:100%;justify-content:end;";

    const bar = document.createElement("div");
    const height = Math.max(3, (Number(item.count) / max) * 75);

    bar.style.cssText =
      `height:${height}px;width:100%;max-width:30px;background:#d4af57;border-radius:4px 4px 0 0;`;

    const label = createText("span", item.label || "", "");
    label.style.cssText = "font-size:9px;color:#a99a78;margin-top:5px;";

    column.append(bar, label);
    chart.appendChild(column);
  });

  container.appendChild(chart);
}

// Display recent activity
function renderActivityFeed() {
  const container = document.getElementById("activity-feed");
  container.replaceChildren();

  const items = clubData?.recent_activity || [];

  if (!items.length) {
    container.textContent = "No recent activity data available.";
    return;
  }

  items.forEach(item => {
    const row = createText("div", "", "player-row");
    row.textContent = `${item.type || "CLUB UPDATE"} — ${item.description || ""}`;
    container.appendChild(row);
  });
}

// Display upcoming events
function renderEvents() {
  const matches = document.getElementById("upcoming-matches");
  const tournaments = document.getElementById("upcoming-tournaments");

  matches.replaceChildren();
  tournaments.replaceChildren();

  const matchItems = clubData?.upcoming_matches || [];
  const tournamentItems = clubData?.upcoming_tournaments || [];

  matches.appendChild(createText("strong", "CLUB MATCHES"));

  if (!matchItems.length) {
    matches.appendChild(
      createText("p", "No confirmed upcoming matches available.")
    );
  }

  matchItems.forEach(item => {
    matches.appendChild(
      createText("p", `${item.name} — ${item.date || "Date TBA"}`)
    );
  });

  tournaments.appendChild(createText("strong", "TOURNAMENTS"));

  if (!tournamentItems.length) {
    tournaments.appendChild(
      createText("p", "No confirmed upcoming tournaments available.")
    );
  }

  tournamentItems.forEach(item => {
    tournaments.appendChild(
      createText("p", `${item.name} — ${item.date || "Date TBA"}`)
    );
  });
}

// Display announcements
function renderAnnouncements() {
  const container = document.getElementById("announcements");
  container.replaceChildren();

  const announcements = clubData?.announcements || [];

  if (!announcements.length) {
    container.textContent =
      "Welcome to Mentalist. Stay sharp and keep improving!";
    return;
  }

  announcements.forEach(item => {
    container.appendChild(
      createText("p", item.title || item.message || "")
    );
  });
}

// Load generated club data


let refreshing = false;
async function refreshClubData() {
  if (refreshing) return;

  refreshing = true;

  const button = document.getElementById("refresh-button");
  const updated = document.getElementById("last-updated");

  button.disabled = true;
  button.textContent = "↻ REFRESHING...";

  try {
    const response = await fetch(
      DATA_URL + "?refresh=" + Date.now(),
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error("Could not retrieve club data.");
    }

    const newData = await response.json();

    // Only replace existing data after successful retrieval.
    clubData = newData;

    renderStatistics();
    renderLeaderboard(currentMode);
    renderTitledPlayers();
    renderActivityChart();
    renderActivityFeed();
    renderEvents();
    renderAnnouncements();

    const now = new Date();

    updated.textContent =
      "Last updated: " + now.toLocaleString();

    button.textContent = "✓ DATA UPDATED";

  } catch (error) {
    console.error("Refresh error:", error);

    button.textContent = "⚠ REFRESH FAILED";

    updated.textContent =
      "Could not retrieve new data. Try again.";
  } finally {
    refreshing = false;
    button.disabled = false;

    if (button.textContent === "✓ DATA UPDATED") {
      setTimeout(() => {
        button.textContent = "↻ REFRESH CLUB DATA";
      }, 2500);
    }
  }
}

// Load data automatically when the dashboard opens.
refreshClubData();

