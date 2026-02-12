/**
 * Twitter/X plugin — X API v2 read + write
 *
 * Read: Bearer token (post lookup, search, user info, timelines, trends)
 * Write: OAuth 2.0 PKCE (post, like, retweet, follow, bookmark)
 *
 * Auth configured via twitter_auth tool (admin DM only).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { createHash, randomBytes } from "node:crypto";

// ---------------------------------------------------------------------------
// Auth storage
// ---------------------------------------------------------------------------

const AUTH_DIR = join(homedir(), ".teleton", "plugins", "twitter");
const AUTH_PATH = join(AUTH_DIR, "auth.json");

function loadAuth() {
  try {
    return JSON.parse(readFileSync(AUTH_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function saveAuth(patch) {
  if (!existsSync(AUTH_DIR)) mkdirSync(AUTH_DIR, { recursive: true });
  const current = loadAuth();
  const merged = { ...current, ...patch, updated_at: new Date().toISOString() };
  writeFileSync(AUTH_PATH, JSON.stringify(merged, null, 2));
  return merged;
}

function loadBearerToken() {
  if (process.env.TWITTER_BEARER_TOKEN) return process.env.TWITTER_BEARER_TOKEN;
  const auth = loadAuth();
  if (auth.bearer_token) return auth.bearer_token;
  try {
    const raw = readFileSync(join(homedir(), ".teleton", "config.yaml"), "utf-8");
    const match = raw.match(/^twitter_bearer_token:\s*"?([^"\n]+)"?/m);
    if (match) return match[1].trim();
  } catch {}
  return null;
}

// ---------------------------------------------------------------------------
// OAuth 2.0 PKCE helpers
// ---------------------------------------------------------------------------

const OAUTH_SCOPES = "tweet.read tweet.write users.read like.read like.write follows.read follows.write bookmark.read bookmark.write offline.access";

function generatePKCE() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

function buildOAuthURL(clientId, redirectUri, state, codeChallenge) {
  const url = new URL("https://x.com/i/oauth2/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", OAUTH_SCOPES);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

async function exchangeCode(code, auth) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: auth.client_id,
    redirect_uri: auth.redirect_uri,
    code_verifier: auth.code_verifier,
  });
  const headers = { "Content-Type": "application/x-www-form-urlencoded" };
  if (auth.client_secret) {
    headers.Authorization = "Basic " + Buffer.from(`${auth.client_id}:${auth.client_secret}`).toString("base64");
  }
  const res = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST", headers, body: body.toString(),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OAuth token exchange failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function refreshAccessToken(auth) {
  if (!auth.oauth?.refresh_token) throw new Error("No refresh token available. Re-authenticate with twitter_auth.");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: auth.oauth.refresh_token,
    client_id: auth.client_id,
  });
  const headers = { "Content-Type": "application/x-www-form-urlencoded" };
  if (auth.client_secret) {
    headers.Authorization = "Basic " + Buffer.from(`${auth.client_id}:${auth.client_secret}`).toString("base64");
  }
  const res = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST", headers, body: body.toString(),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OAuth refresh failed (${res.status}): ${text.slice(0, 200)}. Re-authenticate with twitter_auth.`);
  }
  const tokens = await res.json();
  const oauth = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? auth.oauth.refresh_token,
    expires_at: Date.now() + (tokens.expires_in ?? 7200) * 1000,
    scope: tokens.scope ?? auth.oauth.scope,
  };
  saveAuth({ oauth });
  return oauth.access_token;
}

async function getOAuthToken() {
  const auth = loadAuth();
  if (!auth.oauth?.access_token) {
    throw new Error("OAuth not configured. Use twitter_auth to set up write access (admin DM only). You need a Client ID from https://developer.x.com — app settings > OAuth 2.0.");
  }
  if (auth.oauth.expires_at && Date.now() > auth.oauth.expires_at - 60000) {
    return refreshAccessToken(auth);
  }
  return auth.oauth.access_token;
}

function getAuthenticatedUserId() {
  const auth = loadAuth();
  if (!auth.user_id) throw new Error("OAuth not configured. Use twitter_auth first.");
  return auth.user_id;
}

// ---------------------------------------------------------------------------
// API fetch helpers
// ---------------------------------------------------------------------------

const API_BASE = "https://api.x.com";
const TWEET_FIELDS = "text,author_id,created_at,public_metrics,conversation_id,lang,source,entities";
const USER_FIELDS = "name,username,description,public_metrics,profile_image_url,verified,verified_type,created_at,location,url";

async function xFetch(path, params = {}) {
  const token = loadBearerToken();
  if (!token) {
    throw new Error("Twitter not configured. Use twitter_auth to set your Bearer Token (admin DM only).");
  }
  const url = new URL(path, API_BASE);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`X API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function xFetchOAuth(method, path, body = null) {
  const token = await getOAuthToken();
  const url = new URL(path, API_BASE);
  const opts = {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15000),
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (res.status === 204) return {};
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`X API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatTweet(t, includes) {
  const author = includes?.users?.find((u) => u.id === t.author_id) ?? null;
  return {
    id: t.id,
    text: t.text,
    author_id: t.author_id,
    author_name: author?.name ?? null,
    author_username: author?.username ?? null,
    created_at: t.created_at ?? null,
    lang: t.lang ?? null,
    source: t.source ?? null,
    conversation_id: t.conversation_id ?? null,
    metrics: t.public_metrics ?? null,
  };
}

function formatUser(u) {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    description: u.description ?? null,
    location: u.location ?? null,
    url: u.url ?? null,
    verified: u.verified ?? false,
    verified_type: u.verified_type ?? null,
    profile_image_url: u.profile_image_url ?? null,
    created_at: u.created_at ?? null,
    metrics: u.public_metrics ?? null,
  };
}

// ---------------------------------------------------------------------------
// Auth tool
// ---------------------------------------------------------------------------

const twitterAuth = {
  name: "twitter_auth",
  description:
    `Configure Twitter/X API authentication (admin only, DM only). Two levels:\n` +
    `\n` +
    `1) BEARER TOKEN (read-only tools): provide bearer_token. ` +
    `If the user hasn't provided it, ask them to go to https://developer.x.com, ` +
    `create a project/app, go to "Keys and tokens" and copy the Bearer Token (starts with "AAAA...").\n` +
    `\n` +
    `2) OAUTH (write tools — post, like, retweet, follow): provide client_id (and client_secret if confidential app). ` +
    `If the user hasn't provided these, ask them to go to https://developer.x.com, ` +
    `open their app settings, go to "User authentication settings", enable OAuth 2.0, ` +
    `set type to "Web App" (confidential) or "Native App" (public), ` +
    `set redirect URL to "https://example.com/callback", ` +
    `then copy Client ID (and Client Secret if Web App). ` +
    `The tool will generate an authorization link. After the user clicks it and authorizes, ` +
    `they'll be redirected to a page — they must copy the "code" value from the URL and provide it as oauth_code.\n` +
    `\n` +
    `Steps: 1) call with client_id → get auth link, 2) user clicks + copies code, 3) call with oauth_code → done.`,
  parameters: {
    type: "object",
    properties: {
      bearer_token: {
        type: "string",
        description: "Bearer Token for read-only access (starts with AAAA...)",
      },
      client_id: {
        type: "string",
        description: "OAuth 2.0 Client ID from X Developer Portal app settings",
      },
      client_secret: {
        type: "string",
        description: "OAuth 2.0 Client Secret (only for confidential/Web App type, omit for public/Native App)",
      },
      redirect_uri: {
        type: "string",
        description: "OAuth redirect URI (default: https://example.com/callback — must match app settings)",
      },
      oauth_code: {
        type: "string",
        description: "Authorization code from the redirect URL after user authorizes (the 'code' parameter)",
      },
    },
  },
  execute: async (params, context) => {
    try {
      const adminIds = context.config?.telegram?.admin_ids ?? [];
      if (!adminIds.includes(context.senderId)) {
        return { success: false, error: "Admin only. You are not authorized to configure Twitter." };
      }
      if (context.isGroup) {
        return { success: false, error: "DM only. Send this in a private message, not in a group." };
      }

      // --- Bearer token setup ---
      if (params.bearer_token) {
        const url = new URL("/2/tweets/search/recent", API_BASE);
        url.searchParams.set("query", "test");
        url.searchParams.set("max_results", "10");
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${params.bearer_token}`, Accept: "application/json" },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          return { success: false, error: `Invalid Bearer Token — X API returned ${res.status}: ${text.slice(0, 200)}` };
        }
        saveAuth({ bearer_token: params.bearer_token });
        return { success: true, data: { message: "Bearer Token configured. Read-only tools (search, lookup, trends) are now active." } };
      }

      // --- OAuth step 1: start flow ---
      if (params.client_id) {
        const redirectUri = params.redirect_uri ?? "https://example.com/callback";
        const { verifier, challenge } = generatePKCE();
        const state = randomBytes(16).toString("hex");
        const oauthUrl = buildOAuthURL(params.client_id, redirectUri, state, challenge);
        saveAuth({
          client_id: params.client_id,
          client_secret: params.client_secret ?? null,
          redirect_uri: redirectUri,
          code_verifier: verifier,
          oauth_state: state,
        });
        return {
          success: true,
          data: {
            message: "Click the link below to authorize Twitter access. After authorizing, you'll be redirected — copy the 'code' value from the URL bar and paste it here.",
            oauth_url: oauthUrl,
            redirect_uri: redirectUri,
            note: "The redirect page may show an error — that's normal. Just copy the 'code=XXXXX' value from the URL.",
          },
        };
      }

      // --- OAuth step 2: exchange code ---
      if (params.oauth_code) {
        const auth = loadAuth();
        if (!auth.client_id || !auth.code_verifier) {
          return { success: false, error: "No pending OAuth flow. Start by providing your client_id first." };
        }
        const tokens = await exchangeCode(params.oauth_code, auth);
        // Get authenticated user ID
        const meRes = await fetch("https://api.x.com/2/users/me", {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
          signal: AbortSignal.timeout(10000),
        });
        let userId = null;
        let username = null;
        if (meRes.ok) {
          const me = await meRes.json();
          userId = me.data?.id ?? null;
          username = me.data?.username ?? null;
        }
        saveAuth({
          oauth: {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token ?? null,
            expires_at: Date.now() + (tokens.expires_in ?? 7200) * 1000,
            scope: tokens.scope ?? null,
          },
          user_id: userId,
          username,
          code_verifier: null,
          oauth_state: null,
        });
        return {
          success: true,
          data: {
            message: `OAuth configured for @${username ?? "unknown"}. Write tools (post, like, retweet, follow, bookmark) are now active.`,
            user_id: userId,
            username,
          },
        };
      }

      // --- No params: return instructions ---
      return {
        success: true,
        data: {
          message: "Twitter auth requires setup. Ask the user for their credentials.",
          read_access: "Provide bearer_token for read-only tools (search, lookup, user info, trends).",
          write_access: "Provide client_id (+ client_secret for Web App type) for write tools (post, like, retweet, follow).",
          how_to_get: "Go to https://developer.x.com → create project/app → Keys and tokens → copy Bearer Token. For OAuth: app settings → User authentication → enable OAuth 2.0 → copy Client ID.",
        },
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

// ---------------------------------------------------------------------------
// Read tools — Posts
// ---------------------------------------------------------------------------

const twitterPostLookup = {
  name: "twitter_post_lookup",
  description:
    "Get a tweet/post by its ID from X/Twitter. Returns text, author, creation date, language, and engagement metrics (likes, retweets, replies, views).",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Tweet ID" },
    },
    required: ["id"],
  },
  execute: async (params) => {
    try {
      const data = await xFetch(`/2/tweets/${params.id}`, {
        "tweet.fields": TWEET_FIELDS,
        "user.fields": USER_FIELDS,
        expansions: "author_id",
      });
      if (!data.data) return { success: false, error: "Tweet not found" };
      return { success: true, data: formatTweet(data.data, data.includes) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

const twitterSearchRecent = {
  name: "twitter_search_recent",
  description:
    "Search tweets from the last 7 days on X/Twitter. Supports operators: from:user, has:images, has:videos, has:links, lang:en, -is:retweet, -is:reply, is:verified, url:, #hashtag, @mention. Example: '(AI OR crypto) lang:en -is:retweet has:links'",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query with optional operators (max 512 chars)" },
      max_results: { type: "integer", description: "Number of results, 10-100 (default 10)", minimum: 10, maximum: 100 },
    },
    required: ["query"],
  },
  execute: async (params) => {
    try {
      const data = await xFetch("/2/tweets/search/recent", {
        query: params.query,
        max_results: params.max_results ?? 10,
        "tweet.fields": TWEET_FIELDS,
        "user.fields": USER_FIELDS,
        expansions: "author_id",
      });
      const tweets = (data.data ?? []).map((t) => formatTweet(t, data.includes));
      return { success: true, data: { result_count: data.meta?.result_count ?? tweets.length, tweets } };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

const twitterSearchCount = {
  name: "twitter_search_count",
  description:
    "Get the volume of tweets matching a query over time (histogram). Returns counts per time bucket. Useful to gauge how much a topic is discussed.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
      granularity: { type: "string", description: "Time bucket: 'minute', 'hour', or 'day' (default: hour)", enum: ["minute", "hour", "day"] },
    },
    required: ["query"],
  },
  execute: async (params) => {
    try {
      const data = await xFetch("/2/tweets/counts/recent", {
        query: params.query,
        granularity: params.granularity ?? "hour",
      });
      return {
        success: true,
        data: {
          total_count: data.meta?.total_tweet_count ?? null,
          counts: (data.data ?? []).map((c) => ({ start: c.start, end: c.end, count: c.tweet_count })),
        },
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

// ---------------------------------------------------------------------------
// Read tools — Users
// ---------------------------------------------------------------------------

const twitterUserLookup = {
  name: "twitter_user_lookup",
  description:
    "Get X/Twitter user info by username. Returns name, bio, location, follower/following counts, tweet count, verified status, profile image, and account creation date.",
  parameters: {
    type: "object",
    properties: {
      username: { type: "string", description: "Twitter username (without @)" },
    },
    required: ["username"],
  },
  execute: async (params) => {
    try {
      const name = params.username.replace(/^@/, "");
      const data = await xFetch(`/2/users/by/username/${name}`, { "user.fields": USER_FIELDS });
      if (!data.data) return { success: false, error: `User @${name} not found` };
      return { success: true, data: formatUser(data.data) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

const twitterUserLookupId = {
  name: "twitter_user_lookup_id",
  description: "Get X/Twitter user info by numeric user ID. Returns name, bio, metrics, verified status, etc.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Twitter user ID" },
    },
    required: ["id"],
  },
  execute: async (params) => {
    try {
      const data = await xFetch(`/2/users/${params.id}`, { "user.fields": USER_FIELDS });
      if (!data.data) return { success: false, error: "User not found" };
      return { success: true, data: formatUser(data.data) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

const twitterUserSearch = {
  name: "twitter_user_search",
  description: "Search X/Twitter users by keyword. Returns matching users with their profile info and metrics.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search keyword" },
      max_results: { type: "integer", description: "Number of results, 1-100 (default 10)", minimum: 1, maximum: 100 },
    },
    required: ["query"],
  },
  execute: async (params) => {
    try {
      const data = await xFetch("/2/users/search", {
        query: params.query,
        max_results: params.max_results ?? 10,
        "user.fields": USER_FIELDS,
      });
      const users = (data.data ?? []).map(formatUser);
      return { success: true, data: { users } };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

// ---------------------------------------------------------------------------
// Read tools — Timelines
// ---------------------------------------------------------------------------

const twitterUserPosts = {
  name: "twitter_user_posts",
  description: "Get recent tweets posted by a user (by user ID). Returns up to 100 tweets with text, metrics, and dates.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Twitter user ID" },
      max_results: { type: "integer", description: "Number of tweets, 5-100 (default 10)", minimum: 5, maximum: 100 },
    },
    required: ["id"],
  },
  execute: async (params) => {
    try {
      const data = await xFetch(`/2/users/${params.id}/tweets`, {
        max_results: params.max_results ?? 10,
        "tweet.fields": TWEET_FIELDS,
        "user.fields": USER_FIELDS,
        expansions: "author_id",
      });
      const tweets = (data.data ?? []).map((t) => formatTweet(t, data.includes));
      return { success: true, data: { tweets } };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

const twitterUserMentions = {
  name: "twitter_user_mentions",
  description: "Get recent tweets mentioning a user (by user ID). Returns tweets where the user is @mentioned.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Twitter user ID" },
      max_results: { type: "integer", description: "Number of tweets, 5-100 (default 10)", minimum: 5, maximum: 100 },
    },
    required: ["id"],
  },
  execute: async (params) => {
    try {
      const data = await xFetch(`/2/users/${params.id}/mentions`, {
        max_results: params.max_results ?? 10,
        "tweet.fields": TWEET_FIELDS,
        "user.fields": USER_FIELDS,
        expansions: "author_id",
      });
      const tweets = (data.data ?? []).map((t) => formatTweet(t, data.includes));
      return { success: true, data: { tweets } };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

// ---------------------------------------------------------------------------
// Read tools — Social graph
// ---------------------------------------------------------------------------

const twitterUserFollowers = {
  name: "twitter_user_followers",
  description: "List followers of a user (by user ID). Returns follower profiles with bios and metrics.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Twitter user ID" },
      max_results: { type: "integer", description: "Number of followers, 1-1000 (default 100)", minimum: 1, maximum: 1000 },
    },
    required: ["id"],
  },
  execute: async (params) => {
    try {
      const data = await xFetch(`/2/users/${params.id}/followers`, {
        max_results: params.max_results ?? 100,
        "user.fields": USER_FIELDS,
      });
      const users = (data.data ?? []).map(formatUser);
      return { success: true, data: { result_count: data.meta?.result_count ?? users.length, users } };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

const twitterUserFollowing = {
  name: "twitter_user_following",
  description: "List accounts a user follows (by user ID). Returns followed user profiles with bios and metrics.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Twitter user ID" },
      max_results: { type: "integer", description: "Number of results, 1-1000 (default 100)", minimum: 1, maximum: 1000 },
    },
    required: ["id"],
  },
  execute: async (params) => {
    try {
      const data = await xFetch(`/2/users/${params.id}/following`, {
        max_results: params.max_results ?? 100,
        "user.fields": USER_FIELDS,
      });
      const users = (data.data ?? []).map(formatUser);
      return { success: true, data: { result_count: data.meta?.result_count ?? users.length, users } };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

// ---------------------------------------------------------------------------
// Read tools — Engagement
// ---------------------------------------------------------------------------

const twitterLikingUsers = {
  name: "twitter_liking_users",
  description: "Get users who liked a specific tweet (by tweet ID).",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Tweet ID" },
    },
    required: ["id"],
  },
  execute: async (params) => {
    try {
      const data = await xFetch(`/2/tweets/${params.id}/liking_users`, { "user.fields": USER_FIELDS });
      const users = (data.data ?? []).map(formatUser);
      return { success: true, data: { result_count: data.meta?.result_count ?? users.length, users } };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

const twitterRetweeters = {
  name: "twitter_retweeters",
  description: "Get users who retweeted a specific tweet (by tweet ID).",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Tweet ID" },
    },
    required: ["id"],
  },
  execute: async (params) => {
    try {
      const data = await xFetch(`/2/tweets/${params.id}/retweeted_by`, { "user.fields": USER_FIELDS });
      const users = (data.data ?? []).map(formatUser);
      return { success: true, data: { result_count: data.meta?.result_count ?? users.length, users } };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

const twitterQuotePosts = {
  name: "twitter_quote_posts",
  description: "Get tweets that quote a specific tweet (by tweet ID).",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Tweet ID" },
      max_results: { type: "integer", description: "Number of results, 10-100 (default 10)", minimum: 10, maximum: 100 },
    },
    required: ["id"],
  },
  execute: async (params) => {
    try {
      const data = await xFetch(`/2/tweets/${params.id}/quote_tweets`, {
        max_results: params.max_results ?? 10,
        "tweet.fields": TWEET_FIELDS,
        "user.fields": USER_FIELDS,
        expansions: "author_id",
      });
      const tweets = (data.data ?? []).map((t) => formatTweet(t, data.includes));
      return { success: true, data: { result_count: data.meta?.result_count ?? tweets.length, tweets } };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

// ---------------------------------------------------------------------------
// Read tools — Trends
// ---------------------------------------------------------------------------

const twitterTrends = {
  name: "twitter_trends",
  description:
    "Get trending topics on X/Twitter by location. Use WOEID: 1 = worldwide, 23424977 = US, 23424975 = UK, 23424856 = Japan, 615702 = Paris, 2459115 = New York. Returns trend names and tweet volumes.",
  parameters: {
    type: "object",
    properties: {
      woeid: { type: "integer", description: "WOEID location code (default 1 = worldwide)", minimum: 1 },
    },
  },
  execute: async (params) => {
    try {
      const id = params.woeid ?? 1;
      const data = await xFetch(`/2/trends/by/woeid/${id}`);
      const trends = (data.data ?? []).map((t) => ({
        name: t.trend_name ?? t.name ?? null,
        tweet_count: t.tweet_count ?? null,
      }));
      return { success: true, data: { woeid: id, trends } };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

// ---------------------------------------------------------------------------
// Write tools (OAuth required)
// ---------------------------------------------------------------------------

const twitterPostCreate = {
  name: "twitter_post_create",
  description: "Post a new tweet on X/Twitter. Requires OAuth (set up via twitter_auth). Can create replies and quote tweets.",
  parameters: {
    type: "object",
    properties: {
      text: { type: "string", description: "Tweet text (max 280 chars)" },
      reply_to: { type: "string", description: "Tweet ID to reply to (optional)" },
      quote_tweet_id: { type: "string", description: "Tweet ID to quote (optional)" },
    },
    required: ["text"],
  },
  execute: async (params) => {
    try {
      const body = { text: params.text };
      if (params.reply_to) body.reply = { in_reply_to_tweet_id: params.reply_to };
      if (params.quote_tweet_id) body.quote_tweet_id = params.quote_tweet_id;
      const data = await xFetchOAuth("POST", "/2/tweets", body);
      return { success: true, data: { id: data.data?.id, text: data.data?.text } };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

const twitterPostDelete = {
  name: "twitter_post_delete",
  description: "Delete a tweet you posted. Requires OAuth.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Tweet ID to delete" },
    },
    required: ["id"],
  },
  execute: async (params) => {
    try {
      const data = await xFetchOAuth("DELETE", `/2/tweets/${params.id}`);
      return { success: true, data: { deleted: data.data?.deleted ?? true } };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

const twitterLike = {
  name: "twitter_like",
  description: "Like a tweet. Requires OAuth.",
  parameters: {
    type: "object",
    properties: {
      tweet_id: { type: "string", description: "Tweet ID to like" },
    },
    required: ["tweet_id"],
  },
  execute: async (params) => {
    try {
      const userId = getAuthenticatedUserId();
      const data = await xFetchOAuth("POST", `/2/users/${userId}/likes`, { tweet_id: params.tweet_id });
      return { success: true, data: { liked: data.data?.liked ?? true } };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

const twitterUnlike = {
  name: "twitter_unlike",
  description: "Unlike a previously liked tweet. Requires OAuth.",
  parameters: {
    type: "object",
    properties: {
      tweet_id: { type: "string", description: "Tweet ID to unlike" },
    },
    required: ["tweet_id"],
  },
  execute: async (params) => {
    try {
      const userId = getAuthenticatedUserId();
      const data = await xFetchOAuth("DELETE", `/2/users/${userId}/likes/${params.tweet_id}`);
      return { success: true, data: { liked: data.data?.liked ?? false } };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

const twitterRetweet = {
  name: "twitter_retweet",
  description: "Retweet a tweet. Requires OAuth.",
  parameters: {
    type: "object",
    properties: {
      tweet_id: { type: "string", description: "Tweet ID to retweet" },
    },
    required: ["tweet_id"],
  },
  execute: async (params) => {
    try {
      const userId = getAuthenticatedUserId();
      const data = await xFetchOAuth("POST", `/2/users/${userId}/retweets`, { tweet_id: params.tweet_id });
      return { success: true, data: { retweeted: data.data?.retweeted ?? true } };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

const twitterFollow = {
  name: "twitter_follow",
  description: "Follow a user on X/Twitter. Requires OAuth.",
  parameters: {
    type: "object",
    properties: {
      target_user_id: { type: "string", description: "User ID to follow" },
    },
    required: ["target_user_id"],
  },
  execute: async (params) => {
    try {
      const userId = getAuthenticatedUserId();
      const data = await xFetchOAuth("POST", `/2/users/${userId}/following`, { target_user_id: params.target_user_id });
      return { success: true, data: { following: data.data?.following ?? true, pending: data.data?.pending_follow ?? false } };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

const twitterUnfollow = {
  name: "twitter_unfollow",
  description: "Unfollow a user on X/Twitter. Requires OAuth.",
  parameters: {
    type: "object",
    properties: {
      target_user_id: { type: "string", description: "User ID to unfollow" },
    },
    required: ["target_user_id"],
  },
  execute: async (params) => {
    try {
      const userId = getAuthenticatedUserId();
      const data = await xFetchOAuth("DELETE", `/2/users/${userId}/following/${params.target_user_id}`);
      return { success: true, data: { following: data.data?.following ?? false } };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

const twitterBookmark = {
  name: "twitter_bookmark",
  description: "Bookmark a tweet for later. Requires OAuth.",
  parameters: {
    type: "object",
    properties: {
      tweet_id: { type: "string", description: "Tweet ID to bookmark" },
    },
    required: ["tweet_id"],
  },
  execute: async (params) => {
    try {
      const userId = getAuthenticatedUserId();
      const data = await xFetchOAuth("POST", `/2/users/${userId}/bookmarks`, { tweet_id: params.tweet_id });
      return { success: true, data: { bookmarked: data.data?.bookmarked ?? true } };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const tools = [
  // Auth
  twitterAuth,
  // Read — Posts
  twitterPostLookup,
  twitterSearchRecent,
  twitterSearchCount,
  // Read — Users
  twitterUserLookup,
  twitterUserLookupId,
  twitterUserSearch,
  // Read — Timelines
  twitterUserPosts,
  twitterUserMentions,
  // Read — Social graph
  twitterUserFollowers,
  twitterUserFollowing,
  // Read — Engagement
  twitterLikingUsers,
  twitterRetweeters,
  twitterQuotePosts,
  // Read — Trends
  twitterTrends,
  // Write (OAuth)
  twitterPostCreate,
  twitterPostDelete,
  twitterLike,
  twitterUnlike,
  twitterRetweet,
  twitterFollow,
  twitterUnfollow,
  twitterBookmark,
];
