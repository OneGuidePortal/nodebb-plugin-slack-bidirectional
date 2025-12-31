'use strict';

const db = require.main.require('./src/database');
const winston = require.main.require('winston');

const slackClient = module.exports;

/**
 * Get Slack bot token from settings
 */
async function getBotToken() {
	const settings = await db.getObject('plugin:slack-bidirectional:settings');
	return settings?.slackBotToken || '';
}

/**
 * Send message to Slack channel
 */
slackClient.sendMessage = async (channel, text, options = {}) => {
	const botToken = await getBotToken();

	if (!botToken) {
		throw new Error('Slack bot token not configured');
	}

	const fetch = (await import('node-fetch')).default;

	const payload = {
		channel,
		text,
		...options
	};

	const response = await fetch('https://slack.com/api/chat.postMessage', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${botToken}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(payload),
	});

	const result = await response.json();

	if (!result.ok) {
		throw new Error(`Slack API error: ${result.error}`);
	}

	return result;
};

/**
 * Get channel info
 */
slackClient.getChannelInfo = async (channelId) => {
	const botToken = await getBotToken();

	if (!botToken) {
		throw new Error('Slack bot token not configured');
	}

	const fetch = (await import('node-fetch')).default;

	const response = await fetch(`https://slack.com/api/conversations.info?channel=${channelId}`, {
		method: 'GET',
		headers: {
			'Authorization': `Bearer ${botToken}`,
		},
	});

	const result = await response.json();

	if (!result.ok) {
		throw new Error(`Slack API error: ${result.error}`);
	}

	return result.channel;
};

/**
 * Test Slack connection
 */
slackClient.testConnection = async () => {
	const botToken = await getBotToken();

	if (!botToken) {
		throw new Error('Slack bot token not configured');
	}

	const fetch = (await import('node-fetch')).default;

	const response = await fetch('https://slack.com/api/auth.test', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${botToken}`,
			'Content-Type': 'application/json',
		},
	});

	const result = await response.json();

	if (!result.ok) {
		throw new Error(`Slack API error: ${result.error}`);
	}

	return result;
};
