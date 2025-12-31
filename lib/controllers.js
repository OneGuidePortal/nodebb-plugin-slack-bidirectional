'use strict';

const db = require.main.require('./src/database');
const winston = require.main.require('winston');

const awsWebhook = require('./aws-webhook');
const slackClient = require('./slack-client');

const controllers = module.exports;

/**
 * Render admin page
 */
controllers.renderAdminPage = async (req, res) => {
	const settings = await db.getObject('plugin:slack-bidirectional:settings') || {};

	res.render('admin/plugins/slack-bidirectional', {
		settings: {
			enabled: settings.enabled === 'true' || settings.enabled === true,
			awsWebhookUrl: settings.awsWebhookUrl || '',
			awsApiKey: settings.awsApiKey || '',
			slackBotToken: settings.slackBotToken ? '••••••••' : '', // Mask token
			defaultChannel: settings.defaultChannel || '',
		},
		circuitState: awsWebhook.getCircuitState(),
	});
};

/**
 * Save settings
 */
controllers.saveSettings = async (req, res) => {
	try {
		const { enabled, awsWebhookUrl, awsApiKey, slackBotToken, defaultChannel } = req.body;

		// Get existing settings to preserve token if not changed
		const existingSettings = await db.getObject('plugin:slack-bidirectional:settings') || {};

		const newSettings = {
			enabled: enabled === 'true' || enabled === true ? 'true' : 'false',
			awsWebhookUrl: awsWebhookUrl || '',
			awsApiKey: awsApiKey || '',
			defaultChannel: defaultChannel || '',
		};

		// Only update token if a new one was provided (not masked)
		if (slackBotToken && !slackBotToken.includes('•')) {
			newSettings.slackBotToken = slackBotToken;
		} else {
			newSettings.slackBotToken = existingSettings.slackBotToken || '';
		}

		await db.setObject('plugin:slack-bidirectional:settings', newSettings);

		winston.info('[slack-bidirectional] Settings saved');

		res.json({ success: true });
	} catch (err) {
		winston.error('[slack-bidirectional] Error saving settings:', err);
		res.status(500).json({ error: err.message });
	}
};

/**
 * Test connections
 */
controllers.testConnection = async (req, res) => {
	const results = {
		aws: { success: false, message: '' },
		slack: { success: false, message: '' },
	};

	// Test AWS webhook
	try {
		await awsWebhook.testConnection();
		results.aws.success = true;
		results.aws.message = 'AWS webhook connection successful';
	} catch (err) {
		results.aws.message = `AWS webhook error: ${err.message}`;
	}

	// Test Slack
	try {
		const slackResult = await slackClient.testConnection();
		results.slack.success = true;
		results.slack.message = `Connected to Slack as ${slackResult.user} in workspace ${slackResult.team}`;
	} catch (err) {
		results.slack.message = `Slack error: ${err.message}`;
	}

	res.json(results);
};
