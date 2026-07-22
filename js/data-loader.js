// ── Load & normalize data ───────────────────────────────
async function loadWords() {
  try {
    const cachedWords = localStorage.getItem(MAIN_WORDS_STORAGE_KEY);
    const cachedPhrasals = localStorage.getItem(MAIN_PHRASALS_STORAGE_KEY);
    const cachedSentences = localStorage.getItem(MAIN_SENTENCES_STORAGE_KEY);
    let wordsData = null;
    let phrasalData = null;
    let sentencesData = null;
    const [wordsResult, phrasalResult, sentencesResult] = await Promise.allSettled([
      fetchJSON(WORDS_URL),
      fetchJSON(PHRASAL_VERBS_URL),
      fetchJSON(SENTENCES_URL)
    ]);
    if (wordsResult.status === 'fulfilled') {
      wordsData = wordsResult.value;
      localStorage.setItem(MAIN_WORDS_STORAGE_KEY, JSON.stringify(wordsData));
    } else {
      console.warn("No se pudo obtener words.json remoto.", wordsResult.reason);
    }
    if (phrasalResult.status === 'fulfilled') {
      phrasalData = phrasalResult.value;
      localStorage.setItem(MAIN_PHRASALS_STORAGE_KEY, JSON.stringify(phrasalData));
    } else {
      console.warn("No se pudo obtener phrasal_verbs.json remoto.", phrasalResult.reason);
    }
    if (sentencesResult.status === 'fulfilled') {
      sentencesData = sentencesResult.value;
      localStorage.setItem(MAIN_SENTENCES_STORAGE_KEY, JSON.stringify(sentencesData));
    } else {
      console.warn("No se pudo obtener sentences.json remoto.", sentencesResult.reason);
    }
    if (!wordsData && cachedWords) wordsData = JSON.parse(cachedWords);
    if (!phrasalData && cachedPhrasals) phrasalData = JSON.parse(cachedPhrasals);
    if (!sentencesData && cachedSentences) sentencesData = JSON.parse(cachedSentences);
    if (!wordsData && !phrasalData && !sentencesData) {
      throw new Error('No se encontraron datos en caché ni se pudo establecer conexión con el servidor.');
    }
    processLoadedData(wordsData || [], phrasalData || [], sentencesData || []);
    nextWord();
    document.getElementById('appMain').classList.remove('is-loading');
  } catch (e) {
    const isNetworkIssue = e instanceof TypeError && /fetch/i.test(e.message);
    document.getElementById('loadingMsg').innerHTML =
      (isNetworkIssue
        ? '❌ Error al cargar el vocabulario.<br>Por favor, comprueba tu conexión de red.<br>'
        : '❌ Error al procesar el vocabulario (datos con formato inválido).<br>')
      + e.message;
  }
}
function buildNormalizedEntry(raw, type, savedWeights, index, issues) {
  const label = type === 'phrasal_verb' ? 'phrasal_verb' : (type === 'sentence' ? 'sentence' : 'word');
  if (!raw || typeof raw !== 'object') {
    const msg = `Entrada #${index} (${label}) inválida: no es un objeto.`;
    console.warn(msg, raw);
    issues.push(msg);
    return null;
  }
  const rawTerm = type === 'phrasal_verb' ? raw.phrasal_verb : (type === 'sentence' ? raw.sentence : raw.word);
  const term = safeStr(rawTerm).trim();
  if (!term) {
    const msg = `Entrada #${index}: falta el campo "${label}".`;
    console.warn(msg, raw);
    issues.push(msg);
    return null;
  }
  if (!Array.isArray(raw.translations) || raw.translations.length === 0) {
    const msg = `"${term}": falta "translations" o está vacío.`;
    console.warn(msg, raw);
    issues.push(msg);
    return null;
  }
  const cleanTranslations = raw.translations
    .map(t => safeStr(t).trim())
    .filter(Boolean);
  if (cleanTranslations.length === 0) {
    const msg = `"${term}": "translations" no contiene strings válidos.`;
    console.warn(msg, raw);
    issues.push(msg);
    return null;
  }
  const savedWeight = savedWeights[term];
  const weight = (savedWeight !== undefined) ? savedWeight : 1;
  const processedSentences = Array.isArray(raw.sentences)
    ? raw.sentences
        .filter(s => {
          const ok = s && typeof s.sentence === 'string' && typeof s.fill === 'string';
          if (!ok) {
            const msg = `"${term}": una entrada de "sentences" es inválida y fue omitida.`;
            console.warn(msg, s);
            issues.push(msg);
          }
          return ok;
        })
        .map(s => ({
          sentence: s.sentence,
          fill: removeAccents(s.fill.toLowerCase().trim())
        }))
    : null;
  const rawPast = (type !== 'sentence' && typeof raw.past === 'string' && raw.past.trim()) ? raw.past.trim() : null;
  return {
    ...raw,
    word: term,
    type: type,
    rawTranslations: raw.translations.map(t => safeStr(t).trim()).filter(Boolean),
    rawPast: rawPast,
    translations: cleanTranslations.map(t => removeAccents(t.toLowerCase())),
    past: rawPast ? removeAccents(rawPast.toLowerCase()) : null,
    sentences: (processedSentences && processedSentences.length > 0) ? processedSentences : null,
    image: (type !== 'sentence' && raw.image) ? raw.image : null,
    synonym: raw.synonym === true,
    weight: weight,
    custom_list: raw.custom_list || false,
    originalIndex: index
  };
}
function processLoadedData(wordsData, phrasalData, sentencesData) {
  const savedWeights = loadSavedWeights();
  const issues = [];
  let index = 0;
  const normalizedWords = wordsData
    .map(w => buildNormalizedEntry(w, 'word', savedWeights, index++, issues))
    .filter(Boolean);
  const normalizedPhrasals = phrasalData
    .map(p => buildNormalizedEntry(p, 'phrasal_verb', savedWeights, index++, issues))
    .filter(Boolean);
  const normalizedSentences = (sentencesData || [])
    .map(s => buildNormalizedEntry(s, 'sentence', savedWeights, index++, issues))
    .filter(Boolean);
  words = [...normalizedWords, ...normalizedPhrasals, ...normalizedSentences];
  if (words.length === 0) {
    throw new Error('Los datos se cargaron pero ninguna entrada es válida (revisa el formato del JSON).');
  }
  if (issues.length > 0) {
    reportDataIssues(issues);
  }
  syncWeightsWithStorage();
  const validWords = new Set(words.map(w => w.word));
  const cleanedCustom = customWords.filter(w => validWords.has(w));
  if (cleanedCustom.length !== customWords.length) {
    customWords = cleanedCustom;
    saveCustomWords();
  }
}
function reportDataIssues(issues) {
  console.warn(`Se encontraron ${issues.length} problema(s) en los datos:`, issues);
  const MAX_SHOWN = 8;
  const preview = issues.slice(0, MAX_SHOWN).map(m => `• ${m}`).join('\n');
  const extra = issues.length > MAX_SHOWN ? `\n…y ${issues.length - MAX_SHOWN} más (ver consola).` : '';
  alert(
    `⚠️ Se detectaron ${issues.length} entrada(s) con datos inválidos en el vocabulario.\n` +
    `Fueron omitidas para que la app pueda seguir funcionando.\n\n${preview}${extra}\n\n` +
    `Revisa words.json / phrasal_verbs.json / sentences.json y la consola (F12) para más detalle.`
  );
}
function resetAllWordProgress() {
  localStorage.removeItem(WEIGHTS_STORAGE_KEY);
  completedWords = [];
  saveCompletedWords();
  recentlySeen = [];
  streak = 0;
  updateStats();
}
async function handleSyncWords() {
  const syncBtn = document.getElementById('syncMainBtn');
  const originalText = syncBtn.textContent;
  syncBtn.textContent = '⏳ ...';
  syncBtn.disabled = true;
  try {
    const [wordsData, phrasalData, sentencesData] = await Promise.all([
      fetchJSON(WORDS_URL),
      fetchJSON(PHRASAL_VERBS_URL),
      fetchJSON(SENTENCES_URL).catch(() => [])
    ]);
    localStorage.setItem(MAIN_WORDS_STORAGE_KEY, JSON.stringify(wordsData));
    localStorage.setItem(MAIN_PHRASALS_STORAGE_KEY, JSON.stringify(phrasalData));
    localStorage.setItem(MAIN_SENTENCES_STORAGE_KEY, JSON.stringify(sentencesData));
    resetAllWordProgress();
    processLoadedData(wordsData, phrasalData, sentencesData);
    alert('Sincronización y reinicio completados con éxito.');
    updatePanelWordCount();
    renderPanelList();
    nextWord();
  } catch (error) {
    alert('No se pudo realizar la sincronización: ' + error.message);
  } finally {
    syncBtn.textContent = originalText;
    syncBtn.disabled = false;
  }
}
function handleLoadCustomFromJSON() {
  const confirmation = confirm('¿Deseas reemplazar tu lista personalizada actual por la lista predefinida del servidor (elementos con "custom_list: true")?');
  if (!confirmation) return;
  const predefs = words.filter(w => w.custom_list === true).map(w => w.word);
  if (predefs.length === 0) {
    alert('No se encontraron elementos configurados en la lista predefinida.');
    return;
  }
  customWords = predefs;
  saveCustomWords();
  updateCustomCountTab();
  alert(`Se han cargado ${predefs.length} elementos predefinidos a tu lista.`);
  renderPanelList();
  renderGroupsTab();
  const customToggle = document.getElementById('customModeToggle');
  if (customToggle && customToggle.checked && customWords.length === 0) {
    customToggle.checked = false;
    applyModeAvailability();
    updateStats();
    nextWord();
  }
}