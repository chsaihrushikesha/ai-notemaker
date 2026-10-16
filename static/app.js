/* ==========================================================================
   AI NoteMaker - Interactive Client Application Logic
   ========================================================================== */

// Application State
const state = {
  currentMode: 'upload',      // 'upload' or 'paste'
  selectedFile: null,
  sessionId: null,
  studyPack: null,
  concepts: [],
  revisionItems: [],
  masteredIds: new Set(),
  activeTab: 'summary',
  isAnalyzing: false,
};

// Sample Notes Content
const SAMPLE_NOTES = `Introduction to Machine Learning

Machine learning is a branch of artificial intelligence in which systems learn patterns from data instead of being explicitly programmed. A model is trained on examples and then used to make predictions on new, unseen data.

Supervised learning uses labelled data. Each training example has an input and a correct output, and the algorithm learns a mapping between them. Classification predicts discrete categories such as spam or not spam, while regression predicts continuous values such as house prices.

Unsupervised learning works with unlabelled data. Clustering groups similar items together, and dimensionality reduction compresses data into fewer features while preserving structure. Principal component analysis is a common dimensionality reduction technique.

Overfitting happens when a model memorises the training data and performs poorly on new data. Techniques to reduce overfitting include regularisation, cross-validation, early stopping and collecting more training data. Underfitting is the opposite problem, where the model is too simple to capture the underlying pattern.

Model performance is evaluated on a held-out test set. Accuracy measures the fraction of correct predictions, precision measures how many predicted positives are truly positive, and recall measures how many actual positives were found. The F1 score is the harmonic mean of precision and recall.

Neural networks consist of layers of connected neurons. Each neuron computes a weighted sum of its inputs and applies an activation function such as ReLU. Training uses gradient descent and backpropagation to adjust the weights so that a loss function is minimised.`;

// DOM Element References
const elements = {
  tabUploadBtn: document.getElementById('tabUploadBtn'),
  tabPasteBtn: document.getElementById('tabPasteBtn'),
  modeUpload: document.getElementById('modeUpload'),
  modePaste: document.getElementById('modePaste'),
  dropzone: document.getElementById('dropzone'),
  fileInput: document.getElementById('fileInput'),
  fileCard: document.getElementById('fileCard'),
  fileName: document.getElementById('fileName'),
  fileMeta: document.getElementById('fileMeta'),
  fileRemoveBtn: document.getElementById('fileRemoveBtn'),
  pasteInput: document.getElementById('pasteInput'),
  pasteStats: document.getElementById('pasteStats'),
  clearPasteBtn: document.getElementById('clearPasteBtn'),
  analyzeBtn: document.getElementById('analyzeBtn'),
  btnText: document.getElementById('btnText'),
  stepperCard: document.getElementById('stepperCard'),
  quickSampleBtn: document.getElementById('quickSampleBtn'),
  emptySampleBtn: document.getElementById('emptySampleBtn'),
  emptyState: document.getElementById('emptyState'),
  studyHub: document.getElementById('studyHub'),
  metricWords: document.getElementById('metricWords'),
  metricConcepts: document.getElementById('metricConcepts'),
  metricQuestions: document.getElementById('metricQuestions'),
  metricMode: document.getElementById('metricMode'),
  conceptsCountBadge: document.getElementById('conceptsCountBadge'),
  revisionCountBadge: document.getElementById('revisionCountBadge'),
  summaryContent: document.getElementById('summaryContent'),
  conceptsGrid: document.getElementById('conceptsGrid'),
  conceptSearch: document.getElementById('conceptSearch'),
  conceptCounter: document.getElementById('conceptCounter'),
  revisionList: document.getElementById('revisionList'),
  masteryFill: document.getElementById('masteryFill'),
  masteryText: document.getElementById('masteryText'),
  revealAllBtn: document.getElementById('revealAllBtn'),
  copySummaryBtn: document.getElementById('copySummaryBtn'),
  chatMessages: document.getElementById('chatMessages'),
  chatInput: document.getElementById('chatInput'),
  chatSendBtn: document.getElementById('chatSendBtn'),
  quickPrompts: document.getElementById('quickPrompts'),
  aboutBtn: document.getElementById('aboutBtn'),
  aboutModal: document.getElementById('aboutModal'),
  aboutCloseBtn: document.getElementById('aboutCloseBtn'),
  openPptBtn: document.getElementById('openPptBtn'),
  conceptDetailsModal: document.getElementById('conceptDetailsModal'),
  conceptModalCloseBtn: document.getElementById('conceptModalCloseBtn'),
  conceptModalTerm: document.getElementById('conceptModalTerm'),
  conceptModalDef: document.getElementById('conceptModalDef'),
  conceptModalPoints: document.getElementById('conceptModalPoints'),
  citationModal: document.getElementById('citationModal'),
  modalCitationBadge: document.getElementById('modalCitationBadge'),
  modalCitationScore: document.getElementById('modalCitationScore'),
  modalPassageText: document.getElementById('modalPassageText'),
  modalCloseBtn: document.getElementById('modalCloseBtn'),
  toast: document.getElementById('toast'),
  toastMsg: document.getElementById('toastMsg'),
  modelName: document.getElementById('modelName'),
  appLayout: document.getElementById('appLayout'),
  inputPanel: document.getElementById('inputPanel'),
  outputPanel: document.getElementById('outputPanel'),
  resetDeckBtn: document.getElementById('resetDeckBtn'),
  askMoreRevisionBtn: document.getElementById('askMoreRevisionBtn'),
  askMoreBtnText: document.getElementById('askMoreBtnText'),
  askMoreSpinner: document.getElementById('askMoreSpinner'),
  examCornerBadge: document.getElementById('examCornerBadge'),
  examTopicHeader: document.getElementById('examTopicHeader'),
  examPct: document.getElementById('examPct'),
  examFraction: document.getElementById('examFraction'),
  examBarFill: document.getElementById('examBarFill'),
  resetExamBtn: document.getElementById('resetExamBtn'),
  examList: document.getElementById('examList'),
  customExamInput: document.getElementById('customExamInput'),
  addCustomExamBtn: document.getElementById('addCustomExamBtn'),
};

// ==========================================================================
// Initialization & Health Check
// ==========================================================================

async function init() {
  bindEvents();
  await checkHealth();
}

async function checkHealth() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    if (elements.modelName) {
      elements.modelName.textContent = data.mode === 'llm' ? 'gpt-4.1-nano' : 'Offline Fallback';
    }
  } catch (err) {
    if (elements.modelName) {
      elements.modelName.textContent = 'Offline';
    }
  }
}

// ==========================================================================
// Event Binding
// ==========================================================================

function bindEvents() {
  // Mode tabs
  elements.tabUploadBtn.addEventListener('click', () => switchInputMode('upload'));
  elements.tabPasteBtn.addEventListener('click', () => switchInputMode('paste'));

  // Dropzone file handling
  elements.dropzone.addEventListener('click', () => elements.fileInput.click());
  elements.dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.dropzone.classList.add('dragover');
  });
  elements.dropzone.addEventListener('dragleave', () => elements.dropzone.classList.remove('dragover'));
  elements.dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      handleSelectedFile(e.dataTransfer.files[0]);
    }
  });
  elements.fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
      handleSelectedFile(e.target.files[0]);
    }
  });
  elements.fileRemoveBtn.addEventListener('click', clearSelectedFile);

  // Paste handling
  elements.pasteInput.addEventListener('input', updatePasteStats);
  elements.clearPasteBtn.addEventListener('click', () => {
    elements.pasteInput.value = '';
    updatePasteStats();
  });

  // Sample Loader (from Empty State)
  if (elements.emptySampleBtn) {
    elements.emptySampleBtn.addEventListener('click', loadSampleNotes);
  }

  // About Project Modal & PPT Opener
  if (elements.aboutBtn) {
    elements.aboutBtn.addEventListener('click', () => {
      elements.aboutModal.classList.remove('hidden');
    });
  }
  if (elements.aboutCloseBtn) {
    elements.aboutCloseBtn.addEventListener('click', () => {
      elements.aboutModal.classList.add('hidden');
    });
  }
  if (elements.aboutModal) {
    elements.aboutModal.addEventListener('click', (e) => {
      if (e.target === elements.aboutModal) elements.aboutModal.classList.add('hidden');
    });
  }
  if (elements.openPptBtn) {
    elements.openPptBtn.addEventListener('click', () => {
      showToast('Opening Architecture Presentation...');
      window.open('/api/view-architecture', '_blank');
      fetch('/api/open-architecture').catch(() => { });
    });
  }

  // Concept Modal Close
  if (elements.conceptModalCloseBtn) {
    elements.conceptModalCloseBtn.addEventListener('click', () => {
      elements.conceptDetailsModal.classList.add('hidden');
    });
  }
  if (elements.conceptDetailsModal) {
    elements.conceptDetailsModal.addEventListener('click', (e) => {
      if (e.target === elements.conceptDetailsModal) elements.conceptDetailsModal.classList.add('hidden');
    });
  }

  // Analysis submission
  elements.analyzeBtn.addEventListener('click', handleAnalyze);

  // Hub tabs
  document.querySelectorAll('.hub-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchHubTab(btn.dataset.tab));
  });

  // Concept Search
  elements.conceptSearch.addEventListener('input', (e) => filterConcepts(e.target.value));

  // Revision Actions
  elements.revealAllBtn.addEventListener('click', toggleRevealAll);

  // Ask More Revision Questions
  if (elements.askMoreRevisionBtn) {
    elements.askMoreRevisionBtn.addEventListener('click', handleAskMoreRevision);
  }

  // Exam Corner Listeners
  if (elements.resetExamBtn) {
    elements.resetExamBtn.addEventListener('click', resetExamChecklist);
  }
  if (elements.addCustomExamBtn) {
    elements.addCustomExamBtn.addEventListener('click', addCustomExamItem);
  }
  if (elements.customExamInput) {
    elements.customExamInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addCustomExamItem();
    });
  }

  // Copy Summary
  if (elements.copySummaryBtn) {
    elements.copySummaryBtn.addEventListener('click', copySummary);
  }

  // Reset to Centered Deck
  if (elements.resetDeckBtn) {
    elements.resetDeckBtn.addEventListener('click', resetToCenterLayout);
  }

  // Chat
  elements.chatSendBtn.addEventListener('click', handleChatSubmit);
  elements.chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleChatSubmit();
  });
  if (elements.clearChatBtn) {
    elements.clearChatBtn.addEventListener('click', clearChat);
  }

  // Quick Prompt Chips
  elements.quickPrompts.addEventListener('click', (e) => {
    const chip = e.target.closest('.prompt-chip');
    if (chip) {
      elements.chatInput.value = chip.dataset.q;
      handleChatSubmit();
    }
  });

  // Modal Close
  if (elements.modalCloseBtn) {
    elements.modalCloseBtn.addEventListener('click', () => elements.citationModal.classList.add('hidden'));
  }
  if (elements.citationModal) {
    elements.citationModal.addEventListener('click', (e) => {
      if (e.target === elements.citationModal) {
        elements.citationModal.classList.add('hidden');
      }
    });
  }
}

// ==========================================================================
// Mode & File Switching
// ==========================================================================

function switchInputMode(mode) {
  state.currentMode = mode;
  if (mode === 'upload') {
    elements.tabUploadBtn.classList.add('active');
    elements.tabPasteBtn.classList.remove('active');
    elements.modeUpload.classList.remove('hidden');
    elements.modePaste.classList.add('hidden');
  } else {
    elements.tabPasteBtn.classList.add('active');
    elements.tabUploadBtn.classList.remove('active');
    elements.modePaste.classList.remove('hidden');
    elements.modeUpload.classList.add('hidden');
  }
}

function handleSelectedFile(file) {
  const validExtensions = ['.pdf', '.docx', '.txt', '.md'];
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!validExtensions.includes(ext)) {
    showToast('Unsupported file type. Please upload PDF, DOCX, TXT, or MD.');
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    showToast('File exceeds 15 MB limit.');
    return;
  }
  state.selectedFile = file;
  elements.fileName.textContent = file.name;
  elements.fileMeta.textContent = `${(file.size / 1024).toFixed(1)} KB • Ready to analyze`;
  elements.fileCard.classList.remove('hidden');
  elements.dropzone.classList.add('hidden');
}

function clearSelectedFile(e) {
  if (e) e.stopPropagation();
  state.selectedFile = null;
  elements.fileInput.value = '';
  elements.fileCard.classList.add('hidden');
  elements.dropzone.classList.remove('hidden');
}

function updatePasteStats() {
  const text = elements.pasteInput.value.trim();
  const words = text ? text.split(/\s+/).length : 0;
  elements.pasteStats.textContent = `${words} words • ${text.length} chars`;
}

function loadSampleNotes() {
  switchInputMode('paste');
  elements.pasteInput.value = SAMPLE_NOTES;
  updatePasteStats();
  showToast('Sample Machine Learning notes loaded!');
  elements.pasteInput.scrollIntoView({ behavior: 'smooth' });
}

// ==========================================================================
// Analysis Execution & Stepper
// ==========================================================================

async function handleAnalyze() {
  if (state.isAnalyzing) return;

  const length = document.querySelector('input[name="summaryLength"]:checked').value;

  // Validation
  if (state.currentMode === 'upload' && !state.selectedFile) {
    showToast('Please select or drop a lecture document first.');
    return;
  }
  if (state.currentMode === 'paste') {
    const text = elements.pasteInput.value.trim();
    if (text.split(/\s+/).length < 20) {
      showToast('Please provide at least 20 words of lecture notes.');
      return;
    }
  }

  // Start Analysis UI
  state.isAnalyzing = true;
  elements.analyzeBtn.disabled = true;
  elements.btnText.textContent = 'Analyzing with Nexus AI...';
  elements.stepperCard.classList.remove('hidden');
  resetStepper();

  // Progress animation
  advanceStep(1);
  const stepInterval = setInterval(() => {
    const active = document.querySelector('.step-item.active');
    if (active) {
      const stepNum = parseInt(active.id.replace('step', ''));
      if (stepNum < 5) advanceStep(stepNum + 1);
    }
  }, 3200);

  try {
    let result;
    if (state.currentMode === 'upload') {
      const formData = new FormData();
      formData.append('file', state.selectedFile);
      formData.append('length', length);
      const res = await fetch('/api/analyze/file', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Analysis request failed.');
      }
      result = await res.json();
    } else {
      const res = await fetch('/api/analyze/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: elements.pasteInput.value.trim(),
          length: length,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Analysis request failed.');
      }
      result = await res.json();
    }

    clearInterval(stepInterval);
    for (let i = 1; i <= 5; i++) completeStep(i);

    state.sessionId = result.session_id;
    state.studyPack = result;
    state.concepts = result.key_concepts || [];
    state.revisionItems = result.revision_questions || [];
    state.masteredIds.clear();

    renderStudyHub();
    showToast('Study pack generated successfully!');
  } catch (err) {
    clearInterval(stepInterval);
    showToast(err.message || 'An error occurred during analysis.');
  } finally {
    state.isAnalyzing = false;
    elements.analyzeBtn.disabled = false;
    elements.btnText.textContent = 'Analyse & Generate Study Pack';
    setTimeout(() => {
      elements.stepperCard.classList.add('hidden');
    }, 1200);
  }
}

function resetStepper() {
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById(`step${i}`);
    el.className = 'step-item';
  }
}

function advanceStep(num) {
  for (let i = 1; i < num; i++) {
    completeStep(i);
  }
  const current = document.getElementById(`step${num}`);
  if (current) current.className = 'step-item active';
}

function completeStep(num) {
  const el = document.getElementById(`step${num}`);
  if (el) el.className = 'step-item done';
}

// ==========================================================================
// Layout Transition Animations (FLIP: Center to Left)
// ==========================================================================

function transitionToSplitLayout() {
  const inputPanel = elements.inputPanel || document.getElementById('inputPanel');
  const outputPanel = elements.outputPanel || document.getElementById('outputPanel');
  const appLayout = elements.appLayout || document.getElementById('appLayout');

  if (!appLayout || !appLayout.classList.contains('initial-centered')) return;

  // 1. FIRST: Get centered position
  const firstRect = inputPanel.getBoundingClientRect();

  // 2. LAST: Switch layout classes to split grid and unhide output panel
  appLayout.classList.remove('initial-centered');
  appLayout.classList.add('has-results');
  if (outputPanel) {
    outputPanel.classList.remove('hidden');
    outputPanel.style.display = '';
  }

  // Force reflow to compute new left sidebar geometry
  const lastRect = inputPanel.getBoundingClientRect();

  // 3. INVERT: Calculate delta so card visually starts in center
  const deltaX = firstRect.left - lastRect.left;
  const deltaY = firstRect.top - lastRect.top;
  const scaleX = firstRect.width / (lastRect.width || 1);

  inputPanel.style.transformOrigin = 'top left';
  inputPanel.style.transition = 'none';
  inputPanel.style.transform = `translate(${deltaX}px, ${deltaY}px) scaleX(${scaleX})`;

  if (outputPanel) {
    outputPanel.style.opacity = '0';
    outputPanel.style.transform = 'translateX(40px)';
    outputPanel.style.transition = 'none';
  }

  // Force reflow
  inputPanel.offsetHeight;

  // 4. PLAY: Smoothly glide left to sidebar position
  inputPanel.style.transition = 'transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)';
  inputPanel.style.transform = 'translate(0, 0) scaleX(1)';

  if (outputPanel) {
    outputPanel.style.transition = 'opacity 0.65s cubic-bezier(0.16, 1, 0.3, 1) 0.15s, transform 0.65s cubic-bezier(0.16, 1, 0.3, 1) 0.15s';
    outputPanel.style.opacity = '1';
    outputPanel.style.transform = 'translateX(0)';
  }

  // Clean up inline styles once transition completes
  setTimeout(() => {
    inputPanel.style.transition = '';
    inputPanel.style.transform = '';
    inputPanel.style.transformOrigin = '';
    if (outputPanel) {
      outputPanel.style.transition = '';
      outputPanel.style.transform = '';
      outputPanel.style.opacity = '';
    }
  }, 750);
}

function resetToCenterLayout() {
  const inputPanel = elements.inputPanel || document.getElementById('inputPanel');
  const outputPanel = elements.outputPanel || document.getElementById('outputPanel');
  const appLayout = elements.appLayout || document.getElementById('appLayout');

  if (!appLayout || appLayout.classList.contains('initial-centered')) return;

  const firstRect = inputPanel.getBoundingClientRect();

  appLayout.classList.add('initial-centered');
  appLayout.classList.remove('has-results');

  const lastRect = inputPanel.getBoundingClientRect();
  const deltaX = firstRect.left - lastRect.left;
  const deltaY = firstRect.top - lastRect.top;
  const scaleX = firstRect.width / (lastRect.width || 1);

  inputPanel.style.transformOrigin = 'top left';
  inputPanel.style.transition = 'none';
  inputPanel.style.transform = `translate(${deltaX}px, ${deltaY}px) scaleX(${scaleX})`;
  inputPanel.offsetHeight;

  inputPanel.style.transition = 'transform 0.65s cubic-bezier(0.16, 1, 0.3, 1)';
  inputPanel.style.transform = 'translate(0, 0) scaleX(1)';

  setTimeout(() => {
    inputPanel.style.transition = '';
    inputPanel.style.transform = '';
    inputPanel.style.transformOrigin = '';
  }, 700);
}

// ==========================================================================
// Study Hub Rendering
// ==========================================================================

function renderStudyHub() {
  transitionToSplitLayout();
  if (elements.emptyState) elements.emptyState.classList.add('hidden');
  if (elements.studyHub) elements.studyHub.classList.remove('hidden');

  // Hub Header Info
  elements.metricWords.innerHTML = `<strong>${state.studyPack.words || 0}</strong> words`;
  elements.metricConcepts.innerHTML = `<strong>${state.concepts.length}</strong> concepts`;
  elements.metricQuestions.innerHTML = `<strong>${state.revisionItems.length}</strong> revision cards`;
  elements.metricMode.textContent = state.studyPack.mode === 'llm' ? 'Nexus AI' : 'Offline';

  elements.conceptsCountBadge.textContent = state.concepts.length;
  elements.revisionCountBadge.textContent = state.revisionItems.length;

  // Render Tabs
  renderSummary();
  renderConcepts(state.concepts);
  renderRevision();
  resetChat();
  renderQuickPrompts();
  initExamCorner();

  switchHubTab('summary');
}

function switchHubTab(tabName) {
  state.activeTab = tabName;
  document.querySelectorAll('.hub-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-pane').forEach((pane) => {
    pane.classList.toggle('active', pane.id === `pane${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
  });
}

// Tab 1: Summary
function renderSummary() {
  const raw = state.studyPack.summary || '';
  if (window.marked) {
    elements.summaryContent.innerHTML = marked.parse(raw);
  } else {
    // Basic fallback renderer
    const lines = raw.split('\n').filter(Boolean);
    const html = lines.map(line => `<li>${line.replace(/^[-\*]\s*/, '')}</li>`).join('');
    elements.summaryContent.innerHTML = `<ul>${html}</ul>`;
  }
}

// Tab 2: Key Concepts
function renderConcepts(items) {
  elements.conceptCounter.textContent = `Showing ${items.length} of ${state.concepts.length} concepts`;
  if (!items.length) {
    elements.conceptsGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">
        No concepts found matching your query.
      </div>
    `;
    return;
  }

  elements.conceptsGrid.innerHTML = items.map((item, idx) => `
    <div class="concept-card" onclick="openConceptDetails(${idx})" title="Click to view 3 key details">
      <div>
        <div class="concept-header">
          <div class="concept-term">${escapeHtml(item.term)}</div>
          <span class="concept-badge">#${idx + 1}</span>
        </div>
        <div class="concept-def">${escapeHtml(item.definition)}</div>
      </div>
    </div>
  `).join('');
}

window.openConceptDetails = function (idx) {
  const item = state.concepts[idx];
  if (!item) return;

  elements.conceptModalTerm.textContent = item.term;
  elements.conceptModalDef.textContent = item.definition;

  // Ensure 3 high-yield bullet points
  let points = [];
  if (Array.isArray(item.points) && item.points.length >= 3) {
    points = item.points.slice(0, 3);
  } else if (Array.isArray(item.points) && item.points.length > 0) {
    points = [...item.points];
    while (points.length < 3) {
      if (points.length === 1) {
        points.push(`Clinical & syllabus context: Understanding the exact role and characteristics of ${item.term}.`);
      } else if (points.length === 2) {
        points.push(`Key revision distinction: Fundamental mechanism highlighted throughout the notes.`);
      }
    }
  } else {
    points = [
      item.definition,
      `Clinical & syllabus context: Understanding the exact role and characteristics of ${item.term}.`,
      `Key revision distinction: Fundamental mechanism highlighted throughout the notes.`
    ];
  }

  elements.conceptModalPoints.innerHTML = points.map(p => `<li>${escapeHtml(p)}</li>`).join('');
  elements.conceptDetailsModal.classList.remove('hidden');
};

function renderQuickPrompts() {
  if (!elements.quickPrompts) return;
  const prompts = [];

  // Content-based prompts from extracted concepts
  if (state.concepts && state.concepts.length > 0) {
    prompts.push(`What is ${state.concepts[0].term}?`);
    if (state.concepts.length > 1) {
      prompts.push(`Explain ${state.concepts[1].term}`);
    }
    if (state.concepts.length > 2) {
      prompts.push(`Preventive measures for ${state.concepts[2].term}?`);
    }
  }

  // Content-based prompt from revision questions
  if (state.revisionItems && state.revisionItems.length > 0) {
    const qText = state.revisionItems[0].question;
    prompts.push(qText.length > 50 ? qText.slice(0, 47) + '...' : qText);
  }

  if (prompts.length === 0) {
    prompts.push("Summarize key points");
  }

  elements.quickPrompts.innerHTML = prompts.map(q => `
    <button class="prompt-chip" data-q="${escapeHtml(q)}">${escapeHtml(q)}</button>
  `).join('');
  elements.quickPrompts.classList.remove('hidden');
}

function filterConcepts(query) {
  const q = query.toLowerCase().trim();
  const filtered = state.concepts.filter(c =>
    c.term.toLowerCase().includes(q) || c.definition.toLowerCase().includes(q)
  );
  renderConcepts(filtered);
}

// Tab 3: Revision Questions
function renderRevision() {
  updateMasteryProgress();
  elements.revisionList.innerHTML = state.revisionItems.map((item, idx) => {
    const isMastered = state.masteredIds.has(idx);
    return `
      <div class="revision-card ${isMastered ? 'mastered' : ''}" id="revCard${idx}">
        <div class="revision-header">
          <div>
            <span class="q-badge">Question ${idx + 1}</span>
            <div class="revision-q-text">${escapeHtml(item.question)}</div>
          </div>
        </div>
        <div class="revision-answer-box hidden" id="revAns${idx}">
          <strong>Answer:</strong> ${escapeHtml(item.answer)}
        </div>
        <div class="revision-controls">
          <button class="btn-reveal" onclick="toggleAnswer(${idx})">
            <span id="revBtnText${idx}">Reveal Answer</span>
          </button>
          <button class="btn-master" onclick="toggleMastered(${idx})">
            ${isMastered ? '✓ Mastered' : 'Mark as Mastered'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.toggleAnswer = function (idx) {
  const box = document.getElementById(`revAns${idx}`);
  const btnText = document.getElementById(`revBtnText${idx}`);
  const isHidden = box.classList.contains('hidden');
  if (isHidden) {
    box.classList.remove('hidden');
    btnText.textContent = 'Hide Answer';
  } else {
    box.classList.add('hidden');
    btnText.textContent = 'Reveal Answer';
  }
};

window.toggleMastered = function (idx) {
  if (state.masteredIds.has(idx)) {
    state.masteredIds.delete(idx);
  } else {
    state.masteredIds.add(idx);
  }
  renderRevision();
};

function toggleRevealAll() {
  const answers = document.querySelectorAll('.revision-answer-box');
  const anyHidden = Array.from(answers).some(a => a.classList.contains('hidden'));
  answers.forEach((box, idx) => {
    const btnText = document.getElementById(`revBtnText${idx}`);
    if (anyHidden) {
      box.classList.remove('hidden');
      if (btnText) btnText.textContent = 'Hide Answer';
    } else {
      box.classList.add('hidden');
      if (btnText) btnText.textContent = 'Reveal Answer';
    }
  });
  elements.revealAllBtn.textContent = anyHidden ? 'Hide All Answers' : 'Reveal All Answers';
}

function updateMasteryProgress() {
  const total = state.revisionItems.length;
  const mastered = state.masteredIds.size;
  const pct = total ? Math.round((mastered / total) * 100) : 0;
  elements.masteryFill.style.width = `${pct}%`;
  elements.masteryText.textContent = `${mastered} / ${total} Mastered`;
}

async function handleAskMoreRevision() {
  if (!state.sessionId) {
    showToast('Please generate a study pack first.');
    return;
  }
  if (!elements.askMoreRevisionBtn) return;

  elements.askMoreRevisionBtn.disabled = true;
  if (elements.askMoreSpinner) elements.askMoreSpinner.classList.remove('hidden');
  if (elements.askMoreBtnText) elements.askMoreBtnText.textContent = 'Generating 5 More Questions...';

  try {
    const existingQuestions = state.revisionItems.map(item => item.question);
    const res = await fetch('/api/more-revision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: state.sessionId,
        count: 5,
        offset: state.revisionItems.length,
        existing_questions: existingQuestions
      })
    });

    if (!res.ok) throw new Error('Failed to generate more questions');
    const data = await res.json();
    const newItems = data.items || [];
    if (newItems.length === 0) {
      showToast('No additional questions could be generated from these notes.');
      return;
    }

    const previousCount = state.revisionItems.length;
    state.revisionItems = state.revisionItems.concat(newItems);

    // Re-render the revision cards
    renderRevision();

    // Update counts
    if (elements.revisionCountBadge) elements.revisionCountBadge.textContent = state.revisionItems.length;
    if (elements.metricQuestions) elements.metricQuestions.innerHTML = `<strong>${state.revisionItems.length}</strong> revision cards`;

    // Smoothly scroll down so the first new card is centered in view
    setTimeout(() => {
      const firstNewCard = document.getElementById(`revCard${previousCount}`);
      if (firstNewCard) {
        firstNewCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);

    showToast(`Added 5 more revision questions! (${state.revisionItems.length} total)`);
  } catch (err) {
    console.error(err);
    showToast('Could not load more revision questions at this moment.');
  } finally {
    elements.askMoreRevisionBtn.disabled = false;
    if (elements.askMoreSpinner) elements.askMoreSpinner.classList.add('hidden');
    if (elements.askMoreBtnText) elements.askMoreBtnText.textContent = 'Ask More (Generate 5 More Questions)';
  }
}

// ==========================================================================
// Tab 4: RAG Chat Assistant
// ==========================================================================

function resetChat() {
  const topicName = (state.studyPack && state.studyPack.topic) || (state.concepts && state.concepts[0] && state.concepts[0].term) || 'your notes';
  const greetings = [
    `Hey there! 👋 Today's mission is <strong>${escapeHtml(topicName)}</strong>. Ask me anything directly from your notes to get exam-ready!`,
    `Welcome to study mode! 🎯 We're mastering <strong>${escapeHtml(topicName)}</strong> today. Fire away with any question!`,
    `Ready when you are! 💡 Our focus today is strictly <strong>${escapeHtml(topicName)}</strong>. What concept should we break down first?`,
    `Let's conquer <strong>${escapeHtml(topicName)}</strong> today! 🚀 Ask me any questions, definitions, or exam problems from your notes.`
  ];
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];
  elements.chatMessages.innerHTML = `
    <div class="chat-message assistant">
      <div class="msg-avatar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2a10 10 0 1 0 10 10H12V2z"/>
        </svg>
      </div>
      <div class="msg-body">
        <div class="msg-author">Study Copilot</div>
        <div class="msg-text">
          <p>${greeting}</p>
        </div>
      </div>
    </div>
  `;
}

async function handleChatSubmit() {
  const question = elements.chatInput.value.trim();
  if (!question) return;

  if (!state.sessionId) {
    showToast('Please upload or generate a study pack first.');
    return;
  }

  // Append user message
  appendChatMessage('user', 'You', question);
  elements.chatInput.value = '';

  // Append loading assistant bubble
  const loaderId = appendChatLoader();

  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: state.sessionId,
        question: question,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to get answer');
    }
    const data = await res.json();
    removeChatLoader(loaderId);
    appendChatMessage('assistant', 'Study Copilot', data.answer, data.sources || []);
  } catch (err) {
    removeChatLoader(loaderId);
    appendChatMessage('assistant', 'Study Copilot', `⚠️ Error: ${err.message}`);
  }
}

function formatMarkdown(text) {
  if (!text) return '';
  let src = text.trim();

  // Normalize squashed asterisks or dashes into double newlines so they form proper lists
  src = src.replace(/([^\n])\s*\*\s+\*\*/g, '$1\n\n* **');
  src = src.replace(/([^\n])\s*-\s+\*\*/g, '$1\n\n- **');
  src = src.replace(/([^\n])\s*💡/g, '$1\n\n💡');

  // If external marked is loaded, use it with line breaks enabled
  if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
    try {
      marked.setOptions({ breaks: true, gfm: true });
      let parsed = marked.parse(src);
      // Highlight Key Takeaway callout including following sentence
      parsed = parsed.replace(/<p>(💡\s*<strong>Key Takeaway:?<\/strong>[\s\S]*?)<\/p>(?:\s*<p>([\s\S]*?)<\/p>)?/gi, function (match, head, body) {
        if (body && !body.includes('<')) {
          return `<div class="chat-takeaway">${head} ${body}</div>`;
        }
        return `<div class="chat-takeaway">${head}</div>`;
      });
      return parsed;
    } catch (e) {
      console.warn('Marked parse error, using native parser', e);
    }
  }

  // Self-contained resilient Markdown parser fallback
  src = src.replace(/^### (.*$)/gim, '<h4>$1</h4>');
  src = src.replace(/^## (.*$)/gim, '<h3>$1</h3>');
  src = src.replace(/^# (.*$)/gim, '<h2>$1</h2>');
  src = src.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  src = src.replace(/\*(.*?)\*/g, '<em>$1</em>');
  src = src.replace(/(💡\s*<strong>Key Takeaway:?<\/strong>.*$)/gim, '<div class="chat-takeaway">$1</div>');
  src = src.replace(/(💡\s*Key Takeaway:?.*$)/gim, '<div class="chat-takeaway">$1</div>');

  const lines = src.split('\n');
  let html = '';
  let inList = false;

  for (let line of lines) {
    line = line.trim();
    if (!line) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      continue;
    }

    if (line.startsWith('* ') || line.startsWith('- ')) {
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      html += `<li>${line.substring(2)}</li>`;
    } else {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      if (line.startsWith('<h') || line.startsWith('<div')) {
        html += line;
      } else {
        html += `<p>${line}</p>`;
      }
    }
  }

  if (inList) {
    html += '</ul>';
  }

  return html;
}

function appendChatMessage(role, author, text) {
  const msgEl = document.createElement('div');
  msgEl.className = `chat-message ${role}`;

  let bodyHtml = '';
  if (role === 'assistant') {
    bodyHtml = formatMarkdown(text);
  } else {
    bodyHtml = `<p>${escapeHtml(text)}</p>`;
  }

  msgEl.innerHTML = `
    <div class="msg-avatar">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2a10 10 0 1 0 10 10H12V2z"/>
      </svg>
    </div>
    <div class="msg-body">
      <div class="msg-author">${author}</div>
      <div class="msg-text">${bodyHtml}</div>
    </div>
  `;
  elements.chatMessages.appendChild(msgEl);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function appendChatLoader() {
  const id = 'loader_' + Date.now();
  const el = document.createElement('div');
  el.id = id;
  el.className = 'chat-message assistant';
  el.innerHTML = `
    <div class="msg-avatar">
      <div class="spinner" style="width: 14px; height: 14px; border-width: 1.5px;"></div>
    </div>
    <div class="msg-body">
      <div class="msg-author">Study Copilot</div>
      <div class="msg-text" style="color: var(--text-muted);">Retrieving passages and reasoning...</div>
    </div>
  `;
  elements.chatMessages.appendChild(el);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  return id;
}

function removeChatLoader(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function clearChat() {
  resetChat();
  showToast('Chat history cleared.');
}

window.showCitationModal = function (passage, score, index) {
  elements.modalCitationBadge.textContent = `Source Passage [${index}]`;
  elements.modalCitationScore.textContent = `Relevance Score: ${score}`;
  elements.modalPassageText.textContent = passage;
  elements.citationModal.classList.remove('hidden');
};

// ==========================================================================
// Export & Copy Helpers
// ==========================================================================

function copySummary() {
  if (!state.studyPack) return;
  navigator.clipboard.writeText(state.studyPack.summary || '').then(() => {
    showToast('Summary copied to clipboard!');
  });
}

function showToast(msg) {
  elements.toastMsg.textContent = msg;
  elements.toast.classList.remove('hidden');
  setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 3200);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==========================================================================
// Tab 5: Exam Corner & High-Yield Milestone Checklist
// ==========================================================================

let examItems = [];

function getExamStorageKey() {
  const topic = (state.studyPack && state.studyPack.topic) || 'default';
  return `ainotemaker_exam_${state.sessionId || topic.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
}

function initExamCorner() {
  const topicName = (state.studyPack && state.studyPack.topic) || 'Your Lecture Notes';
  if (elements.examTopicHeader) {
    elements.examTopicHeader.textContent = `${topicName} — Exam Readiness Checklist`;
  }

  const concepts = state.concepts || [];
  const c1 = concepts[0] ? concepts[0].term : 'Core Definitions';
  const c2 = concepts[1] ? concepts[1].term : 'Key Mechanisms';
  const c3 = concepts[2] ? concepts[2].term : 'Essential Formulas & Rules';

  // Base high-yield milestones derived from the topic & concepts
  examItems = [
    { id: 'ex_1', title: `Master Core Concept: ${c1}`, desc: `Be able to define ${c1} and its fundamental role without peeking at your notes.`, tag: 'Must Know', priority: 'high', checked: false },
    { id: 'ex_2', title: `Understand Mechanism: ${c2}`, desc: `Trace step-by-step how ${c2} operates in exam-style problem scenarios.`, tag: 'High Yield', priority: 'high', checked: false },
    { id: 'ex_3', title: `Active Recall on ${c3}`, desc: `Write down 3 bullet points from memory explaining ${c3}.`, tag: 'Active Recall', priority: 'recall', checked: false },
    { id: 'ex_4', title: `Complete All Revision Q&A Cards`, desc: `Practice answering all revision cards in Tab 3 and mark them mastered.`, tag: 'Quiz Drill', priority: 'mastery', checked: false },
    { id: 'ex_5', title: `Feynman Technique Review`, desc: `Explain the entire topic of "${topicName}" out loud in simple terms as if teaching a beginner.`, tag: 'Concept Mastery', priority: 'mastery', checked: false },
    { id: 'ex_6', title: `Formulate 1-Page Exam Cheat Sheet`, desc: `Summarize the high-yield takeaways and potential exam tricky traps into a quick-glance sheet.`, tag: 'Final Polish', priority: 'recall', checked: false }
  ];

  // Load saved progress from localStorage
  const saved = localStorage.getItem(getExamStorageKey());
  if (saved) {
    try {
      const savedData = JSON.parse(saved);
      if (Array.isArray(savedData) && savedData.length > 0) {
        examItems = savedData;
      }
    } catch (e) { }
  }

  renderExamList();
}

function saveExamProgress() {
  localStorage.setItem(getExamStorageKey(), JSON.stringify(examItems));
  updateExamProgressUI();
}

function updateExamProgressUI() {
  const total = examItems.length;
  const completed = examItems.filter(i => i.checked).length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  if (elements.examPct) elements.examPct.textContent = `${pct}%`;
  if (elements.examFraction) elements.examFraction.textContent = `${completed} of ${total} Completed`;
  if (elements.examBarFill) elements.examBarFill.style.width = `${pct}%`;
  if (elements.examCornerBadge) elements.examCornerBadge.textContent = `${pct}%`;
}

function renderExamList() {
  if (!elements.examList) return;
  elements.examList.innerHTML = examItems.map((item, idx) => `
    <div class="exam-item ${item.checked ? 'completed' : ''}" onclick="toggleExamItem(${idx})">
      <input type="checkbox" class="exam-checkbox" ${item.checked ? 'checked' : ''} onclick="event.stopPropagation(); toggleExamItem(${idx})">
      <div class="exam-item-body">
        <div class="exam-item-header">
          <span class="exam-item-title">${escapeHtml(item.title)}</span>
          <span class="exam-item-tag priority-${item.priority || 'high'}">${escapeHtml(item.tag || 'Milestone')}</span>
        </div>
        <div class="exam-item-desc">${escapeHtml(item.desc)}</div>
      </div>
    </div>
  `).join('');
  updateExamProgressUI();
}

window.toggleExamItem = function (idx) {
  if (!examItems[idx]) return;
  examItems[idx].checked = !examItems[idx].checked;
  saveExamProgress();
  renderExamList();
  const completed = examItems.filter(i => i.checked).length;
  if (completed === examItems.length && examItems.length > 0) {
    showToast('🎉 Outstanding! You completed 100% of your Exam Readiness checklist!');
  }
};

function resetExamChecklist() {
  examItems.forEach(i => i.checked = false);
  saveExamProgress();
  renderExamList();
  showToast('Exam checklist progress reset.');
}

function addCustomExamItem() {
  if (!elements.customExamInput) return;
  const text = elements.customExamInput.value.trim();
  if (!text) return;
  examItems.push({
    id: 'custom_' + Date.now(),
    title: text,
    desc: 'Custom revision task added by you.',
    tag: 'Custom Goal',
    priority: 'recall',
    checked: false
  });
  elements.customExamInput.value = '';
  saveExamProgress();
  renderExamList();
  showToast('Custom revision task added!');
}

// Start
document.addEventListener('DOMContentLoaded', init);
