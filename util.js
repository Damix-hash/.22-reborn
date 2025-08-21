require('dotenv').config();
const fs = require('fs');
const path = require('path');

let startTime = Date.now();

const spam_count = {};
const temp_blacklist = new Map();
const spam_offenses = {};
const tpsBuffer = [];

const MAX_BUFFER = 20;

// Whitelist from .env
const whitelist = process.env.WHITELIST ? process.env.WHITELIST.split(',').map(u => u.trim()) : [];

// Hardcoded admin list inside repo
const adminList = ['Damix2131', 'RepoAdmin2', 'anotherAdmin']; // Add your admin usernames here

function isAdmin(user) {
  user = user.trim();
  return whitelist.includes(user) || adminList.includes(user);
}

async function fetchJD(user, state) {
    const response = await fetch(`https://www.6b6t.org/pl/stats/${user}`);
    const text = await response.text()
    if (!text.includes("since")) return null;
    return String(text.split("since")[1].split("</span></div></div></div>")[0].replace("<!-- -->", "").trim());
}

function getCurrentTPS() {
    if (tpsBuffer.length === 0) return 20;

    const sum = tpsBuffer.reduce((a, b) => a + b, 0);
    return sum / tpsBuffer.length;
}

function getCurrentTPSInstant() {
    return tpsBuffer.length ? tpsBuffer[tpsBuffer.length - 1] : 20;
}

function getServerTPS(currentWorldAge, lastWorldAge, timeElapsedMs, clientRestarted) {
  let tpsPassed = (currentWorldAge - lastWorldAge)
  let secondsPassed = timeElapsedMs / 1000

  let tps = tpsPassed / secondsPassed

  if (tps < 0) {tps = 0}
  if (tps > 20) {tps = 20}

  if (clientRestarted) {
    tpsBuffer.length = 0
    clientRestarted = false
  }
  tpsBuffer.push(tps)
  if (tpsBuffer.length > MAX_BUFFER) tpsBuffer.shift();
}

function loadBotData(state) {
  try {
    const inputPath = path.join(__dirname, 'output', 'bot_data.json');
    if (fs.existsSync(inputPath)) {
      const jsonData = fs.readFileSync(inputPath, 'utf8');
      const data = JSON.parse(jsonData);

      state.quotes = data.quotes || {};
      state.crystalled = data.kills || 0;
      state.crystal_deaths = data.crystal_deaths || {};
      state.crystal_kills = data.crystal_kills || {};
      state.global_deaths = data.deaths || 0;
      state.topKills = data.topKills || {};
      state.marriages = data.marriages || {};
      state.bot_uses = data.bot_uses || 0;
      state.totalStats = data.totalStats || {};
      state.joindates = data.joindates || {}

      console.log('[Bot] Loaded bot_data.json');
    } else {
      console.log('[Bot] No bot_data.json found, starting fresh');
    }
  } catch (err) {
    console.error('[Bot] Failed to load bot_data.json:', err);
  }
}

function saveBotData(state) {
  try {
    const data = {
      quotes: state.quotes || {},
      totalStats: state.totalStats || {},
      crystal_kills: state.crystal_kills || {},
      crystal_deaths: state.crystal_deaths || {},
      kills: state.crystalled || 0, 
      deaths: state.global_deaths,
      topKills: state.crystal_kills || {},
      marriages: state.marriages || {},
      bot_uses: state.bot_uses || 0,
      joindates: state.joindates || {},
      lastUpdate: new Date().toISOString()
      
    };

    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

    const filePath = path.join(outputDir, 'bot_data.json');
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    console.log(`[Bot] Saved Data!`);
  } catch (err) {
    console.error('[Bot] Error saving bot_data.json:', err);
  }
}

function startAutoSave(state, intervalMs = 2 * 60 * 1000) {
  setInterval(() => {
    saveBotData(state);
  }, intervalMs);
}

function return_user(msg) {
  let no_rank_message = '';
  let get_username = '';

  if (msg.startsWith('[')) {
    no_rank_message = msg.split(']')[1];
    get_username = no_rank_message.split('»')[0];
  } else if (msg.includes('whispers')) {
    get_username = msg.split('whispers')[0];
  } else {
    get_username = msg.split('»')[0];
  }

  return get_username?.trim() || '';
}

// Legacy: keep this for compatibility if needed
function whitelisted_users(user) {
  return whitelist.includes(user.trim());
}

function blacklist(bot, user) {
  if (temp_blacklist.has(user)) return;

  if (!spam_offenses[user]) spam_offenses[user] = 1;
  else spam_offenses[user]++;

  if (spam_offenses[user] >= 6) spam_offenses[user] = 6;

  const minutes = spam_offenses[user] * 5;
  const duration = minutes * 60 * 1000;

  temp_blacklist.set(user, true);
  bot.whisper(user, `Blacklisted for spamming (${minutes} minutes).`);

  setTimeout(() => {
    temp_blacklist.delete(user);
    bot.whisper(user, "You're no longer blacklisted.");
  }, duration);
}

function checkSpam(bot, user) {
  if (!spam_count[user]) {
    spam_count[user] = 1;
  } else {
    spam_count[user]++;
  }

  setTimeout(() => {
    if (spam_count[user]) {
      spam_count[user]--;
      if (spam_count[user] <= 0) delete spam_count[user];
    }
  }, 5000);

  if (spam_count[user] >= 5) {
    spam_count[user] = 0;
    blacklist(bot, user);
    return true;
  }
  return false;
}

module.exports = {
  fetchJD,
  getCurrentTPS,
  getCurrentTPSInstant,
  getServerTPS,
  loadBotData,
  saveBotData,
  startAutoSave,
  return_user,
  whitelisted_users, // legacy function, still works
  isAdmin,
  spam_count,
  temp_blacklist,
  spam_offenses,
  whitelist,
  adminList,
  checkSpam,
};
