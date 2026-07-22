function nextWord() {
  wordCountTrigger++;
  if (wordCountTrigger >= 10) {
    wordCountTrigger = 0;
    reorderWordsList();
  }
  current = pickRandom();
  if (!current) {
    showEmptyListState();
    return;
  }
  revealCount = 0;
  currentMode = pickModeFor(current);
  resetWordCard();
  if (currentMode === 'en-es') {
    currentSentence = null;
    renderEnEsMode(current);
  } else if (currentMode === 'es-en') {
    currentSentence = null;
    renderEsEnMode(current);
  } else if (currentMode === 'img-en') {
    currentSentence = null;
    renderImgEnMode(current);
  } else {
    currentSentence = renderSentenceMode(current);
  }
  rememberRecentWord(current.word);
  resetFeedbackUI();
  updateStats();
  focusTextInput();
}
function pickRandom() {
  if (words.length === 0) return null;
  const cycleToggle = document.getElementById('cycleModeToggle');
  const isCycleActive = cycleToggle ? cycleToggle.checked : false;
  let baseSet = getBaseWordSet();
  if (baseSet.length === 0) return null;
  let eligibleWords = [...baseSet];
  if (isCycleActive) {
    eligibleWords = eligibleWords.filter(w => !completedWords.includes(w.word));
    if (eligibleWords.length === 0) {
      completedWords = completedWords.filter(w => !baseSet.some(bw => bw.word === w));
      saveCompletedWords();
      eligibleWords = [...baseSet];
      alert("Ciclo completado. Se han restablecido las palabras para iniciar un nuevo ciclo.");
    }
  } else {
    const dynamicLimit = Math.min(RECENT_LIMIT, Math.floor(baseSet.length * 0.25));
    const recentSlice = recentlySeen.slice(-dynamicLimit);
    const filteredByRecent = eligibleWords.filter(w => !recentSlice.includes(w.word));
    if (filteredByRecent.length > 3) eligibleWords = filteredByRecent;
  }
  if (eligibleWords.length > 1) eligibleWords = eligibleWords.filter(w => w !== current);
  if (eligibleWords.length === 0) return null;
  if (eligibleWords.length === 1) return eligibleWords[0];
  const totalWeight = eligibleWords.reduce((sum, w) => sum + (w.weight || 1), 0);
  let randomValue = Math.random() * totalWeight;
  let cumulativeSum = 0;
  for (let i = 0; i < eligibleWords.length; i++) {
    cumulativeSum += (eligibleWords[i].weight || 1);
    if (randomValue <= cumulativeSum) return eligibleWords[i];
  }
  return eligibleWords[eligibleWords.length - 1];
}
function checkAnswer() {
  if (!current) return;
  document.getElementById('wordDisplay').style.visibility = 'visible';
  const rawTrans = document.getElementById('translationInput').value;
  let evalResult;
  if (current.type === 'sentence') {
    if (currentMode === 'en-es') {
      evalResult = evaluateSentenceEnEs(current, rawTrans);
      if (!evalResult.allCorrect) renderSentenceTranslationLeds(current.rawTranslations, rawTrans);
    } else {
      evalResult = evaluateSentenceEsEn(current, rawTrans);
      if (!evalResult.allCorrect) renderSentenceTranslationLeds([current.word], rawTrans);
    }
  } else {
    const userItems = parseInput(rawTrans);
    if (currentMode === 'en-es') {
      evalResult = evaluateEnEs(current, userItems);
      if (!evalResult.allCorrect) renderEnEsLeds(current, userItems, evalResult);
    } else if (currentMode === 'es-en') {
      evalResult = evaluateEsEn(current, userItems);
      if (!evalResult.allCorrect) renderEsEnLeds(current, userItems, evalResult);
    } else if (currentMode === 'img-en') {
      evalResult = evaluateImgEn(current, userItems);
      if (!evalResult.allCorrect) renderImgEnLeds(current, userItems, evalResult);
    } else {
      const userInputSingle = removeAccents(rawTrans.toLowerCase().trim());
      evalResult = evaluateSentence(currentSentence, userInputSingle);
      if (!evalResult.allCorrect) renderSentenceLeds(currentSentence, rawTrans);
    }
  }
  applyAnswerResult(evalResult.allCorrect);
  updateStats();
  showFeedback(evalResult);
}
function evaluateSentenceEnEs(word, rawInput) {
  const userNorm = normalizeSentenceAnswer(rawInput);
  const allCorrect = word.rawTranslations.some(t => normalizeSentenceAnswer(t) === userNorm);
  return { allCorrect, userNorm };
}
function evaluateSentenceEsEn(word, rawInput) {
  const userNorm = normalizeSentenceAnswer(rawInput);
  const expectedNorm = normalizeSentenceAnswer(word.word);
  return { allCorrect: userNorm === expectedNorm, userNorm };
}
function evaluateEnEs(word, userItems) {
  let pastAttempt = '';
  let translationAttempts = [];
  const explicitPastIdx = userItems.findIndex(item => item.startsWith(PAST_PREFIX));
  if (explicitPastIdx !== -1) {
    pastAttempt = userItems[explicitPastIdx].replace(PAST_PREFIX, '').trim();
    translationAttempts = userItems.filter((_, idx) => idx !== explicitPastIdx);
  } else if (word.past) {
    let bestPastScore = -1, bestPastIdx = -1;
    userItems.forEach((item, idx) => {
      const scorePast = getPrefixScore(word.past, item) + (item === word.past ? 1000 : 0);
      let bestTransScore = 0;
      word.translations.forEach(trans => {
        const scoreTrans = getPrefixScore(trans, item) + (item === trans ? 1000 : 0);
        if (scoreTrans > bestTransScore) bestTransScore = scoreTrans;
      });
      if (scorePast > bestTransScore && scorePast > bestPastScore) {
        bestPastScore = scorePast; bestPastIdx = idx;
      }
    });
    if (bestPastIdx !== -1) {
      pastAttempt = userItems[bestPastIdx];
      translationAttempts = userItems.filter((_, idx) => idx !== bestPastIdx);
    } else {
      const perfectPastIdx = userItems.findIndex(item => item === word.past);
      if (perfectPastIdx !== -1) {
        pastAttempt = userItems[perfectPastIdx];
        translationAttempts = userItems.filter((_, idx) => idx !== perfectPastIdx);
      } else {
        translationAttempts = [...userItems];
      }
    }
  } else {
    translationAttempts = [...userItems];
  }
  const missing = word.translations.filter(t => !translationAttempts.includes(t));
  const transOk = missing.length === 0;
  const pastOk = word.past ? (pastAttempt === word.past) : true;
  return { allCorrect: transOk && pastOk, transOk, pastOk, pastAttempt, translationAttempts };
}
function evaluateEsEn(word, userItems) {
  const correctWord = removeAccents(word.word.toLowerCase().trim());
  const { wordAttempt, pastAttempt } = resolveWordAndPast(correctWord, word.past, userItems);
  const wordOk = wordAttempt === correctWord;
  const pastOk = word.past ? (pastAttempt === word.past) : true;
  return { allCorrect: wordOk && pastOk, wordOk, pastOk, wordAttempt, pastAttempt };
}
function evaluateImgEn(word, userItems) {
  const correctWord = removeAccents(word.word.toLowerCase().trim());
  const expectedItems = [correctWord, ...word.translations];
  if (word.past) expectedItems.push(removeAccents(word.past.toLowerCase().trim()));
  const allCorrect = expectedItems.every(item => userItems.includes(item));
  return { allCorrect, expectedItems, userItems };
}
function evaluateSentence(sentence, userInputSingle) {
  return { allCorrect: userInputSingle === sentence.fill };
}
function renderLedPills(pillNodes) {
  const missingEl = document.getElementById('missingList');
  const missingItems = document.getElementById('missingItems');
  missingEl.style.display = '';
  missingItems.innerHTML = '';
  const container = document.getElementById('tplMissingItemsContainer').content.firstElementChild.cloneNode(true);
  pillNodes.forEach(p => container.appendChild(p));
  missingItems.appendChild(container);
}
function renderEnEsLeds(word, userItems, { pastAttempt, translationAttempts }) {
  const expectedItems = [...word.translations];
  if (word.past) expectedItems.push(`${PAST_PREFIX} ${word.past}`);
  const pills = [];
  expectedItems.forEach(item => {
    const isPastItem = item.startsWith(PAST_PREFIX);
    const isMatch = isPastItem ? (pastAttempt === word.past) : translationAttempts.includes(item);
    if (isMatch) {
      pills.push(createLedPill(item, 'correct'));
    } else if (isPastItem) {
      pills.push(createLedPill(buildPrefixedHighlightFragment(PAST_PREFIX, word.past, pastAttempt), 'missing'));
    } else {
      pills.push(createLedPill(buildHighlightFragment(item, findBestPartialMatch(item, translationAttempts)), 'missing'));
    }
  });
  userItems.forEach(item => {
    const cleanItem = item.startsWith(PAST_PREFIX) ? item.replace(PAST_PREFIX, '').trim() : item;
    if (word.translations.includes(cleanItem)) return;
    if (word.past && cleanItem === word.past) return;
    pills.push(createLedPill(item, 'incorrect'));
  });
  renderLedPills(pills);
}
function renderImgEnLeds(word, userItems, { expectedItems }) {
  const pills = [];
  expectedItems.forEach(item => pills.push(createLedPill(item, userItems.includes(item) ? 'correct' : 'missing')));
  userItems.filter(item => !expectedItems.includes(item)).forEach(item => pills.push(createLedPill(item, 'incorrect')));
  renderLedPills(pills);
}
function renderEsEnLeds(word, userItems, { wordAttempt, pastAttempt, wordOk, pastOk }) {
  const correctWord = removeAccents(word.word.toLowerCase().trim());
  const expectedItems = [word.word];
  if (word.past) expectedItems.push(`${PAST_PREFIX} ${word.past}`);
  const pills = [];
  expectedItems.forEach(item => {
    const isPast = item.startsWith(PAST_PREFIX);
    const isMatch = isPast ? pastOk : wordOk;
    if (isMatch) {
      pills.push(createLedPill(item, 'correct'));
    } else if (isPast) {
      pills.push(createLedPill(buildPrefixedHighlightFragment(PAST_PREFIX, word.past, pastAttempt), 'missing'));
    } else {
      pills.push(createLedPill(buildHighlightFragment(word.word, wordAttempt), 'missing'));
    }
  });
  userItems.forEach(item => {
    const cleanItem = item.startsWith(PAST_PREFIX) ? item.replace(PAST_PREFIX, '').trim() : item;
    if (cleanItem === correctWord) return;
    if (word.past && cleanItem === word.past) return;
    pills.push(createLedPill(item, 'incorrect'));
  });
  renderLedPills(pills);
}
function renderSentenceLeds(sentence, rawTrans) {
  renderLedPills([
    createLedPill(`Esperado: ${sentence.fill}`, 'missing'),
    createLedPill(`Escribiste: ${rawTrans || 'nada'}`, 'incorrect')
  ]);
}
function renderSentenceTranslationLeds(expectedList, rawInput) {
  const pills = expectedList.map(exp => createLedPill(`Aceptado: ${exp}`, 'missing'));
  pills.push(createLedPill(`Escribiste: ${rawInput || 'nada'}`, 'incorrect'));
  renderLedPills(pills);
}
function applyAnswerResult(allCorrect) {
  if (allCorrect) {
    streak++;
    current.weight = 1;
    syncWeightsWithStorage();
    markCompletedIfCycleActive(current.word);
  } else {
    streak = 0;
    recentlySeen = recentlySeen.filter(w => w !== current.word);
    increaseWordWeight(current);
  }
}
function updateStats() {
  document.getElementById('streakCount').textContent = streak;
}
function launchConfetti() {
  const canvas = document.getElementById('confetti');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const pieces = Array.from({length: 80}, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * -canvas.height * 0.5,
    r: Math.random() * 7 + 4,
    d: Math.random() * 80 + 20,
    color: ['#f5c518','#e94560','#0f9b8e','#fff','#ff6b6b','#a8edea'][Math.floor(Math.random()*6)],
    tilt: Math.random() * 20 - 10,
    tiltAngle: 0,
    tiltSpeed: Math.random() * 0.1 + 0.05
  }));
  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      ctx.beginPath();
      ctx.lineWidth = p.r;
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x + p.tilt + p.r / 4, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 4);
      ctx.stroke();
      p.tiltAngle += p.tiltSpeed;
      p.y += (Math.cos(frame / 30) + 1.5 + p.r / 5);
      p.x += Math.sin(frame / 20) * 1.5;
      p.tilt = Math.sin(p.tiltAngle) * 15;
    });
    frame++;
    if (frame < 200) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  draw();
}
function initUI() {
  document.getElementById('checkBtn').addEventListener('click', checkAnswer);
  document.getElementById('nextBtn').addEventListener('click', nextWord);
  document.getElementById('skipBtn').addEventListener('click', skipWord);
  document.getElementById('openPanelBtn').addEventListener('click', openWeightsPanel);
  document.getElementById('addCurrentToCustomBtn').addEventListener('click', addCurrentToCustomList);
  document.getElementById('hintBtn').addEventListener('click', toggleHint);
  document.getElementById('revealLetterBtn').addEventListener('click', () => {
    revealCount++;
    updateHintText();
  });
  document.getElementById('cycleModeToggle').addEventListener('change', updateStats);
  const customToggle = document.getElementById('customModeToggle');
  customToggle.addEventListener('change', () => {
    if (customToggle.checked && customWords.length === 0) {
      alert('Tu lista personalizada está vacía. Añade elementos desde el panel (⚙️) antes de activar este modo.');
      customToggle.checked = false;
      return;
    }
    applyModeAvailability();
    updateStats();
    nextWord();
  });
  const transInput = document.getElementById('translationInput');
  transInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      checkAnswer();
    }
  });
  transInput.addEventListener('input', () => {
    const toggle = document.getElementById('hideOnWriteToggle');
    document.getElementById('wordDisplay').style.visibility =
      (toggle.checked && transInput.value.length > 0) ? 'hidden' : 'visible';
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const feedback = document.getElementById('feedback');
    const modal = document.getElementById('weightsModal');
    if (feedback.classList.contains('visible') && !modal.classList.contains('active')) {
      e.preventDefault();
      nextWord();
    }
  });
  applyModeAvailability();
}
function updateHintText() {
  if (!current) return;
  let hintText = "";
  let showRevealBtn = false;
  if (currentMode === 'en-es') {
    const maskedTrans = current.rawTranslations.map(t => getMaskedWord(t, revealCount)).join(' ;\u00A0\u00A0\u00A0');
    const maskedPast = current.past ? `\nPasado: ${getMaskedWord(current.rawPast || current.past, revealCount)}` : "";
    hintText = `${maskedTrans}${maskedPast}`;
    showRevealBtn = true;
  } else if (currentMode === 'es-en') {
    const hasPast = !!current.past;
    const maskedWord = getMaskedWord(current.word, revealCount);
    hintText = hasPast
      ? `Palabra: ${maskedWord}\nPasado: ${getMaskedWord(current.rawPast || current.past, revealCount)}`
      : `Palabra: ${maskedWord}`;
    showRevealBtn = true;
  } else if (currentMode === 'img-en') {
    const maskedWord = getMaskedWord(current.word, revealCount);
    const maskedTrans = current.rawTranslations.map(t => getMaskedWord(t, revealCount)).join(', ');
    const maskedPast = current.past ? `\nPasado: ${getMaskedWord(current.rawPast || current.past, revealCount)}` : "";
    hintText = `Inglés: ${maskedWord}${maskedPast}\nEspañol: ${maskedTrans}`;
    showRevealBtn = true;
  }
  const hintTextEl = document.getElementById('hintText');
  const revealBtnEl = document.getElementById('revealLetterBtn');
  if (showRevealBtn) {
    hintTextEl.textContent = hintText;
    hintTextEl.style.display = 'block';
    revealBtnEl.style.display = 'inline-block';
  } else {
    revealBtnEl.style.display = 'none';
  }
}
function toggleHint() {
  const hintBtn = document.getElementById('hintBtn');
  const hintContent = document.getElementById('hintContent');
  const showing = hintContent.style.display !== 'none';
  hintContent.style.display = showing ? 'none' : 'block';
  hintBtn.textContent = showing ? hintBtn.dataset.showLabel : 'Ocultar pista 🙈';
}
function configureHint({ label, image = null, text = null }) {
  const hintBtn = document.getElementById('hintBtn');
  const hintImage = document.getElementById('hintImage');
  const hintText = document.getElementById('hintText');
  hintBtn.dataset.showLabel = label;
  hintBtn.textContent = label;
  if (image) { hintImage.src = image; hintImage.style.display = 'block'; }
  else { hintImage.style.display = 'none'; }
  if (text) { hintText.textContent = text; hintText.style.display = 'block'; }
  else { hintText.style.display = 'none'; }
  document.getElementById('wordHint').style.display = 'block';
}
// ── Sinónimos: muestra la descripción junto a la palabra ─
// para que el usuario pueda diferenciar entre dos entradas
// que comparten traducción (word.synonym === true).
function updateSynonymDesc(word) {
  const el = document.getElementById('wordSynonymDesc');
  if (!el) return;
  if (word && word.synonym === true && word.description) {
    el.textContent = word.description;
    el.style.display = 'block';
  } else {
    el.textContent = '';
    el.style.display = 'none';
  }
}
function resetWordCard() {
  const wordDisplay = document.getElementById('wordDisplay');
  wordDisplay.style.visibility = 'visible';
  wordDisplay.style.display = '';
  wordDisplay.style.fontSize = '';
  document.getElementById('wordImage').style.display = 'none';
  document.getElementById('wordHint').style.display = 'none';
  document.getElementById('hintContent').style.display = 'none';
  updateSynonymDesc(null);
}
function getBaseWordSet() {
  const customToggle = document.getElementById('customModeToggle');
  const isCustomActive = customToggle ? customToggle.checked : false;
  if (isCustomActive) {
    if (useGroupMode && selectedGroups.length > 0) {
      const groups = calculateGroups();
      const activeWords = new Set(groups.filter(g => selectedGroups.includes(g.id)).flatMap(g => g.words));
      return words.filter(w => activeWords.has(w.word));
    }
    return words.filter(w => customWords.includes(w.word));
  }
  return words;
}
function reorderWordsList() {
  if (words.length <= 1) return;
  const countToMove = Math.min(50, words.length);
  const lastFifty = words.slice(-countToMove);
  const remaining = words.slice(0, words.length - countToMove);
  words = [...lastFifty, ...remaining];
}
function rememberRecentWord(word) {
  recentlySeen.push(word);
  const baseSet = getBaseWordSet();
  const dynamicLimit = Math.min(RECENT_LIMIT, Math.floor(baseSet.length * 0.25));
  if (recentlySeen.length > dynamicLimit) recentlySeen.shift();
}
function getReferenceWordCount() {
  const cycleToggle = document.getElementById('cycleModeToggle');
  const isCycleActive = cycleToggle ? cycleToggle.checked : false;
  let baseSet = getBaseWordSet();
  if (baseSet.length === 0) return Math.max(words.length, 1);
  let eligible = [...baseSet];
  if (isCycleActive) {
    eligible = eligible.filter(w => !completedWords.includes(w.word));
    if (eligible.length === 0) eligible = [...baseSet];
  }
  return Math.max(eligible.length, 1);
}
function pickModeFor(word) {
  const weights = getModeWeights();
  const availableModes = [
    { mode: 'en-es', weight: weights['en-es'] },
    { mode: 'es-en', weight: weights['es-en'] }
  ];
  if (word.image) availableModes.push({ mode: 'img-en', weight: weights['img-en'] });
  const totalWeight = availableModes.reduce((sum, m) => sum + m.weight, 0);
  let randomValue = Math.random() * totalWeight;
  let cumulativeSum = 0;
  for (let i = 0; i < availableModes.length; i++) {
    cumulativeSum += availableModes[i].weight;
    if (randomValue <= cumulativeSum) return availableModes[i].mode;
  }
  return availableModes[availableModes.length - 1].mode;
}
// Selección de modo ponderada: "es-en" es, por defecto, más probable que
// "en-es" (peso configurable en el panel de Ajustes). Las imágenes ("img-en")
// siempre comparten el mismo peso que "es-en". Aplica igual a palabras,
// phrasal verbs y oraciones completas (estas últimas nunca tienen imagen).
function getModeWeights() {
  return { 'en-es': 1, 'es-en': esEnWeight, 'img-en': esEnWeight };
}
function applyModeAvailability() {
  const cycleToggle = document.getElementById('cycleModeToggle');
  const cycleLabel = document.getElementById('cycleModeLabel');
  if (!cycleToggle || !cycleLabel) return;
  cycleToggle.disabled = false;
  cycleLabel.classList.remove('disabled');
}
function renderEnEsMode(word) {
  const isSentence = word.type === 'sentence';
  document.getElementById('wordLabel').textContent = isSentence ? '¿Cómo se traduce esta frase?' : '¿Cómo se traduce?';
  document.getElementById('wordDisplay').textContent = word.word;
  updateSynonymDesc(word);
  const hasPast = !!word.past;
  document.getElementById('inputLabel').textContent = isSentence
    ? 'Traducción al español (frase completa)'
    : (hasPast ? 'Traducciones al español y su pasado (separados por coma)' : 'Traducciones al español (separadas por coma)');
  configureHint({ label: 'Ver pista 👁️', image: word.image || null, text: "" });
  updateHintText();
}
function renderEsEnMode(word) {
  const isSentence = word.type === 'sentence';
  document.getElementById('wordLabel').textContent = isSentence ? '¿Cómo se dice esta frase en inglés?' : '¿Cómo se dice en inglés?';
  document.getElementById('wordDisplay').textContent = word.rawTranslations.join(', ');
  document.getElementById('wordDisplay').style.fontSize = '1.3rem';
  updateSynonymDesc(word);
  const hasPast = !!word.past;
  document.getElementById('inputLabel').textContent = isSentence
    ? 'Frase completa en inglés'
    : (hasPast ? 'Palabra en inglés y su pasado (separados por coma)' : 'Palabra en inglés');
  configureHint({ label: 'Ver pista 👁️', text: "", image: word.image || null });
  updateHintText();
}
function renderImgEnMode(word) {
  document.getElementById('wordLabel').textContent = '¿Qué palabra representa esta imagen?';
  document.getElementById('wordDisplay').style.display = 'none';
  updateSynonymDesc(word);
  const wordImage = document.getElementById('wordImage');
  wordImage.src = word.image;
  wordImage.style.display = 'block';
  document.getElementById('inputLabel').textContent = 'Palabra en inglés';
  document.getElementById('translationInput').placeholder = 'Escribe la palabra en inglés y sus traducciones al español';
  configureHint({ label: 'Ver pista 👁️', text: "" });
  updateHintText();
}
function renderSentenceMode(word) {
  document.getElementById('revealLetterBtn').style.display = 'none';
  document.getElementById('wordLabel').textContent = 'Completa el espacio en blanco de la oración';
  const sentence = word.sentences[Math.floor(Math.random() * word.sentences.length)];
  const wordDisplay = document.getElementById('wordDisplay');
  wordDisplay.textContent = sentence.sentence;
  wordDisplay.style.fontSize = '1.25rem';
  document.getElementById('inputLabel').textContent = 'Escribe la palabra que falta';
  document.getElementById('translationInput').placeholder = 'Escribe la respuesta aquí…';
  if (word.image) configureHint({ label: 'Ver imagen 👁️', image: word.image });
  return sentence;
}
function showEmptyListState() {
  document.getElementById('wordDisplay').textContent = '—';
  document.getElementById('wordImage').style.display = 'none';
  document.getElementById('wordHint').style.display = 'none';
  updateSynonymDesc(null);
  const descEl = document.getElementById('feedbackDesc');
  descEl.textContent = 'Tu lista personalizada está vacía. Añade elementos desde el panel (⚙️).';
  descEl.style.display = 'block';
  document.getElementById('inputSection').style.display = 'none';
  document.getElementById('feedback').className = '';
}
function resetFeedbackUI() {
  const feedbackDescEl = document.getElementById('feedbackDesc');
  feedbackDescEl.style.display = 'none';
  feedbackDescEl.textContent = '';
  document.getElementById('feedbackTranslation').style.display = 'none';
  document.getElementById('feedbackTranslationText').textContent = '';
  document.getElementById('translationInput').value = '';
  document.getElementById('inputSection').style.display = '';
  document.getElementById('feedback').className = '';
  document.getElementById('awardWrap').className = 'award-wrap';
  document.getElementById('streakBanner').className = 'streak-banner';
  document.getElementById('missingList').style.display = 'none';
}
function focusTextInput() {
  setTimeout(() => {
    const input = document.getElementById('translationInput');
    if (input) { input.focus(); input.select(); }
  }, 80);
}
function showFeedback(evalResult) {
  const { allCorrect } = evalResult;
  document.getElementById('inputSection').style.display = 'none';
  document.getElementById('feedback').className = 'visible';
  updateAddCurrentToCustomBtn();
  const descEl = document.getElementById('feedbackDesc');
  if (current.description) { descEl.textContent = current.description; descEl.style.display = 'block'; }
  else { descEl.style.display = 'none'; }
  const transEl = document.getElementById('feedbackTranslation');
  const transTextEl = document.getElementById('feedbackTranslationText');
  if (current.type === 'sentence') {
    if (currentMode === 'es-en') {
      transTextEl.innerHTML = `<strong>${current.word}</strong>`;
    } else {
      transTextEl.textContent = current.rawTranslations.join(' / ');
    }
    transEl.style.display = 'block';
  } else if (currentMode === 'img-en') {
    const list = current.rawTranslations || current.translations;
    let html = `<strong>${current.word}</strong>: ${list.join(', ')}`;
    if (current.past) html += ` <span style="color: var(--muted); font-size: 0.8rem; margin-left: 5px;">(Pasado: ${current.rawPast || current.past})</span>`;
    transTextEl.innerHTML = html;
    transEl.style.display = 'block';
  } else if (currentMode === 'es-en') {
    let html = `<strong>${current.word}</strong>`;
    if (current.past) html += ` — Pasado: <strong>${current.rawPast || current.past}</strong>`;
    transTextEl.innerHTML = html;
    transEl.style.display = 'block';
  } else {
    transEl.style.display = 'none';
  }
  const title = document.getElementById('feedbackTitle');
  if (allCorrect) {
    title.textContent = '¡Correcto!';
    title.className = 'feedback-title correct';
    document.getElementById('awardWrap').className = 'award-wrap show';
    document.getElementById('awardText').textContent = '¡Respuesta perfecta!';
    launchConfetti();
    if (streak >= 3) {
      document.getElementById('streakBanner').className = 'streak-banner show';
      document.getElementById('streakNum').textContent = streak;
    }
  } else {
    const isBaseOk = (currentMode === 'en-es' && evalResult.transOk) || (currentMode === 'img-en' && evalResult.wordOk);
    title.textContent = isBaseOk ? 'Casi… faltó el pasado' : 'Revisa tus respuestas';
    title.className = 'feedback-title wrong';
    const wordCard = document.getElementById('wordCard');
    wordCard.classList.add('shake');
    setTimeout(() => wordCard.classList.remove('shake'), 450);
  }
}
function skipWord() {
  streak = 0;
  updateStats();
  nextWord();
}
function createLedPill(content, statusClass) {
  const node = document.getElementById('tplLedPill').content.firstElementChild.cloneNode(true);
  node.classList.add(statusClass);
  if (typeof content === 'string') node.textContent = content;
  else node.appendChild(content);
  return node;
}
function buildHighlightFragment(expected, user) {
  const frag = document.createDocumentFragment();
  if (!user) { frag.appendChild(document.createTextNode(expected)); return frag; }
  for (let i = 0; i < expected.length; i++) {
    if (i < user.length && expected[i] === user[i]) {
      const b = document.createElement('b');
      b.style.cssText = 'color: var(--correct); font-weight: bold;';
      b.textContent = expected[i];
      frag.appendChild(b);
    } else {
      const span = document.createElement('span');
      span.style.opacity = '0.5';
      span.textContent = expected[i];
      frag.appendChild(span);
    }
  }
  return frag;
}
function buildPrefixedHighlightFragment(prefix, expected, user) {
  const frag = document.createDocumentFragment();
  frag.appendChild(document.createTextNode(prefix + ' '));
  frag.appendChild(buildHighlightFragment(expected, user));
  return frag;
}
function markCompletedIfCycleActive(word) {
  const cycleToggle = document.getElementById('cycleModeToggle');
  if (cycleToggle.checked && !completedWords.includes(word)) {
    completedWords.push(word);
    saveCompletedWords();
  }
}
function increaseWordWeight(word) {
  const referenceWordsCount = getReferenceWordCount();
  const referenceOthers = Math.max(referenceWordsCount - 1, 1);
  if (!word.weight || word.weight <= 1) {
    const targetProbability = 0.20;
    word.weight = Math.ceil((targetProbability * referenceOthers) / (1 - targetProbability));
  } else {
    word.weight += Math.ceil(referenceWordsCount * 0.15);
  }
  syncWeightsWithStorage();
}
function updateAddCurrentToCustomBtn() {
  const btn = document.getElementById('addCurrentToCustomBtn');
  if (!btn || !current) return;
  if (customWords.includes(current.word)) {
    btn.textContent = '➖ Quitar de mi lista';
    btn.style.background = 'rgba(231, 76, 60, 0.15)';
    btn.style.color = 'var(--wrong)';
    btn.style.borderColor = 'rgba(231, 76, 60, 0.3)';
  } else {
    btn.textContent = '➕ Añadir a mi lista';
    btn.style.background = '';
    btn.style.color = '';
    btn.style.borderColor = '';
  }
  btn.disabled = false;
  btn.style.opacity = '1';
}
function addCurrentToCustomList() {
  if (!current) return;
  if (customWords.includes(current.word)) {
    customWords = customWords.filter(w => w !== current.word);
    saveCustomWords();
    const customToggle = document.getElementById('customModeToggle');
    if (customToggle && customToggle.checked && customWords.length === 0) {
      customToggle.checked = false;
      applyModeAvailability();
      updateStats();
      nextWord();
      return;
    }
  } else {
    customWords.push(current.word);
    saveCustomWords();
  }
  updateAddCurrentToCustomBtn();
}