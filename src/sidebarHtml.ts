export function getSidebarHtml(nonce: string, codiconFontUri: string, cspSource: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src ${cspSource}; script-src 'nonce-${nonce}';">
  <style>
    @font-face {
      font-family: 'codicon';
      src: url('${codiconFontUri}') format('truetype');
    }
    .codicon {
      font-family: 'codicon';
      font-size: 16px;
      font-style: normal;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      line-height: 1;
      display: inline-block;
    }
    .codicon-preview:before { content: "\\eb2f"; }
    .codicon-diff-multiple:before { content: "\\ec23"; }
    .codicon-unverified:before { content: "\\eb76"; }
    .codicon-warning:before { content: "\\ea6c"; }
    .codicon-close:before { content: "\\ea76"; }
    .codicon-chevron-right:before { content: "\\eab6"; }
    .codicon-chevron-down:before { content: "\\eab4"; }
    .codicon-ellipsis:before { content: "\\ea7c"; }
    .codicon-file-code:before { content: "\\eae9"; }
    .codicon-question:before { content: "\\eb32"; }
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
    .empty-icon {
      font-size: 32px;
      margin-bottom: 8px;
      opacity: 0.5;
    }
    .empty-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 8px 0;
    }
    .empty-desc {
      font-size: 12px;
      margin: 0;
    }
    .header {
      padding: 10px 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      background: var(--vscode-sideBar-background);
    }
    .summary-header {
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
      gap: 6px;
      user-select: none;
    }
    .summary-header:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .summary-spacer {
      flex: 1;
    }
    .summary-date {
      font-size: 11px;
      font-weight: 400;
      text-transform: none;
      letter-spacing: 0;
      color: var(--vscode-descriptionForeground);
      white-space: nowrap;
    }
    .section-icon {
      font-size: 14px;
    }
    .group {
      margin-bottom: 4px;
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
      color: var(--vscode-descriptionForeground);
    }
    .group-summary {
      font-size: 13px;
      color: var(--vscode-editor-foreground);
      line-height: 1.5;
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
      margin-bottom: 4px;
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
      color: var(--vscode-descriptionForeground);
    }
    .flag-summary {
      font-size: 13px;
      color: var(--vscode-editor-foreground);
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
    }
    .tree-stats-line {
      padding: 6px 12px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      user-select: none;
    }
    .tree-stats-line:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .tree-prefix-line {
      padding: 3px 8px 3px 24px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
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
    .phantom-badge {
      font-size: 12px;
      color: var(--vscode-editorWarning-foreground);
      flex-shrink: 0;
    }
    .uncategorized-group {
      opacity: 0.7;
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
      <div class="empty-icon"><span class="codicon codicon-diff-multiple"></span></div>
      <p class="empty-title">No review loaded</p>
      <p class="empty-desc">Open a review file to get started.</p>
      <p class="empty-desc" style="margin-top: 4px; font-size: 11px; opacity: 0.7;">Usually named <code>code-review.json</code></p>
      <button class="select-btn" data-action="select-file">Select Review File</button>
    </div>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let _phantomSet = new Set();

    window.addEventListener('message', e => {
      if (e.data.type === 'update') {
        vscode.setState({ review: e.data.review, mtime: e.data.mtime, validation: e.data.validation, selectedGroup: -1, collapsedDirs: [], expandedGroups: [] });
        render(e.data.review, e.data.mtime, e.data.validation);
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
      return esc(text).replace(/\\\`([^\\\`]+)\\\`/g, '<code>$1</code>');
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
      _phantomSet = new Set(validation?.phantomFiles || []);
      const missingFiles = validation?.missingFiles || [];
      const uncatIndex = review.groups.length;

      root.innerHTML = \`
        \${review.explanation ? \`<div class="summary-header" data-action="open-explanation">
          <span class="codicon codicon-preview section-icon"></span>
          <span>Review Summary</span>
          <span class="summary-spacer"></span>
          \${mtime ? \`<span class="summary-date">\${formatDate(mtime)}</span>\` : ''}
          <button class="unload-btn" data-action="unload-review" title="Close review"><span class="codicon codicon-close" style="font-size: 12px;"></span></button>
        </div>\` : \`<div class="header">
          <div class="header-row">
            <span></span>
            <button class="unload-btn" data-action="unload-review" title="Close review"><span class="codicon codicon-close" style="font-size: 12px;"></span></button>
          </div>
        </div>\`}

        <div class="section-header" data-action="toggle-section" data-section="groups">
          <span class="codicon \${groupsCollapsed ? 'codicon-chevron-right' : 'codicon-chevron-down'}" style="font-size: 12px;"></span>
          <span class="codicon codicon-diff-multiple section-icon"></span>
          <span>Groups</span>
        </div>

        \${!groupsCollapsed ? review.groups.map((g, i) => {
          const groupHasPhantom = g.files.some(f => _phantomSet.has(f));
          return \`
            <div class="group" id="group-\${i}">
              <div class="group-header" data-action="toggle-group-files" data-group-index="\${i}">
                <div class="group-title">
                  <span class="tree-group-badge">\${i + 1}</span>
                  <span class="group-title-text">\${esc(g.title)}</span>
                  \${groupHasPhantom ? '<span class="codicon codicon-warning phantom-badge"></span>' : ''}
                </div>
                \${g.summary ? \`<div class="group-summary">\${inlineCode(g.summary)}</div>\` : ''}
              </div>
              <div class="tree-stats-line" data-action="toggle-group-files" data-group-index="\${i}">
                <span class="codicon codicon-file-code" style="font-size: 12px;"></span>
                \${g.files.length} file\${g.files.length !== 1 ? 's' : ''}\${filePrefix(g.files) ? ' &mdash; ' + esc(filePrefix(g.files)) : ''}
              </div>
              \${expandedGroups.includes(i) ? buildGroupTree(g.files, i) : ''}
            </div>
          \`;
        }).join('') : ''}

        \${!groupsCollapsed && missingFiles.length > 0 ? \`
          <div class="group uncategorized-group" id="group-uncategorized">
            <div class="group-header" data-action="toggle-group-files" data-group-index="\${uncatIndex}">
              <div class="group-title">
                <span class="codicon codicon-question section-icon" style="font-size: 14px;"></span>
                <span class="group-title-text">Uncategorized</span>
              </div>
              <div class="group-summary">Files in the diff not assigned to any group</div>
            </div>
            <div class="tree-stats-line" data-action="toggle-group-files" data-group-index="\${uncatIndex}">
              <span class="codicon codicon-file-code" style="font-size: 12px;"></span>
              \${missingFiles.length} file\${missingFiles.length !== 1 ? 's' : ''}\${filePrefix(missingFiles) ? ' &mdash; ' + esc(filePrefix(missingFiles)) : ''}
            </div>
            \${expandedGroups.includes(uncatIndex) ? buildGroupTree(missingFiles, 'uncategorized') : ''}
          </div>
        \` : ''}

        \${review.flags?.length ? \`
          <div class="section-header" data-action="toggle-section" data-section="flags">
            <span class="codicon \${flagsCollapsed ? 'codicon-chevron-right' : 'codicon-chevron-down'}" style="font-size: 12px;"></span>
            <span class="codicon codicon-unverified section-icon"></span>
            <span>Flags</span>
          </div>
          \${!flagsCollapsed ? \`<div class="flags">
            \${review.flags.map((f, i) => \`
              <div class="flag flag-\${esc(f.severity)}" id="flag-\${i}" data-action="open-flag" data-file="\${esc(f.file)}" data-line="\${f.line}" data-index="\${i}" data-clip="\${esc(f.summary ? f.file + ' : ' + f.summary : f.file)}">
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

      if (action === 'open-flag') {
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
          <div class="empty-icon"><span class="codicon codicon-diff-multiple"></span></div>
          <p class="empty-title">No review loaded</p>
          <p class="empty-desc">Open a review file to get started.</p>
          <p class="empty-desc" style="margin-top: 4px; font-size: 11px; opacity: 0.7;">Usually named <code>code-review.json</code></p>
          <button class="select-btn" data-action="select-file">Select Review File</button>
        </div>
      \`;
    }

    function filePrefix(files) {
      if (files.length === 0) return '';
      const parts = files.map(f => f.split('/'));
      let commonLen = 0;
      for (let i = 0; i < parts[0].length - 1; i++) {
        if (parts.every(p => i < p.length - 1 && p[i] === parts[0][i])) {
          commonLen = i + 1;
        } else break;
      }
      return commonLen > 0 ? parts[0].slice(0, commonLen).join('/') + '/' : '';
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
