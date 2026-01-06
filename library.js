'use strict';

const db = require.main.require('./src/database');
const meta = require.main.require('./src/meta');
const nconf = require.main.require('nconf');
const winston = require.main.require('winston');
const routeHelpers = require.main.require('./src/routes/helpers');
const posts = require.main.require('./src/posts');
const topics = require.main.require('./src/topics');
const user = require.main.require('./src/user');
const categories = require.main.require('./src/categories');

const controllers = require('./lib/controllers');
const awsWebhook = require('./lib/aws-webhook');

const plugin = {};

// Marker to identify content created from Slack (prevents loops)
// Check for various marker formats
const SLACK_ORIGIN_MARKER = '[slack-sync]';
const SLACK_ORIGIN_MARKER_HTML = '<!-- [slack-sync] -->';
const SLACK_ORIGIN_MARKER_ZWS = '\u200B[slack-sync]\u200B';
const SLACK_ORIGIN_MARKER_MD = '[//]: # (slack-sync)';

plugin.init = async (params) => {
	const { router, middleware } = params;

	// Setup the admin page route
	routeHelpers.setupAdminPageRoute(router, '/admin/plugins/slack-bidirectional', controllers.renderAdminPage);

	// API routes for admin - settings
	router.post('/api/admin/plugins/slack-bidirectional/settings', middleware.applyCSRF, controllers.saveSettings);
	router.post('/api/admin/plugins/slack-bidirectional/test', middleware.applyCSRF, controllers.testConnection);

	// API routes for admin - channel mappings
	router.get('/api/admin/plugins/slack-bidirectional/mappings', controllers.getMappings);
	router.post('/api/admin/plugins/slack-bidirectional/mappings', middleware.applyCSRF, controllers.saveMapping);
	router.delete('/api/admin/plugins/slack-bidirectional/mappings/:channelId', middleware.applyCSRF, controllers.deleteMapping);

	winston.info('[slack-bidirectional] Plugin initialized');
};

plugin.addAdminNavigation = (header) => {
	header.plugins.push({
		route: '/plugins/slack-bidirectional',
		icon: 'fa-slack',
		name: 'Slack Bidirectional Sync',
	});

	return header;
};

/**
 * Check if content originated from Slack (to prevent loops)
 */
function isFromSlack(content) {
	return content && (
		content.includes(SLACK_ORIGIN_MARKER) ||
		content.includes(SLACK_ORIGIN_MARKER_HTML) ||
		content.includes(SLACK_ORIGIN_MARKER_ZWS) ||
		content.includes(SLACK_ORIGIN_MARKER_MD)
	);
}

/**
 * Hook: New topic created
 * Send to AWS webhook which will post to Slack
 */
plugin.onTopicPost = async (data) => {
	try {
		const settings = await getSettings();

		if (!settings.enabled) {
			return data;
		}

		const { topic, post } = data;

		// Check if this topic was created from Slack (prevent loops)
		let postContent = post.content;
		if (!postContent && post.pid) {
			const fullPost = await posts.getPostData(post.pid);
			postContent = fullPost?.content || '';
		}

		if (isFromSlack(postContent)) {
			winston.verbose('[slack-bidirectional] Skipping topic created from Slack:', topic.tid);
			return data;
		}

		// Get user data
		const uid = post.uid || topic.uid;
		const userData = await user.getUserFields(uid, ['username', 'picture', 'fullname', 'email']);
		const displayName = userData.fullname || userData.username || 'Unknown User';

		// Get category info
		const categoryData = await categories.getCategoryData(topic.cid);

		// Construct avatar URL
		let userAvatar = constructAvatarUrl(userData.picture);

		// Send to AWS webhook
		await awsWebhook.sendEvent({
			eventType: 'topic.create',
			data: {
				topicId: topic.tid,
				postId: post.pid,
				categoryId: topic.cid,
				categoryName: categoryData?.name,
				categorySlug: categoryData?.slug,
				title: topic.title,
				content: postContent,
				author: {
					uid: uid,
					username: userData.username,
					displayName: displayName,
					avatar: userAvatar,
					email: userData.email
				},
				url: `${nconf.get('url')}/topic/${topic.slug}`,
				timestamp: Date.now()
			}
		});

		winston.info('[slack-bidirectional] Topic sent to AWS:', { tid: topic.tid, title: topic.title });

	} catch (err) {
		winston.error('[slack-bidirectional] Error in onTopicPost:', err);
	}

	return data;
};

/**
 * Hook: Post saved (reply to topic)
 * Send to AWS webhook which will post to Slack thread
 */
plugin.onPostSave = async (data) => {
	try {
		const settings = await getSettings();

		if (!settings.enabled) {
			return data;
		}

		const { post } = data;

		// Skip if this is the main post (handled by onTopicPost)
		if (post.isMain) {
			return data;
		}

		// Get full post content
		let postContent = post.content;
		if (!postContent && post.pid) {
			const fullPost = await posts.getPostData(post.pid);
			postContent = fullPost?.content || '';
		}

		// Check if this post was created from Slack (prevent loops)
		if (isFromSlack(postContent)) {
			winston.verbose('[slack-bidirectional] Skipping post created from Slack:', post.pid);
			return data;
		}

		// Get topic data
		const topicData = await topics.getTopicData(post.tid);
		if (!topicData) {
			winston.warn('[slack-bidirectional] Could not find topic for post:', post.pid);
			return data;
		}

		// Get user data
		const userData = await user.getUserFields(post.uid, ['username', 'picture', 'fullname', 'email']);
		const displayName = userData.fullname || userData.username || 'Unknown User';

		// Construct avatar URL
		let userAvatar = constructAvatarUrl(userData.picture);

		// Send to AWS webhook
		await awsWebhook.sendEvent({
			eventType: 'post.create',
			data: {
				postId: post.pid,
				topicId: post.tid,
				categoryId: topicData.cid,
				topicTitle: topicData.title,
				topicSlug: topicData.slug,
				content: postContent,
				author: {
					uid: post.uid,
					username: userData.username,
					displayName: displayName,
					avatar: userAvatar,
					email: userData.email
				},
				url: `${nconf.get('url')}/post/${post.pid}`,
				timestamp: Date.now()
			}
		});

		winston.info('[slack-bidirectional] Reply sent to AWS:', { pid: post.pid, tid: post.tid });

	} catch (err) {
		winston.error('[slack-bidirectional] Error in onPostSave:', err);
	}

	return data;
};

/**
 * Hook: Topic deleted
 */
plugin.onTopicDelete = async (data) => {
	try {
		const settings = await getSettings();

		if (!settings.enabled) {
			return data;
		}

		const { topic } = data;

		await awsWebhook.sendEvent({
			eventType: 'topic.delete',
			data: {
				topicId: topic.tid,
				timestamp: Date.now()
			}
		});

		winston.info('[slack-bidirectional] Topic delete sent to AWS:', { tid: topic.tid });

	} catch (err) {
		winston.error('[slack-bidirectional] Error in onTopicDelete:', err);
	}

	return data;
};

/**
 * Hook: Topic purged
 */
plugin.onTopicPurge = async (data) => {
	try {
		const settings = await getSettings();

		if (!settings.enabled) {
			return data;
		}

		const { topic } = data;

		await awsWebhook.sendEvent({
			eventType: 'topic.purge',
			data: {
				topicId: topic.tid,
				timestamp: Date.now()
			}
		});

		winston.info('[slack-bidirectional] Topic purge sent to AWS:', { tid: topic.tid });

	} catch (err) {
		winston.error('[slack-bidirectional] Error in onTopicPurge:', err);
	}

	return data;
};

/**
 * Construct full avatar URL from user picture
 */
function constructAvatarUrl(picture) {
	if (!picture) {
		const baseUrl = nconf.get('url').replace(/\/$/, '');
		return `${baseUrl}/assets/uploads/system/default-avatar.png`;
	}

	if (picture.startsWith('http://') || picture.startsWith('https://')) {
		return picture;
	}

	// Get base URL and extract the origin (without path like /oneguide)
	const baseUrl = nconf.get('url').replace(/\/$/, '');
	const urlObj = new URL(baseUrl);
	const origin = urlObj.origin; // e.g., https://nodebb.oneguideportal.com

	// If picture starts with the site path (e.g., /oneguide/assets/...), use origin + picture
	// Otherwise prepend the full baseUrl
	const picturePath = picture.startsWith('/') ? picture : `/${picture}`;

	// Check if picture path already includes the site path
	const sitePath = urlObj.pathname; // e.g., /oneguide
	if (sitePath && sitePath !== '/' && picturePath.startsWith(sitePath)) {
		return `${origin}${picturePath}`;
	}

	return `${baseUrl}${picturePath}`;
}

/**
 * Get plugin settings from database
 */
async function getSettings() {
	const settings = await db.getObject('plugin:slack-bidirectional:settings');

	return {
		enabled: settings?.enabled === 'true' || settings?.enabled === true || false,
		awsWebhookUrl: settings?.awsWebhookUrl || '',
		awsApiKey: settings?.awsApiKey || '',
	};
}

// Export for use in other modules
plugin.getSettings = getSettings;
plugin.SLACK_ORIGIN_MARKER = SLACK_ORIGIN_MARKER;

module.exports = plugin;
