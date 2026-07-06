import React from 'react';
import { WebView } from 'react-native-webview';
import { IMidTest } from '@/types';

function escapeHtml(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function optionLetter(index: number): string {
  if (index < 26) return String.fromCharCode(65 + index);
  return String(index + 1);
}

function generateQuestionnaireHtml(midTest: IMidTest, currentQuestionIndex: number) {
  const questionnaires = midTest.questionnaires || [];
  const currentQuestion = questionnaires[currentQuestionIndex];
  const total = questionnaires.length;
  const progress = total > 0 ? Math.round(((currentQuestionIndex + 1) / total) * 100) : 0;
  const allowMultiple = Boolean(currentQuestion?.allowMultiple);

  const optionsHtml = (currentQuestion?.options || [])
    .map((opt, i) => `
        <div class="option" onclick="selectOption(${i})" id="opt-${i}" role="button" aria-pressed="false">
          <div class="letter-badge" id="badge-${i}">${optionLetter(i)}</div>
          <div class="option-body">
            <div class="option-text">${escapeHtml(opt.label || '')}</div>
            ${opt.image ? `<img src="${escapeHtml(opt.image)}" alt="" class="option-image" loading="lazy" />` : ''}
          </div>
        </div>
      `)
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f0f4ff;
      color: #1e293b;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .top-bar {
      background: #3363AD;
      padding: 12px 14px 10px;
      flex-shrink: 0;
    }
    .top-bar-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }
    .test-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: rgba(255,255,255,0.8);
      flex: 1;
      min-width: 0;
    }
    .q-counter {
      font-size: 13px;
      font-weight: 700;
      color: #fff;
      background: rgba(255,255,255,0.18);
      border-radius: 20px;
      padding: 4px 10px;
      flex-shrink: 0;
      white-space: nowrap;
    }
    .progress-track {
      height: 4px;
      background: rgba(255,255,255,0.25);
      border-radius: 4px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: #fff;
      border-radius: 4px;
      width: ${progress}%;
      transition: width 0.35s ease;
    }

    /* One scroll region for question + all options */
    .main-scroll {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      padding: 12px 12px 8px;
    }
    .main-scroll::-webkit-scrollbar { display: none; }

    .question-card {
      background: #fff;
      border-radius: 14px;
      padding: 16px;
      box-shadow: 0 2px 8px rgba(51,99,173,0.10);
      margin-bottom: 12px;
      border: 1px solid #e2e8f0;
    }
    .question-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    .question-number {
      width: 32px;
      height: 32px;
      border-radius: 10px;
      background: rgba(51, 99, 173, 0.1);
      color: #3363AD;
      font-size: 14px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .question-content {
      flex: 1;
      min-width: 0;
    }
    .question-text {
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
      line-height: 20px;
      word-break: break-word;
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }
    .multi-hint {
      display: inline-block;
      margin-top: 10px;
      font-size: 12px;
      font-weight: 600;
      color: #3363AD;
      background: rgba(51, 99, 173, 0.1);
      border-radius: 8px;
      padding: 4px 10px;
    }
    .question-image {
      width: 100%;
      max-height: 240px;
      object-fit: contain;
      border-radius: 10px;
      margin-top: 12px;
      display: block;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
    }

    .options-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding-bottom: 8px;
    }

    .option {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px;
      background: #fff;
      border: 2px solid #e2e8f0;
      border-radius: 14px;
      cursor: pointer;
      transition: border-color 0.18s, background 0.18s, transform 0.1s;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
    }
    .option:active { transform: scale(0.99); }
    .option.selected  { border-color: #3363AD; background: rgba(51, 99, 173, 0.06); }
    .option.correct   { border-color: #16a34a; background: #f0fdf4; }
    .option.incorrect { border-color: #ef4444; background: #fef2f2; }
    .option.disabled  { pointer-events: none; }

    .letter-badge {
      width: 28px;
      height: 28px;
      border-radius: 14px;
      background: #f8fafc;
      border: 2px solid #cbd5e1;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 800;
      color: #64748b;
      flex-shrink: 0;
      margin-top: 1px;
      transition: background 0.18s, border-color 0.18s, color 0.18s;
    }
    .option.selected  .letter-badge { background: #3363AD; border-color: #3363AD; color: #fff; }
    .option.correct   .letter-badge { background: #16a34a; border-color: #16a34a; color: #fff; }
    .option.incorrect .letter-badge { background: #ef4444; border-color: #ef4444; color: #fff; }

    .option-body {
      flex: 1;
      min-width: 0;
    }
    .option-text {
      font-size: 14px;
      color: #1e293b;
      line-height: 20px;
      word-break: break-word;
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }
    .option.selected  .option-text { color: #1e3a8a; font-weight: 600; }
    .option.correct   .option-text { color: #15803d; font-weight: 600; }
    .option.incorrect .option-text { color: #b91c1c; font-weight: 600; }
    .option-image {
      width: 100%;
      max-width: 220px;
      max-height: 140px;
      object-fit: contain;
      border-radius: 8px;
      margin-top: 10px;
      display: block;
      background: #f1f5f9;
    }

    .scroll-hint {
      position: sticky;
      bottom: -8px;
      left: 0;
      right: 0;
      height: 48px;
      margin-top: -48px;
      pointer-events: none;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding-bottom: 4px;
      background: linear-gradient(to bottom, rgba(240,244,255,0) 0%, rgba(240,244,255,0.95) 70%, rgba(240,244,255,1) 100%);
      opacity: 0;
      transition: opacity 0.25s;
    }
    .scroll-hint.visible { opacity: 1; }
    .scroll-arrow {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #3363AD;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(51,99,173,0.3);
      animation: bounce-down 1.1s ease-in-out infinite;
    }
    @keyframes bounce-down { 0%,100%{transform:translateY(0)} 50%{transform:translateY(4px)} }

    .submit-footer {
      flex-shrink: 0;
      padding: 8px 12px 4px;
      background: #f0f4ff;
      border-top: 1px solid #e2e8f0;
    }
    .submit-btn {
      width: 100%;
      padding: 14px 0;
      background: #3363AD;
      color: #fff;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.18s, opacity 0.18s;
    }
    .submit-btn:disabled { background: #94a3b8; cursor: not-allowed; }
    .submit-btn:not(:disabled):active { background: #2451a0; }

    .result-banner {
      position: fixed;
      left: 50%;
      top: 12px;
      transform: translateX(-50%);
      padding: 11px 20px;
      border-radius: 10px;
      color: #fff;
      font-weight: 800;
      z-index: 9999;
      box-shadow: 0 8px 26px rgba(0,0,0,0.22);
      font-size: 15px;
      min-width: 260px;
      max-width: 92%;
      text-align: center;
      animation: rb-slide-down 220ms ease;
    }
    .result-banner.correct   { background: #16a34a; }
    .result-banner.incorrect { background: #ef4444; }
    @keyframes rb-slide-down {
      from { transform: translateX(-50%) translateY(-8px); opacity: 0; }
      to   { transform: translateX(-50%) translateY(0); opacity: 1; }
    }

    .feedback-overlay {
      position: fixed; inset: 0;
      display: flex; align-items: center; justify-content: center;
      background: rgba(2,6,23,0.55);
      z-index: 10000; padding: 20px;
    }
    .feedback-modal {
      background: #fff; border-radius: 14px;
      padding: 20px 22px; width: min(720px, 96%);
      box-shadow: 0 18px 36px rgba(2,6,23,0.28);
      position: relative; max-height: 80vh; overflow: hidden;
      display: flex; flex-direction: column;
    }
    .feedback-modal-title {
      font-size: 13px; font-weight: 700; color: #3363AD;
      text-transform: uppercase; letter-spacing: 0.8px;
      margin-bottom: 10px;
    }
    .feedback-close {
      position: absolute; top: 12px; right: 14px;
      background: #f1f5f9; border: none;
      width: 28px; height: 28px; border-radius: 50%;
      font-size: 16px; cursor: pointer; color: #475569;
    }
    .feedback-content {
      font-size: 15px; color: #334155; line-height: 1.6;
      overflow-y: auto; flex: 1;
      word-break: break-word;
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>

  <div class="top-bar">
    <div class="top-bar-row">
      <span class="test-label">Ikizamini cyo hagati</span>
      <span class="q-counter">Ikibazo ${currentQuestionIndex + 1} / ${total}</span>
    </div>
    <div class="progress-track"><div class="progress-fill"></div></div>
  </div>

  <div class="main-scroll" id="main-scroll">
    <div class="question-card">
      <div class="question-row">
        <div class="question-number">${currentQuestionIndex + 1}</div>
        <div class="question-content">
          <div class="question-text">${escapeHtml(currentQuestion?.question || 'Nta kibazo')}</div>
          ${allowMultiple ? '<span class="multi-hint">Hitamo kimwe cg byinshi</span>' : ''}
        </div>
      </div>
      ${currentQuestion?.questionImage ? `<img src="${escapeHtml(currentQuestion.questionImage)}" alt="" class="question-image" />` : ''}
    </div>

    <div class="options-list" id="options-list">
      ${optionsHtml}
    </div>

    <div class="scroll-hint" id="scroll-hint">
      <div class="scroll-arrow">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
    </div>
  </div>

  <div class="submit-footer">
    <button class="submit-btn" id="submit-btn" disabled>Emeza igisubizo</button>
  </div>

  <script>
    const questions = ${JSON.stringify(questionnaires)};
    const qIdx = ${currentQuestionIndex};
    const q = questions[qIdx] || {};
    const correctAnswers = (q.answers || []).map(function(a) { return a.label; });
    const allowMultiple = ${allowMultiple ? 'true' : 'false'};
    let selectedOptions = [];
    let submitted = false;

    var scrollEl = document.getElementById('main-scroll');
    var scrollHint = document.getElementById('scroll-hint');

    function updateScrollHint() {
      if (!scrollEl || !scrollHint) return;
      var hasOverflow = scrollEl.scrollHeight > scrollEl.clientHeight + 4;
      var atBottom = scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 12;
      if (hasOverflow && !atBottom) {
        scrollHint.classList.add('visible');
      } else {
        scrollHint.classList.remove('visible');
      }
    }

    if (scrollEl) {
      scrollEl.addEventListener('scroll', updateScrollHint, { passive: true });
      [80, 250, 600, 1200].forEach(function(ms) { setTimeout(updateScrollHint, ms); });
      window.addEventListener('resize', updateScrollHint);
    }

    function selectOption(idx) {
      if (submitted) return;
      var optEl = document.getElementById('opt-' + idx);
      if (!optEl) return;

      if (!allowMultiple) {
        for (var i = 0; i < (q.options || []).length; i++) {
          var el = document.getElementById('opt-' + i);
          if (el) {
            el.classList.remove('selected');
            el.setAttribute('aria-pressed', 'false');
          }
        }
        optEl.classList.add('selected');
        optEl.setAttribute('aria-pressed', 'true');
        selectedOptions = [idx];
      } else {
        var alreadySel = optEl.classList.contains('selected');
        if (alreadySel) {
          optEl.classList.remove('selected');
          optEl.setAttribute('aria-pressed', 'false');
          selectedOptions = selectedOptions.filter(function(i) { return i !== idx; });
        } else {
          optEl.classList.add('selected');
          optEl.setAttribute('aria-pressed', 'true');
          selectedOptions.push(idx);
        }
      }
      document.getElementById('submit-btn').disabled = selectedOptions.length === 0;
      setTimeout(updateScrollHint, 50);
    }

    document.getElementById('submit-btn').onclick = function() {
      if (submitted || selectedOptions.length === 0) return;
      submitted = true;
      this.disabled = true;

      (q.options || []).forEach(function(opt, i) {
        var el = document.getElementById('opt-' + i);
        if (!el) return;
        el.classList.add('disabled');
        if (correctAnswers.includes(opt.label)) {
          el.classList.add('correct');
          el.classList.remove('selected');
        }
        if (selectedOptions.includes(i) && !correctAnswers.includes(opt.label)) {
          el.classList.add('incorrect');
        }
      });

      var selectedLabels = selectedOptions.map(function(i) { return (q.options || [])[i].label; });
      var uniqueSel = Array.from(new Set(selectedLabels));
      var uniqueCorr = Array.from(new Set(correctAnswers));
      var isCorrect = uniqueSel.length === uniqueCorr.length && uniqueSel.every(function(l) { return uniqueCorr.includes(l); });

      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'feedbackModalState', isOpen: true }));
      }

      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'questionnaireSubmitted',
          selectedOptions: selectedLabels,
          correctAnswers: correctAnswers
        }));
      }

      var banner = document.createElement('div');
      banner.className = 'result-banner ' + (isCorrect ? 'correct' : 'incorrect');
      banner.textContent = isCorrect ? '✓  Nibyo, Igisubizo cyawe nicyo!' : '✗  Igisubizo cyawe sicyo';
      document.body.appendChild(banner);

      setTimeout(function() {
        banner.style.opacity = '0';
        setTimeout(function() {
          try { document.body.removeChild(banner); } catch(e) {}
          var fb = (q.feedbackStatement) ? String(q.feedbackStatement).trim() : '';
          if (!isCorrect && fb.length > 0) {
            showFeedbackModal(fb);
          } else if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'feedbackModalState', isOpen: false }));
          }
        }, 0);
      }, 1500);
    };

    function showFeedbackModal(message) {
      var overlay = document.createElement('div');
      overlay.className = 'feedback-overlay';

      var modal = document.createElement('div');
      modal.className = 'feedback-modal';

      var title = document.createElement('div');
      title.className = 'feedback-modal-title';
      title.textContent = 'Igisubizo nyacyo';

      var closeBtn = document.createElement('button');
      closeBtn.className = 'feedback-close';
      closeBtn.innerHTML = '✕';

      var content = document.createElement('div');
      content.className = 'feedback-content';
      content.textContent = message;

      modal.appendChild(title);
      modal.appendChild(closeBtn);
      modal.appendChild(content);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      function close() {
        overlay.style.opacity = '0';
        setTimeout(function() {
          try { document.body.removeChild(overlay); } catch(e) {}
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'feedbackModalState', isOpen: false }));
          }
        }, 200);
      }

      closeBtn.addEventListener('click', close);
      overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
    }
  </script>
</body>
</html>`;
}

const QuestionnaireViewer: React.FC<{
  midTest: IMidTest;
  currentQuestionIndex: number;
  onMessage?: (event: any) => void;
}> = ({ midTest, currentQuestionIndex, onMessage }) => {
  return (
    <WebView
      source={{ html: generateQuestionnaireHtml(midTest, currentQuestionIndex) }}
      originWhitelist={['*']}
      style={{ flex: 1, width: '100%', height: '100%', backgroundColor: '#f0f4ff' }}
      javaScriptEnabled
      scalesPageToFit={false}
      startInLoadingState
      nestedScrollEnabled
      onMessage={onMessage}
    />
  );
};

export default QuestionnaireViewer;
