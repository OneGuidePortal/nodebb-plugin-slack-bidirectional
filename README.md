# NodeBB Slack Bidirectional Sync Plugin

Bidirectional synchronization between NodeBB and Slack via AWS EventBridge with DynamoDB mapping.

## Features

- **Bidirectional Sync**: Topics and replies sync in both directions
- **Thread Preservation**: Slack threads map to NodeBB topic replies and vice versa
- **Author Attribution**: Messages show the original author's name and avatar
- **Loop Prevention**: Automatic detection prevents infinite ping-pong
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

1. Clone or copy this plugin to your NodeBB `node_modules` folder:
   ```bash
   cd /path/to/nodebb/node_modules
   git clone https://github.com/OneGuidePortal/nodebb-plugin-slack-bidirectional.git
   ```

2. Rebuild NodeBB:
   ```bash
   ./nodebb build
   ```

3. Activate the plugin in NodeBB Admin → Extend → Plugins

4. Restart NodeBB:
   ```bash
   ./nodebb restart
   ```

## Configuration

1. Go to Admin → Plugins → Slack Bidirectional Sync

2. Configure:
   - **AWS Webhook URL**: Your API Gateway endpoint (e.g., `https://xxx.execute-api.region.amazonaws.com/dev/nodebb/events`)
   - **AWS API Key**: Optional API key if your endpoint requires it
   - **Slack Bot Token**: Your Slack Bot OAuth Token (xoxb-...)
   - **Default Channel**: Fallback Slack channel for unmapped categories

3. Click "Test Connections" to verify setup

## Loop Prevention

The plugin adds a hidden marker `[slack-sync]` to content created from Slack. When NodeBB fires a hook for this content, the plugin detects the marker and skips sending it back to Slack.

## Required Slack Scopes

- `chat:write` - Post messages
- `channels:read` - Read channel info
- `channels:join` - Join channels
- `users:read` - Read user info

## AWS Infrastructure

This plugin works with the OneGuide Notifications AWS stack which includes:
- API Gateway endpoints
- EventBridge for event routing
- Lambda functions for processing
- DynamoDB for mapping storage
- SQS Dead Letter Queue

See the `packages/notifications` directory in the main repo for infrastructure details.

## License

MIT
