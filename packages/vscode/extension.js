'use strict';
// Thin vscode glue over src/core.js. The testable logic lives in core; this file only
// wires commands, an output channel, and a diagnostic collection to the editor.
const vscode = require('vscode');
const path = require('path');
const core = require('./src/core');

function activate(context) {
  const out = vscode.window.createOutputChannel('usagecontract');
  const diagCol = vscode.languages.createDiagnosticCollection('usagecontract');
  context.subscriptions.push(out, diagCol);

  const resolve = (p) => {
    if (!p) return p;
    if (path.isAbsolute(p)) return p;
    const ws = vscode.workspace.workspaceFolders;
    return ws && ws.length ? path.join(ws[0].uri.fsPath, p) : p;
  };
  const pickFile = async (title) => {
    const u = await vscode.window.showOpenDialog({ canSelectMany: false, title, filters: { 'OpenAPI JSON': ['json'] } });
    return u && u[0] && u[0].fsPath;
  };
  const pickFolder = async (title) => {
    const u = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, canSelectMany: false, title });
    return u && u[0] && u[0].fsPath;
  };

  context.subscriptions.push(vscode.commands.registerCommand('usagecontract.canIDeploy', async () => {
    try {
      const base = await pickFile('usagecontract: select the BASE OpenAPI spec');
      if (!base) return;
      const candidate = await pickFile('usagecontract: select the CANDIDATE OpenAPI spec');
      if (!candidate) return;
      const profilesDir = await pickFolder('usagecontract: select the profiles folder');
      if (!profilesDir) return;
      const res = core.gate(core.loadJson(base), core.loadJson(candidate), core.loadProfiles(profilesDir));
      out.clear(); out.show(true);
      out.appendLine(res.ok ? 'SAFE to deploy — no consumer is broken.' : 'BREAKING for: ' + res.breakingConsumers.join(', '));
      for (const r of res.results) {
        out.appendLine(`\n[${r.breaking ? 'BREAK' : 'ok'}] ${r.consumer}`);
        for (const v of r.violations) out.appendLine(`   - ${v.reason}: ${v.op}${v.field ? ' · ' + v.field : ''}`);
      }
      (res.ok ? vscode.window.showInformationMessage : vscode.window.showWarningMessage)(
        res.ok ? 'usagecontract: safe to deploy' : 'usagecontract: breaking for ' + res.breakingConsumers.join(', '));
    } catch (e) { vscode.window.showErrorMessage('usagecontract: ' + e.message); }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('usagecontract.coverage', async () => {
    try {
      const spec = await pickFile('usagecontract: select the OpenAPI spec');
      if (!spec) return;
      const profilesDir = await pickFolder('usagecontract: select the profiles folder');
      if (!profilesDir) return;
      const rep = core.coverageReport(core.loadJson(spec), core.loadProfiles(profilesDir));
      out.clear(); out.show(true); out.appendLine('Coverage report:');
      for (const c of rep) out.appendLine(`  ${c.consumer}: ${c.pct}%  (read ${c.read}/${c.reachable})`);
    } catch (e) { vscode.window.showErrorMessage('usagecontract: ' + e.message); }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('usagecontract.checkActiveSpec', async () => {
    const ed = vscode.window.activeTextEditor;
    if (!ed) { vscode.window.showWarningMessage('usagecontract: open an OpenAPI spec first'); return; }
    const cfg = vscode.workspace.getConfiguration('usagecontract');
    const baseFile = resolve(cfg.get('baselineSpec'));
    const profilesDir = resolve(cfg.get('profilesDir'));
    if (!baseFile || !profilesDir) {
      vscode.window.showWarningMessage('usagecontract: set usagecontract.baselineSpec and usagecontract.profilesDir in settings');
      return;
    }
    try {
      const text = ed.document.getText();
      const diags = core.diagnostics(core.loadJson(baseFile), JSON.parse(text), text, core.loadProfiles(profilesDir));
      diagCol.set(ed.document.uri, diags.map((d) => new vscode.Diagnostic(
        new vscode.Range(d.line, d.character, d.line, d.character + 1), d.message, vscode.DiagnosticSeverity.Error)));
      if (!diags.length) vscode.window.showInformationMessage('usagecontract: no breaking changes for any consumer');
      else out.appendLine(`usagecontract: ${diags.length} breaking issue(s) flagged in ${path.basename(ed.document.fileName)}`);
    } catch (e) { vscode.window.showErrorMessage('usagecontract: ' + e.message); }
  }));
}

function deactivate() {}
module.exports = { activate, deactivate };
