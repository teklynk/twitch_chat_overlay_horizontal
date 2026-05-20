# Twitch Horizontal Chat Overlay

## What is this?
A clean, ticker-style horizontal chat overlay for Twitch streamers. Designed to be placed at the top or bottom of your stream, it allows chat messages to flow across the screen in a single line, making it ideal for minimalist or high-action layouts where vertical space is limited.

## Features
- **Horizontal "Push" Flow**: New messages enter from the right and push older messages toward the left edge of the screen.
- **Multiple Stylized Themes**: Includes several built-in themes like "Cyber Orbitron" (Neon/Cyberpunk), "Pink Comfortaa", and a "Twitchy" dark mode style.
- **Emote Support**: Fully supports native Twitch emotes, BetterTTV, and 7TV (Global and Channel) emotes.
- **High Performance**: Automatically prunes older messages from the DOM to ensure the overlay stays lightweight during long broadcast sessions.
- **Customizable via URL**: Control functionality like badges, colors, and emotes through simple URL parameters.

## Setup Guide

### OBS Settings
1. Add a **Browser Source** in OBS.
2. Enter your generated overlay URL (e.g., `chat.html?channel=yourchannel&themeOption=2`).
3. Set the **Width** to match your stream canvas (e.g., 1920).
4. Set the **Height** to something compact (e.g., 150 to 250).

## Configuration (URL Parameters)

Append these parameters to your `chat.html` URL to customize the behavior.

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `channel` | string | **Required**. The Twitch channel name to join. |
| `themeOption` | integer | Select a theme: `1` (Modern), `2` (Cyber Orbitron), `3` (Pink), `4` (Twitchy). |
| `useColor` | true/false | Use the chatter's native Twitch color or a default theme color. |
| `showBadges` | true/false | Toggle visibility of subscriber/moderator badges. |
| `showBttvEmotes` | true/false | Enable or disable BetterTTV emote rendering. |
| `show7tvEmotes` | true/false | Enable or disable 7TV emote rendering. |

## Custom CSS
You can further customize the look in OBS by adding CSS to the **Custom CSS** field in the Browser Source properties.

### Example: Adding a fade-out effect to the left and right side
```css
html { 
	mask-image: linear-gradient(to left, transparent 0%, black 2%);
}

body {
	mask-image: linear-gradient(to right, transparent 0%, black 2%);
}
```

## Self Host / Local Development

You can run this project locally using Docker. A docker-compose.yml file is included.

```bash
docker-compose up -d --build
```

The project will be available at: `http://localhost:5004`

Stop and remove the container with:

```bash
docker-compose down
```