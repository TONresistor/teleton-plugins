# twitter

X/Twitter API v2 — read (search, lookup, trends) + write (post, like, retweet, follow) with OAuth 1.0a.

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

### Write (OAuth 1.0a)

| Tool | Description |
|------|-------------|
| `twitter_post_create` | Post a new tweet (text, reply, quote) |
| `twitter_post_delete` | Delete a tweet |
| `twitter_like` | Like a tweet |
| `twitter_unlike` | Unlike a tweet |
| `twitter_retweet` | Retweet a tweet |
| `twitter_unretweet` | Undo a retweet |
| `twitter_follow` | Follow a user |
| `twitter_unfollow` | Unfollow a user |
| `twitter_bookmark` | Bookmark a tweet |
| `twitter_remove_bookmark` | Remove a bookmark |

## Install

```bash
mkdir -p ~/.teleton/plugins
cp -r plugins/twitter ~/.teleton/plugins/
```

## Configuration

Credentials are configured via environment variables, the webui secrets panel, or the teleton config file. The plugin reads them through `sdk.secrets` at runtime.

### Bearer Token (required — read tools)

Get a Bearer Token from the [X Developer Portal](https://developer.x.com):

1. Create a developer account
2. Create a project and app
3. Go to **Keys and tokens** and copy the **Bearer Token**

Set it as `TWITTER_BEARER_TOKEN` env var, or configure `bearer_token` in the webui.

### OAuth 1.0a (optional — write tools)

For write tools (post, like, retweet, follow, bookmark), you need four additional credentials:

1. Go to your app on [developer.x.com](https://developer.x.com)
2. Go to **Keys and tokens**
3. Under **Consumer Keys**, copy the **API Key** and **API Key Secret**
4. Under **Authentication Tokens**, generate (or regenerate) an **Access Token and Secret** with **Read and write** permissions

Set them as env vars or configure in the webui:

| Secret | Env var | Description |
|--------|---------|-------------|
| `consumer_key` | `TWITTER_CONSUMER_KEY` | Consumer Key (API Key) |
| `consumer_secret` | `TWITTER_CONSUMER_SECRET` | Consumer Secret (API Key Secret) |
| `access_token` | `TWITTER_ACCESS_TOKEN` | Access Token (Read and write) |
| `access_token_secret` | `TWITTER_ACCESS_TOKEN_SECRET` | Access Token Secret |

## Usage

- "What's trending on Twitter?"
- "Search for tweets about TON blockchain"
- "Show me @elonmusk's latest tweets"
- "Who liked this tweet: 1234567890?"
- "Post a tweet saying: Hello from teleton!"
- "Like tweet 1234567890"
- "Follow @vitalikbuterin"

## Schemas

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

### twitter_like / twitter_unlike / twitter_retweet / twitter_unretweet / twitter_bookmark / twitter_remove_bookmark

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `tweet_id` | string | Yes | Tweet ID |

### twitter_follow / twitter_unfollow

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `target_user_id` | string | Yes | User ID to follow/unfollow |

## API reference

This plugin wraps the [X API v2](https://docs.x.com) (pay-as-you-go). See [Configuration](#configuration) for setup.
