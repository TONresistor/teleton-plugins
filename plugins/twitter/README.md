# twitter

Read-only access to X/Twitter API v2 — posts, users, search, timelines, and trends.

## Tools

| Tool | Description |
|------|-------------|
| `twitter_auth` | Configure Twitter API token (admin DM only) |
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

## Install

```bash
mkdir -p ~/.teleton/plugins
cp -r plugins/twitter ~/.teleton/plugins/
```

### API key setup

Get a Bearer Token from the [X Developer Portal](https://developer.x.com):

1. Create a developer account
2. Create a project and app
3. Go to "Keys and tokens" and copy the **Bearer Token**

Then configure it via DM with the bot:

> "Configure twitter with this token: AAAA..."

The agent will call `twitter_auth` which saves the token locally. Alternatively, add it to your teleton config:

```yaml
# ~/.teleton/config.yaml
twitter_bearer_token: "your-bearer-token"
```

Or set the `TWITTER_BEARER_TOKEN` env var.

## Usage

- "What's the latest tweet from @elonmusk?"
- "Search for tweets about TON blockchain in the last week"
- "How many tweets mentioned 'bitcoin' today?"
- "Show me the profile of @vaborsh"
- "Who are the top followers of user 12345?"
- "What's trending in France?"
- "Who liked this tweet: 1234567890?"

## Schemas

### twitter_auth

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `bearer_token` | string | Yes | Bearer Token from X Developer Portal |

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
| `granularity` | string | No | hour | Time bucket: minute, hour, or day |

### twitter_user_lookup

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `username` | string | Yes | Twitter username (without @) |

### twitter_user_lookup_id

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Twitter user ID |

### twitter_user_search

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `query` | string | Yes | — | Search keyword |
| `max_results` | integer | No | 10 | Results, 1-100 |

### twitter_user_posts

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | Yes | — | Twitter user ID |
| `max_results` | integer | No | 10 | Tweets to return, 5-100 |

### twitter_user_mentions

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | Yes | — | Twitter user ID |
| `max_results` | integer | No | 10 | Tweets to return, 5-100 |

### twitter_user_followers

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | Yes | — | Twitter user ID |
| `max_results` | integer | No | 100 | Followers to return, 1-1000 |

### twitter_user_following

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | Yes | — | Twitter user ID |
| `max_results` | integer | No | 100 | Results, 1-1000 |

### twitter_liking_users

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Tweet ID |

### twitter_retweeters

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
| `woeid` | integer | No | 1 | WOEID location (1=worldwide, 23424977=US, 615702=Paris) |

## API reference

This plugin wraps the [X API v2](https://docs.x.com) (pay-as-you-go). A Bearer Token is required — see [Install](#install).
