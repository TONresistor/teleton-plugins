# twitter

X/Twitter API v2 — read (search, lookup, trends) + write (post, like, retweet, follow) with OAuth 2.0 PKCE.

## Tools

### Read (Bearer token)

| Tool | Description |
|------|-------------|
| `twitter_post_lookup` | Get a tweet by ID |
| `twitter_search_recent` | Search tweets from the last 7 days |
| `twitter_search_count` | Tweet volume histogram for a query |
| `twitter_user_lookup` | Get user info by username |
| `twitter_user_lookup_id` | Get user info by ID |
| `twitter_user_search` | Search users by keyword |
| `twitter_user_posts` | Get a user's recent tweets |
| `twitter_user_mentions` | Get tweets mentioning a user |
| `twitter_user_followers` | List followers of a user |
| `twitter_user_following` | List accounts a user follows |
| `twitter_liking_users` | Users who liked a tweet |
| `twitter_retweeters` | Users who retweeted a tweet |
| `twitter_quote_posts` | Tweets quoting a given tweet |
| `twitter_trends` | Trending topics by location |

### Write (OAuth 2.0)

| Tool | Description |
|------|-------------|
| `twitter_post_create` | Post a new tweet (text, reply, quote) |
| `twitter_post_delete` | Delete a tweet |
| `twitter_like` | Like a tweet |
| `twitter_unlike` | Unlike a tweet |
| `twitter_retweet` | Retweet a tweet |
| `twitter_follow` | Follow a user |
| `twitter_unfollow` | Unfollow a user |
| `twitter_bookmark` | Bookmark a tweet |

### Admin

| Tool | Description |
|------|-------------|
| `twitter_auth` | Configure API tokens (admin DM only) |

## Install

```bash
mkdir -p ~/.teleton/plugins
cp -r plugins/twitter ~/.teleton/plugins/
```

## Authentication

All auth is done via DM with the bot using `twitter_auth`. Admin only.

### Step 1 — Bearer Token (read-only)

Get a Bearer Token from the [X Developer Portal](https://developer.x.com):

1. Create a developer account
2. Create a project and app
3. Go to **Keys and tokens** → copy the **Bearer Token**

Then DM the bot:

> "Configure twitter with this bearer token: AAAA..."

### Step 2 — OAuth 2.0 (write access)

For write tools (post, like, retweet, follow), you need OAuth 2.0:

1. Go to your app on [developer.x.com](https://developer.x.com)
2. Open **User authentication settings**
3. Enable **OAuth 2.0**
4. Set app type to **Web App** (confidential) or **Native App** (public)
5. Set redirect URL to `https://example.com/callback`
6. Copy your **Client ID** (and **Client Secret** if Web App)

Then DM the bot:

> "Set up twitter OAuth with client ID: xxxx and client secret: yyyy"

The bot will send you an authorization link. Click it, authorize on Twitter, then copy the `code` parameter from the redirect URL and paste it:

> "Here's the code: abc123def456"

Done! Write tools are now active. Tokens auto-refresh when they expire.

## Usage

- "What's trending on Twitter?"
- "Search for tweets about TON blockchain"
- "Show me @elonmusk's latest tweets"
- "Who liked this tweet: 1234567890?"
- "Post a tweet saying: Hello from teleton!"
- "Like tweet 1234567890"
- "Follow @vitalikbuterin"

## Schemas

### twitter_auth

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `bearer_token` | string | No | Bearer Token for read-only access |
| `client_id` | string | No | OAuth 2.0 Client ID (starts OAuth flow) |
| `client_secret` | string | No | OAuth 2.0 Client Secret (Web App type only) |
| `redirect_uri` | string | No | OAuth redirect URI (default: https://example.com/callback) |
| `oauth_code` | string | No | Authorization code from redirect URL (completes OAuth flow) |

### twitter_post_lookup

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Tweet ID |

### twitter_search_recent

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `query` | string | Yes | — | Search query with operators (max 512 chars) |
| `max_results` | integer | No | 10 | Results to return, 10-100 |

### twitter_search_count

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `query` | string | Yes | — | Search query |
| `granularity` | string | No | hour | minute, hour, or day |

### twitter_user_lookup

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `username` | string | Yes | Twitter username (without @) |

### twitter_user_lookup_id / twitter_user_posts / twitter_user_mentions

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | Yes | — | Twitter user ID |
| `max_results` | integer | No | 10 | Results (5-100 for posts/mentions) |

### twitter_user_followers / twitter_user_following

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | Yes | — | Twitter user ID |
| `max_results` | integer | No | 100 | Results, 1-1000 |

### twitter_user_search

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `query` | string | Yes | — | Search keyword |
| `max_results` | integer | No | 10 | Results, 1-100 |

### twitter_liking_users / twitter_retweeters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Tweet ID |

### twitter_quote_posts

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | Yes | — | Tweet ID |
| `max_results` | integer | No | 10 | Results, 10-100 |

### twitter_trends

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `woeid` | integer | No | 1 | WOEID (1=worldwide, 23424977=US, 615702=Paris) |

### twitter_post_create

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | Yes | Tweet text (max 280 chars) |
| `reply_to` | string | No | Tweet ID to reply to |
| `quote_tweet_id` | string | No | Tweet ID to quote |

### twitter_post_delete

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Tweet ID to delete |

### twitter_like / twitter_unlike / twitter_retweet / twitter_bookmark

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `tweet_id` | string | Yes | Tweet ID |

### twitter_follow / twitter_unfollow

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `target_user_id` | string | Yes | User ID to follow/unfollow |

## API reference

This plugin wraps the [X API v2](https://docs.x.com) (pay-as-you-go). See [Authentication](#authentication) for setup.
