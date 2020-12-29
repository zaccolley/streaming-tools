const events = require("events");
const fetch = require("node-fetch");
const { stringify: queryStringStringify } = require("qs");

const logger = require("./helpers/logger");

let LAST_CACHED_DATETIME = new Date();
// let LAST_CACHED_DATETIME = new Date("1970-01-01T00:00:00Z"); // test

const {
  TWITCH_CLIENT_ID,
  TWITCH_CLIENT_SECRET,
  TWITCH_BROADCASTER_ID,
} = process.env;

async function getOAuthToken() {
  const queryString = queryStringStringify({
    client_id: TWITCH_CLIENT_ID,
    client_secret: TWITCH_CLIENT_SECRET,
    grant_type: "client_credentials",
  });
  const url = ` https://id.twitch.tv/oauth2/token?${queryString}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/vnd.twitchtv.v5+json",
    },
  });

  const json = await response.json();
  if (!json.access_token) {
    throw new Error("No access token.");
  }

  return json.access_token;
}

function callTwitchAPIBuilder(oAuthToken) {
  return async function (endpoint, options) {
    const queryString = queryStringStringify(options);
    const url = `https://api.twitch.tv/helix/${endpoint}?${queryString}`;

    let response;
    try {
      response = await fetch(url, {
        headers: {
          Accept: "application/vnd.twitchtv.v5+json",
          Authorization: `Bearer ${oAuthToken}`,
          "Client-Id": TWITCH_CLIENT_ID,
        },
      });
    } catch (e) {
      logger.error("💩 Twitch API", e);
    }

    if (!response) {
      return;
    }

    const rateLimit = response.headers.get("ratelimit-limit");
    const rateLimitRemaining = response.headers.get(
      "ratelimit-remaining"
    );

    if (rateLimitRemaining / rateLimit < 0.33) {
      logger.error(
        "💩 Twitch API",
        `Twitch API Call Rate limit: ${rateLimitRemaining}/${rateLimit}`
      );
    }

    const json = await response.json();

    if (!json) {
      logger.error("💩 Twitch API", `No data for: ${url}`);
      return;
    }

    return json;
  };
}

async function getUser(callTwitchAPI, username) {
  const response = await callTwitchAPI("users", {
    login: username,
  });

  if (!response || !response.data || response.data.length === 0) {
    return null;
  }

  const [userData] = response.data;
  const { description, display_name, profile_image_url } = userData;

  return {
    username: display_name,
    description,
    image: profile_image_url,
  };
}

async function getFollowers(callTwitchAPI) {
  const response = await callTwitchAPI("users/follows", {
    to_id: TWITCH_BROADCASTER_ID,
  });

  const { data, total } = response;

  if (!data || data.length === 0) {
    return { total: null, followers: [] };
  }

  const followers = data.map(
    ({ from_id, from_name, followed_at }) => ({
      id: from_id,
      username: from_name,
      followed_at,
    })
  );

  return {
    total,
    followers,
  };
}

async function syncAndEmitNewFollowersEvent(
  callTwitchAPI,
  eventEmitter
) {
  const { total, followers } = await getFollowers(callTwitchAPI);

  let newFollowers = false;
  followers.forEach((follower) => {
    // if they've followed after the last time we checked
    if (LAST_CACHED_DATETIME < new Date(follower.followed_at)) {
      newFollowers = true;
      eventEmitter.emit("follow", follower);
      eventEmitter.emit("followTotal", total);
    }
  });

  if (newFollowers) {
    // update cached time
    LAST_CACHED_DATETIME = new Date();
  }
}

async function TwitchAPI() {
  const eventEmitter = new events.EventEmitter();
  const oAuthToken = await getOAuthToken();
  const callTwitchAPI = callTwitchAPIBuilder(oAuthToken);

  logger.info(
    "💩 Twitch API",
    "Syncing and emitting new followers..."
  );
  syncAndEmitNewFollowersEvent(callTwitchAPI, eventEmitter);
  setInterval(() => {
    syncAndEmitNewFollowersEvent(callTwitchAPI, eventEmitter);
  }, 1000); // every 0.5 seconds
  // rate limit is 800 per minute, per user
  // https://dev.twitch.tv/docs/api/guide#rate-limits

  eventEmitter.getUser = async (username) => {
    return getUser(callTwitchAPI, username);
  };

  eventEmitter.getFollowTotal = async () => {
    const { total } = await getFollowers(callTwitchAPI);
    return total;
  };

  return eventEmitter;
}

module.exports = TwitchAPI;
