// ── Listeners globales del panel ────────────────────────
document.getElementById('closePanelBtn').addEventListener('click', closeWeightsPanel);
document.getElementById('resetWeightsBtn').addEventListener('click', resetAllWeights);
document.getElementById('clearCustomBtn').addEventListener('click', clearCustomList);
document.getElementById('tabAll').addEventListener('click', () => switchPanelTab('all'));
document.getElementById('tabCustom').addEventListener('click', () => switchPanelTab('custom'));
document.getElementById('tabConfig').addEventListener('click', () => switchPanelTab('config'));
document.getElementById('tabGroups').addEventListener('click', () => switchPanelTab('groups'));
document.getElementById('exportCustomBtn').addEventListener('click', exportCustomListJSON);
document.getElementById('loadCustomFromJsonBtn').addEventListener('click', handleLoadCustomFromJSON);
document.getElementById('applyModeWeightBtn').addEventListener('click', handleApplyModeWeight);
document.getElementById('applyGroupSizeBtn').addEventListener('click', () => {
  const val = parseInt(document.getElementById('groupSizeInput').value, 10);
  if (isNaN(val) || val < 1) { alert('Introduce un número válido.'); return; }
  groupSize = val;
  localStorage.setItem('group_size', groupSize);
  selectedGroups = [];
  localStorage.setItem('selected_groups', '[]');
  renderGroupsTab();
});
document.getElementById('toggleGroupModeBtn').addEventListener('click', () => {
  if (!useGroupMode && selectedGroups.length === 0) {
    alert('Selecciona al menos un grupo primero.');
    return;
  }
  useGroupMode = !useGroupMode;
  localStorage.setItem('use_group_mode', useGroupMode);
  renderGroupsTab();
  const customToggle = document.getElementById('customModeToggle');
  if (customToggle && customToggle.checked) { updateStats(); nextWord(); }
});
document.getElementById('clearGroupSelectionBtn').addEventListener('click', () => {
  selectedGroups = [];
  useGroupMode = false;
  localStorage.setItem('selected_groups', '[]');
  localStorage.setItem('use_group_mode', 'false');
  renderGroupsTab();
});
document.getElementById('panelSearchInput').addEventListener('input', e => {
  panelSearchQuery = e.target.value;
  renderPanelList();
});
document.getElementById('panelSortBtn').addEventListener('click', cyclePanelSort);

// ── GitHub credentials persistence ──────────────────────
document.getElementById('githubToken').value = localStorage.getItem('sync_gh_token') || '';
document.getElementById('githubUser').value = localStorage.getItem('sync_gh_user') || '';
document.getElementById('githubRepo').value = localStorage.getItem('sync_gh_repo') || '';
document.getElementById('githubToken').addEventListener('input', e => localStorage.setItem('sync_gh_token', e.target.value));
document.getElementById('githubUser').addEventListener('input', e => localStorage.setItem('sync_gh_user', e.target.value));
document.getElementById('githubRepo').addEventListener('input', e => localStorage.setItem('sync_gh_repo', e.target.value));
document.getElementById('syncMainBtn').addEventListener('click', handleSyncWords);
document.getElementById('pushToGithubBtn').addEventListener('click', pushToGitHub);

// ── Boot ─────────────────────────────────────────────────
initUI();
loadWords();
