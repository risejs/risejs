import './ui.css';
import { QuestLog } from './data.js';
import { createDialogue } from '../dialogue/index.js';
export { QuestLog };

/**
 * Quest pack (opt-in). Dialogue lives in the `dialogue` pack, which is still installed automatically to keep the older API working.
 *
 *   app.use(questPlugin);
 *   app.quests.add({ id:'supply', title:'SUPPLY RUN', steps:[{ id:'crates', text:'Collect crates', need:3 }] });
 *   app.quests.progress('supply', 'crates', 1);
 *   app.dialogue.start(graph, 'intro');
 */

function createQuestUI(app, log) {
  const el = document.createElement('div');
  el.className = 'pkg-quests off';
  app.hud.root.appendChild(el);

  const render = () => {
    const quests = log.entries();
    el.classList.toggle('off', !quests.length);
    el.innerHTML = quests
      .map(
        (q) => `
        <div class="pkg-quest ${q.done ? 'done' : ''}">
          <div class="pkg-quest-title">${escapeHtml(q.title)}</div>
          ${q.steps
            .map(
              (s) =>
                `<div class="pkg-quest-step"><i>${s.count}/${s.need}</i><span>${escapeHtml(s.text)}</span></div>`
            )
            .join('')}
        </div>`
      )
      .join('');
  };

  const off = app.events.on('quest:change', render);
  render();
  return () => {
    off();
    el.remove();
  };
}

export function questPlugin(app) {
  const log = new QuestLog(app.events);
  app.quests = log;
  const ownDialogue = !app.dialogue;
  if (ownDialogue) app.dialogue = createDialogue(app);
  const dlg = app.dialogue;
  const disposeUI = createQuestUI(app, log);
  app.log?.('quest pack ready');
  return () => {
    disposeUI();
    if (ownDialogue && app.dialogue === dlg) {
      dlg.dispose?.();
      app.dialogue = null;
    }
    if (app.quests === log) app.quests = null;
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
