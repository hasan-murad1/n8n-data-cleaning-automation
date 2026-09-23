// Node: Code - Format Error Message (separate Error Workflow, after Error Trigger)
// Type: Code | Mode: Run Once for All Items
// Purpose: Turn n8n's raw error payload into a readable email alert.

const e = $input.first().json || {};
const workflowName = e.workflow?.name || e.workflowName || 'Unknown workflow';
const executionId = e.execution?.id || e.executionId || 'Unknown execution';
const nodeName = e.execution?.lastNodeExecuted || e.node?.name || e.nodeName || 'Unknown node';
const message = e.execution?.error?.message || e.error?.message || e.message || 'Unknown error';
const stack = e.execution?.error?.stack || e.error?.stack || '';

return [{
  json: {
    subject: `[n8n Error] ${workflowName}`,
    htmlBody: `<h2>n8n workflow failed</h2>
<p><strong>Workflow:</strong> ${workflowName}</p>
<p><strong>Execution ID:</strong> ${executionId}</p>
<p><strong>Last node:</strong> ${nodeName}</p>
<p><strong>Error:</strong> ${message}</p>
<pre style="white-space:pre-wrap;background:#f5f5f5;padding:10px;">${stack}</pre>`
  }
}];
