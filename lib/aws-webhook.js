'use strict';

const db = require.main.require('./src/database');
const winston = require.main.require('winston');

const awsWebhook = module.exports;

// Rate limiting
const messageQueue = [];
let isProcessingQueue = false;
const RATE_LIMIT_MS = 100; // 100ms between requests
const MAX_QUEUE_SIZE = 500;

// Circuit breaker
let circuitState = 'CLOSED';
let failureCount = 0;
let lastFailureTime = null;
const FAILURE_THRESHOLD = 5;
const CIRCUIT_RESET_TIMEOUT = 60000; // 1 minute

/**
 * Get plugin settings
 */
async function getSettings() {
	const settings = await db.getObject('plugin:slack-bidirectional:settings');
	return {
		enabled: settings?.enabled === 'true' || settings?.enabled === true || false,
		awsWebhookUrl: settings?.awsWebhookUrl || '',
		awsApiKey: settings?.awsApiKey || '',
	};
}

/**
 * Check circuit breaker state
 */
function checkCircuitBreaker() {
	if (circuitState === 'OPEN') {
		const timeSinceLastFailure = Date.now() - lastFailureTime;
		if (timeSinceLastFailure > CIRCUIT_RESET_TIMEOUT) {
			winston.info('[slack-bidirectional] Circuit breaker entering HALF_OPEN state');
			circuitState = 'HALF_OPEN';
			failureCount = 0;
		} else {
			throw new Error('Circuit breaker is OPEN - AWS webhook temporarily disabled');
		}
	}
}

function recordSuccess() {
	if (circuitState === 'HALF_OPEN') {
		winston.info('[slack-bidirectional] Circuit breaker CLOSED - webhook restored');
		circuitState = 'CLOSED';
	}
	failureCount = 0;
}

function recordFailure() {
	failureCount++;
	lastFailureTime = Date.now();

	if (failureCount >= FAILURE_THRESHOLD) {
		winston.error(`[slack-bidirectional] Circuit breaker OPEN - ${failureCount} consecutive failures`);
		circuitState = 'OPEN';
	}
}

/**
 * Send event to AWS webhook with retry logic
 */
async function sendWithRetry(url, payload, apiKey, retries = 0) {
	const MAX_RETRIES = 3;
	const RETRY_DELAY = 1000;

	try {
		const fetch = (await import('node-fetch')).default;

		const headers = {
			'Content-Type': 'application/json',
		};

		// Add API key if configured
		if (apiKey) {
			headers['x-api-key'] = apiKey;
		}

		const response = await fetch(url, {
			method: 'POST',
			headers,
			body: JSON.stringify(payload),
			timeout: 10000, // 10 second timeout
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`HTTP ${response.status}: ${errorText}`);
		}

		const result = await response.json();
		recordSuccess();

		winston.verbose('[slack-bidirectional] Event sent to AWS successfully');
		return result;

	} catch (err) {
		if (retries < MAX_RETRIES) {
			const delay = RETRY_DELAY * Math.pow(2, retries);
			winston.warn(`[slack-bidirectional] Retry ${retries + 1}/${MAX_RETRIES} after ${delay}ms:`, err.message);
			await new Promise(resolve => setTimeout(resolve, delay));
			return sendWithRetry(url, payload, apiKey, retries + 1);
		}

		recordFailure();
		winston.error('[slack-bidirectional] Failed after all retries:', err);
		throw err;
	}
}

/**
 * Process the message queue
 */
async function processQueue() {
	if (isProcessingQueue || messageQueue.length === 0) {
		return;
	}

	isProcessingQueue = true;

	while (messageQueue.length > 0) {
		const { payload, resolve, reject } = messageQueue.shift();

		try {
			const settings = await getSettings();

			if (!settings.enabled || !settings.awsWebhookUrl) {
				reject(new Error('AWS webhook not configured'));
				continue;
			}

			checkCircuitBreaker();

			const result = await sendWithRetry(settings.awsWebhookUrl, payload, settings.awsApiKey);
			resolve(result);

		} catch (err) {
			reject(err);
		}

		// Rate limit
		if (messageQueue.length > 0) {
			await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
		}
	}

	isProcessingQueue = false;
}

/**
 * Send event to AWS webhook (queued)
 */
awsWebhook.sendEvent = async (payload) => {
	const settings = await getSettings();

	if (!settings.enabled) {
		winston.verbose('[slack-bidirectional] Plugin disabled, skipping event');
		return null;
	}

	if (!settings.awsWebhookUrl) {
		winston.warn('[slack-bidirectional] AWS webhook URL not configured');
		return null;
	}

	// Check queue size
	if (messageQueue.length >= MAX_QUEUE_SIZE) {
		winston.error('[slack-bidirectional] Message queue full, dropping event');
		return null;
	}

	// Add to queue
	return new Promise((resolve, reject) => {
		messageQueue.push({ payload, resolve, reject });
		processQueue();
	});
};

/**
 * Test connection to AWS webhook
 */
awsWebhook.testConnection = async () => {
	const settings = await getSettings();

	if (!settings.awsWebhookUrl) {
		throw new Error('AWS webhook URL not configured');
	}

	const testPayload = {
		eventType: 'test',
		data: {
			message: 'Test connection from NodeBB plugin',
			timestamp: Date.now()
		}
	};

	return sendWithRetry(settings.awsWebhookUrl, testPayload, settings.awsApiKey);
};

awsWebhook.getCircuitState = () => circuitState;
