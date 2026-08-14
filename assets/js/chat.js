const params = new URLSearchParams(window.location.search);
const channel = params.get('channel').toLowerCase().trim();

// Theme selection logic
const themeOption = params.get('themeOption');
if (themeOption) {
  const themeLink = document.createElement("link");
  themeLink.rel = "stylesheet";
  themeLink.type = "text/css";
  themeLink.href = `assets/css/theme${themeOption.trim()}.css`;
  document.head.appendChild(themeLink);
}

const FADE_DURATION = 1.0; // seconds for the fade animation (adjustable)
const useColor = params.get('useColor') === 'true'; // Use chatters' colors or to inherit
const showBadges = params.get('showBadges') === 'true'; // Show chatters' badges
const showBttvEmotes = params.get('showBttvEmotes') === 'true'; // Show BetterTTV emotes
const showFfzEmotes = params.get('showFfzEmotes') === 'true'; // Show FFZ emotes
const show7tvEmotes = params.get('show7tvEmotes') === 'true'; // Show 7TV emotes
const onlySpecialUsers = params.get('onlySpecialUsers') === 'true'; // Only show messages from subs, mods, vips
const maxMessages = (() => {
  const value = parseInt(params.get('maxMessages'), 10);
  return Number.isInteger(value) && value > 0 ? value : 50;
})();
const fadeOutTime = (() => {
  const value = parseFloat(params.get('fadeOutTime'));
  return Number.isFinite(value) && value > 0 ? value : 0;
})();

let chat = document.getElementById("chat"),
  messageCount = 0,
  bttvEmotes = {},
  seventvEmotes = {},
  ffzEmotes = {},
  randomColorsChosen = {},
  badgeDefinitions = {},
  clientOptions = {
    options: {
      debug: true,
      skipUpdatingEmotesets: true,
    },
    connection: { reconnect: true },
    channels: [channel],
  },
  client = new tmi.client(clientOptions);

async function resolveChannelId(channelName) {
  try {
    const res = await fetch(`https://api.ivr.fi/twitch/resolve/${encodeURIComponent(channelName)}`);
    const data = await res.json();
    return data?.id || null;
  } catch (err) {
    console.warn("Unable to resolve Twitch channel id:", err);
    return null;
  }
}

const fallbackBadgeStyles = {
  broadcaster: "chat-badge-broadcaster",
  mod: "chat-badge-mod",
  admin: "chat-badge-admin",
  staff: "chat-badge-staff",
  turbo: "chat-badge-turbo",
  vip: "chat-badge-vip",
  subscriber: "chat-badge-subscriber",
  partner: "chat-badge-partner",
  founder: "chat-badge-founder"
};

async function safeFetchJson(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

function mergeBadgeDefinitions(target, payload) {
  if (!payload) return;

  const candidates = payload?.badge_sets || payload?.badges || payload?.data || payload;

  if (Array.isArray(candidates)) {
    candidates.forEach((item) => {
      const setName = item?.set_id || item?.id || item?.name || item?.badge_set || item?.slug;
      const versions = item?.versions || item?.versions_map || item?.badge_versions;

      if (!setName || !versions) return;

      if (Array.isArray(versions)) {
        const normalized = {};
        versions.forEach((version) => {
          const versionName = version?.id || version?.version || version?.name || version?.version_id || version?.key;
          if (!versionName) return;

          normalized[versionName] = {
            image_url_1x: version?.image_url_1x || version?.image_url || version?.url_1x || version?.url,
            image_url_2x: version?.image_url_2x || version?.url_2x,
            image_url_3x: version?.image_url_3x || version?.url_3x,
            image_url_4x: version?.image_url_4x || version?.url_4x,
          };
        });

        target[setName] = normalized;
      } else if (versions && typeof versions === "object") {
        target[setName] = versions;
      }
    });

    return;
  }

  if (payload && typeof payload === "object") {
    Object.entries(payload).forEach(([setName, setData]) => {
      if (!setData || typeof setData !== "object") return;

      const versions = setData.versions || setData.badge_versions || setData.versions_map || setData.versions_obj;
      if (!versions) return;

      if (Array.isArray(versions)) {
        const normalized = {};
        versions.forEach((version) => {
          const versionName = version?.id || version?.version || version?.name || version?.version_id || version?.key;
          if (!versionName) return;

          normalized[versionName] = {
            image_url_1x: version?.image_url_1x || version?.image_url || version?.url_1x || version?.url,
            image_url_2x: version?.image_url_2x || version?.url_2x,
            image_url_3x: version?.image_url_3x || version?.url_3x,
            image_url_4x: version?.image_url_4x || version?.url_4x,
          };
        });

        target[setName] = normalized;
      } else {
        target[setName] = versions;
      }
    });
  }
}

async function loadBadgeDefinitions(channelName) {
  const globalData = await safeFetchJson("https://api.ivr.fi/v2/twitch/badges/global");
  mergeBadgeDefinitions(badgeDefinitions, globalData);

  const channelData = await safeFetchJson(
    `https://api.ivr.fi/v2/twitch/badges/channel?login=${encodeURIComponent(channelName)}`
  );
  mergeBadgeDefinitions(badgeDefinitions, channelData);
}

loadBadgeDefinitions(channel.replace(/^#/, ""));

// Fetch BTTV emotes (Global + Channel) via gateway on load
if (showBttvEmotes) {
  fetch(`https://twitchapi.teklynk.com/getbttvemotes.php?channel=${channel}`)
    .then(res => res.json())
    .then(data => {
      if (Array.isArray(data)) {
        data.forEach(emote => bttvEmotes[emote.code] = emote.id);
      }
    });
}

// Fetch FFZ emotes (Global + Channel) via gateway on load
if (showFfzEmotes) {
  fetch(`https://twitchapi.teklynk.com/getffzemotes.php?channel=${channel}`)
    .then(res => res.json())
    .then(data => {
      if (Array.isArray(data)) {
        data.forEach(emote => ffzEmotes[emote.code] = emote.id);
      }
    });
}

// Fetch 7TV emotes (Global + Channel) via gateway on load
if (show7tvEmotes) {
  fetch(`https://twitchapi.teklynk.com/get7tvemotes.php?channel=${channel}`)
    .then(res => res.json())
    .then(data => {
      const processEmotes = (emotesArray) => {
        if (Array.isArray(emotesArray)) {
          emotesArray.forEach(emote => {
            seventvEmotes[emote.name] = emote.id;
          });
        }
      };

      if (data.emote_set) processEmotes(data.emote_set.emotes);
      processEmotes(data.emotes);
    });
}

function dehash(channel) {
  return channel.replace(/^#/, "");
}

function htmlEntities(html) {
  function it() {
    return html.map(function (n, i, arr) {
      if (n.length === 1) {
        return n.replace(/[\u00A0-\u9999<>\&]/gim, function (i) {
          return "&#" + i.charCodeAt(0) + ";";
        });
      }
      return n;
    });
  }

  let isArray = Array.isArray(html);
  if (!isArray) {
    html = html.split("");
  }
  html = it(html);
  if (!isArray) html = html.join("");
  return html;
}

function formatEmotes(text, emotes) {
  let splitText = text.split("");
  for (let i in emotes) {
    let e = emotes[i];
    for (let j in e) {
      let mote = e[j];
      if (typeof mote === "string") {
        mote = mote.split("-");
        mote = [parseInt(mote[0]), parseInt(mote[1])];
        let length = mote[1] - mote[0],
          empty = new Array(length + 1).fill("");
        splitText = splitText
          .slice(0, mote[0])
          .concat(empty)
          .concat(splitText.slice(mote[1] + 1, splitText.length));
        splitText.splice(
          mote[0],
          1,
          '<img class="emoticon" src="https://static-cdn.jtvnw.net/emoticons/v2/' +
          i +
          '/default/dark/2.0">'
        );
      }
    }
  }

  if (showBttvEmotes || show7tvEmotes || showFfzEmotes) {
    let word = "";
    let start = -1;
    for (let i = 0; i <= splitText.length; i++) {
      let item = splitText[i];
      if (item && typeof item === "string" && item.length === 1 && /\S/.test(item)) {
        if (start === -1) start = i;
        word += item;
      } else {
        if (word && showBttvEmotes && bttvEmotes[word]) {
          splitText.splice(start, word.length, '<img class="emoticon" src="https://cdn.betterttv.net/emote/' + bttvEmotes[word] + '/2x">');
          i = start;
        } else if (word && show7tvEmotes && seventvEmotes[word]) {
          splitText.splice(start, word.length, '<img class="emoticon" src="https://cdn.7tv.app/emote/' + seventvEmotes[word] + '/2x.webp">');
          i = start;
        } else if (word && showFfzEmotes && ffzEmotes[word]) {
          splitText.splice(start, word.length, '<img class="emoticon" src="https://cdn.frankerfacez.com/emote/' + ffzEmotes[word] + '/2">');
          i = start;
        }
        word = "";
        start = -1;
      }
    }
  }

  return htmlEntities(splitText).join("");
}

function badges(chan, user) {
  const chatBadges = document.createElement("span");
  chatBadges.className = "chat-badges";

  const entries = Object.entries(user.badges || {});
  if (user.username === chan && !entries.some(([badgeSet]) => badgeSet === "broadcaster")) {
    entries.push(["broadcaster", "1"]);
  }

  entries.forEach(([badgeSet, badgeVersion]) => {
    const versions = badgeDefinitions[badgeSet];
    const versionData = versions?.[badgeVersion];

    if (versionData) {
      const badge = document.createElement("img");
      badge.className = "chat-badge";
      badge.alt = `${badgeSet}/${badgeVersion}`;
      badge.draggable = false;
      badge.src = versionData.image_url_2x || versionData.image_url_1x || versionData.image_url_3x || "";
      chatBadges.appendChild(badge);
    } else {
      const badge = document.createElement("div");
      badge.className = "chat-badge-" + badgeSet;
      chatBadges.appendChild(badge);
    }
  });

  return chatBadges;
}

function isSpecialUser(user, chan) {
  // Check if user is broadcaster, mod, vip, or subscriber
  const badges = user.badges || {};
  const isBroadcaster = user.username === chan;
  const isMod = 'moderator' in badges;
  const isVip = 'vip' in badges;
  const isSubscriber = 'subscriber' in badges;
  
  return isBroadcaster || isMod || isVip || isSubscriber;
}

function handleChat(channel, user, message, self) {
  let chan = dehash(channel),
    name = user.username,
    chatLine = document.createElement("div"),
    chatChannel = document.createElement("span"),
    chatName = document.createElement("span"),
    chatColon = document.createElement("span"),
    chatMessage = document.createElement("span");

  let color = useColor ? user.color : "#9147ff"; // Twitch purple as default

  chatLine.className = "chat-line";
  chatLine.dataset.username = name;
  chatLine.dataset.channel = channel;
  chatLine.dataset.id = user["id"];

  messageCount++;
  chatLine.classList.add(messageCount % 2 === 0 ? "even" : "odd");

  if (user["message-type"] === "action") {
    chatLine.className += " chat-action";
  }

  chatChannel.className = "chat-channel";
  chatChannel.innerHTML = chan;

  chatName.className = "chat-name";
  chatName.style.color = color;
  chatName.innerHTML = user["display-name"] || name;

  chatColon.className = "chat-colon";
  chatColon.style.color = color;
  chatColon.textContent = ":";

  chatMessage.className = "chat-message";
  chatMessage.innerHTML = formatEmotes(message, user.emotes);

  const chatUser = document.createElement("span");
  chatUser.className = "chat-user";

  if (showBadges) chatLine.appendChild(badges(chan, user, self));
  if (client.opts.channels.length > 1) chatLine.appendChild(chatChannel);
  chatUser.appendChild(chatName);
  chatUser.appendChild(chatColon);
  chatLine.appendChild(chatUser);
  chatLine.appendChild(chatMessage);
  chat.appendChild(chatLine);

  // Prune old messages to prevent DOM overloading and performance degradation
  while (chat.children.length > maxMessages) {
    chat.removeChild(chat.firstChild);
  }

  if (fadeOutTime > 0) {
    // use a CSS animation for a gradual fade; set inline so each line uses the same timing
    chatLine.style.animation = `chat-fade-out ${FADE_DURATION}s ease ${fadeOutTime}s 1 forwards`;
    // remove the element after delay+duration to keep DOM clean
    setTimeout(() => {
      if (chatLine.parentNode === chat) chat.removeChild(chatLine);
    }, (fadeOutTime + FADE_DURATION) * 1000);
  }

  // Automatically scroll to the right as new chat messages come in
  window.requestAnimationFrame(() => {
    chat.scrollTo({
      left: chat.scrollWidth,
      behavior: 'smooth'
    });
  });
}

// reloads chat when /clear is used
function clearChat(channel) {
  setTimeout(function () {
    window.location.reload(true);
  }, 1000);
}

// deletes message by its unique id
function deleteMsg(channel, username, deletedMessage, userstate) {
  let msgID = userstate["target-msg-id"];

  const elementsToRemove = document.querySelectorAll(`[data-id="${msgID}"]`);

  elementsToRemove.forEach((element) => {
    element.remove();
  });
}

client.addListener("message", handleChat);
client.addListener("clearchat", clearChat);
client.addListener("messagedeleted", deleteMsg);
client.connect();