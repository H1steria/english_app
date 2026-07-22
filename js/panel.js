// ── Panel: contadores y utilidades comunes ──────────────
function updatePanelWordCount() {
  const countEl = document.getElementById('panelWordCount');
  if (!countEl) return;
  const wordCount = words.filter(w => w.type === 'word').length;
  const phrasalCount = words.filter(w => w.type === 'phrasal_verb').length;
  const sentenceCount = words.filter(w => w.type === 'sentence').length;
  countEl.textContent = `Total: ${words.length} elementos (${wordCount} palabras, ${phrasalCount} phrasal verbs, ${sentenceCount} oraciones)`;
}
function updateCustomCountTab() {
  const el = document.getElementById('customCountTab');
  if (el) el.textContent = customWords.length;
}
function createEmptyStateNode(text) {
  const node = document.getElementById('tplPanelEmpty').content.firstElementChild.cloneNode(true);
  node.textContent = text;
  return node;
}

// ── Panel: lista (pestañas Todas / Mi lista) con separación
//    entre palabras, phrasal verbs y oraciones dentro de "Todas" ─
function createPanelItemNode(w, savedWeights) {
  const node = document.getElementById('tplPanelItem').content.firstElementChild.cloneNode(true);
  const weight = savedWeights[w.word] !== undefined ? savedWeights[w.word] : 1;
  const isCustom = customWords.includes(w.word);
  node.classList.toggle('is-custom', isCustom);
  node.querySelector('.word-name').textContent = w.word;
  const badge = node.querySelector('.type-badge');
  if (w.type === 'phrasal_verb') {
    badge.textContent = 'PV';
    badge.style.cssText = 'font-size:0.65rem; padding:1px 6px; border-radius:6px; background:rgba(233,69,96,0.15); color:var(--accent); margin-left:6px;';
  } else if (w.type === 'sentence') {
    badge.textContent = 'FRASE';
    badge.style.cssText = 'font-size:0.65rem; padding:1px 6px; border-radius:6px; background:rgba(155,89,182,0.18); color:#c07df0; margin-left:6px;';
  } else {
    badge.textContent = 'W';
    badge.style.cssText = 'font-size:0.65rem; padding:1px 6px; border-radius:6px; background:rgba(15,155,142,0.15); color:var(--teal); margin-left:6px;';
  }
  if (w.synonym === true) {
    const synBadge = document.createElement('span');
    synBadge.textContent = 'SYN';
    synBadge.title = 'Sinónimo: muestra la descripción junto a la palabra';
    synBadge.style.cssText = 'font-size:0.65rem; padding:1px 6px; border-radius:6px; background:rgba(245,197,24,0.15); color:var(--gold); margin-left:4px;';
    badge.insertAdjacentElement('afterend', synBadge);
  }
  const weightEl = node.querySelector('.word-weight');
  weightEl.textContent = `x${weight}`;
  weightEl.style.color = weight > 1 ? 'var(--accent)' : '';
  const addBtn = node.querySelector('[data-action="add-custom"]');
  const removeBtn = node.querySelector('[data-action="remove-custom"]');
  addBtn.style.display = isCustom ? 'none' : '';
  removeBtn.style.display = isCustom ? '' : 'none';
  addBtn.dataset.word = w.word;
  removeBtn.dataset.word = w.word;
  return node;
}
function createSectionHeaderNode(title, count) {
  const node = document.getElementById('tplPanelSectionHeader').content.firstElementChild.cloneNode(true);
  node.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:8px 4px 4px; margin-top:6px; font-size:0.72rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--muted); border-bottom:1px solid #ffffff0a;';
  node.querySelector('.section-title').textContent = title;
  node.querySelector('.section-count').textContent = count;
  return node;
}
function sortByWeightDesc(list, savedWeights) {
  return [...list].sort((a, b) => {
    const wa = savedWeights[a.word] !== undefined ? savedWeights[a.word] : 1;
    const wb = savedWeights[b.word] !== undefined ? savedWeights[b.word] : 1;
    return wb - wa;
  });
}
function renderPanelList() {
  const listContainer = document.getElementById('panelList');
  listContainer.innerHTML = '';
  const savedWeights = loadSavedWeights();
  if (panelTab === 'custom') {
    const list = sortPanelList(filterPanelList(words.filter(w => customWords.includes(w.word))), savedWeights);
    if (list.length === 0) {
      const msg = panelSearchQuery ? 'Sin resultados para tu búsqueda.'
        : 'Tu lista personalizada está vacía. Pulsa ➕ en cualquier elemento de "Todas" para añadirlo.';
      listContainer.appendChild(createEmptyStateNode(msg));
    } else {
      list.forEach(w => listContainer.appendChild(createPanelItemNode(w, savedWeights)));
    }
  } else {
    const wordEntries = sortPanelList(filterPanelList(words.filter(w => w.type === 'word')), savedWeights);
    const phrasalEntries = sortPanelList(filterPanelList(words.filter(w => w.type === 'phrasal_verb')), savedWeights);
    const sentenceEntries = sortPanelList(filterPanelList(words.filter(w => w.type === 'sentence')), savedWeights);
    if (wordEntries.length === 0 && phrasalEntries.length === 0 && sentenceEntries.length === 0) {
      listContainer.appendChild(createEmptyStateNode(panelSearchQuery ? 'Sin resultados para tu búsqueda.' : 'No hay elementos.'));
    } else {
      if (wordEntries.length > 0) {
        listContainer.appendChild(createSectionHeaderNode('Palabras', wordEntries.length));
        wordEntries.forEach(w => listContainer.appendChild(createPanelItemNode(w, savedWeights)));
      }
      if (phrasalEntries.length > 0) {
        listContainer.appendChild(createSectionHeaderNode('Phrasal Verbs', phrasalEntries.length));
        phrasalEntries.forEach(w => listContainer.appendChild(createPanelItemNode(w, savedWeights)));
      }
      if (sentenceEntries.length > 0) {
        listContainer.appendChild(createSectionHeaderNode('Oraciones', sentenceEntries.length));
        sentenceEntries.forEach(w => listContainer.appendChild(createPanelItemNode(w, savedWeights)));
      }
    }
  }
  attachPanelItemListeners(listContainer);
}
function attachPanelItemListeners(container) {
  container.querySelectorAll('[data-action="add-custom"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const word = btn.dataset.word;
      if (!customWords.includes(word)) { customWords.push(word); saveCustomWords(); }
      updateCustomCountTab();
      renderPanelList();
      renderGroupsTab();
    });
  });
  container.querySelectorAll('[data-action="remove-custom"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const word = btn.dataset.word;
      customWords = customWords.filter(w => w !== word);
      saveCustomWords();
      updateCustomCountTab();
      renderPanelList();
      renderGroupsTab();
      const customToggle = document.getElementById('customModeToggle');
      if (customToggle && customToggle.checked && customWords.length === 0) {
        customToggle.checked = false;
        applyModeAvailability();
        updateStats();
        nextWord();
      }
    });
  });
}
function cyclePanelSort() {
  panelSortMode = SORT_CYCLE[(SORT_CYCLE.indexOf(panelSortMode) + 1) % SORT_CYCLE.length];
  localStorage.setItem('panel_sort_mode', panelSortMode);
  updateSortBtnLabel();
  renderPanelList();
}
function updateSortBtnLabel() {
  const btn = document.getElementById('panelSortBtn');
  if (btn) btn.textContent = SORT_LABELS[panelSortMode];
}
function sortPanelList(list, savedWeights) {
  if (panelSortMode === 'az') return [...list].sort((a, b) => a.word.localeCompare(b.word));
  if (panelSortMode === 'za') return [...list].sort((a, b) => b.word.localeCompare(a.word));
  return sortByWeightDesc(list, savedWeights);
}
function filterPanelList(list) {
  const q = removeAccents(panelSearchQuery.toLowerCase().trim());
  if (!q) return list;
  return list.filter(w =>
    removeAccents(w.word.toLowerCase()).includes(q) ||
    (w.rawTranslations || w.translations || []).some(t => removeAccents(safeStr(t).toLowerCase()).includes(q))
  );
}

// ── Panel: apertura / cierre / pestañas ─────────────────
function openWeightsPanel() {
  updatePanelWordCount();
  updateCustomCountTab();
  renderPanelList();
  updateSortBtnLabel();
  const weightInput = document.getElementById('esEnWeightInput');
  if (weightInput) weightInput.value = esEnWeight;
  document.getElementById('weightsModal').classList.add('active');
}
function closeWeightsPanel() {
  document.getElementById('weightsModal').classList.remove('active');
}
function switchPanelTab(tab) {
  panelTab = tab;
  document.getElementById('tabAll').classList.toggle('active', tab === 'all');
  document.getElementById('tabCustom').classList.toggle('active', tab === 'custom');
  document.getElementById('tabConfig').classList.toggle('active', tab === 'config');
  document.getElementById('tabGroups').classList.toggle('active', tab === 'groups');
  const isConfig = (tab === 'config');
  const isGroups = (tab === 'groups');
  const isList = !isConfig && !isGroups;
  document.getElementById('panelList').style.display = isList ? 'flex' : 'none';
  document.getElementById('panelConfig').style.display = isConfig ? 'flex' : 'none';
  document.getElementById('panelGroups').style.display = isGroups ? 'flex' : 'none';
  document.getElementById('panelActionsAll').style.display = (tab === 'all') ? '' : 'none';
  document.getElementById('panelActionsCustom').style.display = (tab === 'custom') ? '' : 'none';
  document.getElementById('panelActionsGroups').style.display = (tab === 'groups') ? '' : 'none';
  document.getElementById('panelToolbar').style.display = isList ? 'flex' : 'none';
  if (isList) renderPanelList();
  if (isGroups) renderGroupsTab();
  if (isConfig) {
    const weightInput = document.getElementById('esEnWeightInput');
    if (weightInput) weightInput.value = esEnWeight;
  }
}
function resetAllWeights() {
  if (!confirm('¿Deseas restablecer todos los pesos a 1?')) return;
  localStorage.removeItem(WEIGHTS_STORAGE_KEY);
  words.forEach(w => { w.weight = 1; });
  syncWeightsWithStorage();
  renderPanelList();
}
function clearCustomList() {
  if (!confirm('¿Deseas vaciar tu lista personalizada?')) return;
  customWords = [];
  saveCustomWords();
  const customToggle = document.getElementById('customModeToggle');
  if (customToggle && customToggle.checked) {
    customToggle.checked = false;
    applyModeAvailability();
    updateStats();
    nextWord();
  }
  updateCustomCountTab();
  renderPanelList();
  renderGroupsTab();
}
function handleApplyModeWeight() {
  const input = document.getElementById('esEnWeightInput');
  const val = parseFloat(input.value);
  if (isNaN(val) || val < 1) {
    alert('El peso debe ser un número mayor o igual a 1 (1 = misma probabilidad que Inglés → Español).');
    input.value = esEnWeight;
    return;
  }
  saveModeWeight(val);
  alert(`Listo. "Español → Inglés" (e imágenes) ahora son ${val}x más probables que "Inglés → Español".`);
}
function exportCustomListJSON() {
  if (customWords.length === 0) { alert("La lista personalizada está vacía."); return; }
  const dataToExport = words
    .filter(w => customWords.includes(w.word))
    .map(w => ({ ...toCleanBaseItem(w), custom_list: true }));
  const dataStr = JSON.stringify(dataToExport, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mi_lista_englishup.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function toCleanBaseItem(w) {
  const keyName = w.type === 'phrasal_verb' ? 'phrasal_verb' : (w.type === 'sentence' ? 'sentence' : 'word');
  const item = {
    [keyName]: w.word,
    translations: w.rawTranslations || w.translations,
    description: w.description || "",
  };
  if (w.type !== 'sentence') {
    item.past = w.rawPast || w.past || null;
    if (w.image) item.image = w.image;
  }
  if (w.synonym === true) item.synonym = true;
  if (w.sentences && w.sentences.length > 0) {
    item.sentences = w.sentences.map(s => ({ sentence: s.sentence, fill: s.fill }));
  }
  return item;
}
function calculateGroups() {
  const sorted = getSortedCustomWords();
  const groups = [];
  for (let i = 0; i < sorted.length; i += groupSize) {
    groups.push({ id: Math.floor(i / groupSize) + 1, words: sorted.slice(i, i + groupSize) });
  }
  return groups;
}
function getSortedCustomWords() {
  const indexMap = {};
  words.forEach(w => { indexMap[w.word] = w.originalIndex; });
  return [...customWords].sort((a, b) => {
    const ia = indexMap[a] !== undefined ? indexMap[a] : Infinity;
    const ib = indexMap[b] !== undefined ? indexMap[b] : Infinity;
    return ia - ib;
  });
}
function getWordGroup(word) {
  const sorted = getSortedCustomWords();
  const idx = sorted.indexOf(word);
  if (idx === -1) return null;
  return Math.floor(idx / groupSize) + 1;
}

function createGroupWordRow(term) {
  const node = document.getElementById('tplGroupWordRow').content.firstElementChild.cloneNode(true);
  node.style.cssText = 'font-size:0.82rem; padding:2px 0; color:var(--muted);';
  node.querySelector('.group-word-text').textContent = term;
  return node;
}
function createGroupCardNode(group, isSelected) {
  const node = document.getElementById('tplGroupCard').content.firstElementChild.cloneNode(true);
  node.style.cssText = `background:rgba(255,255,255,0.03); border:1.5px solid ${isSelected ? 'var(--teal)' : '#ffffff12'}; border-radius:8px; overflow:hidden;`;
  const header = node.querySelector('.group-card-header');
  header.style.cssText = 'display:flex; align-items:center; gap:8px; padding:8px 10px; cursor:pointer;';
  const checkbox = header.querySelector('.group-checkbox');
  checkbox.checked = isSelected;
  checkbox.dataset.group = group.id;
  checkbox.style.cssText = 'accent-color:var(--teal); width:16px; height:16px; cursor:pointer;';
  const title = header.querySelector('.group-title');
  title.textContent = `Grupo ${group.id}`;
  title.style.cssText = 'font-weight:700; font-size:0.88rem; flex:1;';
  const count = header.querySelector('.group-count');
  count.textContent = `${group.words.length} elementos`;
  count.style.cssText = 'font-size:0.75rem; color:var(--muted);';
  const arrow = header.querySelector('.group-arrow');
  arrow.style.cssText = 'color:var(--muted); font-size:0.75rem; transition:transform 0.2s;';
  const body = node.querySelector('.group-card-body');
  body.style.cssText = 'display:none; padding:6px 10px 10px; border-top:1px solid #ffffff0a;';
  group.words.forEach(term => body.appendChild(createGroupWordRow(term)));
  header.addEventListener('click', e => {
    if (e.target.type === 'checkbox') return;
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : 'block';
    arrow.style.transform = open ? '' : 'rotate(180deg)';
  });
  checkbox.addEventListener('change', e => {
    const gid = parseInt(e.target.dataset.group, 10);
    if (e.target.checked) {
      if (!selectedGroups.includes(gid)) selectedGroups.push(gid);
    } else {
      selectedGroups = selectedGroups.filter(g => g !== gid);
    }
    localStorage.setItem('selected_groups', JSON.stringify(selectedGroups));
    renderGroupsTab();
  });
  return node;
}
function renderGroupsTab() {
  const groupSizeInput = document.getElementById('groupSizeInput');
  if (groupSizeInput) groupSizeInput.value = groupSize;
  const toggleBtn = document.getElementById('toggleGroupModeBtn');
  if (toggleBtn) {
    if (useGroupMode && selectedGroups.length > 0) {
      toggleBtn.textContent = `📦 Usando: Grupos ${selectedGroups.join(', ')}`;
      toggleBtn.style.background = 'rgba(233,69,96,0.15)';
      toggleBtn.style.color = 'var(--accent)';
      toggleBtn.style.borderColor = 'rgba(233,69,96,0.3)';
    } else {
      toggleBtn.textContent = '📋 Usando: Toda la lista';
      toggleBtn.style.background = 'rgba(15,155,142,0.12)';
      toggleBtn.style.color = 'var(--teal)';
      toggleBtn.style.borderColor = 'rgba(15,155,142,0.3)';
    }
  }
  const groupsList = document.getElementById('groupsList');
  if (!groupsList) return;
  groupsList.innerHTML = '';
  const groups = calculateGroups();
  if (groups.length === 0) {
    groupsList.appendChild(createEmptyStateNode('Tu lista personalizada está vacía.'));
    return;
  }
  groups.forEach(group => {
    groupsList.appendChild(createGroupCardNode(group, selectedGroups.includes(group.id)));
  });
}