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

  res.on('end', async () => {
    const response = JSON.parse(data);
    const games = response.response.games || [];

    // Sort by playtime in last 2 weeks (descending)
    games.sort((a, b) => b.playtime_2weeks - a.playtime_2weeks);

    // Take top 5
    const topGames = games.slice(0, 5);

    // Download and convert images to base64
    const gamesWithImages = await Promise.all(topGames.map(async (game) => {
      const imageUrl = `https://cdn.akamai.steamstatic.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`;
      const base64Image = await downloadImageAsBase64(imageUrl);
      return { ...game, base64Image };
    }));

    // Generate SVG
    const svg = generateSVG(gamesWithImages);

    // Write to file
    fs.writeFileSync('steam-metrics.svg', svg);
    console.log('Steam widget generated successfully!');
  });
}).on('error', (err) => {
  console.error('Error fetching Steam data:', err);
  process.exit(1);
});

function downloadImageAsBase64(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const base64 = buffer.toString('base64');
        resolve(`data:image/jpg;base64,${base64}`);
      });
    }).on('error', reject);
  });
}

function generateSVG(games) {
  const height = 140 + (games.length * 70);

  let gameElements = '';
  games.forEach((game, index) => {
    const hours = Math.round(game.playtime_2weeks / 60 * 10) / 10;

    gameElements += `
        <div class="media">
          <img src="${game.base64Image}" alt=""/>
          <div class="about">
            <div class="name">${escapeXml(game.name)}</div>
            <div class="infos">
              <div>${hours} hours played (last 2 weeks)</div>
            </div>
          </div>
        </div>
    `;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="${height}" class="">
    <defs><style/></defs>
    <style>
@keyframes animation-gauge{0%{stroke-dasharray:0 329}}@keyframes animation-rainbow{0%,to{color:#7f00ff;fill:#7f00ff}14%{color:#a933ff;fill:#a933ff}29%{color:#007fff;fill:#007fff}43%{color:#00ff7f;fill:#00ff7f}57%{color:#ff0;fill:#ff0}71%{color:#ff7f00;fill:#ff7f00}86%{color:red;fill:red}}svg{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif,Apple Color Emoji,Segoe UI Emoji;font-size:14px;color:#777}h2{margin:8px 0 2px;padding:0;color:#0366d6;font-weight:400;font-size:16px}h2 svg{fill:currentColor}section>.field{margin-left:5px;margin-right:5px}.field{display:flex;align-items:center;margin-bottom:2px;white-space:nowrap}.field svg{margin:0 8px;fill:#959da5;flex-shrink:0}.row{display:flex;flex-wrap:wrap}.row section{flex:1 1 0}.steam .games{margin-left:28px}.steam .media{display:flex;margin-bottom:4px;width:450px}.steam .media img{margin:0 10px;border-radius:7px;height:32px;width:32px}.steam .media .about{flex-grow:1}.steam .media .name{display:flex;align-items:center;justify-content:space-between;font-size:14px;line-height:14px;color:#58a6ff}.steam .media .infos{font-size:12px;color:#666}#metrics-end{width:100%}
    </style>
    <foreignObject x="0" y="0" width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" xmlns:xlink="http://www.w3.org/1999/xlink" class="items-wrapper">
            <section class="steam">
                <h2 class="field">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
                        <path fill-rule="evenodd" d="M1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0zM8 0a8 8 0 100 16A8 8 0 008 0zm.5 4.75a.75.75 0 00-1.5 0v3.5a.75.75 0 00.471.696l2.5 1a.75.75 0 00.557-1.392L8.5 7.742V4.75z"/>
                    </svg>
                    Recently played
                </h2>
                <div class="games">
${gameElements}
                </div>
            </section>
        </div>
        <div xmlns="http://www.w3.org/1999/xhtml" id="metrics-end"></div>
    </foreignObject>
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
