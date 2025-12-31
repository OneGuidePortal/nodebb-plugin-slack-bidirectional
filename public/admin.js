'use strict';

define('admin/plugins/slack-bidirectional', ['settings', 'alerts'], function (settings, alerts) {
	var Admin = {};

	Admin.init = function () {
		// Save settings
		$('#slack-bidirectional-settings').on('submit', function (e) {
			e.preventDefault();

			var formData = {
				enabled: $('#enabled').is(':checked'),
				awsWebhookUrl: $('#awsWebhookUrl').val(),
				awsApiKey: $('#awsApiKey').val(),
				slackBotToken: $('#slackBotToken').val(),
				defaultChannel: $('#defaultChannel').val(),
			};

			$.ajax({
				url: config.relative_path + '/api/admin/plugins/slack-bidirectional/settings',
				method: 'POST',
				data: formData,
				headers: {
					'x-csrf-token': config.csrf_token,
				},
				success: function () {
					alerts.success('Settings saved successfully');
				},
				error: function (xhr) {
					alerts.error('Error saving settings: ' + (xhr.responseJSON?.error || 'Unknown error'));
				},
			});
		});

		// Test connection
		$('#test-connection').on('click', function () {
			var $btn = $(this);
			$btn.prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Testing...');

			$.ajax({
				url: config.relative_path + '/api/admin/plugins/slack-bidirectional/test',
				method: 'POST',
				headers: {
					'x-csrf-token': config.csrf_token,
				},
				success: function (results) {
					$('#test-results').show();

					// AWS result
					var $awsResult = $('#aws-result');
					$awsResult
						.removeClass('alert-success alert-danger')
						.addClass(results.aws.success ? 'alert-success' : 'alert-danger')
						.html('<strong>AWS:</strong> ' + results.aws.message);

					// Slack result
					var $slackResult = $('#slack-result');
					$slackResult
						.removeClass('alert-success alert-danger')
						.addClass(results.slack.success ? 'alert-success' : 'alert-danger')
						.html('<strong>Slack:</strong> ' + results.slack.message);
				},
				error: function (xhr) {
					alerts.error('Error testing connection: ' + (xhr.responseJSON?.error || 'Unknown error'));
				},
				complete: function () {
					$btn.prop('disabled', false).html('<i class="fa fa-plug"></i> Test Connections');
				},
			});
		});
	};

	return Admin;
});
