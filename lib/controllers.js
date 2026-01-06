'use strict';

const db = require.main.require('./src/database');
const winston = require.main.require('winston');
const categories = require.main.require('./src/categories');

const awsWebhook = require('./aws-webhook');

const controllers = module.exports;

/**
 * Render admin page
 */
controllers.renderAdminPage = async (req, res) => {
	const settings = await db.getObject('plugin:slack-bidirectional:settings') || {};

	// Get all categories for the dropdown
	const allCategories = await categories.getAllCategories(1); // uid 1 = admin
	const categoryList = allCategories.map(cat => ({
		cid: cat.cid,
		name: cat.name,
		slug: cat.slug,
	}));

	res.render('admin/plugins/slack-bidirectional', {
		settings: {
			enabled: settings.enabled === 'true' || settings.enabled === true,
			awsWebhookUrl: settings.awsWebhookUrl || '',
			awsApiKey: settings.awsApiKey || '',
		},
		categories: categoryList,
		circuitState: awsWebhook.getCircuitState(),
	});
};

/**
 * Save settings
 */
controllers.saveSettings = async (req, res) => {
	try {
		const { enabled, awsWebhookUrl, awsApiKey } = req.body;

		const newSettings = {
			enabled: enabled === 'true' || enabled === true ? 'true' : 'false',
			awsWebhookUrl: awsWebhookUrl || '',
			awsApiKey: awsApiKey || '',
		};

		await db.setObject('plugin:slack-bidirectional:settings', newSettings);

		winston.info('[slack-bidirectional] Settings saved');

		res.json({ success: true });
	} catch (err) {
		winston.error('[slack-bidirectional] Error saving settings:', err);
		res.status(500).json({ error: err.message });
	}
};

/**
 * Test AWS connection
 */
controllers.testConnection = async (req, res) => {
	const results = {
		aws: { success: false, message: '' },
	};

	// Test AWS webhook
	try {
		await awsWebhook.testConnection();
		results.aws.success = true;
		results.aws.message = 'AWS webhook connection successful';
	} catch (err) {
		results.aws.message = `AWS webhook error: ${err.message}`;
	}

	res.json(results);
};

/**
 * Get channel mappings from AWS
 */
controllers.getMappings = async (req, res) => {
	try {
		const mappings = await awsWebhook.getMappings();

		// Enrich with category names
		const enrichedMappings = await Promise.all(
			mappings.map(async (mapping) => {
				try {
					const categoryData = await categories.getCategoryData(mapping.nodebbCategoryId);
					return {
						...mapping,
						categoryName: categoryData?.name || null,
						categorySlug: categoryData?.slug || null,
					};
				} catch (err) {
					return mapping;
				}
			})
		);

		res.json({ mappings: enrichedMappings });
	} catch (err) {
		winston.error('[slack-bidirectional] Error getting mappings:', err);
		res.status(500).json({ error: err.message });
	}
};

/**
 * Create or update a channel mapping
 */
controllers.saveMapping = async (req, res) => {
	try {
		const { channelId, channelName, categoryId } = req.body;

		if (!channelId || !categoryId) {
			return res.status(400).json({ error: 'channelId and categoryId are required' });
		}

		// Get category info for the slug
		const categoryData = await categories.getCategoryData(categoryId);
		if (!categoryData) {
			return res.status(400).json({ error: 'Category not found' });
		}

		await awsWebhook.saveMapping({
			channelId,
			channelName: channelName || null,
			categoryId,
			categorySlug: categoryData.slug,
		});

		winston.info('[slack-bidirectional] Mapping saved:', { channelId, categoryId });

		res.json({ success: true });
	} catch (err) {
		winston.error('[slack-bidirectional] Error saving mapping:', err);
		res.status(500).json({ error: err.message });
	}
};

/**
 * Delete a channel mapping
 */
controllers.deleteMapping = async (req, res) => {
	try {
		const { channelId } = req.params;

		if (!channelId) {
			return res.status(400).json({ error: 'channelId is required' });
		}

		await awsWebhook.deleteMapping(channelId);

		winston.info('[slack-bidirectional] Mapping deleted:', { channelId });

		res.json({ success: true });
	} catch (err) {
		winston.error('[slack-bidirectional] Error deleting mapping:', err);
		res.status(500).json({ error: err.message });
	}
};
