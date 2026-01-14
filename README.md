# NodeBB Slack Bidirectional Sync Plugin

[![npm version](https://badge.fury.io/js/nodebb-plugin-slack-bidirectional.svg)](https://www.npmjs.com/package/nodebb-plugin-slack-bidirectional)

Bidirectional synchronization between NodeBB and Slack via AWS Lambda with multi-tenant support.

## Features

- **Bidirectional Sync**: Topics and replies sync in both directions
- **Thread Preservation**: Slack threads map to NodeBB topic replies and vice versa
- **Author Attribution**: Messages show the original author's name and avatar
- **Loop Prevention**: Automatic detection prevents infinite ping-pong
- **Multi-Tenant Support**: Each NodeBB instance only sees its own channel mappings
- **Centralized Mapping**: DynamoDB stores all message mappings for consistency

## Architecture

```
NodeBB Topic/Reply
       ↓
  [This Plugin]
       ↓
  AWS API Gateway (/nodebb/events)
       ↓
  AWS EventBridge
       ↓
  Lambda Processor
       ↓
  Slack API (post message)
       ↓
  DynamoDB (store mapping)
```

```
Slack Message
       ↓
  AWS API Gateway (/slack/events)
       ↓
  AWS EventBridge
       ↓
  Lambda Processor
       ↓
  NodeBB API (create topic/reply)
       ↓
  DynamoDB (store mapping)
```

## Installation

### Via npm (Recommended)

```bash
cd /path/to/nodebb
npm install nodebb-plugin-slack-bidirectional
./nodebb build && ./nodebb restart
```

### Via Git

```bash
cd /path/to/nodebb/node_modules
git clone https://github.com/OneGuidePortal/nodebb-plugin-slack-bidirectional.git
cd ..
./nodebb build && ./nodebb restart
```

### Activate the Plugin

1. Go to NodeBB Admin → Extend → Plugins
2. Find "Slack Bidirectional Sync" and activate it
3. Restart NodeBB

## Configuration

1. Go to Admin → Plugins → Slack Bidirectional Sync

2. Configure:
   - **AWS Webhook URL**: Your API Gateway endpoint (e.g., `https://xxx.execute-api.region.amazonaws.com/dev/nodebb/events`)
   - **AWS API Key**: Optional API key if your endpoint requires it

3. Click "Test Connection" to verify AWS connectivity

4. Add channel mappings to link Slack channels to NodeBB categories

## Multi-Tenant Support

This plugin supports multiple NodeBB instances sharing the same AWS infrastructure. Each NodeBB instance:

- Automatically derives its site URL from the configured `url` setting
- Only sees channel mappings created for its specific site
- Stores new mappings with its site URL for proper isolation

The site URL is derived from NodeBB's configuration (e.g., `https://nodebb.example.com/sitename/api`).

## Loop Prevention

The plugin adds a hidden marker `[slack-sync]` to content created from Slack. When NodeBB fires a hook for this content, the plugin detects the marker and skips sending it back to Slack.

## Required Slack Scopes

The Slack app (configured in AWS) needs these scopes:
- `chat:write` - Post messages
- `channels:read` - Read channel info
- `channels:join` - Join channels
- `users:read` - Read user info
- `users:read.email` - Read user emails (for user matching)

## AWS Infrastructure

This plugin works with the OneGuide Notifications AWS stack which includes:
- API Gateway endpoints
- EventBridge for event routing
- Lambda functions for processing
- DynamoDB for mapping storage
- SQS Dead Letter Queue

See the `packages/notifications` directory in the main repo for infrastructure details.

## Updating

To update to the latest version:

```bash
cd /path/to/nodebb
npm update nodebb-plugin-slack-bidirectional
./nodebb build && ./nodebb restart
```

## Changelog

### v1.1.0
- Added multi-tenant support for channel mappings
- Each NodeBB instance now only sees its own mappings
- New mappings automatically include the site URL

### v1.0.0
- Initial release
- Bidirectional sync between Slack and NodeBB
- Thread preservation
- Author attribution

## License

MIT
