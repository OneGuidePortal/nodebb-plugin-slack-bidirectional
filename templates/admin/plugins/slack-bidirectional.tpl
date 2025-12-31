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

						<h5><i class="fa fa-slack"></i> Slack Configuration</h5>

						<div class="mb-3">
							<label class="form-label" for="slackBotToken">Slack Bot Token</label>
							<input type="password" class="form-control" id="slackBotToken" name="slackBotToken"
								value="{settings.slackBotToken}"
								placeholder="xoxb-...">
							<div class="form-text">Bot User OAuth Token from your Slack App</div>
						</div>

						<div class="mb-3">
							<label class="form-label" for="defaultChannel">Default Slack Channel</label>
							<input type="text" class="form-control" id="defaultChannel" name="defaultChannel"
								value="{settings.defaultChannel}"
								placeholder="#general">
							<div class="form-text">Default channel for posts without a category mapping</div>
						</div>

						<hr>

						<div class="d-flex gap-2">
							<button type="submit" class="btn btn-primary" id="save-settings">
								<i class="fa fa-save"></i> Save Settings
							</button>
							<button type="button" class="btn btn-outline-secondary" id="test-connection">
								<i class="fa fa-plug"></i> Test Connections
							</button>
						</div>
					</form>

					<div id="test-results" class="mt-4" style="display: none;">
						<h5>Connection Test Results</h5>
						<div id="aws-result" class="alert"></div>
						<div id="slack-result" class="alert"></div>
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
				</div>
			</div>

			<div class="card mt-3">
				<div class="card-header">
					<h5 class="card-title">Required Slack Scopes</h5>
				</div>
				<div class="card-body">
					<ul class="list-unstyled mb-0">
						<li><code>chat:write</code></li>
						<li><code>channels:read</code></li>
						<li><code>channels:join</code></li>
						<li><code>users:read</code></li>
					</ul>
				</div>
			</div>
		</div>
	</div>
</div>
