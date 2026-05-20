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

const useColor = params.get('useColor') === 'true'; // Use chatters' colors or to inherit
const showBadges = params.get('showBadges') === 'true'; // Show chatters' badges
const showBttvEmotes = params.get('showBttvEmotes') === 'true'; // Show BetterTTV emotes
const show7tvEmotes = params.get('show7tvEmotes') === 'true'; // Show 7TV emotes
const maxMessages = 50; // Maximum number of messages to keep in the DOM

let chat = document.getElementById("chat"),
  messageCount = 0,
  bttvEmotes = {},
  seventvEmotes = {},
  randomColorsChosen = {},
  clientOptions = {
    options: {
      debug: true,
      skipUpdatingEmotesets: true,
    },
    connection: { reconnect: true },
    channels: [channel],
  },
  client = new tmi.client(clientOptions);

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

// Fetch 7TV emotes (Global + Channel) via gateway on load
if (show7tvEmotes) {
  fetch(`https://twitchapi.teklynk.com/get7tvemotes.php?channel=${channel}`)
    .then(res => res.json())
    .then(data => {
      // 7TV returns channel emotes in emote_set.emotes and global emotes in emotes
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

  // Third-party Emote Logic (BTTV, 7TV): Scan for word-based matches
  if (showBttvEmotes || show7tvEmotes) {
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
        }
        word = "";
        start = -1;
      }
    }
  }

  return htmlEntities(splitText).join("");
}

function badges(chan, user) {
  function createBadge(name) {
    let badge = document.createElement("div");
    badge.className = "chat-badge-" + name;
    return badge;
  }

  let chatBadges = document.createElement("span");
  chatBadges.className = "chat-badges";

  if (user.username === chan) {
    chatBadges.appendChild(createBadge("broadcaster"));
  }
  if (user["user-type"]) {
    chatBadges.appendChild(createBadge(user["user-type"]));
  }
  if (user.turbo) {
    chatBadges.appendChild(createBadge("turbo"));
  }

  return chatBadges;
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
  chatLine.dataset.id = user["id"]

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

  chatMessage.className = "chat-message";

  chatMessage.innerHTML = formatEmotes(message, user.emotes);

  if (showBadges) chatLine.appendChild(badges(chan, user, self));
  if (client.opts.channels.length > 1) chatLine.appendChild(chatChannel);
  chatLine.appendChild(chatName);
  chatLine.appendChild(chatColon);
  chatLine.appendChild(chatMessage);
  chat.appendChild(chatLine);

  // Prune old messages to prevent DOM overloading and performance degradation
  while (chat.children.length > maxMessages) {
    chat.removeChild(chat.firstChild);
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
