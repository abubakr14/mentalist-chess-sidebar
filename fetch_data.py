
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

CLUB_ID = "mentalist"
BASE_URL = "https://api.chess.com/pub"
OUTPUT_FILE = Path("data.json")

HEADERS = {
    "User-Agent": "MentalistClubDashboard/1.0 (GitHub: Abubakr14)",
    "Accept": "application/json",
}

session = requests.Session()
session.headers.update(HEADERS)


def api_get(url):
    """Fetch public Chess.com API data with retry handling."""
    for attempt in range(5):
        try:
            response = session.get(url, timeout=30)

            if response.status_code == 429:
                time.sleep(5 * (attempt + 1))
                continue

            response.raise_for_status()
            return response.json()

        except requests.RequestException as error:
            print(f"Request failed: {error}")
            if attempt == 4:
                return {}
            time.sleep(3 * (attempt + 1))

    return {}


def get_rating(stats, category):
    category_data = stats.get(f"chess_{category}", {})
    last_game = category_data.get("last", {})
    rating = last_game.get("rating")

    return rating if isinstance(rating, (int, float)) else None


def get_club_members():
    data = api_get(f"{BASE_URL}/club/{CLUB_ID}/members")

    weekly = data.get("weekly", [])
    monthly = data.get("monthly", [])
    all_time = data.get("all_time", [])

    def usernames(items):
        result = []

        for item in items:
            if isinstance(item, dict):
                username = item.get("username")
            else:
                username = item

            if username:
                result.append(str(username))

        return result

    weekly_names = usernames(weekly)
    monthly_names = usernames(monthly)
    all_names = usernames(all_time)

    members = list(dict.fromkeys(
        weekly_names + monthly_names + all_names
    ))

    return members, len(set(weekly_names + monthly_names)), len(members)


def get_player_data(username):
    profile = api_get(
        f"{BASE_URL}/player/{username}"
    )

    stats = api_get(
        f"{BASE_URL}/player/{username}/stats"
    )

    if not profile:
        return None

    ratings = {
        "blitz": get_rating(stats, "blitz"),
        "bullet": get_rating(stats, "bullet"),
        "rapid": get_rating(stats, "rapid"),
    }

    available = [
        rating for rating in ratings.values()
        if rating is not None
    ]

    highest_rating = max(available) if available else None

    return {
        "username": username,
        "ratings": ratings,
        "highest_rating": highest_rating,
        "title": profile.get("title"),
    }


def build_leaderboard(players, category):
    ranked = []

    for player in players:
        rating = player["ratings"].get(category)

        if rating is not None:
            ranked.append({
                "username": player["username"],
                "rating": rating,
            })

    return sorted(
        ranked,
        key=lambda player: player["rating"],
        reverse=True
    )[:10]


def build_titled_players(players):
    titled = []

    for player in players:
        if player.get("title") and player["highest_rating"] is not None:
            titled.append({
                "username": player["username"],
                "rating": player["highest_rating"],
            })

    return sorted(
        titled,
        key=lambda player: player["rating"],
        reverse=True
    )


def main():
    print("Fetching Mentalist club information...")

    club = api_get(f"{BASE_URL}/club/{CLUB_ID}")

    if not club:
        raise RuntimeError(
            "Could not retrieve the Mentalist club profile."
        )

    members, active_count, total_count = get_club_members()

    if not members:
        raise RuntimeError(
            "No club members were returned. Check the club URL ID."
        )

    print(f"Found {len(members)} members.")

    players = []

    # Serial requests help avoid Chess.com rate limiting.
    for index, username in enumerate(members, start=1):
        print(f"[{index}/{len(members)}] Fetching {username}")

        player = get_player_data(username)

        if player:
            players.append(player)

        time.sleep(0.2)

    matches = api_get(
        f"{BASE_URL}/club/{CLUB_ID}/matches"
    )

    in_progress = matches.get("in_progress", [])
    registered = matches.get("registered", [])

    data = {
        "club": {
            "name": club.get("name", "Mentalist"),
            "url": "https://www.chess.com/club/mentalist",
        },

        "updated_at": datetime.now(
            timezone.utc
        ).isoformat(),

        "statistics": {
            "total_members": club.get(
                "members_count", total_count
            ),
            "active_members": active_count,
            "new_members": None,
            "club_matches": len(in_progress) + len(registered),
        },

        "leaderboards": {
            "blitz": build_leaderboard(players, "blitz"),
            "bullet": build_leaderboard(players, "bullet"),
            "rapid": build_leaderboard(players, "rapid"),
        },

        "titled_players": build_titled_players(players),

        "activity_chart": [],
        "recent_activity": [],
        "upcoming_matches": [],
        "upcoming_tournaments": [],
        "announcements": [],
    }

    # Save generated data.
    OUTPUT_FILE.write_text(
        json.dumps(data, indent=2),
        encoding="utf-8"
    )

    print("Successfully generated data.json")
    print(f"Processed {len(players)} players.")


if __name__ == "__main__":
    main()
