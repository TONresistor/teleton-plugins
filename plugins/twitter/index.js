/**
 * Twitter/X plugin — X API v2 read + write
 *
 * Read: Bearer token (post lookup, search, user info, timelines, trends)
 * Write: OAuth 1.0a HMAC-SHA1 (post, like, retweet, follow, bookmark)
 *
 * Auth configured via twitter_auth / twitter_oauth tools (admin DM only).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { createHmac, randomBytes } from "node:crypto";

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
// OAuth 1.0a HMAC-SHA1 signing
// ---------------------------------------------------------------------------

function percentEncode(str) {
  return encodeURIComponent(String(str))
    .replace(/!/g, "%21")
    .replace(/\*/g, "%2A")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");
}

function buildOAuth1Header(method, url, queryParams, creds) {
  const oauthParams = {
    oauth_consumer_key: creds.consumer_key,
    oauth_token: creds.access_token,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_version: "1.0",
  };

  // Combine oauth params + query params for signature base (NOT JSON body)
  const allParams = { ...oauthParams };
  for (const [k, v] of Object.entries(queryParams)) {
    allParams[k] = v;
  }

  // Sort by key, then build parameter string
  const paramString = Object.keys(allParams)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(allParams[k])}`)
    .join("&");

  // Signature base string: METHOD&url&params
  const baseUrl = url.split("?")[0];
  const signatureBase = `${method.toUpperCase()}&${percentEncode(baseUrl)}&${percentEncode(paramString)}`;

  // Signing key: consumer_secret&token_secret
  const signingKey = `${percentEncode(creds.consumer_secret)}&${percentEncode(creds.access_token_secret)}`;

  // HMAC-SHA1
  const signature = createHmac("sha1", signingKey).update(signatureBase).digest("base64");
  oauthParams.oauth_signature = signature;

  // Build Authorization header
  const header = Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
    .join(", ");

  return `OAuth ${header}`;
}

function loadOAuth1Creds() {
  const auth = loadAuth();
  if (!auth.consumer_key || !auth.consumer_secret || !auth.access_token || !auth.access_token_secret) {
    throw new Error(
      "OAuth not configured. Use twitter_oauth (admin DM only) to provide your Consumer Key, Consumer Secret, Access Token, and Access Token Secret from https://developer.x.com."
    );
  }
  return {
    consumer_key: auth.consumer_key,
    consumer_secret: auth.consumer_secret,
    access_token: auth.access_token,
    access_token_secret: auth.access_token_secret,
  };
}

function getAuthenticatedUserId() {
  const auth = loadAuth();
  if (!auth.user_id) throw new Error("OAuth not configured or user ID unknown. Use twitter_oauth first.");
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
  const creds = loadOAuth1Creds();
  const fullUrl = new URL(path, API_BASE).toString();
  const authHeader = buildOAuth1Header(method, fullUrl, {}, creds);
  const opts = {
    method,
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15000),
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(fullUrl, opts);
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
// Auth tools
// ---------------------------------------------------------------------------

const twitterAuth = {
  name: "twitter_auth",
  description:
    `Configure Twitter/X API Bearer Token for read-only access (admin only, DM only). ` +
    `If the user has not provided their bearer_token, ask them to: ` +
    `1) Go to https://developer.x.com and open their app, ` +
    `2) Go to "Keys and tokens" and copy the Bearer Token (starts with "AAAA..."), ` +
    `3) Paste it here in DM. ` +
    `This only enables read tools. For write access (post, like, retweet, follow), use twitter_oauth instead.`,
  parameters: {
    type: "object",
    properties: {
      bearer_token: {
        type: "string",
        description: "Bearer Token from X Developer Portal (long string starting with AAAA...)",
      },
    },
    required: ["bearer_token"],
  },
  execute: async (params, context) => {
    try {
      const adminIds = context.config?.telegram?.admin_ids ?? [];
      if (!adminIds.includes(context.senderId)) {
        return { success: false, error: "Admin only." };
      }
      if (context.isGroup) {
        return { success: false, error: "DM only." };
      }
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
      return { success: true, data: { message: "Bearer Token saved. Read tools are active. For write access, use twitter_oauth." } };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

const twitterOAuth = {
  name: "twitter_oauth",
  description:
    `Set up OAuth 1.0a for Twitter/X write access — post, like, retweet, follow, bookmark (admin only, DM only). ` +
    `Requires 4 keys from https://developer.x.com → app → "Keys and tokens" → OAuth 1.0 section:\n` +
    `- consumer_key: the "Consumer Key" (aka API Key)\n` +
    `- consumer_secret: the "Consumer Secret" (aka API Key Secret) — click "Show" or "Regenerate" to reveal\n` +
    `- access_token: the "Access Token" (should say "Read and write")\n` +
    `- access_token_secret: the "Access Token Secret" — shown when generating/regenerating the Access Token\n` +
    `\n` +
    `If the user hasn't provided all 4 values, ask them to go to https://developer.x.com, ` +
    `open their app, go to "Keys and tokens", and copy all 4 values from the OAuth 1.0 section. ` +
    `The Consumer Secret and Access Token Secret may need to be regenerated to be visible again. ` +
    `No redirect flow needed — just paste the 4 keys and it's done.`,
  parameters: {
    type: "object",
    properties: {
      consumer_key: {
        type: "string",
        description: "Consumer Key (API Key) from OAuth 1.0 Keys section",
      },
      consumer_secret: {
        type: "string",
        description: "Consumer Secret (API Key Secret) — click Show or Regenerate to reveal",
      },
      access_token: {
        type: "string",
        description: "Access Token (should say 'Read and write')",
      },
      access_token_secret: {
        type: "string",
        description: "Access Token Secret — shown when generating the Access Token",
      },
    },
    required: ["consumer_key", "consumer_secret", "access_token", "access_token_secret"],
  },
  execute: async (params, context) => {
    try {
      const adminIds = context.config?.telegram?.admin_ids ?? [];
      if (!adminIds.includes(context.senderId)) {
        return { success: false, error: "Admin only." };
      }
      if (context.isGroup) {
        return { success: false, error: "DM only." };
      }

      // Validate by calling /2/users/me with OAuth 1.0a
      const creds = {
        consumer_key: params.consumer_key,
        consumer_secret: params.consumer_secret,
        access_token: params.access_token,
        access_token_secret: params.access_token_secret,
      };
      const meUrl = `${API_BASE}/2/users/me`;
      const authHeader = buildOAuth1Header("GET", meUrl, { "user.fields": USER_FIELDS }, creds);
      const res = await fetch(`${meUrl}?user.fields=${encodeURIComponent(USER_FIELDS)}`, {
        headers: { Authorization: authHeader, Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { success: false, error: `Invalid OAuth credentials — X API returned ${res.status}: ${text.slice(0, 300)}` };
      }
      const me = await res.json();
      const userId = me.data?.id ?? null;
      const username = me.data?.username ?? null;

      saveAuth({
        consumer_key: params.consumer_key,
        consumer_secret: params.consumer_secret,
        access_token: params.access_token,
        access_token_secret: params.access_token_secret,
        user_id: userId,
        username,
      });

      return {
        success: true,
        data: {
          message: `OAuth configured for @${username ?? "unknown"}. All write tools (post, like, retweet, follow, bookmark) are now active.`,
          user_id: userId,
          username,
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
// Write tools (OAuth 1.0a required)
// ---------------------------------------------------------------------------

const twitterPostCreate = {
  name: "twitter_post_create",
  description: "Post a new tweet on X/Twitter. Requires OAuth (set up via twitter_oauth). Can create replies and quote tweets.",
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
  twitterOAuth,
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
  // Write (OAuth 1.0a)
  twitterPostCreate,
  twitterPostDelete,
  twitterLike,
  twitterUnlike,
  twitterRetweet,
  twitterFollow,
  twitterUnfollow,
  twitterBookmark,
];
