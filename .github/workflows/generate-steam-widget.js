const https = require('https');
const fs = require('fs');

const STEAM_API_KEY = process.env.STEAM_API_KEY;
const STEAM_ID = '76561198145331488';

// Fetch recently played games from Steam API
https.get(`https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?key=${STEAM_API_KEY}&steamid=${STEAM_ID}&format=json`, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    const response = JSON.parse(data);
    const games = response.response.games || [];

    // Sort by playtime in last 2 weeks (descending)
    games.sort((a, b) => b.playtime_2weeks - a.playtime_2weeks);

    // Take top 5
    const topGames = games.slice(0, 5);

    // Generate SVG
    const svg = generateSVG(topGames);

    // Write to file
    fs.writeFileSync('steam-metrics.svg', svg);
    console.log('Steam widget generated successfully!');
  });
}).on('error', (err) => {
  console.error('Error fetching Steam data:', err);
  process.exit(1);
});

function generateSVG(games) {
  const height = 60 + (games.length * 80);

  let gameElements = '';
  games.forEach((game, index) => {
    const y = 60 + (index * 80);
    const hours = Math.round(game.playtime_2weeks / 60 * 10) / 10;

    gameElements += `
      <g transform="translate(20, ${y})">
        <image href="http://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg"
               width="64" height="64" x="0" y="0"/>
        <text x="80" y="25" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 16px; fill: #58a6ff; font-weight: 600;">
          ${escapeXml(game.name)}
        </text>
        <text x="80" y="45" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; fill: #8b949e;">
          ${hours} hours played (last 2 weeks)
        </text>
      </g>
    `;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="${height}" viewBox="0 0 500 ${height}">
  <style>
    .header { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  </style>
  <rect width="500" height="${height}" fill="#0d1117"/>

  <text x="20" y="35" class="header" style="font-size: 20px; fill: #58a6ff; font-weight: 600;">
    🎮 Recently Played Games
  </text>

  ${gameElements}
</svg>`;
}

function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}
