const form = document.querySelector('#analyzer-form');
const jobDescription = document.querySelector('#job-description');
const fileInput = document.querySelector('#cv-file');
const dropzone = document.querySelector('#dropzone');
const filePreview = document.querySelector('#file-preview');
const count = document.querySelector('#char-count');
const button = document.querySelector('#analyze-button');
const errorMessage = document.querySelector('#error-message');
const results = document.querySelector('#results');

// Keep the color field close to the pointer and leave a small fading trail.
let lastTrail = 0;
document.addEventListener('pointermove', event => {
  const hue = Math.round(150 + (event.clientX / window.innerWidth) * 35);
  document.body.style.setProperty('--cursor-x', `${event.clientX}px`);
  document.body.style.setProperty('--cursor-y', `${event.clientY}px`);
  document.body.style.setProperty('--cursor-hue', hue);
  if (event.pointerType !== 'mouse' || event.timeStamp - lastTrail < 65) return;
  lastTrail = event.timeStamp;
  const trail = document.createElement('span');
  trail.className = 'cursor-trail';
  trail.style.left = `${event.clientX}px`;
  trail.style.top = `${event.clientY}px`;
  trail.style.setProperty('--trail-color', `hsl(${hue}, 68%, 62%)`);
  document.body.appendChild(trail);
  trail.addEventListener('animationend', () => trail.remove(), { once: true });
});

jobDescription.addEventListener('input', () => {
  count.textContent = `${jobDescription.value.length.toLocaleString()} / 12,000`;
});

function showFile(file) {
  if (!file) return;
  filePreview.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`;
}
fileInput.addEventListener('change', () => showFile(fileInput.files[0]));
['dragenter', 'dragover'].forEach(eventName => dropzone.addEventListener(eventName, event => {
  event.preventDefault(); dropzone.classList.add('dragging');
}));
['dragleave', 'drop'].forEach(eventName => dropzone.addEventListener(eventName, event => {
  event.preventDefault(); dropzone.classList.remove('dragging');
}));
dropzone.addEventListener('drop', event => {
  const file = event.dataTransfer.files[0];
  if (file) { fileInput.files = event.dataTransfer.files; showFile(file); }
});

dropzone.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInput.click(); }
});

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.toggle('visible', Boolean(message));
}
function list(items, weak = false) {
  if (!items?.length) return '<p>No specific items identified.</p>';
  return `<ul class="list ${weak ? 'weak' : ''}">${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}
function badges(items, missing = false) {
  if (!items?.length) return '<p>No specific skills identified.</p>';
  return `<div class="badges">${items.map(item => `<span class="badge ${missing ? 'missing' : ''}">${escapeHtml(item)}</span>`).join('')}</div>`;
}
function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;', '"':'&quot;'}[char]));
}
function classification(score) {
  if (score >= 90) return 'Excellent Match';
  if (score >= 75) return 'Strong Match';
  if (score >= 60) return 'Moderate Match';
  if (score >= 40) return 'Low Match';
  return 'Poor Match';
}
function renderResults(data) {
  const score = Number(data.overall_score);
  results.innerHTML = `
    <div class="score-hero">
      <div class="score-ring" style="--score:${score}%"><div class="score-number">${score}<small>%</small></div></div>
      <div><div class="score-label">CV relevance score</div><h2>${classification(score)}</h2><p>${escapeHtml(data.summary)}</p></div>
      <div class="score-detail"><strong>Role fit</strong><span>Based on this job description</span></div>
    </div>
    <div class="results-grid">
      <article class="result-card"><h3>Matching skills</h3>${badges(data.matching_skills)}</article>
      <article class="result-card"><h3>Missing skills</h3>${badges(data.missing_skills, true)}</article>
      <article class="result-card"><h3>Relevant experience</h3><p>${escapeHtml(data.experience_match)}</p></article>
      <article class="result-card"><h3>Education match</h3><p>${escapeHtml(data.education_match)}</p></article>
      <article class="result-card"><h3>Job requirement match</h3><p>${data.responsibility_score}% alignment with the responsibilities described for this role.</p></article>
      <article class="result-card"><h3>Strengths</h3>${list(data.strengths)}</article>
      <article class="result-card"><h3>Weaknesses</h3>${list(data.weaknesses, true)}</article>
      <article class="result-card full"><h3>Suggestions for improvement</h3><div class="suggestions">${(data.suggestions?.length ? data.suggestions : ['No additional suggestions were identified.']).map(item => `<div class="suggestion">${escapeHtml(item)}</div>`).join('')}</div></article>
    </div>`;
  results.hidden = false;
  results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  showError('');
  if (!jobDescription.value.trim()) return showError('Add the job description before analyzing.');
  if (!fileInput.files[0]) return showError('Choose a PDF, DOCX, or TXT CV before analyzing.');
  button.disabled = true;
  button.querySelector('span').textContent = 'Analyzing...';
  try {
    const response = await fetch('/api/analyze-cv/', { method: 'POST', body: new FormData(form) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'The analysis could not be completed.');
    renderResults(data);
  } catch (error) {
    showError(error.message || 'The analysis could not be completed. Please try again.');
  } finally {
    button.disabled = false;
    button.querySelector('span').textContent = 'Analyze CV';
  }
});
