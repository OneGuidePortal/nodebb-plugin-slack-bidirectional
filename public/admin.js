'use strict';

define('admin/plugins/slack-bidirectional', ['settings', 'alerts', 'bootbox'], function (settings, alerts, bootbox) {
	var Admin = {};
	var mappingModal;

	Admin.init = function () {
		// Initialize Bootstrap modal
		mappingModal = new bootstrap.Modal(document.getElementById('mapping-modal'));

		// Save settings
		$('#slack-bidirectional-settings').on('submit', function (e) {
			e.preventDefault();

			var formData = {
				enabled: $('#enabled').is(':checked') ? 'true' : 'false',
				awsWebhookUrl: $('#awsWebhookUrl').val(),
				awsApiKey: $('#awsApiKey').val(),
			};

			$.ajax({
				url: config.relative_path + '/api/admin/plugins/slack-bidirectional/settings',
				method: 'POST',
				contentType: 'application/json',
				data: JSON.stringify(formData),
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
				},
				error: function (xhr) {
					alerts.error('Error testing connection: ' + (xhr.responseJSON?.error || 'Unknown error'));
				},
				complete: function () {
					$btn.prop('disabled', false).html('<i class="fa fa-plug"></i> Test AWS Connection');
				},
			});
		});

		// Load channel mappings on page load
		loadMappings();

		// Add mapping button
		$('#add-mapping').on('click', function () {
			$('#mapping-modal-title').text('Add Channel Mapping');
			$('#mapping-edit-id').val('');
			$('#mapping-channel-id').val('');
			$('#mapping-channel-name').val('');
			$('#mapping-category-id').val('');
			mappingModal.show();
		});

		// Save mapping
		$('#save-mapping').on('click', function () {
			var channelId = $('#mapping-channel-id').val().trim();
			var channelName = $('#mapping-channel-name').val().trim();
			var categoryId = $('#mapping-category-id').val();

			if (!channelId || !categoryId) {
				alerts.error('Please fill in all required fields');
				return;
			}

			var $btn = $(this);
			$btn.prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Saving...');

			$.ajax({
				url: config.relative_path + '/api/admin/plugins/slack-bidirectional/mappings',
				method: 'POST',
				contentType: 'application/json',
				data: JSON.stringify({
					channelId: channelId,
					channelName: channelName,
					categoryId: parseInt(categoryId, 10),
				}),
				headers: {
					'x-csrf-token': config.csrf_token,
				},
				success: function () {
					alerts.success('Mapping saved successfully');
					mappingModal.hide();
					loadMappings();
				},
				error: function (xhr) {
					alerts.error('Error saving mapping: ' + (xhr.responseJSON?.error || 'Unknown error'));
				},
				complete: function () {
					$btn.prop('disabled', false).html('<i class="fa fa-save"></i> Save Mapping');
				},
			});
		});

		// Delete mapping (event delegation)
		$('#mappings-tbody').on('click', '.delete-mapping', function () {
			var channelId = $(this).data('channel-id');
			var channelName = $(this).data('channel-name') || channelId;

			bootbox.confirm({
				title: 'Delete Mapping',
				message: 'Are you sure you want to delete the mapping for <strong>' + channelName + '</strong>?',
				buttons: {
					confirm: { label: 'Delete', className: 'btn-danger' },
					cancel: { label: 'Cancel', className: 'btn-secondary' },
				},
				callback: function (result) {
					if (result) {
						deleteMapping(channelId);
					}
				},
			});
		});
	};

	function loadMappings() {
		$('#mappings-loading').show();
		$('#mappings-table').hide();
		$('#no-mappings').hide();
		$('#mappings-error').hide();

		$.ajax({
			url: config.relative_path + '/api/admin/plugins/slack-bidirectional/mappings',
			method: 'GET',
			headers: {
				'x-csrf-token': config.csrf_token,
			},
			success: function (response) {
				$('#mappings-loading').hide();

				var mappings = response.mappings || [];

				if (mappings.length === 0) {
					$('#no-mappings').show();
					return;
				}

				var $tbody = $('#mappings-tbody');
				$tbody.empty();

				mappings.forEach(function (mapping) {
					var createdDate = mapping.createdAt ? new Date(mapping.createdAt).toLocaleDateString() : 'N/A';
					var channelDisplay = mapping.channelName
						? mapping.channelName + ' (' + mapping.slackChannel + ')'
						: mapping.slackChannel;
					var categoryDisplay = mapping.categoryName
						? mapping.categoryName + ' (ID: ' + mapping.nodebbCategoryId + ')'
						: 'Category ' + mapping.nodebbCategoryId;

					$tbody.append(
						'<tr>' +
							'<td><code>' + channelDisplay + '</code></td>' +
							'<td>' + categoryDisplay + '</td>' +
							'<td>' + createdDate + '</td>' +
							'<td>' +
								'<button class="btn btn-sm btn-danger delete-mapping" ' +
									'data-channel-id="' + mapping.slackChannel + '" ' +
									'data-channel-name="' + (mapping.channelName || mapping.slackChannel) + '">' +
									'<i class="fa fa-trash"></i>' +
								'</button>' +
							'</td>' +
						'</tr>'
					);
				});

				$('#mappings-table').show();
			},
			error: function (xhr) {
				$('#mappings-loading').hide();
				$('#mappings-error')
					.text('Error loading mappings: ' + (xhr.responseJSON?.error || 'Unknown error'))
					.show();
			},
		});
	}

	function deleteMapping(channelId) {
		$.ajax({
			url: config.relative_path + '/api/admin/plugins/slack-bidirectional/mappings/' + encodeURIComponent(channelId),
			method: 'DELETE',
			headers: {
				'x-csrf-token': config.csrf_token,
			},
			success: function () {
				alerts.success('Mapping deleted successfully');
				loadMappings();
			},
			error: function (xhr) {
				alerts.error('Error deleting mapping: ' + (xhr.responseJSON?.error || 'Unknown error'));
			},
		});
	}

	return Admin;
});
