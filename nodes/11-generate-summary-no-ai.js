// Node: Code - Generate Summary (No AI)
// Type: Code | Mode: Run Once for All Items
// Purpose: Rule-based executive summary — replaces an LLM call entirely (zero AI/API cost).
// References "Code - Quality Analysis" by name; rename accordingly if you rename that node.

const inputJson = $('Code - Quality Analysis').first().json;
const data = inputJson.aiPromptData;
const before = data.before, after = data.after;

const improvementPoints = after.qualityScore - before.qualityScore;
const improvementPct = before.qualityScore > 0 ? Math.round((improvementPoints / before.qualityScore) * 100) : 0;

function getGrade(score) { if (score >= 90) return 'Excellent'; if (score >= 75) return 'Good'; if (score >= 60) return 'Fair'; return 'Needs Attention'; }

let summary = `This dataset (${before.rows} rows, ${before.columns} columns) started with a quality score of ${before.qualityScore}/100 (${getGrade(before.qualityScore)}). `;
summary += `Following automated cleaning, the score improved to ${after.qualityScore}/100 (${getGrade(after.qualityScore)}) — a gain of ${improvementPoints} points`;
summary += improvementPct > 0 ? ` (+${improvementPct}%). ` : '. ';

const issueParts = [];
if (data.topMissingColumns.length > 0) issueParts.push(`missing values were concentrated in ${data.topMissingColumns.slice(0, 3).map(c => c.column).join(', ')}`);
if (before.duplicateRows > 0) issueParts.push(`${before.duplicateRows} duplicate row${before.duplicateRows > 1 ? 's were' : ' was'} identified`);
if (data.typeIssueColumns.length > 0) issueParts.push(`inconsistent data types were found in ${data.typeIssueColumns.slice(0, 3).map(c => c.column).join(', ')}`);
if (issueParts.length > 0) summary += `Key issues identified: ${issueParts.join('; ')}. `;

const actions = data.cleaningActions || {};
const actionParts = [];
if (actions.standardizedMissingValues > 0) actionParts.push(`${actions.standardizedMissingValues} missing values standardized`);
if (actions.duplicatesRemovedAfterCleaning > 0) actionParts.push(`${actions.duplicatesRemovedAfterCleaning} duplicates removed`);
if (actions.convertedNumbers > 0) actionParts.push(`${actions.convertedNumbers} values converted to proper numeric format`);
if (actions.dateStandardized > 0) actionParts.push(`${actions.dateStandardized} dates standardized`);
if (actionParts.length > 0) summary += `Cleaning actions performed: ${actionParts.join(', ')}. `;

summary += data.recommendation;

return [{ json: { ...inputJson, text: summary } }];
