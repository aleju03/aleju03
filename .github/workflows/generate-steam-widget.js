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

    // Fetch detailed info for each game
    const gamesWithDetails = await Promise.all(topGames.map(async (game) => {
      // Download icon
      const imageUrl = `https://cdn.akamai.steamstatic.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`;
      const base64Image = await downloadImageAsBase64(imageUrl);

      // Fetch game details (tags/genres)
      const gameDetails = await fetchGameDetails(game.appid);

      // Fetch achievements
      const achievements = await fetchPlayerAchievements(game.appid);

      return {
        ...game,
        base64Image,
        genres: gameDetails.genres,
        achievements: achievements
      };
    }));

    // Generate SVG
    const svg = generateSVG(gamesWithDetails);

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

function fetchGameDetails(appid) {
  return new Promise((resolve) => {
    https.get(`https://store.steampowered.com/api/appdetails?appids=${appid}`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response[appid]?.success && response[appid]?.data?.genres) {
            const genres = response[appid].data.genres.map(g => g.description).slice(0, 3);
            resolve({ genres });
          } else {
            resolve({ genres: [] });
          }
        } catch (err) {
          resolve({ genres: [] });
        }
      });
    }).on('error', () => resolve({ genres: [] }));
  });
}

function fetchPlayerAchievements(appid) {
  return new Promise((resolve) => {
    https.get(`https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/?key=${STEAM_API_KEY}&steamid=${STEAM_ID}&appid=${appid}`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.playerstats?.achievements) {
            const total = response.playerstats.achievements.length;
            const unlocked = response.playerstats.achievements.filter(a => a.achieved === 1).length;
            resolve({ unlocked, total });
          } else {
            resolve(null);
          }
        } catch (err) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

function generateSVG(games) {
  // Calculate dynamic height based on number of games (each game ~100px)
  const baseHeight = 80;
  const gameHeight = 100;
  const height = baseHeight + (games.length * gameHeight);

  let gameElements = '';
  games.forEach((game, index) => {
    const hours = Math.round(game.playtime_2weeks / 60 * 10) / 10;
    const genres = game.genres.join(', ') || 'Action';

    // Format last played date
    const lastPlayed = game.rtime_last_played
      ? new Date(game.rtime_last_played * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'Recently';

    // Achievement info
    const achievementInfo = game.achievements
      ? `<div><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path fill-rule="evenodd" d="M7.177 3.073L9.573.677A.25.25 0 0110 .854v4.792a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM11 2.5h-1V4h1a1 1 0 011 1v5.628a2.251 2.251 0 101.5 0V5A2.5 2.5 0 0011 2.5zm1 10.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0zM3.75 12a.75.75 0 100 1.5.75.75 0 000-1.5z"/></svg>${game.achievements.unlocked} / ${game.achievements.total} achievements unlocked</div>`
      : '';

    gameElements += `
        <div class="media">
          <img src="${game.base64Image}" alt=""/>
          <div class="about">
            <div class="name">${escapeXml(game.name)}</div>
            <div class="infos">
              <div>${escapeXml(genres)}</div>
            </div>
            <div class="infos">
              <div><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path fill-rule="evenodd" d="M1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0zM8 0a8 8 0 100 16A8 8 0 008 0zm.5 4.75a.75.75 0 00-1.5 0v3.5a.75.75 0 00.471.696l2.5 1a.75.75 0 00.557-1.392L8.5 7.742V4.75z"/></svg>${hours} hours played</div>
              <div><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path fill-rule="evenodd" d="M4.75 0a.75.75 0 01.75.75V2h5V.75a.75.75 0 011.5 0V2h1.25c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0113.25 16H2.75A1.75 1.75 0 011 14.25V3.75C1 2.784 1.784 2 2.75 2H4V.75A.75.75 0 014.75 0zm0 3.5h8.5a.25.25 0 01.25.25V6h-11V3.75a.25.25 0 01.25-.25h2.5zm-2.25 4v6.75c0 .138.112.25.25.25h10.5a.25.25 0 00.25-.25V7.5h-11z"/></svg>Last played on ${lastPlayed}</div>
              ${achievementInfo}
            </div>
          </div>
        </div>
    `;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="${height}" class="">
    <defs><style/></defs>
    <style>
@keyframes animation-gauge{0%{stroke-dasharray:0 329}}@keyframes animation-rainbow{0%,to{color:#7f00ff;fill:#7f00ff}14%{color:#a933ff;fill:#a933ff}29%{color:#007fff;fill:#007fff}43%{color:#00ff7f;fill:#00ff7f}57%{color:#ff0;fill:#ff0}71%{color:#ff7f00;fill:#ff7f00}86%{color:red;fill:red}}svg{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif,Apple Color Emoji,Segoe UI Emoji;font-size:14px;color:#777}h2{margin:8px 0 2px;padding:0;color:#0366d6;font-weight:400;font-size:16px}h2 svg{fill:currentColor}section>.field{margin-left:5px;margin-right:5px}.field{display:flex;align-items:center;margin-bottom:2px;white-space:nowrap}.field svg{margin:0 8px;fill:#959da5;flex-shrink:0}.row{display:flex;flex-wrap:wrap}.row section{flex:1 1 0}.steam .games{margin-left:28px}.steam .media{display:flex;margin-bottom:12px;width:450px}.steam .media img{margin:0 10px;border-radius:7px;height:32px;width:32px}.steam .media .about{flex-grow:1}.steam .media .name{display:flex;align-items:center;justify-content:space-between;font-size:14px;line-height:14px;color:#58a6ff;font-weight:600;margin-bottom:4px}.steam .media .infos{font-size:12px;color:#8b949e;display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-bottom:2px}.steam .media .infos>div{display:inline-flex;align-items:center;margin-right:12px}.steam .media .infos svg{fill:currentColor;height:12px;width:12px;margin:0 4px 0 0}#metrics-end{width:100%}
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
