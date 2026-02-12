/**
 * Twitter/X plugin — read-only access to X API v2
 *
 * Post lookup, search, user info, timelines, trends.
 * Bearer token configured via twitter_auth tool (admin DM only)
 * or from ~/.teleton/config.yaml (twitter_bearer_token) or TWITTER_BEARER_TOKEN env.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

const AUTH_PATH = join(homedir(), ".teleton", "plugins", "twitter", "auth.json");

function loadBearerToken() {
  // 1. env var (highest priority)
  if (process.env.TWITTER_BEARER_TOKEN) return process.env.TWITTER_BEARER_TOKEN;
  // 2. auth.json (set via twitter_auth tool)
  try {
    const auth = JSON.parse(readFileSync(AUTH_PATH, "utf-8"));
    if (auth.bearer_token) return auth.bearer_token;
  } catch {}
  // 3. config.yaml fallback
  try {
    const raw = readFileSync(join(homedir(), ".teleton", "config.yaml"), "utf-8");
    const match = raw.match(/^twitter_bearer_token:\s*"?([^"\n]+)"?/m);
    if (match) return match[1].trim();
  } catch {}
  return null;
}

function saveBearerToken(token) {
  const dir = join(homedir(), ".teleton", "plugins", "twitter");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(AUTH_PATH, JSON.stringify({ bearer_token: token, configured_at: new Date().toISOString() }, null, 2));
}

// ---------------------------------------------------------------------------
// API fetch helper
// ---------------------------------------------------------------------------

const API_BASE = "https://api.x.com";

const TWEET_FIELDS = "text,author_id,created_at,public_metrics,conversation_id,lang,source,entities";
const USER_FIELDS = "name,username,description,public_metrics,profile_image_url,verified,verified_type,created_at,location,url";

async function xFetch(path, params = {}) {
  const token = loadBearerToken();
  if (!token) {
    throw new Error("Twitter not configured. Use the twitter_auth tool to set up your Bearer Token.");
  }
  const url = new URL(path, API_BASE);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
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
    `Configure Twitter/X API authentication (admin only, DM only). ` +
    `Requires a Bearer Token from the X Developer Portal. ` +
    `If the user has not provided their bearer_token, ask them to: ` +
    `1) Go to https://developer.x.com and create a developer account, ` +
    `2) Create a project and an app, ` +
    `3) Go to the app's "Keys and tokens" page and copy the Bearer Token, ` +
    `4) Paste it here in DM. ` +
    `The token looks like a long string starting with "AAAA...".`,
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
      // Admin check
      const adminIds = context.config?.telegram?.admin_ids ?? [];
      if (!adminIds.includes(context.senderId)) {
        return { success: false, error: "Admin only. You are not authorized to configure Twitter." };
      }
      // DM check
      if (context.isGroup) {
        return { success: false, error: "DM only. Send this command in a private message, not in a group." };
      }
      // Validate token by calling /2/users/me... but we don't have user-context auth.
      // Just test with a simple public call
      const url = new URL("/2/tweets/search/recent", API_BASE);
      url.searchParams.set("query", "test");
      url.searchParams.set("max_results", "10");
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${params.bearer_token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { success: false, error: `Invalid token — X API returned ${res.status}: ${text.slice(0, 200)}` };
      }
      saveBearerToken(params.bearer_token);
      return { success: true, data: { message: "Twitter API configured successfully. All twitter tools are now active." } };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

// ---------------------------------------------------------------------------
// Post tools
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
// User tools
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
// Timeline tools
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
// Social graph tools
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
// Engagement tools
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
// Trends
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
// Export
// ---------------------------------------------------------------------------

export const tools = [
  twitterAuth,
  twitterPostLookup,
  twitterSearchRecent,
  twitterSearchCount,
  twitterUserLookup,
  twitterUserLookupId,
  twitterUserSearch,
  twitterUserPosts,
  twitterUserMentions,
  twitterUserFollowers,
  twitterUserFollowing,
  twitterLikingUsers,
  twitterRetweeters,
  twitterQuotePosts,
  twitterTrends,
];
