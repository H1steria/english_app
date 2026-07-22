async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} al obtener ${url}`);
  return response.json();
}
function safeStr(v) {
  return (typeof v === 'string') ? v : '';
}
function removeAccents(text) {
  if (!text) return "";
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function getMaskedWord(wordStr, currentReveal = 0) {
  const clean = safeStr(wordStr).trim();
  if (!clean) return "";
  if (clean.includes(',')) {
    return clean.split(',').map(part => getMaskedWord(part, currentReveal)).join(',\u00A0\u00A0');
  }
  if (clean.includes('/')) {
    return clean.split('/').map(part => getMaskedWord(part, currentReveal)).join('\u00A0/\u00A0');
  }
  let letterCounter = 0;
  const characters = clean.split('');
  const processedChars = characters.map((char) => {
    if (char === ' ') return '\u00A0\u00A0\u00A0';
    if (/[\s.()\-?!]/.test(char)) return char;
    const shouldReveal = (letterCounter === 0 || letterCounter <= currentReveal);
    letterCounter++;
    return shouldReveal ? char : '_';
  });
  return processedChars.join('\u00A0');
}
function parseInput(raw) {
  return removeAccents(safeStr(raw).toLowerCase().trim()).split(',').map(s => s.trim()).filter(Boolean);
}
function getPrefixScore(expected, user) {
  let score = 0;
  for (let i = 0; i < Math.min(expected.length, user.length); i++) {
    if (expected[i] === user[i]) score++; else break;
  }
  return score;
}
function findBestPartialMatch(expected, userItems) {
  let bestMatch = "";
  let maxScore = 0;
  userItems.forEach(user => {
    const score = getPrefixScore(expected, user);
    if (score > maxScore) { maxScore = score; bestMatch = user; }
  });
  return bestMatch;
}
function resolveWordAndPast(correctWord, correctPast, userItems) {
  let remainingItems = [];
  let pastAttempt = '';
  userItems.forEach(item => {
    if (item.startsWith(PAST_PREFIX)) pastAttempt = item.replace(PAST_PREFIX, '').trim();
    else remainingItems.push(item);
  });
  let wordAttempt = '';
  if (correctPast && correctWord === correctPast && pastAttempt === '') {
    wordAttempt = remainingItems[0] || '';
    pastAttempt = remainingItems[0] || '';
    return { wordAttempt, pastAttempt };
  }
  if (correctPast && pastAttempt === '') {
    let bestWordScore = -1, bestPastScore = -1, bestWordIdx = -1, bestPastIdx = -1;
    remainingItems.forEach((item, idx) => {
      const scoreWord = getPrefixScore(correctWord, item) + (item === correctWord ? 1000 : 0);
      const scorePast = getPrefixScore(correctPast, item) + (item === correctPast ? 1000 : 0);
      if (scoreWord > bestWordScore) { bestWordScore = scoreWord; bestWordIdx = idx; }
      if (scorePast > bestPastScore) { bestPastScore = scorePast; bestPastIdx = idx; }
    });
    if (bestWordIdx !== -1 && bestWordIdx === bestPastIdx) {
      if (remainingItems[bestWordIdx] === correctWord) wordAttempt = remainingItems[bestWordIdx];
      else if (remainingItems[bestWordIdx] === correctPast) pastAttempt = remainingItems[bestWordIdx];
      else wordAttempt = remainingItems[bestWordIdx];
    } else {
      if (bestWordIdx !== -1) wordAttempt = remainingItems[bestWordIdx];
      if (bestPastIdx !== -1 && bestPastIdx !== bestWordIdx) pastAttempt = remainingItems[bestPastIdx];
    }
  } else {
    wordAttempt = remainingItems[0] || '';
  }
  return { wordAttempt, pastAttempt };
}
function normalizeSentenceAnswer(s) {
  return removeAccents(safeStr(s).toLowerCase().trim())
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?¡¿]+$/g, '');
}
function toBase64(jsonString) {
  const utf8Bytes = new TextEncoder().encode(jsonString);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < utf8Bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...utf8Bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}