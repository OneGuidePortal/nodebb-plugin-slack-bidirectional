<div class="acp-page-container">
	<div class="row">
		<div class="col-lg-9">
			<div class="card">
				<div class="card-header">
					<h4 class="card-title"><i class="fa fa-slack"></i> Slack Bidirectional Sync</h4>
				</div>
				<div class="card-body">
					<p class="lead">
						Bidirectional synchronization between NodeBB and Slack via AWS EventBridge.
					</p>

					<div class="alert alert-info">
						<i class="fa fa-info-circle"></i>
						<strong>How it works:</strong>
						<ul class="mb-0 mt-2">
							<li>Topics/replies created in NodeBB are sent to AWS, which posts them to Slack</li>
							<li>Messages in Slack are sent to AWS, which creates topics/replies in NodeBB</li>
							<li>DynamoDB maintains the mapping between Slack messages and NodeBB topics</li>
							<li>Loop detection prevents infinite ping-pong between platforms</li>
							<li><strong>Slack credentials are managed centrally via AWS</strong></li>
						</ul>
					</div>

					<form id="slack-bidirectional-settings">
						<div class="mb-3">
							<div class="form-check form-switch">
								<input class="form-check-input" type="checkbox" id="enabled" name="enabled" <!-- IF settings.enabled -->checked<!-- ENDIF settings.enabled -->>
								<label class="form-check-label" for="enabled">
									<strong>Enable Bidirectional Sync</strong>
								</label>
							</div>
						</div>

						<hr>

						<h5><i class="fa fa-cloud"></i> AWS Configuration</h5>

						<div class="mb-3">
							<label class="form-label" for="awsWebhookUrl">AWS Webhook URL</label>
							<input type="url" class="form-control" id="awsWebhookUrl" name="awsWebhookUrl"
								value="{settings.awsWebhookUrl}"
								placeholder="https://xxx.execute-api.region.amazonaws.com/dev/nodebb/events">
							<div class="form-text">The AWS API Gateway endpoint for receiving NodeBB events</div>
						</div>

						<div class="mb-3">
							<label class="form-label" for="awsApiKey">AWS API Key (optional)</label>
							<input type="password" class="form-control" id="awsApiKey" name="awsApiKey"
								value="{settings.awsApiKey}"
								placeholder="API key if required">
							<div class="form-text">API key for authenticating with AWS (if configured)</div>
						</div>

						<hr>

						<div class="d-flex gap-2">
							<button type="submit" class="btn btn-primary" id="save-settings">
								<i class="fa fa-save"></i> Save Settings
							</button>
							<button type="button" class="btn btn-outline-secondary" id="test-connection">
								<i class="fa fa-plug"></i> Test AWS Connection
							</button>
						</div>
					</form>

					<div id="test-results" class="mt-4" style="display: none;">
						<h5>Connection Test Results</h5>
						<div id="aws-result" class="alert"></div>
					</div>
				</div>
			</div>

			<!-- Channel Mappings Card -->
			<div class="card mt-4">
				<div class="card-header d-flex justify-content-between align-items-center">
					<h5 class="card-title mb-0"><i class="fa fa-link"></i> Channel-Category Mappings</h5>
					<button type="button" class="btn btn-sm btn-success" id="add-mapping">
						<i class="fa fa-plus"></i> Add Mapping
					</button>
				</div>
				<div class="card-body">
					<p class="text-muted">
						Map Slack channels to NodeBB categories. Messages in mapped channels will sync to the corresponding category.
					</p>

					<div id="mappings-loading" class="text-center py-4">
						<i class="fa fa-spinner fa-spin fa-2x"></i>
						<p class="mt-2 text-muted">Loading mappings...</p>
					</div>

					<div id="mappings-error" class="alert alert-danger" style="display: none;"></div>

					<table class="table table-hover" id="mappings-table" style="display: none;">
						<thead>
							<tr>
								<th>Slack Channel</th>
								<th>NodeBB Category</th>
								<th>Created</th>
								<th style="width: 100px;">Actions</th>
							</tr>
						</thead>
						<tbody id="mappings-tbody">
							<!-- Populated by JS -->
						</tbody>
					</table>

					<div id="no-mappings" class="text-center py-4 text-muted" style="display: none;">
						<i class="fa fa-info-circle fa-2x mb-2"></i>
						<p>No channel mappings configured yet.</p>
						<p>Click "Add Mapping" to create your first channel-category mapping.</p>
					</div>
				</div>
			</div>
		</div>

		<div class="col-lg-3">
			<div class="card">
				<div class="card-header">
					<h5 class="card-title">Status</h5>
				</div>
				<div class="card-body">
					<p>
						<strong>Circuit Breaker:</strong>
						<span class="badge <!-- IF circuitState -->bg-success<!-- ELSE -->bg-danger<!-- ENDIF circuitState -->">
							{circuitState}
						</span>
					</p>
					<p>
						<strong>Sync Status:</strong>
						<span class="badge <!-- IF settings.enabled -->bg-success<!-- ELSE -->bg-secondary<!-- ENDIF settings.enabled -->">
							<!-- IF settings.enabled -->Active<!-- ELSE -->Disabled<!-- ENDIF settings.enabled -->
						</span>
					</p>
				</div>
			</div>

			<div class="card mt-3">
				<div class="card-header">
					<h5 class="card-title">Architecture</h5>
				</div>
				<div class="card-body">
					<p class="small text-muted mb-0">
						Slack OAuth tokens are managed centrally via AWS Secrets Manager and DynamoDB.
						This plugin only needs the AWS webhook URL to send events -
						Slack credentials are handled by the Lambda functions.
					</p>
				</div>
			</div>

			<div class="card mt-3">
				<div class="card-header">
					<h5 class="card-title">Categories</h5>
				</div>
				<div class="card-body">
					<ul class="list-unstyled mb-0 small" id="categories-list">
						<!-- BEGIN categories -->
						<li><code>{categories.cid}</code> - {categories.name}</li>
						<!-- END categories -->
					</ul>
				</div>
			</div>
		</div>
	</div>
</div>

<!-- Add/Edit Mapping Modal -->
<div class="modal fade" id="mapping-modal" tabindex="-1">
	<div class="modal-dialog">
		<div class="modal-content">
			<div class="modal-header">
				<h5 class="modal-title" id="mapping-modal-title">Add Channel Mapping</h5>
				<button type="button" class="btn-close" data-bs-dismiss="modal"></button>
			</div>
			<div class="modal-body">
				<form id="mapping-form">
					<input type="hidden" id="mapping-edit-id">

					<div class="mb-3">
						<label class="form-label" for="mapping-channel-id">Slack Channel ID</label>
						<input type="text" class="form-control" id="mapping-channel-id"
							placeholder="C1234567890" required>
						<div class="form-text">The Slack channel ID (starts with C for public, G for private)</div>
					</div>

					<div class="mb-3">
						<label class="form-label" for="mapping-channel-name">Channel Name (optional)</label>
						<input type="text" class="form-control" id="mapping-channel-name"
							placeholder="#general">
						<div class="form-text">Human-readable channel name for reference</div>
					</div>

					<div class="mb-3">
						<label class="form-label" for="mapping-category-id">NodeBB Category</label>
						<select class="form-select" id="mapping-category-id" required>
							<option value="">Select a category...</option>
							<!-- BEGIN categories -->
							<option value="{categories.cid}">{categories.name} (ID: {categories.cid})</option>
							<!-- END categories -->
						</select>
					</div>
				</form>
			</div>
			<div class="modal-footer">
				<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
				<button type="button" class="btn btn-primary" id="save-mapping">
					<i class="fa fa-save"></i> Save Mapping
				</button>
			</div>
		</div>
	</div>
</div>
