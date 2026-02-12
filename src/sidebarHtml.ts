export function getSidebarHtml(nonce: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: 13px;
      line-height: 1.5;
      padding: 0;
      margin: 0;
      color: var(--vscode-foreground);
    }
    .empty {
      padding: 20px;
      text-align: center;
      color: var(--vscode-descriptionForeground);
    }
    .header {
      padding: 10px 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      background: var(--vscode-sideBar-background);
    }
    .explanation-link {
      padding: 10px 12px;
      font-size: 12px;
      color: var(--vscode-textLink-foreground);
      border-bottom: 1px solid var(--vscode-panel-border);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .explanation-link:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .explanation-spacer {
      flex: 1;
    }
    .explanation-date {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      white-space: nowrap;
    }
    .group {
      border-bottom: 1px solid var(--vscode-panel-border);
      border-left: 3px solid transparent;
    }
    .group-header {
      padding: 12px;
      cursor: pointer;
      line-height: 1.4;
    }
    .group-header:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .group-title {
      font-weight: 500;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .group-title-text {
      flex: 1;
      min-width: 0;
    }
    .group-summary {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.5;
    }
    .group-meta {
      padding: 8px 12px;
      color: var(--vscode-descriptionForeground);
      border-top: 1px solid var(--vscode-panel-border);
    }
    .group-meta:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .section-header {
      padding: 10px 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-sideBar-background);
      border-bottom: 1px solid var(--vscode-panel-border);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      user-select: none;
    }
    .section-header:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .flags {
      padding: 0;
    }
    .flag {
      padding: 10px 12px;
      font-size: 12px;
      display: flex;
      align-items: flex-start;
      gap: 8px;
      cursor: pointer;
      border-bottom: 1px solid var(--vscode-panel-border);
      border-left: 3px solid transparent;
      position: relative;
    }
    .flag:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .flag.selected {
      border-left-color: var(--vscode-focusBorder);
    }
    .flag-copy {
      position: absolute;
      top: 8px;
      right: 8px;
      font-size: 13px;
      color: var(--vscode-descriptionForeground);
      opacity: 0;
      pointer-events: none;
    }
    .flag:hover .flag-copy {
      opacity: 0.7;
    }
    .flag-icon {
      flex-shrink: 0;
    }
    .flag-info .flag-icon { color: var(--vscode-editorInfo-foreground); }
    .flag-warning .flag-icon { color: var(--vscode-editorWarning-foreground); }
    .flag-error .flag-icon { color: var(--vscode-editorError-foreground); }
    .flag-content {
      flex: 1;
      min-width: 0;
    }
    .flag-title {
      font-weight: 500;
      line-height: 1.4;
    }
    .flag-summary {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-top: 6px;
      line-height: 1.5;
    }
    .group-summary code, .flag-summary code {
      font-family: var(--vscode-editor-font-family);
      font-size: 0.9em;
      background: var(--vscode-textCodeBlock-background);
      padding: 1px 4px;
      border-radius: 3px;
    }
    .flag-location {
      font-size: 11px;
      color: var(--vscode-textLink-foreground);
      margin-top: 6px;
    }
.select-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      cursor: pointer;
      border-radius: 2px;
      font-size: 13px;
      margin-top: 12px;
    }
    .select-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .fc-green { color: var(--vscode-testing-iconPassed); }
    .fc-yellow { color: var(--vscode-editorWarning-foreground); }
    .fc-red { color: var(--vscode-editorError-foreground); }
    .group.selected {
      border-left: 3px solid var(--vscode-focusBorder);
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .unload-btn {
      background: none;
      border: none;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      font-size: 14px;
      padding: 4px 6px;
      border-radius: 3px;
      line-height: 1;
    }
    .unload-btn:hover {
      background: var(--vscode-toolbar-hoverBackground);
      color: var(--vscode-foreground);
    }
    .group-file-tree {
      padding: 4px 0 8px 0;
      border-top: 1px solid var(--vscode-panel-border);
    }
    .tree-prefix-line {
      padding: 3px 8px 3px 24px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
    .file-count-toggle {
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
    }
    .tree-dir {
      padding: 3px 8px;
      cursor: pointer;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 4px;
      user-select: none;
    }
    .tree-dir:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .tree-chevron {
      font-size: 10px;
      width: 12px;
      text-align: center;
      flex-shrink: 0;
    }
    .tree-file {
      padding: 3px 8px;
      cursor: pointer;
      font-size: 12px;
      user-select: none;
      color: var(--vscode-textLink-foreground);
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .tree-file:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .tree-file-icon {
      font-size: 10px;
      flex-shrink: 0;
    }
    .tree-group-badge {
      font-size: 11px;
      min-width: 16px;
      height: 16px;
      line-height: 16px;
      text-align: center;
      border-radius: 3px;
      color: var(--vscode-descriptionForeground);
      font-weight: 500;
    }
    .validation-banner {
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .validation-header {
      padding: 10px 12px;
      font-size: 12px;
      color: var(--vscode-editorError-foreground);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      user-select: none;
    }
    .validation-header:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .validation-content {
      padding: 0 12px 8px 12px;
      font-size: 12px;
    }
    .validation-subtitle {
      font-size: 11px;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
      margin: 8px 0 4px 0;
    }
    .phantom-file {
      color: var(--vscode-descriptionForeground);
      cursor: default;
    }
    .phantom-file:hover {
      background: none !important;
    }
  </style>
</head>
<body>
  <div id="root">
    <div class="empty">
      <p>No review loaded</p>
      <p style="font-size: 12px;">Select a review JSON file to get started.</p>
      <button class="select-btn" data-action="select-file">Select Review File</button>
    </div>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let _phantomSet = new Set();

    window.addEventListener('message', e => {
      if (e.data.type === 'update') {
        render(e.data.review, e.data.mtime, e.data.validation);
        vscode.setState({ review: e.data.review, mtime: e.data.mtime, validation: e.data.validation, selectedGroup: -1, collapsedDirs: [], expandedGroups: [] });
      } else if (e.data.type === 'selectGroup') {
        highlightGroup(e.data.index);
        const state = vscode.getState() || {};
        vscode.setState({ ...state, selectedGroup: e.data.index, selectedFlag: -1 });
      } else if (e.data.type === 'reset') {
        showEmpty();
        vscode.setState({});
      }
    });

    // Restore state when webview is re-created (e.g. after switching views)
    const savedState = vscode.getState();
    if (savedState?.review) {
      render(savedState.review, savedState.mtime, savedState.validation);
      if (savedState.selectedFlag >= 0) {
        highlightFlag(savedState.selectedFlag);
      } else if (savedState.selectedGroup >= 0) {
        highlightGroup(savedState.selectedGroup);
      }
    }

    // Tell the extension we're ready to receive data
    vscode.postMessage({ type: 'ready' });

    function inlineCode(text) {
      return esc(text).replace(/\`([^\`]+)\`/g, '<code>$1</code>');
    }

    function formatDate(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function render(review, mtime, validation) {
      const root = document.getElementById('root');
      const state = vscode.getState() || {};
      const expandedGroups = state.expandedGroups || [];
      const groupsCollapsed = state.groupsCollapsed || false;
      const flagsCollapsed = state.flagsCollapsed || false;
      const validationCollapsed = state.validationCollapsed || false;
      _phantomSet = new Set(validation?.phantomFiles || []);
      const hasWarnings = validation && (validation.missingFiles.length > 0 || validation.phantomFiles.length > 0);

      root.innerHTML = \`
        \${review.explanation ? \`<div class="explanation-link" data-action="open-explanation">
          <span>Changes Explanation</span>
          <span class="explanation-spacer"></span>
          \${mtime ? \`<span class="explanation-date">\${formatDate(mtime)}</span>\` : ''}
          <button class="unload-btn" data-action="unload-review" title="Close review">\u2715</button>
        </div>\` : \`<div class="header">
          <div class="header-row">
            <span></span>
            <button class="unload-btn" data-action="unload-review" title="Close review">\u2715</button>
          </div>
        </div>\`}

        \${hasWarnings ? \`<div class="validation-banner">
          <div class="validation-header" data-action="toggle-section" data-section="validation">
            <span>\u2716</span>
            <span>Error: \${validation.missingFiles.length ? validation.missingFiles.length + ' missing' : ''}\${validation.missingFiles.length && validation.phantomFiles.length ? ', ' : ''}\${validation.phantomFiles.length ? validation.phantomFiles.length + ' phantom' : ''}</span>
            <span class="tree-chevron">\${validationCollapsed ? '\u25B8' : '\u25BE'}</span>
          </div>
          \${!validationCollapsed ? \`<div class="validation-content">
            \${validation.phantomFiles.length ? \`<div class="validation-subtitle">Phantom files (not in diff)</div>\${validation.phantomFiles.map(f => '<div style="padding: 2px 0; color: var(--vscode-descriptionForeground);"><span style="color: var(--vscode-editorError-foreground)">\u2716</span> <span style="text-decoration: line-through">' + esc(f) + '</span></div>').join('')}\` : ''}
            \${validation.missingFiles.length ? \`<div class="validation-subtitle">Missing from review</div>\${buildGroupTree(validation.missingFiles, 'missing')}\` : ''}
          </div>\` : ''}
        </div>\` : ''}

        <div class="section-header" data-action="toggle-section" data-section="groups"><span class="tree-chevron">\${groupsCollapsed ? '\u25B8' : '\u25BE'}</span>\${review.groups.length} Review Group\${review.groups.length !== 1 ? 's' : ''}</div>

        \${!groupsCollapsed ? review.groups.map((g, i) => \`
          <div class="group" id="group-\${i}">
            <div class="group-header" data-action="open-group" data-group-index="\${i}">
              <div class="group-title"><span class="tree-group-badge">\${i + 1}</span><span class="group-title-text">\${esc(g.title)}</span></div>
              \${g.summary ? \`<div class="group-summary">\${inlineCode(g.summary)}</div>\` : ''}
            </div>
            <div class="group-meta" data-action="toggle-group-files" data-group-index="\${i}"><span class="file-count-toggle \${g.files.length < 5 ? 'fc-green' : g.files.length < 10 ? 'fc-yellow' : 'fc-red'}"><span class="tree-chevron">\${expandedGroups.includes(i) ? '\u25BE' : '\u25B8'}</span>\${g.files.length} file\${g.files.length !== 1 ? 's' : ''}</span></div>
            \${expandedGroups.includes(i) ? buildGroupTree(g.files, i) : ''}
          </div>
        \`).join('') : ''}

        \${review.flags?.length ? \`
          <div class="section-header" data-action="toggle-section" data-section="flags"><span class="tree-chevron">\${flagsCollapsed ? '\u25B8' : '\u25BE'}</span>Flags</div>
          \${!flagsCollapsed ? \`<div class="flags">
            \${review.flags.map((f, i) => \`
              <div class="flag flag-\${esc(f.severity)}" id="flag-\${i}" data-action="open-flag" data-file="\${esc(f.file)}" data-line="\${f.line}" data-index="\${i}" data-clip="\${esc(f.summary ? f.title + ' | ' + f.summary : f.title)}">
                <span class="flag-icon">\${f.severity === 'error' ? '\u2716' : f.severity === 'warning' ? '\u26A0' : '\u24D8'}</span>
                <div class="flag-content">
                  <div class="flag-title">\${esc(f.title)}</div>
                  \${f.summary ? \`<div class="flag-summary">\${inlineCode(f.summary)}</div>\` : ''}
                  <div class="flag-location">\${esc(f.file)}:\${f.line}</div>
                </div>
                <span class="flag-copy" title="Copy to clipboard">\u29C9</span>
              </div>
            \`).join('')}
          </div>\` : ''}
        \` : ''}

      \`;
    }

    // Event delegation — routes all clicks via data-action attributes
    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      const action = target.dataset.action;

      if (action === 'open-group') {
        const index = parseInt(target.dataset.groupIndex, 10);
        vscode.postMessage({ type: 'openGroup', groupIndex: index });
      } else if (action === 'open-flag') {
        const file = target.dataset.file;
        const line = parseInt(target.dataset.line, 10);
        const index = parseInt(target.dataset.index, 10);
        const clipText = target.dataset.clip;
        highlightFlag(index);
        const state = vscode.getState() || {};
        vscode.setState({ ...state, selectedGroup: -1, selectedFlag: index });
        vscode.postMessage({ type: 'openFlag', file: file, line: line, clipText: clipText });
      } else if (action === 'open-explanation') {
        vscode.postMessage({ type: 'openExplanation' });
      } else if (action === 'select-file') {
        vscode.postMessage({ type: 'selectFile' });
      } else if (action === 'unload-review') {
        vscode.postMessage({ type: 'unloadReview' });
      } else if (action === 'toggle-section') {
        toggleSection(target.dataset.section);
      } else if (action === 'toggle-group-files') {
        toggleGroupFiles(parseInt(target.dataset.groupIndex, 10));
      } else if (action === 'toggle-dir') {
        toggleDir(target.dataset.path);
      } else if (action === 'open-file') {
        const groupEl = target.closest('.group');
        if (groupEl) {
          const index = parseInt(groupEl.id.replace('group-', ''), 10);
          highlightGroup(index);
          const state = vscode.getState() || {};
          vscode.setState({ ...state, selectedGroup: index, selectedFlag: -1 });
        }
        vscode.postMessage({ type: 'openFile', file: target.dataset.path });
      }
    });

    function highlightGroup(index) {
      document.querySelectorAll('.group').forEach((el, i) => {
        el.classList.toggle('selected', i === index);
      });
      document.querySelectorAll('.flag').forEach(el => {
        el.classList.remove('selected');
      });
    }

    function highlightFlag(index) {
      document.querySelectorAll('.group').forEach(el => {
        el.classList.remove('selected');
      });
      document.querySelectorAll('.flag').forEach((el, i) => {
        el.classList.toggle('selected', i === index);
      });
    }

    function showEmpty() {
      document.getElementById('root').innerHTML = \`
        <div class="empty">
          <p>No review loaded</p>
          <p style="font-size: 12px;">Select a review JSON file to get started.</p>
          <button class="select-btn" data-action="select-file">Select Review File</button>
        </div>
      \`;
    }

    function buildGroupTree(files, groupIndex) {
      if (files.length === 0) return '';

      const parts = files.map(f => f.split('/'));
      let commonLen = 0;
      if (parts.length > 0) {
        for (let i = 0; i < parts[0].length - 1; i++) {
          if (parts.every(p => i < p.length - 1 && p[i] === parts[0][i])) {
            commonLen = i + 1;
          } else break;
        }
      }
      const prefix = commonLen > 0 ? parts[0].slice(0, commonLen).join('/') + '/' : '';

      const tree = {};
      for (const file of files) {
        const segs = file.split('/').slice(commonLen);
        let node = tree;
        for (let i = 0; i < segs.length; i++) {
          if (i === segs.length - 1) {
            node[segs[i]] = file;
          } else {
            if (!node[segs[i]] || typeof node[segs[i]] === 'string') node[segs[i]] = {};
            node = node[segs[i]];
          }
        }
      }

      const state = vscode.getState() || {};
      const collapsed = state.collapsedDirs || [];
      const gp = 'g' + groupIndex + ':';

      function compactDir(name, obj) {
        const entries = Object.entries(obj);
        const dirs = entries.filter(([, v]) => v !== null && typeof v === 'object');
        const fl = entries.filter(([, v]) => typeof v === 'string');
        if (dirs.length === 1 && fl.length === 0) {
          return compactDir(name + '/' + dirs[0][0], dirs[0][1]);
        }
        return { label: name, node: obj };
      }

      function renderNode(obj, depth, pathPrefix) {
        let h = '';
        const entries = Object.entries(obj);
        const dirs = entries.filter(([, v]) => v !== null && typeof v === 'object').sort((a, b) => a[0].localeCompare(b[0]));
        const leaves = entries.filter(([, v]) => typeof v === 'string').sort((a, b) => a[0].localeCompare(b[0]));
        for (const [name, children] of dirs) {
          const compacted = compactDir(name, children);
          const dp = pathPrefix ? pathPrefix + '/' + compacted.label : compacted.label;
          const key = gp + dp;
          const ic = collapsed.includes(key);
          h += '<div class="tree-dir" style="padding-left:' + (depth * 16 + 8) + 'px" data-action="toggle-dir" data-path="' + esc(key) + '">';
          h += '<span class="tree-chevron">' + (ic ? '\u25B8' : '\u25BE') + '</span>' + esc(compacted.label);
          h += '</div>';
          if (!ic) h += renderNode(compacted.node, depth + 1, dp);
        }
        for (const [name, fullPath] of leaves) {
          if (_phantomSet.has(fullPath)) {
            h += '<div class="tree-file phantom-file" style="padding-left:' + (depth * 16 + 24) + 'px">';
            h += '<span class="tree-file-icon" style="color: var(--vscode-editorError-foreground)">\u2716</span><span style="text-decoration: line-through">' + esc(name) + '</span>';
            h += '</div>';
          } else {
            h += '<div class="tree-file" style="padding-left:' + (depth * 16 + 24) + 'px" data-action="open-file" data-path="' + esc(fullPath) + '">';
            h += '<span class="tree-file-icon">\u25A0</span>' + esc(name);
            h += '</div>';
          }
        }
        return h;
      }

      let html = '<div class="group-file-tree">';
      if (prefix) html += '<div class="tree-prefix-line">' + esc(prefix) + '</div>';
      html += renderNode(tree, 0, '');
      html += '</div>';
      return html;
    }

    function toggleSection(section) {
      const state = vscode.getState() || {};
      const key = section + 'Collapsed';
      vscode.setState({ ...state, [key]: !state[key] });
      if (state.review) {
        render(state.review, state.mtime, state.validation);
        if (state.selectedFlag >= 0) highlightFlag(state.selectedFlag);
        else if (state.selectedGroup >= 0) highlightGroup(state.selectedGroup);
      }
    }

    function toggleGroupFiles(index) {
      const state = vscode.getState() || {};
      let expanded = state.expandedGroups || [];
      if (expanded.includes(index)) {
        expanded = expanded.filter(i => i !== index);
      } else {
        expanded.push(index);
      }
      vscode.setState({ ...state, expandedGroups: expanded });
      if (state.review) {
        render(state.review, state.mtime, state.validation);
        if (state.selectedFlag >= 0) highlightFlag(state.selectedFlag);
        else if (state.selectedGroup >= 0) highlightGroup(state.selectedGroup);
      }
    }

    function toggleDir(dirPath) {
      const state = vscode.getState() || {};
      let collapsed = state.collapsedDirs || [];
      if (collapsed.includes(dirPath)) {
        collapsed = collapsed.filter(d => d !== dirPath);
      } else {
        collapsed.push(dirPath);
      }
      vscode.setState({ ...state, collapsedDirs: collapsed });
      if (state.review) {
        render(state.review, state.mtime, state.validation);
        if (state.selectedFlag >= 0) highlightFlag(state.selectedFlag);
        else if (state.selectedGroup >= 0) highlightGroup(state.selectedGroup);
      }
    }

    function esc(s) {
      if (!s) return '';
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
  </script>
</body>
</html>`;
}
