"use client";

import { useEffect } from "react";

type CardData = {
  id: number;
  text: string; // HTML-safe string (text + optional <img class="emoji-img" src="data:image/...">)
  done: boolean;
  color: string;
};

type State = {
  nextId: number;
  cards: Record<string, CardData[]>;
  weekVisibility: Record<string, boolean[]>;
};

const STORAGE_KEY = "muchi-note-safe-v3";
const MONTH_NAMES = [
  "1월",
  "2월",
  "3월",
  "4월",
  "5월",
  "6월",
  "7월",
  "8월",
  "9월",
  "10월",
  "11월",
  "12월",
];
const WEEKDAY_NAMES_MON_FIRST = ["월", "화", "수", "목", "금", "토", "일"];
const FIXED_HOLIDAYS: Record<string, string> = {
  "01-01": "신정",
  "03-01": "삼일절",
  "05-05": "어린이날",
  "06-06": "현충일",
  "08-15": "광복절",
  "10-03": "개천절",
  "10-09": "한글날",
  "12-25": "크리스마스",
};
const CARD_COLORS = ["default", "yellow", "green", "pink"] as const;
const EMOJI_STORE_KEY = "muchi-emoji-store";
const EMOJI_ORDER_KEY = "muchi-emoji-order";
const DEFAULT_EMOJIS = [
  { id: "default-check", ch: "✅" },
  { id: "default-fire", ch: "🔥" },
  { id: "default-star", ch: "⭐️" },
  { id: "default-pin", ch: "📌" },
  { id: "default-heart", ch: "❤️" },
  { id: "default-thumb", ch: "👍" },
  { id: "default-idea", ch: "💡" },
  { id: "default-bang", ch: "❗️" },
  { id: "default-strong", ch: "💪" },
];

export default function Page() {
  useEffect(() => {
    // React 18 StrictMode 초기 mount 중복 실행을 방지하기 위한 플래그
    if ((window as typeof window & { __MUCHI_NOTE_INIT__?: boolean }).__MUCHI_NOTE_INIT__) {
      return;
    }
    (window as typeof window & { __MUCHI_NOTE_INIT__?: boolean }).__MUCHI_NOTE_INIT__ = true;

    const AIRTABLE_BASE_ID =
      process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID ?? "app8KHGcgFezjsSHP";
    const AIRTABLE_TABLE_NAME =
      process.env.NEXT_PUBLIC_AIRTABLE_TABLE_NAME ?? "cards";
    const AIRTABLE_TOKEN =
      process.env.NEXT_PUBLIC_AIRTABLE_TOKEN ??
      "여기에_네_Airtable_토큰_붙여넣기";

    const monthTitle = document.getElementById("monthTitle") as HTMLElement | null;
    const monthPickerToggle = document.getElementById(
      "monthPickerToggle",
    ) as HTMLButtonElement | null;
    const monthDropdown = document.getElementById("monthDropdown") as HTMLElement | null;
    const ymYearLabel = document.getElementById("ymYearLabel") as HTMLElement | null;
    const ymPrevYear = document.getElementById("ymPrevYear") as HTMLButtonElement | null;
    const ymNextYear = document.getElementById("ymNextYear") as HTMLButtonElement | null;
    const ymMonthButtons = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".ym-month-btn"),
    );

    const calendarGrid = document.getElementById("calendarGrid") as HTMLElement | null;
    const calendarWrapper = document.querySelector(".calendar-wrapper") as HTMLElement | null;
    const headerToggle = document.getElementById("headerToggle") as HTMLButtonElement | null;
    const prevBtn = document.getElementById("prevMonth") as HTMLButtonElement | null;
    const nextBtn = document.getElementById("nextMonth") as HTMLButtonElement | null;
    const weekendToggleBtn = document.getElementById("weekendToggle") as HTMLButtonElement | null;
    const scaleResetBtn = document.getElementById("scaleReset") as HTMLButtonElement | null;
    const searchInput = document.getElementById("searchInput") as HTMLInputElement | null;
    const searchBtn = document.getElementById("searchBtn") as HTMLButtonElement | null;
    const airtableSaveBtn = document.getElementById(
      "airtableSaveBtn",
    ) as HTMLButtonElement | null;
    const airtableLoadBtn = document.getElementById(
      "airtableLoadBtn",
    ) as HTMLButtonElement | null;
    const todayBtn = document.getElementById("todayBtn") as HTMLButtonElement | null;
    const scopeMonthBtn = document.getElementById("scopeMonth") as HTMLButtonElement | null;
    const scopeAllBtn = document.getElementById("scopeAll") as HTMLButtonElement | null;
    const toastContainer = document.getElementById(
      "toastContainer",
    ) as HTMLElement | null;

    if (
      !monthTitle ||
      !calendarGrid ||
      !searchInput ||
      !searchBtn ||
      !scopeMonthBtn ||
      !scopeAllBtn ||
      !toastContainer
    ) {
      console.error("필수 DOM 요소를 찾을 수 없습니다. 마크업을 확인하세요.");
      return;
    }

    let current = new Date();
    current.setDate(1);
    let pickerYear = current.getFullYear();
    // 인피니트 스크롤 범위: 시작 달(포함) / 끝 달 시작(제외)
    let startCursor = new Date(current.getFullYear(), current.getMonth(), 1);
    let endCursor = new Date(current.getFullYear(), current.getMonth() + 1, 1);

    let state: State = { nextId: 1, cards: {}, weekVisibility: {} };
    let headerCollapsed = false;
    let showWeekend = true;
    let marqueeBox: HTMLDivElement | null = null;
    let marqueeStart: { x: number; y: number } | null = null;
    let marqueeActive = false;
    const SCALE_KEY = "muchi-ui-scale";
    let lastActiveDayCell: HTMLElement | null = null;
    let lastActiveDateKey: string | null = null;
    let cardClipboard: CardData[] = [];
    let emojiList: Array<{ id: string; src: string; name: string }> = [];
    let emojiOrder: string[] = [];
    let draggingEmojiId: string | null = null;
    const HISTORY_LIMIT = 200;
    let history: State[] = [];
    let historyIndex = -1;
    let draggingCards: HTMLDivElement[] = [];
    let dragPlaceholder: HTMLDivElement | null = null;
    let searchMode: "month" | "all" = "month";
    let lastFocusedContent: HTMLDivElement | null = null;
    let lastRange: Range | null = null;
    let lastActiveCardContent: HTMLDivElement | null = null;
    let keepFocusFromPalette = false;

    function toggleSelection(card: HTMLDivElement) {
      card.classList.toggle("selected");
    }

    function clearSelection() {
      document.querySelectorAll(".card.selected").forEach((c) => c.classList.remove("selected"));
    }

    function sanitizeToTextAndEmojis(html: string) {
      const container = document.createElement("div");
      container.innerHTML = html;
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
      let result = "";
      const allowedImg = (el: Element) =>
        el.tagName.toLowerCase() === "img" &&
        el.getAttribute("src")?.startsWith("data:image/") &&
        (el as HTMLImageElement).src.length < 500000; // cap size

      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node.nodeType === Node.TEXT_NODE) {
          result += node.textContent ?? "";
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          if (allowedImg(el)) {
            const src = el.getAttribute("src") || "";
            result += `<img class="emoji-img" src="${src}">`;
          }
        }
      }
      return result;
    }

    function insertAtSelection(htmlFragment: string, opts?: { strictCard?: boolean }) {
      const selection = window.getSelection();
      const strictCard = opts?.strictCard ?? false;
      let range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;

      if (!range && lastRange) {
        range = lastRange.cloneRange();
        selection?.removeAllRanges();
        if (selection && range) selection.addRange(range);
      }

      const targetContent = lastFocusedContent || lastActiveCardContent;

      if (!range && targetContent) {
        range = document.createRange();
        range.selectNodeContents(targetContent);
        range.collapse(false);
        selection?.removeAllRanges();
        if (selection && range) selection.addRange(range);
      }

      if (!range) return false;
      if (strictCard && (!targetContent || !targetContent.closest(".card"))) return false;

      range.deleteContents();
      const temp = document.createElement("div");
      temp.innerHTML = htmlFragment;
      const frag = document.createDocumentFragment();
      while (temp.firstChild) {
        frag.appendChild(temp.firstChild);
      }
      range.insertNode(frag);
      range.collapse(false);
      selection?.removeAllRanges();
      if (selection) selection.addRange(range);
      lastRange = range.cloneRange();
      return true;
    }

    function loadEmojis() {
      try {
        const raw = localStorage.getItem(EMOJI_STORE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          emojiList = parsed.filter((e) => typeof e.src === "string" && typeof e.id === "string");
        }
      } catch (e) {
        console.error("loadEmojis error", e);
      }
    }

    function saveEmojis() {
      try {
        localStorage.setItem(EMOJI_STORE_KEY, JSON.stringify(emojiList));
      } catch (e) {
        console.error("saveEmojis error", e);
      }
    }

    function loadEmojiOrder() {
      try {
        const raw = localStorage.getItem(EMOJI_ORDER_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) emojiOrder = parsed.filter((id) => typeof id === "string");
      } catch (e) {
        console.error("loadEmojiOrder error", e);
      }
    }

    function saveEmojiOrder() {
      try {
        localStorage.setItem(EMOJI_ORDER_KEY, JSON.stringify(emojiOrder));
      } catch (e) {
        console.error("saveEmojiOrder error", e);
      }
    }

    function setActiveDay(cell: HTMLElement | null) {
      if (!cell || !cell.classList.contains("day-cell")) return;
      const key = cell.dataset.date || null;
      if (lastActiveDayCell && lastActiveDayCell !== cell) {
        lastActiveDayCell.classList.remove("active-day");
      }
      lastActiveDayCell = cell;
      lastActiveDateKey = key;
      cell.classList.add("active-day");
    }

    function deleteCards(targets: HTMLDivElement[]) {
      if (!targets.length) return;
      if (targets.length > 1 && !confirm(`선택된 ${targets.length}개 카드를 삭제할까요?`)) {
        return;
      }
      pushHistory();

      const affectedDates = new Set<string>();

      targets.forEach((c) => {
        const dateKey = c.dataset.date;
        const idStr = c.dataset.cardId;
        const parent = c.parentElement;
        c.remove();
        if (dateKey && idStr) {
          const numericId = Number(idStr);
          if (Number.isFinite(numericId)) {
            let deleted = deleteCardFromState(dateKey, numericId);
            if (!deleted) {
              for (const key of Object.keys(state.cards)) {
                if (deleteCardFromState(key, numericId)) {
                  affectedDates.add(key);
                  deleted = true;
                  break;
                }
              }
            }
            affectedDates.add(dateKey);
          }
        }
        if (parent && parent.classList.contains("day-body")) {
          if (!parent.querySelector(".card")) {
            const hintEl = parent.querySelector(".day-empty-hint") as HTMLElement | null;
            if (hintEl) hintEl.style.display = "block";
          }
        }
      });

      affectedDates.forEach((dk) => updateDayBadge(dk));
      clearSelection();
      syncCurrentMonthFromDom();
    }

    function ensureMarqueeBox() {
      if (marqueeBox) return marqueeBox;
      const box = document.createElement("div");
      box.className = "marquee-selection";
      document.body.appendChild(box);
      marqueeBox = box;
      return box;
    }

    function isEditableTarget(el: HTMLElement | null) {
      if (!el) return false;
      const tag = el.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea") return true;
      if ((el as HTMLDivElement).isContentEditable) return true;
      return false;
    }

    function updateMarqueeSelection(rect: { left: number; top: number; right: number; bottom: number }) {
      const cards = document.querySelectorAll<HTMLDivElement>(".card");
      cards.forEach((card) => {
        const r = card.getBoundingClientRect();
        const overlap = !(rect.right < r.left || rect.left > r.right || rect.bottom < r.top || rect.top > r.bottom);
        if (overlap) {
          card.classList.add("selected");
        }
      });
    }

    const formatDateKey = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    };


    const formatMonthKey = (year: number, monthIndex: number) =>
      `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

    function updateMonthTitle(date: Date = current) {
      if (!monthTitle) return;
      monthTitle.textContent = `${date.getFullYear()}년 ${MONTH_NAMES[date.getMonth()]}`;
      pickerYear = date.getFullYear();
      if (ymYearLabel) ymYearLabel.textContent = `${pickerYear}년`;
    }

    const toggleWeekendUI = () => {
      document.body.classList.toggle("weekend-hidden", !showWeekend);
      if (weekendToggleBtn) {
        weekendToggleBtn.textContent = showWeekend ? "주말 숨기기" : "주말 보이기";
      }
    };

    function snapshotState() {
      return JSON.parse(JSON.stringify(state)) as State;
    }

    function pushHistory() {
      // 현재 인덱스 이후 히스토리 제거 후 추가
      history = history.slice(0, historyIndex + 1);
      history.push(snapshotState());
      if (history.length > HISTORY_LIMIT) {
        history.shift();
      }
      historyIndex = history.length - 1;
    }

    function undo() {
      if (historyIndex <= 0) return;
      historyIndex--;
      const prev = history[historyIndex];
      state = JSON.parse(JSON.stringify(prev));
      saveState();
      renderCalendar();
    }

    function loadScale() {
      try {
        const raw = localStorage.getItem(SCALE_KEY);
        if (!raw) return;
        const v = Number(raw);
        if (Number.isFinite(v) && v >= 0.8 && v <= 1.3) {
          document.documentElement.style.setProperty("--ui-scale", String(v));
        }
      } catch (e) {
        console.error("loadScale error", e);
      }
    }

    function saveScale(v: number) {
      try {
        localStorage.setItem(SCALE_KEY, String(v));
      } catch (e) {
        console.error("saveScale error", e);
      }
    }

    function adjustScale(delta: number) {
      const current = Number(
        getComputedStyle(document.documentElement).getPropertyValue("--ui-scale"),
      );
      const next = Math.max(0.8, Math.min(1.3, current + delta));
      document.documentElement.style.setProperty("--ui-scale", String(next));
      saveScale(next);
    }

    function onWheelScale(e: WheelEvent) {
      if (!(e.metaKey || e.altKey)) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      adjustScale(delta);
    }

    function toggleMonthDropdown() {
      if (!monthDropdown || !monthPickerToggle) return;
      const willOpen = !monthDropdown.classList.contains("open");
      if (willOpen) {
        pickerYear = current.getFullYear();
        monthDropdown.classList.add("open");
        monthPickerToggle.classList.add("open");
        if (ymYearLabel) ymYearLabel.textContent = `${pickerYear}년`;
      } else {
        monthDropdown.classList.remove("open");
        monthPickerToggle.classList.remove("open");
      }
    }

    function closeMonthDropdown() {
      if (!monthDropdown || !monthPickerToggle) return;
      monthDropdown.classList.remove("open");
      monthPickerToggle.classList.remove("open");
    }

    function loadState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<State>;
        if (parsed && typeof parsed === "object") {
          if (parsed.cards && typeof parsed.cards === "object") state.cards = parsed.cards;
          if (parsed.weekVisibility && typeof parsed.weekVisibility === "object") {
            state.weekVisibility = parsed.weekVisibility;
          }
          if (typeof parsed.nextId === "number" && parsed.nextId > 0) state.nextId = parsed.nextId;
        }
      } catch (e) {
        console.error("loadState error", e);
        state = { nextId: 1, cards: {}, weekVisibility: {} };
      }
    }

    function saveState() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        console.error("saveState error", e);
      }
    }

    const getCardsForDate = (dateKey: string) => {
      const list = state.cards[dateKey];
      return Array.isArray(list) ? list : [];
    };

    const ensureCardList = (dateKey: string) => {
      if (!Array.isArray(state.cards[dateKey])) state.cards[dateKey] = [];
      return state.cards[dateKey];
    };

    function upsertCard(dateKey: string, cardObj: CardData) {
      const list = ensureCardList(dateKey);
      const id = cardObj.id;
      const idx = list.findIndex((c) => c.id === id);
      if (idx >= 0) list[idx] = cardObj;
      else list.push(cardObj);
      saveState();
    }

    function deleteCardFromState(dateKey: string, id: number) {
      const list = state.cards[dateKey];
      if (!Array.isArray(list)) return false;
      const initLen = list.length;
      state.cards[dateKey] = list.filter((c) => c.id !== id);
      const deleted = state.cards[dateKey].length < initLen;
      if (state.cards[dateKey].length === 0) delete state.cards[dateKey];
      if (deleted) saveState();
      return deleted;
    }

    function applyCardColorClass(card: HTMLElement, colorKey: string) {
      card.classList.remove("color-yellow", "color-green", "color-pink");
      if (colorKey === "yellow") card.classList.add("color-yellow");
      else if (colorKey === "green") card.classList.add("color-green");
      else if (colorKey === "pink") card.classList.add("color-pink");
    }

    function updateDayBadge(dateKey: string) {
      const cell = document.querySelector(`.day-cell[data-date="${dateKey}"]`);
      if (!cell) return;
      const metaEl = cell.querySelector(".day-meta");
      if (!metaEl) return;
      const isToday = cell.classList.contains("today");
      (metaEl as HTMLElement).textContent = isToday ? "오늘" : "";
    }

    function syncOneCardFromDom(card: HTMLDivElement) {
      const dateKey = card.dataset.date;
      const idStr = card.dataset.cardId;
      if (!dateKey || !idStr) return;
      const id = Number(idStr);
      if (!Number.isFinite(id)) return;

      const content = card.querySelector(".card-content");
      const text = content ? content.innerHTML ?? "" : "";
      const done = card.classList.contains("done");
      const color = card.dataset.color || "default";
      upsertCard(dateKey, { id, text, done, color });
    }

    function syncCurrentMonthFromDom() {
      const dayCells = document.querySelectorAll<HTMLDivElement>(".day-cell[data-date]");
      dayCells.forEach((cell) => {
        const dateKey = cell.dataset.date;
        if (!dateKey) return;
        const cards = Array.from(cell.querySelectorAll<HTMLDivElement>(".card"));
        if (cards.length === 0) {
          delete state.cards[dateKey];
          return;
        }
        const list: CardData[] = [];
        cards.forEach((card) => {
          const idStr = card.dataset.cardId;
          const id = Number(idStr);
          if (!Number.isFinite(id)) return;
          const content = card.querySelector(".card-content");
          const text = content ? content.innerHTML ?? "" : "";
          const done = card.classList.contains("done");
          const color = card.dataset.color || "default";
          list.push({ id, text, done, color });
        });
        state.cards[dateKey] = list;
      });
      saveState();
    }

    function makeEditable(card: HTMLDivElement) {
      const content = card.querySelector(".card-content") as HTMLDivElement | null;
      if (!content || content.isContentEditable) return;
      const safeContent: HTMLDivElement = content;

      safeContent.contentEditable = "true";
      safeContent.focus();
      const range = document.createRange();
      range.selectNodeContents(safeContent);
      range.collapse(false);
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }

      function onBlur() {
        safeContent.removeEventListener("blur", onBlur);
        safeContent.removeEventListener("keydown", onKey);
        safeContent.contentEditable = "false";
        syncOneCardFromDom(card);
      }
      function onKey(e: KeyboardEvent) {
        if (e.key === "Escape") {
          e.preventDefault();
          safeContent.blur();
        }
      }
      safeContent.addEventListener("blur", onBlur);
      safeContent.addEventListener("keydown", onKey);
    }

    function createCard(
      container: HTMLElement,
      cardData?: Partial<CardData>,
      options?: { autoEdit?: boolean; fromState?: boolean },
    ) {
      const opts = Object.assign({ autoEdit: true, fromState: false }, options || {});
      const hint = container.querySelector(".day-empty-hint") as HTMLElement | null;
      if (hint) hint.style.display = "none";

      const card = document.createElement("div");
      card.className = "card";
      const handle = document.createElement("div");
      handle.className = "card-handle";
      const content = document.createElement("div");
      content.className = "card-content";
      content.dataset.placeholder = "새 할 일을 적어보세요";

      const toolbar = document.createElement("div");
      toolbar.className = "card-toolbar";
      const btnColor = document.createElement("button");
      btnColor.className = "card-btn card-btn-color";
      btnColor.textContent = "색상";
      const btnDelete = document.createElement("button");
      btnDelete.className = "card-btn card-btn-delete";
      btnDelete.textContent = "삭제";
      toolbar.appendChild(btnColor);
      toolbar.appendChild(btnDelete);

      const text = cardData?.text ?? "";
      const done = !!cardData?.done;
      const color = cardData?.color ?? "default";
      let id = typeof cardData?.id === "number" ? cardData.id : null;
      if (!Number.isFinite(id) || (id ?? 0) <= 0) id = state.nextId++;

      card.dataset.cardId = String(id);
      card.id = `card-${id}`;
      card.dataset.color = color;
      applyCardColorClass(card, color);
      content.innerHTML = sanitizeToTextAndEmojis(text || "");

      content.addEventListener("focus", () => {
        lastFocusedContent = content;
        lastActiveCardContent = content;
      });

      content.addEventListener("mouseup", () => {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          lastRange = sel.getRangeAt(0).cloneRange();
        }
        lastActiveCardContent = content;
      });

      content.addEventListener("keyup", () => {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          lastRange = sel.getRangeAt(0).cloneRange();
        }
        lastActiveCardContent = content;
      });

      content.addEventListener("blur", () => {
        setTimeout(() => {
          if (keepFocusFromPalette) return;
          const active = document.activeElement as HTMLElement | null;
          if (active && (active.closest(".emoji-palette") || active.closest(".card-content"))) {
            return;
          }
          lastFocusedContent = null;
          lastRange = null;
          lastActiveCardContent = null;
        }, 0);
      });

      // 복사/붙여넣기: 텍스트+이모지(img dataURL)만 허용
      content.addEventListener("copy", (e) => {
        const sel = window.getSelection();
        if (!sel) return;
        const range = sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
        if (!range) return;
        const div = document.createElement("div");
        div.appendChild(range.cloneContents());
        const sanitized = sanitizeToTextAndEmojis(div.innerHTML);
        if (e.clipboardData) {
          e.clipboardData.setData("text/html", sanitized);
          e.clipboardData.setData("text/plain", div.textContent || "");
          e.preventDefault();
        }
      });

      content.addEventListener("paste", (e) => {
        e.preventDefault();
        const html = e.clipboardData?.getData("text/html");
        const plain = e.clipboardData?.getData("text/plain") ?? "";
        const sanitized = html ? sanitizeToTextAndEmojis(html) : plain;
        if (sanitized) {
          insertAtSelection(sanitized);
          syncOneCardFromDom(card);
          // 안전망
          setTimeout(() => syncOneCardFromDom(card), 0);
        }
      });

      const dayCell = container.closest(".day-cell") as HTMLElement | null;
      if (dayCell && dayCell.dataset.date) {
        const key = dayCell.dataset.date;
        card.dataset.date = key;
        if (!opts.fromState) {
          upsertCard(key, {
            id: id ?? 0,
            text,
            done,
            color,
          });
        }
      }

      if (done) card.classList.add("done");

      card.appendChild(handle);
      card.appendChild(content);
      card.appendChild(toolbar);
      container.appendChild(card);

      card.addEventListener("click", (e) => {
        if (e.shiftKey) {
          e.stopPropagation();
          toggleSelection(card);
          return;
        }
        const day = card.closest(".day-cell");
        setActiveDay(day as HTMLElement | null);
        const contentEl = card.querySelector(".card-content") as HTMLDivElement | null;
        if (!contentEl || contentEl.isContentEditable) return;
        makeEditable(card);
      });

      card.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        pushHistory();
        card.classList.toggle("done");
        syncOneCardFromDom(card);
        // 안전망: DOM 기준으로 재저장
        syncCurrentMonthFromDom();
        const dKey = card.dataset.date;
        if (dKey) updateDayBadge(dKey);
      });

      btnDelete.addEventListener("click", (e) => {
        e.stopPropagation();
        const selectedCards = Array.from(document.querySelectorAll<HTMLDivElement>(".card.selected"));
        const targets = selectedCards.length ? selectedCards : [card];
        deleteCards(targets);
      });

      btnColor.addEventListener("click", (e) => {
        e.stopPropagation();
        pushHistory();
        const currentColor = card.dataset.color || "default";
        const idx = CARD_COLORS.indexOf(currentColor as (typeof CARD_COLORS)[number]);
        const nextColor = CARD_COLORS[(idx + 1 + CARD_COLORS.length) % CARD_COLORS.length];
        card.dataset.color = nextColor;
        applyCardColorClass(card, nextColor);
        syncOneCardFromDom(card);
        // 안전망: DOM 기준으로 재저장
        syncCurrentMonthFromDom();
      });

      card.draggable = true;
      card.addEventListener("dragstart", (e) => {
        if (!card.classList.contains("selected")) {
          clearSelection();
          toggleSelection(card);
        }

        draggingCards = Array.from(
          document.querySelectorAll<HTMLDivElement>(".card.selected"),
        );
        if (!draggingCards.includes(card)) {
          draggingCards.push(card);
        }

        if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
        setTimeout(() => {
          draggingCards.forEach((c) => {
            c.style.opacity = "0.4";
          });
        }, 0);
      });

      card.addEventListener("dragend", () => {
        if (draggingCards) {
          draggingCards.forEach((c) => {
            c.style.opacity = "1";
          });
        }
        draggingCards = [];

        const targets = document.querySelectorAll(".day-cell.drop-target");
        targets.forEach((c) => c.classList.remove("drop-target"));
        if (dragPlaceholder && dragPlaceholder.parentElement) {
          dragPlaceholder.parentElement.removeChild(dragPlaceholder);
        }
        dragPlaceholder = null;
      });

      if (opts.autoEdit) {
        makeEditable(card);
      }

      return card;
    }

    function renderCalendar() {
      if (!calendarGrid) return;
      calendarGrid.innerHTML = "";
      lastActiveDayCell = null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 현재 표시 범위: startCursor ~ endCursor
      const viewYear = current.getFullYear();
      const viewMonth = current.getMonth();
      const startMonth = new Date(startCursor);
      const endMonth = new Date(endCursor);

      const firstOfRange = new Date(startMonth.getFullYear(), startMonth.getMonth(), 1);
      const lastOfRange = new Date(endMonth.getFullYear(), endMonth.getMonth(), 0); // endCursor는 다음달 1일(제외)

      const startDate = new Date(firstOfRange);
      const endDate = new Date(lastOfRange);
      const MS_PER_DAY = 24 * 60 * 60 * 1000;
      const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1;
      const columns = showWeekend ? 7 : 5;
      let leadingEmpty = 0;
      if (showWeekend) {
        leadingEmpty = (startDate.getDay() + 6) % 7; // Monday-first
      } else {
        const wd = startDate.getDay();
        leadingEmpty = wd >= 1 && wd <= 5 ? wd - 1 : 0; // Monday-first, weekends hidden
      }
      let renderedCount = 0;

      // 앞쪽 빈 셀로 요일 정렬
      for (let i = 0; i < leadingEmpty; i++) {
        const placeholder = document.createElement("div");
        placeholder.className = "day-cell placeholder";
        calendarGrid.appendChild(placeholder);
      }

      for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
        const cell = document.createElement("div");
        cell.className = "day-cell";

        const header = document.createElement("div");
        header.className = "day-header";
        const numEl = document.createElement("div");
        numEl.className = "day-number";
        const metaEl = document.createElement("div");
        metaEl.className = "day-meta";

        const body = document.createElement("div");
        body.className = "day-body";
        const hint = document.createElement("div");
        hint.className = "day-empty-hint";
        hint.textContent = "더블클릭해서 카드 추가";
        body.appendChild(hint);

        const thisDate = new Date(startDate);
        thisDate.setDate(startDate.getDate() + dayIndex);

        const jsDay = thisDate.getDay();
        if (!showWeekend && (jsDay === 0 || jsDay === 6)) {
          continue; // 주말 숨김
        }

        if (thisDate.getMonth() !== viewMonth) {
          cell.classList.add("other-month");
        }

        const w = thisDate.getDay(); // 0(일)~6(토)
        const dayOfMonth = thisDate.getDate();

        const label = WEEKDAY_NAMES_MON_FIRST[w === 0 ? 6 : w - 1];
        const mmdd = `${String(thisDate.getMonth() + 1).padStart(2, "0")}-${String(dayOfMonth).padStart(
          2,
          "0",
        )}`;
        const holidayName = FIXED_HOLIDAYS[mmdd];
        numEl.textContent = `${thisDate.getMonth() + 1}월 ${dayOfMonth}일(${label})${
          holidayName ? ` ${holidayName}` : ""
        }`;
        if (w === 0 || holidayName) numEl.classList.add("sun", "holiday");
        else if (w === 6) numEl.classList.add("sat");

        const key = formatDateKey(thisDate);
        cell.dataset.date = key;

        const cmp = new Date(thisDate.getTime());
        cmp.setHours(0, 0, 0, 0);
        if (cmp.getTime() === today.getTime()) {
          cell.classList.add("today");
          metaEl.textContent = "오늘";
        }

        const cards = getCardsForDate(key);
        if (cards.length > 0) hint.style.display = "none";
        cards.forEach((data) => {
          createCard(body, data, { autoEdit: false, fromState: true });
        });
        updateDayBadge(key);

        header.appendChild(numEl);
        header.appendChild(metaEl);
        cell.appendChild(header);
        cell.appendChild(body);
        calendarGrid.appendChild(cell);

        cell.addEventListener("mouseenter", () => {
          cell.classList.add("hovered-day");
        });

        cell.addEventListener("mouseleave", () => {
          cell.classList.remove("hovered-day");
        });

        cell.addEventListener("click", () => {
          setActiveDay(cell);
        });

        cell.addEventListener("dblclick", () => {
          if (!cell.dataset.date) return;
          pushHistory();
          createCard(body, { text: "", done: false, color: "default" }, { autoEdit: true, fromState: false });
          updateDayBadge(cell.dataset.date);
          setActiveDay(cell);
        });

          cell.addEventListener("dragover", (e) => {
            if (!draggingCards || draggingCards.length === 0) return;
            e.preventDefault();

          const allCells = document.querySelectorAll(".day-cell.drop-target");
          allCells.forEach((c) => c.classList.remove("drop-target"));
          cell.classList.add("drop-target");

          const bodyEl = cell.querySelector(".day-body");
          if (!bodyEl) return;

          if (!dragPlaceholder) {
            dragPlaceholder = document.createElement("div");
            dragPlaceholder.className = "card-placeholder";
          }

          const cardsInBody = Array.from(bodyEl.querySelectorAll<HTMLDivElement>(".card"));
          const filtered = cardsInBody.filter((c) => !draggingCards.includes(c));

          if (filtered.length === 0) {
            if (dragPlaceholder.parentElement !== bodyEl) {
              bodyEl.appendChild(dragPlaceholder);
            }
            return;
          }

          const mouseY = e.clientY;
          let inserted = false;
          for (const cardEl of filtered) {
            const rect = cardEl.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            if (mouseY < midY) {
              if (dragPlaceholder.parentElement !== bodyEl || dragPlaceholder.nextSibling !== cardEl) {
                bodyEl.insertBefore(dragPlaceholder, cardEl);
              }
              inserted = true;
              break;
            }
          }

          if (!inserted) {
            if (dragPlaceholder.parentElement !== bodyEl || dragPlaceholder.nextSibling != null) {
              bodyEl.appendChild(dragPlaceholder);
            }
          }
          });

          cell.addEventListener("drop", (e) => {
            e.preventDefault();
            if (!draggingCards || draggingCards.length === 0 || !cell.dataset.date) return;
            pushHistory();
            const newKey = cell.dataset.date;
            const bodyEl = cell.querySelector(".day-body");
            if (!bodyEl) return;

            if (dragPlaceholder && dragPlaceholder.parentElement === bodyEl) {
              draggingCards.forEach((c) => bodyEl.insertBefore(c, dragPlaceholder));
            } else {
              draggingCards.forEach((c) => bodyEl.appendChild(c));
            }

            const affectedDateKeys = new Set<string>();
            affectedDateKeys.add(newKey);

            draggingCards.forEach((card) => {
              const oldKey = card.dataset.date;
              if (oldKey) affectedDateKeys.add(oldKey);

              card.dataset.date = newKey;

              if (oldKey && oldKey !== newKey) {
                const idStr = card.dataset.cardId;
                const id = Number(idStr);
                if (Number.isFinite(id)) {
                  const oldList = getCardsForDate(oldKey);
                  const idx = oldList.findIndex((c) => c.id === id);
                  let obj: CardData | null = null;
                  if (idx >= 0) {
                    obj = oldList.splice(idx, 1)[0];
                    if (oldList.length === 0) delete state.cards[oldKey];
                  }

                  if (obj) {
                    const newList = ensureCardList(newKey);
                    newList.push(obj);
                  }
                }
              }
            });

            saveState();

            affectedDateKeys.forEach((key) => {
              updateDayBadge(key);
              const cellEl = document.querySelector(`.day-cell[data-date="${key}"]`);
              if (cellEl) {
                const bEl = cellEl.querySelector(".day-body");
                if (bEl) {
                  const h = bEl.querySelector(".day-empty-hint") as HTMLElement | null;
                  const hasCards = bEl.querySelector(".card");
                  if (h) h.style.display = hasCards ? "none" : "block";
                }
              }
            });

            const targets = document.querySelectorAll(".day-cell.drop-target");
            targets.forEach((c) => c.classList.remove("drop-target"));

            if (dragPlaceholder && dragPlaceholder.parentElement) {
              dragPlaceholder.parentElement.removeChild(dragPlaceholder);
            }
            if (draggingCards) {
              draggingCards.forEach((c) => {
                c.style.opacity = "1";
              });
            }
            dragPlaceholder = null;
            draggingCards = [];
          });
        }

      // 뒷쪽 빈 셀로 마지막 주 채우기
      const totalCells = leadingEmpty + renderedCount;
      const trailing = (columns - (totalCells % columns)) % columns;
      for (let i = 0; i < trailing; i++) {
        const placeholder = document.createElement("div");
        placeholder.className = "day-cell placeholder";
        calendarGrid.appendChild(placeholder);
      }

      // 선택 유지: 기존 선택된 날짜가 있으면 새 DOM에서 다시 표시
      if (lastActiveDateKey) {
        const activeCell = calendarGrid.querySelector<HTMLElement>(
          `.day-cell[data-date="${lastActiveDateKey}"]`,
        );
        if (activeCell) {
          activeCell.classList.add("active-day");
          lastActiveDayCell = activeCell;
        } else {
          lastActiveDateKey = null;
        }
      }

      // 스크롤 위치 기준으로 월 타이틀을 동기화
      syncMonthHeaderWithScroll();
    }

    const switchSearchScope = (mode: "month" | "all") => {
      searchMode = mode;
      if (mode === "month") {
        scopeMonthBtn.classList.add("active");
        scopeAllBtn.classList.remove("active");
        searchInput.placeholder = "이 달에서 검색";
      } else {
        scopeMonthBtn.classList.remove("active");
        scopeAllBtn.classList.add("active");
        searchInput.placeholder = "전체 기간 검색";
      }
      searchInput.focus();
    };

    function showToast(message: string) {
      if (!toastContainer) return;
      const toast = document.createElement("div");
      toast.className = "toast";
      toast.textContent = message;
      toastContainer.appendChild(toast);
      setTimeout(() => {
        toast.style.animation = "toast-out 0.3s ease forwards";
        toast.addEventListener("animationend", () => {
          toast.remove();
        });
      }, 3000);
    }

    function clearSearchHighlights() {
      document.querySelectorAll(".card.search-hit").forEach((c) => {
        c.classList.remove("search-hit");
      });
      if (searchInput) {
        searchInput.classList.remove("error");
      }
    }

    function highlightCard(card: HTMLElement) {
      card.classList.add("search-hit");
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        card.classList.remove("search-hit");
      }, 4000);
    }

    function handleSearchFail() {
      if (searchInput) {
        searchInput.classList.add("error");
      }
      showToast("검색 결과 없음");
      setTimeout(() => {
        if (searchInput) {
          searchInput.classList.remove("error");
        }
      }, 1500);
    }

    function runSearch() {
      const q = searchInput.value.trim().toLowerCase();
      clearSearchHighlights();

      if (!q) return;

      if (searchMode === "month") {
        const cards = Array.from(document.querySelectorAll<HTMLElement>(".card"));
        let found: HTMLElement | null = null;
        for (const card of cards) {
          const text = card.innerText.toLowerCase();
          if (text.includes(q)) {
            found = card;
            break;
          }
        }

        if (found) {
          highlightCard(found);
        } else {
          handleSearchFail();
        }
      } else {
        let foundDateKey: string | null = null;
        let foundCardId: number | null = null;
        const dateKeys = Object.keys(state.cards).sort();

        for (const key of dateKeys) {
          const list = state.cards[key];
          if (!Array.isArray(list)) continue;
          const match = list.find((c) => (c.text || "").toLowerCase().includes(q));
          if (match) {
            foundDateKey = key;
            foundCardId = match.id;
            break;
          }
        }

        if (foundDateKey && foundCardId) {
          const [y, m] = foundDateKey.split("-").map(Number);
          current = new Date(y, m - 1, 1);
          renderCalendar();

          setTimeout(() => {
            const targetCard = document.querySelector<HTMLElement>(
              `.card[data-card-id="${foundCardId}"]`,
            );
            if (targetCard) {
              highlightCard(targetCard);
            }
          }, 50);
        } else {
          handleSearchFail();
        }
      }
    }

    function ensureAirtableConfig() {
      if (!AIRTABLE_BASE_ID || !AIRTABLE_TABLE_NAME) {
        alert("Airtable 설정(Base ID / Table Name)이 비어 있습니다.");
        return false;
      }
      if (!AIRTABLE_TOKEN || AIRTABLE_TOKEN.includes("여기에_네_Airtable_토큰_붙여넣기")) {
        alert("Airtable 토큰이 설정되지 않았습니다. pat... 토큰을 AIRTABLE_TOKEN에 넣어주세요.");
        return false;
      }
      return true;
    }

    async function saveToAirtableSnapshot() {
      if (!ensureAirtableConfig()) return;
      try {
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
          AIRTABLE_TABLE_NAME,
        )}`;
        const snapshotName = new Date().toISOString().slice(0, 19).replace("T", " ");
        const snapshotJson = JSON.stringify(state);

        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${AIRTABLE_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            records: [
              {
                fields: {
                  cardID: snapshotName,
                  json: snapshotJson,
                },
              },
            ],
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          console.error("[Airtable] save error", res.status, res.statusText, text);
          alert(`에어테이블 저장 중 오류가 발생했습니다. (HTTP ${res.status})`);
          return;
        }

        alert("에어테이블에 스냅샷 저장 완료!");
      } catch (e) {
        console.error("saveToAirtableSnapshot error", e);
        alert("에어테이블 저장 중 예외가 발생했습니다. 콘솔을 확인해주세요.");
      }
    }

    async function loadFromAirtableSnapshot() {
      if (!ensureAirtableConfig()) return;
      try {
        const url =
          `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
            AIRTABLE_TABLE_NAME,
          )}` + `?maxRecords=1&sort[0][field]=createdTime&sort[0][direction]=desc`;

        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${AIRTABLE_TOKEN}`,
          },
        });

        if (!res.ok) {
          const text = await res.text();
          console.error("[Airtable] load error", res.status, res.statusText, text);
          alert("에어테이블에서 데이터 불러오기 실패. 콘솔을 확인해주세요.");
          return;
        }

        const data = await res.json();
        if (!data.records || data.records.length === 0) {
          alert("에어테이블에 저장된 스냅샷이 없습니다.");
          return;
        }

        const latest = data.records[0];
        const rawJson = latest.fields.json as string | undefined;
        if (!rawJson) {
          alert("마지막 스냅샷에 json 필드가 없습니다.");
          return;
        }

        const parsed = JSON.parse(rawJson) as State;
        if (!parsed || typeof parsed !== "object" || !parsed.cards || typeof parsed.nextId !== "number") {
          alert("스냅샷 구조가 예상과 다릅니다.");
          return;
        }

        state = parsed;
        saveState();
        renderCalendar();
        alert("에어테이블 스냅샷을 불러왔습니다!");
      } catch (e) {
        console.error("loadFromAirtableSnapshot error", e);
        alert("에어테이블에서 데이터 불러오는 중 예외가 발생했습니다. 콘솔을 확인해주세요.");
      }
    }

    loadState();
    pushHistory();
    loadScale();
    renderCalendar();

    // 이전/다음 달 버튼: 인피니트 스크롤과 함께 범위 재설정
    // prev/next 버튼은 숨김 상태 (동작 비활성)

    if (todayBtn) {
      todayBtn.addEventListener("click", () => {
        syncCurrentMonthFromDom();
        const now = new Date();
        current = new Date(now.getFullYear(), now.getMonth(), 1);
        startCursor = new Date(current.getFullYear(), current.getMonth(), 1);
        endCursor = new Date(current.getFullYear(), current.getMonth() + 1, 1);
        renderCalendar();
        requestAnimationFrame(() => {
          const target = document.querySelector<HTMLDivElement>(".day-cell.today");
          if (target) {
            const container = calendarWrapper || document.documentElement;
            const containerRect = container.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();
            const headerHeight = headerCollapsed ? 0 : 140;
            const desiredOffset = container.clientHeight * 0.5;
            const offset =
              targetRect.top - containerRect.top + container.scrollTop - headerHeight - desiredOffset;
            skipAutoExtend = true;
            container.scrollTo({ top: Math.max(offset, 0), behavior: "smooth" });
            setTimeout(() => {
              skipAutoExtend = false;
              syncMonthHeaderWithScroll();
            }, 450);
          } else if (calendarWrapper) {
            skipAutoExtend = true;
            calendarWrapper.scrollTop = 0;
            setTimeout(() => {
              skipAutoExtend = false;
              syncMonthHeaderWithScroll();
            }, 120);
          }
        });
      });
    }

    scopeMonthBtn.addEventListener("click", () => switchSearchScope("month"));
    scopeAllBtn.addEventListener("click", () => switchSearchScope("all"));

    searchBtn.addEventListener("click", runSearch);
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") runSearch();
    });

    if (monthPickerToggle) {
      monthPickerToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleMonthDropdown();
      });
    }

    document.addEventListener("click", (e) => {
      if (marqueeActive) return;
      const target = e.target as HTMLElement;
      if (target.closest(".card")) return;
      if (target.closest(".month-picker")) return;
      if (emojiPalette && emojiPalette.contains(target)) return;
      clearSelection();
      if (!target.closest(".card-content")) {
        lastFocusedContent = null;
        lastRange = null;
        lastActiveCardContent = null;
      }

      if (!monthDropdown || !monthPickerToggle) return;
      if (!monthDropdown.classList.contains("open")) return;
      const picker = monthPickerToggle.closest(".month-picker");
      if (picker && picker.contains(target)) return;
      closeMonthDropdown();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        clearSelection();
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (isEditableTarget(e.target as HTMLElement)) return;
        const selectedCards = Array.from(document.querySelectorAll<HTMLDivElement>(".card.selected"));
        if (!selectedCards.length) return;
        e.preventDefault();
        deleteCards(selectedCards);
      }
    });

    if (ymPrevYear && ymNextYear) {
      ymPrevYear.addEventListener("click", () => {
        pickerYear--;
        if (ymYearLabel) ymYearLabel.textContent = `${pickerYear}년`;
        updateMonthTitle(new Date(pickerYear, current.getMonth(), 1));
      });
      ymNextYear.addEventListener("click", () => {
        pickerYear++;
        if (ymYearLabel) ymYearLabel.textContent = `${pickerYear}년`;
        updateMonthTitle(new Date(pickerYear, current.getMonth(), 1));
      });
    }

    if (ymMonthButtons && ymMonthButtons.length) {
      ymMonthButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          const monthIndex = Number(btn.dataset.month);
          if (!Number.isFinite(monthIndex)) return;
          current.setFullYear(pickerYear);
          current.setMonth(monthIndex);
          current.setDate(1);
          startCursor = new Date(current.getFullYear(), current.getMonth(), 1);
          endCursor = new Date(current.getFullYear(), current.getMonth() + 1, 1);
          renderCalendar();
          requestAnimationFrame(() => {
            skipAutoExtend = true;
            if (calendarWrapper) calendarWrapper.scrollTop = 0;
            setTimeout(() => {
              skipAutoExtend = false;
              updateMonthTitle(current);
              syncMonthHeaderWithScroll();
            }, 80);
          });
          closeMonthDropdown();
        });
      });
    }

    if (airtableSaveBtn) airtableSaveBtn.addEventListener("click", saveToAirtableSnapshot);
    if (airtableLoadBtn) airtableLoadBtn.addEventListener("click", loadFromAirtableSnapshot);

    (window as typeof window & { _dumpState?: () => State })._dumpState = () =>
      JSON.parse(JSON.stringify(state));

    // 헤더 토글
    function setHeaderVisibility(collapsed: boolean) {
      headerCollapsed = collapsed;
      document.body.classList.toggle("header-collapsed", collapsed);
      if (headerToggle) {
        headerToggle.textContent = collapsed ? "헤더 보이기" : "헤더 숨기기";
      }
    }
    if (headerToggle) {
      headerToggle.addEventListener("click", () => setHeaderVisibility(!headerCollapsed));
      setHeaderVisibility(false);
    }

    // ===== 스크롤 동기화: 화면 상단에 보이는 일(또는 카드)의 월로 헤더 업데이트 =====
    let syncRaf = 0;
    function syncMonthHeaderWithScroll() {
      const days = Array.from(document.querySelectorAll<HTMLDivElement>(".day-cell")).filter(
        (cell) => !!cell.dataset.date,
      );
      if (!days.length) return;
      const container = calendarWrapper || document.documentElement;
      const baseline = container.scrollTop + container.clientHeight * 0.4; // 화면 40% 지점 기준
      let targetDate: Date | null = null;
      let bestGap = Number.POSITIVE_INFINITY;
      days.forEach((cell) => {
        const top = cell.offsetTop;
        const bottom = top + cell.offsetHeight;
        if (bottom < baseline) return; // 기준보다 완전히 위인 셀은 제외
        const gap = Math.abs(top - baseline);
        if (gap < bestGap) {
          bestGap = gap;
          const dateKey = cell.dataset.date;
          if (dateKey) {
            const [y, m, d] = dateKey.split("-").map(Number);
            targetDate = new Date(y, m - 1, d);
          }
        }
      });
      if (targetDate) updateMonthTitle(targetDate);
    }

    function onScrollThrottled() {
      if (syncRaf) return;
      syncRaf = requestAnimationFrame(() => {
        syncRaf = 0;
        syncMonthHeaderWithScroll();
      });
    }
    // 마퀴 선택 (빈 영역 드래그로 카드 다중 선택)
    function onMarqueeStart(e: MouseEvent) {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest(".card")) return; // 카드 위에서는 기존 드래그/클릭 우선
      marqueeActive = true;
      marqueeStart = { x: e.clientX, y: e.clientY };
      const box = ensureMarqueeBox();
      box.style.display = "block";
      box.style.left = `${e.clientX}px`;
      box.style.top = `${e.clientY}px`;
      box.style.width = "0px";
      box.style.height = "0px";
      clearSelection();
      document.addEventListener("mousemove", onMarqueeMove);
      document.addEventListener("mouseup", onMarqueeEnd, { once: true });
    }

    function onMarqueeMove(e: MouseEvent) {
      if (!marqueeStart || !marqueeBox) return;
      const x1 = Math.min(marqueeStart.x, e.clientX);
      const y1 = Math.min(marqueeStart.y, e.clientY);
      const x2 = Math.max(marqueeStart.x, e.clientX);
      const y2 = Math.max(marqueeStart.y, e.clientY);
      marqueeBox.style.left = `${x1}px`;
      marqueeBox.style.top = `${y1}px`;
      marqueeBox.style.width = `${x2 - x1}px`;
      marqueeBox.style.height = `${y2 - y1}px`;
      updateMarqueeSelection({ left: x1, top: y1, right: x2, bottom: y2 });
    }

    function onMarqueeEnd() {
      marqueeStart = null;
      if (marqueeBox) {
        marqueeBox.style.display = "none";
        marqueeBox.style.width = "0px";
        marqueeBox.style.height = "0px";
      }
      document.removeEventListener("mousemove", onMarqueeMove);
      setTimeout(() => {
        marqueeActive = false;
      }, 0);
    }

    function copySelectedCards(e: ClipboardEvent) {
      if (isEditableTarget(e.target as HTMLElement)) return;
      const selected = Array.from(document.querySelectorAll<HTMLDivElement>(".card.selected"));
      if (!selected.length) return;
      const data: CardData[] = selected.map((card) => {
        const content = card.querySelector(".card-content");
        return {
          id: Number(card.dataset.cardId) || 0,
          text: content ? content.textContent ?? "" : "",
          done: card.classList.contains("done"),
          color: card.dataset.color || "default",
        };
      });
      cardClipboard = data;
      if (e.clipboardData) {
        e.clipboardData.setData("application/json", JSON.stringify(data));
        e.clipboardData.setData(
          "text/plain",
          data.map((c) => c.text).join("\n\n"),
        );
        e.preventDefault();
      }
    }

    function pasteCards(e: ClipboardEvent) {
      if (isEditableTarget(e.target as HTMLElement)) return;
      const targetCell =
        lastActiveDayCell ||
        (lastActiveDateKey
          ? calendarGrid.querySelector<HTMLElement>(`.day-cell[data-date="${lastActiveDateKey}"]`)
          : null);
      if (!targetCell) {
        showToast("붙여넣기할 날짜 칸을 먼저 클릭하세요.");
        return;
      }
      const bodyEl = targetCell.querySelector(".day-body");
      if (!bodyEl) return;

      let data: CardData[] = [];
      const jsonStr = e.clipboardData?.getData("application/json");
      if (jsonStr) {
        try {
          const parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed)) {
            data = parsed
              .map((c) => ({
                text: c.text ?? "",
                done: !!c.done,
                color: c.color ?? "default",
              }))
              .filter((c) => typeof c.text === "string");
          }
        } catch {
          /* ignore */
        }
      }
      if (!data.length && cardClipboard.length) {
        data = cardClipboard.map((c) => ({
          text: c.text,
          done: c.done,
          color: c.color,
        }));
      }
      if (!data.length) return;
      e.preventDefault();
      pushHistory();

      data.forEach((c) => {
        const created = createCard(
          bodyEl,
          { text: c.text, done: c.done, color: c.color },
          { autoEdit: false, fromState: false },
        );
      });
      const key = targetCell.dataset.date;
      if (key) updateDayBadge(key);
      syncCurrentMonthFromDom();
    }

    // 인피니트 스크롤: 상/하단 근접 시 범위 확장
    let loadingPrev = false;
    let loadingNext = false;
    let skipAutoExtend = false;

    function extendRange(direction: "prev" | "next") {
      const container = calendarWrapper || document.documentElement;
      const prevHeight = container.scrollHeight;
      if (direction === "prev") {
        startCursor = new Date(startCursor.getFullYear(), startCursor.getMonth() - 1, 1);
        loadingPrev = true;
        renderCalendar();
        const newHeight = container.scrollHeight;
        const diff = newHeight - prevHeight;
        container.scrollTop += diff > 0 ? diff : 0; // 스크롤 위치 보정
        loadingPrev = false;
      } else {
        endCursor = new Date(endCursor.getFullYear(), endCursor.getMonth() + 1, 1);
        loadingNext = true;
        renderCalendar();
        loadingNext = false;
      }
    }

    function onCalendarScroll() {
      const container = calendarWrapper || document.documentElement;
      const scrollTop = container.scrollTop;
      const clientHeight = container.clientHeight;
      const scrollHeight = container.scrollHeight;

      if (skipAutoExtend) {
        return;
      }

      if (scrollTop < 120 && !loadingPrev) {
        extendRange("prev");
      } else if (scrollTop + clientHeight > scrollHeight - 200 && !loadingNext) {
        extendRange("next");
      }
      onScrollThrottled();
    }

    if (calendarWrapper) {
      calendarWrapper.addEventListener("scroll", onCalendarScroll);
      calendarWrapper.addEventListener("mousedown", onMarqueeStart);
    } else {
      window.addEventListener("scroll", onCalendarScroll);
      window.addEventListener("mousedown", onMarqueeStart);
    }

    if (weekendToggleBtn) {
      weekendToggleBtn.addEventListener("click", () => {
        showWeekend = !showWeekend;
        toggleWeekendUI();
        renderCalendar();
      });
    }

    (calendarWrapper || window).addEventListener("wheel", onWheelScale, { passive: false });
    document.addEventListener("copy", copySelectedCards);
    document.addEventListener("paste", pasteCards);

    if (scaleResetBtn) {
      scaleResetBtn.addEventListener("click", () => {
        document.documentElement.style.setProperty("--ui-scale", "1");
        saveScale(1);
      });
    }

    // selectionchange로 마지막 커서 위치 추적
    document.addEventListener("selectionchange", () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const anchor = range.startContainer as HTMLElement | null;
      const el = anchor ? (anchor.nodeType === 3 ? anchor.parentElement : anchor) : null;
      if (el && el.closest(".card-content")) {
        lastRange = range.cloneRange();
        const cont = el.closest(".card-content") as HTMLDivElement | null;
        lastFocusedContent = cont;
        lastActiveCardContent = cont;
      }
    });

    // ========== 이모지 업로드 & 팔레트 ==========
    const emojiTrigger = document.getElementById("emojiTrigger") as HTMLButtonElement | null;
    const emojiUploadTrigger = document.getElementById(
      "emojiUploadTrigger",
    ) as HTMLButtonElement | null;
    const emojiUpload = document.getElementById("emojiUpload") as HTMLInputElement | null;
    const emojiPalette = document.getElementById("emojiPalette") as HTMLElement | null;

    function renderEmojiPalette() {
      if (!emojiPalette) return;
      const oldList = emojiPalette.querySelector<HTMLElement>("#emojiPaletteList");
      const listEl = document.createElement("div");
      listEl.id = "emojiPaletteList";
      listEl.className = "emoji-list";
      if (oldList) {
        emojiPalette.replaceChild(listEl, oldList);
      } else {
        emojiPalette.appendChild(listEl);
      }

      const seen = new Set<string>();

      // 전체 이모지 풀: 기본 + 업로드
      const allEmojis: Array<
        | { type: "default"; id: string; ch: string }
        | { type: "upload"; id: string; src: string; name: string }
      > = [
        ...DEFAULT_EMOJIS.map((d) => ({ type: "default" as const, id: d.id, ch: d.ch })),
        ...emojiList.map((u) => ({ type: "upload" as const, id: u.id, src: u.src, name: u.name })),
      ];

      // 순서 적용
      const mapAll = new Map(allEmojis.map((e) => [e.id, e]));
      const ordered: typeof allEmojis = [];
      emojiOrder.forEach((id) => {
        const item = mapAll.get(id);
        if (item) {
          ordered.push(item);
          mapAll.delete(id);
        }
      });
      mapAll.forEach((item) => ordered.push(item));
      // 저장된 순서가 비어있다면 기본 순서로 초기화
      if (!emojiOrder.length) {
        emojiOrder = ordered.map((e) => e.id);
        saveEmojiOrder();
      }

      let placeholder: HTMLDivElement | null = null;

      function ensurePlaceholder() {
        if (placeholder) return placeholder;
        const ph = document.createElement("div");
        ph.className = "emoji-placeholder";
        placeholder = ph;
        return ph;
      }

      const buildBtn = (emoji: (typeof ordered)[number]) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "emoji-btn";
        btn.draggable = true;

        btn.addEventListener("dragstart", (e) => {
          btn.classList.add("dragging");
          draggingEmojiId = emoji.id;
          if (e.dataTransfer) {
            e.dataTransfer.setData("text/plain", emoji.id);
            e.dataTransfer.effectAllowed = "move";
          }
        });

        btn.addEventListener("dragend", () => {
          btn.classList.remove("dragging");
          draggingEmojiId = null;
          if (placeholder && placeholder.parentElement) placeholder.parentElement.removeChild(placeholder);
          placeholder = null;
        });

        const runInsert = (html: string) => {
          const targetContent = lastFocusedContent || lastActiveCardContent;
          if (!targetContent || !targetContent.closest(".card")) {
            showToast("카드를 먼저 클릭해 주세요.");
            return;
          }
          const sel = window.getSelection();
          sel?.removeAllRanges();
          targetContent.focus();
          if (lastRange) {
            sel?.addRange(lastRange);
          } else if (targetContent) {
            const r = document.createRange();
            r.selectNodeContents(targetContent);
            r.collapse(false);
            sel?.addRange(r);
            lastRange = r.cloneRange();
          }
          const ok = insertAtSelection(html, { strictCard: true });
          if (!ok) {
            showToast("카드를 먼저 클릭해 주세요.");
            return;
          }
          const focusedCard = targetContent.closest(".card");
          if (focusedCard) syncOneCardFromDom(focusedCard as HTMLDivElement);
        };

        if (emoji.type === "default") {
          btn.textContent = emoji.ch;
          btn.addEventListener("click", () => runInsert(emoji.ch));
        } else {
          const img = document.createElement("img");
          img.src = emoji.src;
          img.alt = emoji.name || "emoji";
          btn.appendChild(img);
          btn.addEventListener("click", () =>
            runInsert(`<img class="emoji-img" src="${emoji.src}">`),
          );
        }
        return btn;
      };

      ordered.forEach((emoji) => {
        if (emoji.type === "upload" && seen.has(emoji.src)) return;
        if (emoji.type === "default" && seen.has(emoji.ch)) return;
        seen.add(emoji.type === "upload" ? emoji.src : emoji.ch);
        listEl.appendChild(buildBtn(emoji));
      });

      listEl.addEventListener("dragover", (e) => {
        if (!draggingEmojiId) return;
        e.preventDefault();
        const ph = ensurePlaceholder();
        const target = (e.target as HTMLElement).closest(".emoji-btn");
        const children = Array.from(listEl.children);
        if (target && target.parentElement === listEl) {
          const rect = target.getBoundingClientRect();
          const before = e.clientY < rect.top + rect.height / 2;
          if (before) {
            listEl.insertBefore(ph, target);
          } else {
            listEl.insertBefore(ph, target.nextSibling);
          }
        } else if (!ph.parentElement) {
          listEl.appendChild(ph);
        }
      });

      listEl.addEventListener("drop", (e) => {
        if (!draggingEmojiId) return;
        e.preventDefault();
        const ph = placeholder;
        const children = Array.from(listEl.children);
        let targetIndex = ph ? children.indexOf(ph) : children.length;
        if (targetIndex < 0) targetIndex = children.length;
        if (ph && ph.parentElement) ph.parentElement.removeChild(ph);
        placeholder = null;

        const order = emojiOrder.filter((id) => id !== draggingEmojiId);
        const clamped = Math.max(0, Math.min(targetIndex, order.length));
        order.splice(clamped, 0, draggingEmojiId);
        emojiOrder = order;
        saveEmojiOrder();
        renderEmojiPalette();
      });

      listEl.addEventListener("dragleave", (e) => {
        if (!draggingEmojiId) return;
        const related = e.relatedTarget as HTMLElement | null;
        if (related && listEl.contains(related)) return;
        if (placeholder && placeholder.parentElement) placeholder.parentElement.removeChild(placeholder);
        placeholder = null;
      });
    }

    function handleEmojiFile(file: File) {
      const reader = new FileReader();
      reader.onload = () => {
        const src = typeof reader.result === "string" ? reader.result : "";
        if (!src.startsWith("data:image/")) {
          alert("이미지 파일만 업로드 가능합니다.");
          return;
        }
        // 중복 방지
        if (emojiList.some((e) => e.src === src)) {
          renderEmojiPalette();
          return;
        }
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        emojiList.unshift({ id, src, name: file.name });
        emojiList = emojiList.slice(0, 40); // 제한
        emojiOrder.unshift(id);
        emojiOrder = emojiOrder.slice(0, DEFAULT_EMOJIS.length + 40);
        saveEmojis();
        saveEmojiOrder();
        renderEmojiPalette();
      };
      reader.readAsDataURL(file);
    }

    if (emojiUpload) {
      emojiUpload.addEventListener("change", () => {
        const file = emojiUpload.files?.[0];
        if (file) handleEmojiFile(file);
        emojiUpload.value = "";
      });
    }

    if (emojiUploadTrigger && emojiUpload) {
      emojiUploadTrigger.addEventListener("click", () => emojiUpload.click());
    }

    if (emojiTrigger && emojiPalette) {
      // 트리거 클릭 시 포커스가 카드에서 이동하지 않도록 mousedown 막기
      emojiTrigger.addEventListener("mousedown", (e) => {
        keepFocusFromPalette = true;
        e.preventDefault();
        if (lastActiveCardContent) {
          lastActiveCardContent.focus();
          const sel = window.getSelection();
          sel?.removeAllRanges();
          if (lastRange) sel?.addRange(lastRange);
        }
      });

      emojiTrigger.addEventListener("click", () => {
        emojiPalette.classList.toggle("open");
        // 클릭 직후에도 포커스/커서 복원
        if (lastActiveCardContent) {
          lastActiveCardContent.focus();
          const sel = window.getSelection();
          sel?.removeAllRanges();
          if (lastRange) sel?.addRange(lastRange);
        }
        keepFocusFromPalette = false;
      });
      emojiPalette.addEventListener("pointerdown", (e) => {
        const dragBtn = (e.target as HTMLElement).closest(".emoji-btn");
        if (dragBtn && dragBtn instanceof HTMLButtonElement && dragBtn.draggable) {
          keepFocusFromPalette = true;
          return; // 드래그를 막지 않음
        }
        keepFocusFromPalette = true;
        e.preventDefault();
        if (lastFocusedContent) {
          lastFocusedContent.focus();
          const sel = window.getSelection();
          sel?.removeAllRanges();
          if (lastRange) sel?.addRange(lastRange);
        }
      });
      emojiPalette.addEventListener("pointerup", () => {
        setTimeout(() => {
          keepFocusFromPalette = false;
        }, 0);
      });
      document.addEventListener("click", (e) => {
        const t = e.target as HTMLElement;
        if (emojiPalette.contains(t) || emojiTrigger.contains(t)) return;
        emojiPalette.classList.remove("open");
      });
    }

    loadEmojis();
    loadEmojiOrder();
    renderEmojiPalette();

    toggleWeekendUI();
  }, []);

  return (
    <div className="app">
      <div className="main-glass-panel">
        <button className="btn header-toggle" id="headerToggle">
          헤더 숨기기
        </button>
        <header>
          <div className="title">MUCHI NOTE</div>
          <div className="hint">
            💡 날짜 더블클릭 = 새 카드 · 카드 클릭 = 수정 · 카드 더블클릭 = 완료 토글 · 드래그로 이월 · 주 제목 클릭
            = 주별 접기/펼치기 · 카드 색상 버튼으로 슬롯 색 바꾸기
          </div>
        </header>

        <div className="top-bar">
          <button className="btn" id="prevMonth">
            &lt; 이전 달
          </button>
          <div className="month-picker">
            <button className="month-display" id="monthPickerToggle" type="button">
              <span className="month-title" id="monthTitle" />
              <span className="month-caret">▾</span>
            </button>
            <div className="month-dropdown" id="monthDropdown">
              <div className="ym-header">
                <button type="button" className="ym-year-btn" id="ymPrevYear">
                  ‹
                </button>
                <span className="ym-year-label" id="ymYearLabel" />
                <button type="button" className="ym-year-btn" id="ymNextYear">
                  ›
                </button>
              </div>
              <div className="ym-month-grid">
                <button type="button" className="ym-month-btn" data-month="0">
                  1월
                </button>
                <button type="button" className="ym-month-btn" data-month="1">
                  2월
                </button>
                <button type="button" className="ym-month-btn" data-month="2">
                  3월
                </button>
                <button type="button" className="ym-month-btn" data-month="3">
                  4월
                </button>
                <button type="button" className="ym-month-btn" data-month="4">
                  5월
                </button>
                <button type="button" className="ym-month-btn" data-month="5">
                  6월
                </button>
                <button type="button" className="ym-month-btn" data-month="6">
                  7월
                </button>
                <button type="button" className="ym-month-btn" data-month="7">
                  8월
                </button>
                <button type="button" className="ym-month-btn" data-month="8">
                  9월
                </button>
                <button type="button" className="ym-month-btn" data-month="9">
                  10월
                </button>
                <button type="button" className="ym-month-btn" data-month="10">
                  11월
                </button>
                <button type="button" className="ym-month-btn" data-month="11">
                  12월
                </button>
              </div>
            </div>
          </div>
          <button className="btn" id="nextMonth">
            다음 달 &gt;
          </button>
          {/* 오늘 버튼 추가 */}
          <button className="btn btn-today" id="todayBtn">
            오늘
          </button>
          <button className="btn" id="weekendToggle">
            주말 숨기기
          </button>

          <div className="search-wrap">
            <div className="search-scope-toggles">
              <button className="scope-btn active" id="scopeMonth">
                이번 달
              </button>
              <button className="scope-btn" id="scopeAll">
                전체
              </button>
            </div>
            <input className="search-input" id="searchInput" type="text" placeholder="검색어 입력" />
          <button className="btn" id="searchBtn">
            검색
          </button>
          <div className="emoji-panel">
            <button className="btn" id="emojiTrigger" type="button">
              이모지
            </button>
            <input id="emojiUpload" type="file" accept="image/*" style={{ display: "none" }} />
            <div className="emoji-palette" id="emojiPalette">
              <div className="emoji-upload-row">
                <button className="btn" id="emojiUploadTrigger" type="button">
                  업로드
                </button>
              </div>
            </div>
          </div>
          <div className="scale-control">
            <button className="btn" id="scaleReset" type="button">
              🔍 100%
            </button>
          </div>
        </div>
      </div>

        <div className="calendar-wrapper">
          <div className="weekday-row">
            <div>월</div>
            <div>화</div>
            <div>수</div>
            <div>목</div>
            <div>금</div>
            <div>토</div>
            <div>일</div>
          </div>
          <div className="calendar-grid" id="calendarGrid" />
        </div>
      </div>

      <div id="toastContainer" className="toast-container" />

      <div className="help-bar">
        ✏️ 날짜 칸 <b>더블클릭</b> → 새 카드 · 카드 <b>클릭</b> → 내용 수정 · 카드 <b>더블클릭</b> → 완료/해제 · 카드{" "}
        <b>왼쪽 막대 드래그</b> → 다른 날짜로 이동 · <b>주 제목 클릭</b>으로 주별 접기/펼치기 · 카드 툴바의 <b>색상</b>{" "}
        버튼으로 슬롯 색상 변경
        <span className="debug-hint">
          (💾 / 📥 버튼이 동작하지 않으면 브라우저 콘솔의 에러 메시지를 함께 확인해 주세요)
        </span>
      </div>
    </div>
  );
}
