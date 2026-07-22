async function fetchGitHubFile(url, headers) {
  let res;
  try {
    res = await fetch(url, { headers });
  } catch (networkErr) {
    throw new Error(`No se pudo conectar con GitHub (${url}). Revisa tu conexión de red. Detalle: ${networkErr.message}`);
  }
  if (!res.ok) {
    let bodyText = '';
    try { bodyText = await res.text(); } catch (_) {}
    let apiMsg = '';
    try { apiMsg = bodyText ? JSON.parse(bodyText).message : ''; } catch (_) {}
    throw new Error(`No se pudo verificar la versión en el servidor (${url}). Código: ${res.status}${apiMsg ? ' — ' + apiMsg : ''}`);
  }
  let fileData;
  try {
    fileData = await res.json();
  } catch (parseErr) {
    throw new Error(`Respuesta de GitHub no es JSON válido al leer ${url}.`);
  }

  let base64Content = fileData.content;

  // Contents API omits content for files > 1MB (encoding: "none", content: "").
  // Fall back to the Git Blobs API, which supports files up to 100MB.
  if (!base64Content || fileData.encoding === 'none') {
    if (!fileData.git_url) {
      throw new Error(`El archivo ${url} supera 1MB y GitHub no devolvió una URL de blob para leerlo (git_url ausente).`);
    }
    let blobRes;
    try {
      blobRes = await fetch(fileData.git_url, { headers });
    } catch (networkErr) {
      throw new Error(`No se pudo conectar con GitHub para leer el blob de ${url}. Detalle: ${networkErr.message}`);
    }
    if (!blobRes.ok) {
      throw new Error(`No se pudo obtener el contenido completo de ${url} vía blob API. Código: ${blobRes.status}`);
    }
    let blobData;
    try {
      blobData = await blobRes.json();
    } catch (parseErr) {
      throw new Error(`Respuesta de blob API no es JSON válido para ${url}.`);
    }
    if (!blobData || typeof blobData.content !== 'string' || !blobData.content) {
      throw new Error(`La blob API no devolvió contenido para ${url} (¿archivo vacío o demasiado grande incluso para blobs, >100MB?).`);
    }
    base64Content = blobData.content;
  }

  let parsed;
  try {
    const rawBytes = Uint8Array.from(atob(base64Content.replace(/\n/g, '')), c => c.charCodeAt(0));
    parsed = JSON.parse(new TextDecoder().decode(rawBytes));
  } catch (decodeErr) {
    throw new Error(`El contenido de ${url} en GitHub no es un JSON válido (archivo corrupto o mal formado en el repositorio). Detalle: ${decodeErr.message}`);
  }
  return { sha: fileData.sha, data: parsed };
}
async function fetchGitHubFileOptional(url, headers) {
  let res;
  try {
    res = await fetch(url, { headers });
  } catch (networkErr) {
    throw new Error(`No se pudo conectar con GitHub (${url}). Revisa tu conexión de red. Detalle: ${networkErr.message}`);
  }
  if (res.status === 404) {
    return { sha: null, data: [] };
  }
  return fetchGitHubFile(url, headers);
}
async function createGitHubBlob(apiBase, headers, base64Content) {
  const res = await fetch(`${apiBase}/git/blobs`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: base64Content, encoding: 'base64' })
  });
  if (!res.ok) throw new Error(`Error creando blob (código ${res.status}).`);
  return (await res.json()).sha;
}
async function createGitHubTree(apiBase, headers, baseTreeSha, entries) {
  const res = await fetch(`${apiBase}/git/trees`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_tree: baseTreeSha, tree: entries })
  });
  if (!res.ok) throw new Error(`Error creando árbol (código ${res.status}).`);
  return (await res.json()).sha;
}
async function createGitHubCommit(apiBase, headers, message, treeSha, parentSha) {
  const res = await fetch(`${apiBase}/git/commits`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] })
  });
  if (!res.ok) throw new Error(`Error creando commit (código ${res.status}).`);
  return (await res.json()).sha;
}
async function updateGitHubRef(apiBase, headers, branch, commitSha) {
  const res = await fetch(`${apiBase}/git/refs/heads/${branch}`, {
    method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: commitSha })
  });
  if (!res.ok) throw new Error(`Error actualizando referencia (código ${res.status}).`);
}
function buildExportEntry(localWord, serverEntry, keyName, termValue, syncCustomList) {
  const base = localWord ? toCleanBaseItem(localWord) : { ...serverEntry };
  base[keyName] = termValue;
  if (syncCustomList) {
    if (customWords.includes(termValue)) {
      base.custom_list = true;
      base.group = getWordGroup(termValue);
    } else {
      delete base.custom_list;
      delete base.group;
    }
  } else {
    if (serverEntry && serverEntry.custom_list !== undefined) base.custom_list = serverEntry.custom_list;
    if (serverEntry && serverEntry.group !== undefined) base.group = serverEntry.group;
  }
  return base;
}
function buildExportDataset(serverList, localList, keyName, syncCustomList) {
  const localMap = {};
  localList.forEach(w => { localMap[w.word] = w; });
  const serverTerms = new Set(serverList.map(sw => sw[keyName]));
  const exportData = serverList.map(sw => buildExportEntry(localMap[sw[keyName]] || null, sw, keyName, sw[keyName], syncCustomList));
  localList.filter(w => !serverTerms.has(w.word)).forEach(w => {
    exportData.push(buildExportEntry(w, null, keyName, w.word, syncCustomList));
  });
  return exportData;
}
async function pushToGitHub() {
  const token = document.getElementById('githubToken').value.trim();
  const owner = document.getElementById('githubUser').value.trim();
  const repo = document.getElementById('githubRepo').value.trim();
  if (!token || !owner || !repo) {
    alert('Debe rellenar el Token, Usuario y Repositorio para subir cambios.');
    return;
  }
  const syncCustomList = confirm(
    '¿Deseas sincronizar tu lista personalizada local con el servidor?\n\n' +
    'Pulsa "Aceptar" para enviar tu lista local.\n' +
    'Pulsa "Cancelar" para conservar los valores custom_list y group del servidor sin cambios.'
  );
  const btn = document.getElementById('pushToGithubBtn');
  const originalText = btn.textContent;
  btn.textContent = 'Subiendo... ⏳';
  btn.disabled = true;
  let stage = 'inicio';
  try {
    const headers = { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' };
    const apiBase = `https://api.github.com/repos/${owner}/${repo}`;
    const wordsUrl = `${apiBase}/contents/words.json`;
    const phrasalsUrl = `${apiBase}/contents/phrasal_verbs.json`;
    const sentencesUrl = `${apiBase}/contents/sentences.json`;
    const localWordsOnly = words.filter(w => w.type === 'word');
    const localPhrasalsOnly = words.filter(w => w.type === 'phrasal_verb');
    const localSentencesOnly = words.filter(w => w.type === 'sentence');

    stage = 'leyendo words.json remoto';
    const { data: serverWords } = await fetchGitHubFile(wordsUrl, headers);
    stage = 'leyendo phrasal_verbs.json remoto';
    const { data: serverPhrasals } = await fetchGitHubFile(phrasalsUrl, headers);
    stage = 'leyendo sentences.json remoto';
    const { data: serverSentences } = await fetchGitHubFileOptional(sentencesUrl, headers);

    stage = 'preparando datos a subir';
    const wordsExport = buildExportDataset(serverWords, localWordsOnly, 'word', syncCustomList);
    const phrasalsExport = buildExportDataset(serverPhrasals, localPhrasalsOnly, 'phrasal_verb', syncCustomList);
    const sentencesExport = buildExportDataset(serverSentences, localSentencesOnly, 'sentence', syncCustomList);

    stage = 'obteniendo rama por defecto';
    const repoRes = await fetch(apiBase, { headers });
    if (!repoRes.ok) throw new Error(`No se pudo leer el repositorio (código ${repoRes.status}).`);
    const branch = (await repoRes.json()).default_branch;

    stage = 'obteniendo referencia de la rama';
    const refRes = await fetch(`${apiBase}/git/ref/heads/${branch}`, { headers });
    if (!refRes.ok) throw new Error(`No se pudo obtener la referencia de "${branch}" (código ${refRes.status}).`);
    const latestCommitSha = (await refRes.json()).object.sha;

    stage = 'obteniendo árbol base';
    const baseCommitRes = await fetch(`${apiBase}/git/commits/${latestCommitSha}`, { headers });
    if (!baseCommitRes.ok) throw new Error(`No se pudo leer el commit base (código ${baseCommitRes.status}).`);
    const baseTreeSha = (await baseCommitRes.json()).tree.sha;

    stage = 'creando blobs';
    const [wordsBlobSha, phrasalsBlobSha, sentencesBlobSha] = await Promise.all([
      createGitHubBlob(apiBase, headers, toBase64(JSON.stringify(wordsExport, null, 1))),
      createGitHubBlob(apiBase, headers, toBase64(JSON.stringify(phrasalsExport, null, 1))),
      createGitHubBlob(apiBase, headers, toBase64(JSON.stringify(sentencesExport, null, 1)))
    ]);

    stage = 'creando árbol nuevo';
    const newTreeSha = await createGitHubTree(apiBase, headers, baseTreeSha, [
      { path: 'words.json', mode: '100644', type: 'blob', sha: wordsBlobSha },
      { path: 'phrasal_verbs.json', mode: '100644', type: 'blob', sha: phrasalsBlobSha },
      { path: 'sentences.json', mode: '100644', type: 'blob', sha: sentencesBlobSha }
    ]);

    stage = 'creando commit';
    const newCommitSha = await createGitHubCommit(apiBase, headers,
      'Sync words.json, phrasal_verbs.json, sentences.json', newTreeSha, latestCommitSha);

    stage = 'actualizando referencia de la rama';
    await updateGitHubRef(apiBase, headers, branch, newCommitSha);

    alert('¡Cambios guardados en GitHub en un único commit!');
  } catch (error) {
    console.error(`Fallo en etapa "${stage}":`, error);
    alert(`Error al exportar cambios (etapa: ${stage}):\n${error.message}`);
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}
