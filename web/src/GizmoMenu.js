// A menu bar with dropdown menus and submenus, as web components:
//
//   <gizmo-menubar>
//     <gizmo-menu label="Shading">
//       <gizmo-menu label="Modes">                       (a submenu)
//         <gizmo-menu-item type="radio" name="mode" value="pixel" checked>Pixel</gizmo-menu-item>
//       </gizmo-menu>
//       <gizmo-menu-item type="checkbox" name="textured">Textured</gizmo-menu-item>
//       <gizmo-menu-item name="reset">Reset</gizmo-menu-item>   (a plain action)
//     </gizmo-menu>
//   </gizmo-menubar>
//
// Choosing an item fires "menuselect" on it (it bubbles) with
// detail = { item, name, value, checked }. A checkbox item toggles itself and a
// radio item unchecks the other radios with the same name before the event.
//
// Mouse: click a menu to open it; while one is open, hovering moves between
// menus. Keyboard (ARIA menubar pattern): arrows, Home/End, Enter/Space, Escape.
// Items and menus can be added or removed at any time.

const template = (html) => {
  const t = document.createElement("template");
  t.innerHTML = html;
  return t;
};

// The page's "* { padding: 0; margin: 0 }" beats :host styles, so the padding
// lives on elements inside the shadow roots.
const ROW_STYLE = `
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px 8px 8px;
    white-space: nowrap;
    cursor: pointer;
  }
  .check {
    flex: none;
    width: 14px;
    text-align: center;
    color: var(--yellow, #f3a200);
  }
  .label {
    flex: 1;
  }
`;

const ItemTemplate = template(`
<style>
  :host {
    display: block;
    outline: none;
  }
  :host([hidden]) {
    display: none;
  }
  ${ROW_STYLE}
  :host(:focus) .row {
    background-color: var(--color-b, #525252);
  }
  :host([disabled]) .row {
    opacity: 0.4;
    cursor: default;
  }
  /* Marks the pixel font has: square root as the check, bullet as the radio. */
  :host([type="checkbox"][checked]) .check::before {
    content: "\\221A";
  }
  :host([type="radio"][checked]) .check::before {
    content: "\\2022";
  }
</style>
<div class="row" part="row">
  <span class="check" part="check"></span>
  <span class="label" part="label"><slot></slot></span>
</div>
`);

export class GizmoMenuItem extends HTMLElement {
  static observedAttributes = ["type", "checked", "disabled"];

  constructor() {
    super();
    this.attachShadow({ mode: "open" }).appendChild(ItemTemplate.content.cloneNode(true));
  }

  connectedCallback() {
    if (!this.hasAttribute("tabindex")) this.tabIndex = -1;
    this.#update_aria();
  }
  attributeChangedCallback() {
    this.#update_aria();
  }

  // "checkbox", "radio", or "" (a plain action).
  get type() {
    const type = this.getAttribute("type");
    return type === "checkbox" || type === "radio" ? type : "";
  }
  set type(val) {
    this.setAttribute("type", val);
  }
  get checked() {
    return this.hasAttribute("checked");
  }
  set checked(val) {
    this.toggleAttribute("checked", Boolean(val));
  }
  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(val) {
    this.toggleAttribute("disabled", Boolean(val));
  }
  get name() {
    return this.getAttribute("name") ?? "";
  }
  set name(val) {
    this.setAttribute("name", val);
  }
  // The "value" attribute, or the item's text.
  get value() {
    return this.getAttribute("value") ?? this.textContent.trim();
  }
  set value(val) {
    this.setAttribute("value", val);
  }

  #update_aria() {
    const role = { checkbox: "menuitemcheckbox", radio: "menuitemradio" }[this.type] ?? "menuitem";
    this.setAttribute("role", role);
    if (this.type) this.setAttribute("aria-checked", String(this.checked));
    else this.removeAttribute("aria-checked");
    this.setAttribute("aria-disabled", String(this.disabled));
  }
}

const MenuTemplate = template(`
<style>
  :host {
    position: relative;
    display: block;
    outline: none;
  }
  :host([hidden]) {
    display: none;
  }
  ${ROW_STYLE}
  /* A pixel-exact triangle (the font has none). */
  .arrow {
    flex: none;
    width: 0;
    height: 0;
    border-left: 4px solid currentColor;
    border-top: 4px solid transparent;
    border-bottom: 4px solid transparent;
  }
  /* Submenu (inside another menu): looks like an item with an arrow. */
  :host(:focus) .row,
  :host([open]) .row {
    background-color: var(--color-b, #525252);
  }
  /* Menu on the bar. */
  :host([top]) {
    display: flex;
  }
  :host([top]) .row {
    padding: 8px 14px;
    border-bottom: 2px solid transparent;
  }
  :host([top]) .check,
  :host([top]) .arrow {
    display: none;
  }
  :host([top]) .row:hover,
  :host([top]:focus) .row {
    background-color: var(--color-b, #525252);
  }
  :host([top][open]) .row {
    background-color: transparent;
    color: var(--yellow, #f3a200);
    border-bottom-color: var(--yellow, #f3a200);
  }
  :host([disabled]) .row {
    opacity: 0.4;
    cursor: default;
  }

  .panel {
    position: absolute;
    z-index: 1;
    display: none;
    flex-direction: column;
    min-width: 180px;
    box-sizing: border-box;
    background-color: var(--black, #000);
    border: 2px solid var(--yellow, #f3a200);
    cursor: default;
  }
  :host([open]) .panel {
    display: flex;
  }
  :host([top]) .panel {
    top: 100%;
    left: 0;
  }
  :host(:not([top])) .panel {
    top: -2px;
    left: 100%;
  }
  /* Long lists scroll (only panels without submenus: scrolling would clip them). */
  .panel.scroll {
    max-height: 60vh;
    overflow-y: auto;
  }
  .empty {
    display: none;
    padding: 8px 14px;
    color: var(--color-c, #9e9e9e);
    font-style: italic;
    white-space: nowrap;
  }
  .panel.is-empty .empty {
    display: block;
  }
</style>
<div class="row" part="trigger">
  <span class="check"></span>
  <span class="label" part="label"></span>
  <span class="arrow" aria-hidden="true"></span>
</div>
<div class="panel" part="panel" role="menu">
  <slot></slot>
  <span class="empty">(empty)</span>
</div>
`);

export class GizmoMenu extends HTMLElement {
  static observedAttributes = ["label", "open", "disabled"];

  #trigger;
  #label;
  #panel;

  constructor() {
    super();
    this.attachShadow({ mode: "open" }).appendChild(MenuTemplate.content.cloneNode(true));
    this.#trigger = this.shadowRoot.querySelector(".row");
    this.#label = this.shadowRoot.querySelector(".label");
    this.#panel = this.shadowRoot.querySelector(".panel");
    this.shadowRoot.querySelector("slot").addEventListener("slotchange", () => this.#sync_panel());
  }

  connectedCallback() {
    if (!this.hasAttribute("tabindex")) this.tabIndex = -1;
    this.toggleAttribute("top", this.parentElement?.localName === "gizmo-menubar");
    this.setAttribute("role", "menuitem");
    this.setAttribute("aria-haspopup", "menu");
    this.setAttribute("aria-expanded", String(this.open));
    this.#sync_panel();
  }
  attributeChangedCallback(name) {
    if (name === "label") this.#label.textContent = this.label;
    if (name === "open") this.setAttribute("aria-expanded", String(this.open));
    if (name === "disabled") this.setAttribute("aria-disabled", String(this.disabled));
  }

  get label() {
    return this.getAttribute("label") ?? "";
  }
  set label(val) {
    this.setAttribute("label", val);
  }
  get open() {
    return this.hasAttribute("open");
  }
  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(val) {
    this.toggleAttribute("disabled", Boolean(val));
  }
  get top() {
    return this.hasAttribute("top");
  }
  // The menu's own items and submenus, in order.
  get entries() {
    return entries_of(this);
  }
  // Whether an event happened on the menu's own row (not inside its panel).
  is_trigger_event(e) {
    return e.composedPath().includes(this.#trigger);
  }

  #sync_panel() {
    this.#panel.classList.toggle("scroll", !this.querySelector(":scope > gizmo-menu"));
    this.#panel.classList.toggle("is-empty", !this.entries.length);
  }
}

const BarTemplate = template(`
<style>
  :host {
    position: relative;
    z-index: 20;
    display: flex;
    align-items: stretch;
    background-color: var(--black, #000);
    color: var(--color-d, #ededed);
    font-family: var(--font, monospace);
    font-size: 16px;
    font-weight: normal;
    text-transform: uppercase;
    user-select: none;
  }
</style>
<slot></slot>
`);

// Tag names, not class checks: children can still be un-upgraded while their
// parent is set up (the elements are defined one after the other).
const is_menu = (el) => el?.localName === "gizmo-menu";
const is_item = (el) => el?.localName === "gizmo-menu-item";
const is_entry = (el) => is_menu(el) || is_item(el);
const entries_of = (parent) => [...parent.children].filter((el) => is_entry(el) && !el.hidden);
const usable = (el) => !el.disabled;

export class GizmoMenuBar extends HTMLElement {
  #on_outside = (e) => {
    if (!e.composedPath().includes(this)) this.close();
  };

  constructor() {
    super();
    this.attachShadow({ mode: "open" }).appendChild(BarTemplate.content.cloneNode(true));
    this.shadowRoot.querySelector("slot").addEventListener("slotchange", () => this.#sync_tabindex());
    this.addEventListener("click", (e) => this.#on_click(e));
    this.addEventListener("pointerover", (e) => this.#on_hover(e));
    this.addEventListener("keydown", (e) => this.#on_key(e));
    this.addEventListener("focusout", (e) => {
      if (!this.contains(e.relatedTarget)) this.close();
    });
  }

  connectedCallback() {
    this.setAttribute("role", "menubar");
    document.addEventListener("pointerdown", this.#on_outside, true);
    this.#sync_tabindex();
  }
  disconnectedCallback() {
    document.removeEventListener("pointerdown", this.#on_outside, true);
  }

  get menus() {
    return entries_of(this).filter(is_menu);
  }
  get is_open() {
    return this.menus.some((m) => m.open);
  }

  // Closes every menu.
  close() {
    for (const menu of this.menus) this.#close_menu(menu);
  }

  // Tab reaches the bar once, on its first menu.
  #sync_tabindex() {
    this.menus.forEach((menu, i) => (menu.tabIndex = i === 0 ? 0 : -1));
  }

  // Opens `menu` (closing its open siblings); focus = "first" / "last" / null.
  #open_menu(menu, focus = null) {
    if (menu.disabled) return;
    for (const sibling of entries_of(menu.parentElement)) {
      if (sibling !== menu && is_menu(sibling)) this.#close_menu(sibling);
    }
    menu.toggleAttribute("open", true);
    const entries = menu.entries.filter(usable);
    const target = focus === "first" ? entries[0] : focus === "last" ? entries[entries.length - 1] : null;
    target?.focus();
  }
  #close_menu(menu) {
    if (!menu.open) return;
    for (const child of menu.entries) if (is_menu(child)) this.#close_menu(child);
    menu.removeAttribute("open");
  }
  // Closes the open submenus next to `entry` (hovering another item of the same menu).
  #close_siblings(entry) {
    for (const sibling of entries_of(entry.parentElement)) {
      if (sibling !== entry && is_menu(sibling)) this.#close_menu(sibling);
    }
  }

  // From the keyboard the focus goes back to the item's menu on the bar; from
  // the mouse it leaves the bar, so the keys go back to the page (the game).
  #activate(item, keyboard = false) {
    if (item.disabled) return;
    const top = item.closest("gizmo-menubar > gizmo-menu");
    if (item.type === "checkbox") item.checked = !item.checked;
    if (item.type === "radio") {
      for (const other of entries_of(item.parentElement)) {
        if (is_item(other) && other.type === "radio" && other.name === item.name) {
          other.checked = other === item;
        }
      }
    }
    this.close();
    if (keyboard) top?.focus();
    else if (this.contains(document.activeElement)) document.activeElement.blur();
    item.dispatchEvent(
      new CustomEvent("menuselect", {
        bubbles: true,
        composed: true,
        detail: { item, name: item.name, value: item.value, checked: item.checked },
      }),
    );
  }

  #entry_of(e) {
    const entry = e.target.closest?.("gizmo-menu, gizmo-menu-item");
    return entry && this.contains(entry) ? entry : null;
  }

  #on_click(e) {
    const entry = this.#entry_of(e);
    if (!entry || entry.disabled) return;
    if (is_item(entry)) {
      this.#activate(entry);
      return;
    }
    if (!entry.is_trigger_event(e)) return; // a click on the panel's border
    if (entry.top) {
      if (entry.open) {
        this.close();
        entry.blur();
      } else {
        this.#open_menu(entry);
        entry.focus();
      }
    } else {
      this.#open_menu(entry);
    }
  }

  #on_hover(e) {
    const entry = this.#entry_of(e);
    if (!entry || e.pointerType === "touch") return;
    if (is_menu(entry) && entry.top) {
      // Moving along the bar while a menu is open switches menus.
      if (this.is_open && !entry.open && !entry.disabled) {
        this.#open_menu(entry);
        entry.focus();
      }
      return;
    }
    if (is_menu(entry) && !entry.is_trigger_event(e)) return;
    if (entry.disabled) return;
    entry.focus();
    if (is_menu(entry)) this.#open_menu(entry);
    else this.#close_siblings(entry);
  }

  #on_key(e) {
    const entry = this.#entry_of(e);
    if (!entry || e.altKey || e.ctrlKey || e.metaKey) return;
    if (this.#handle_key(e.key, entry) === false) return;
    e.preventDefault();
    e.stopPropagation(); // keep the keys away from the game controls
  }

  // Returns false when the key isn't used.
  #handle_key(key, entry) {
    const menus = this.menus.filter(usable);
    const top = entry.closest("gizmo-menubar > gizmo-menu");
    // Next/previous menu on the bar, opened when one was open (or `force`).
    const move_top = (step, force = false) => {
      const was_open = force || this.is_open;
      const next = menus[(menus.indexOf(top) + step + menus.length) % menus.length];
      this.close();
      next.focus();
      if (was_open) this.#open_menu(next, "first");
    };

    if (is_menu(entry) && entry.top) {
      switch (key) {
        case "ArrowRight":
          return move_top(1);
        case "ArrowLeft":
          return move_top(-1);
        case "ArrowDown":
        case "Enter":
        case " ":
          return this.#open_menu(entry, "first");
        case "ArrowUp":
          return this.#open_menu(entry, "last");
        case "Home":
          return menus[0]?.focus();
        case "End":
          return menus[menus.length - 1]?.focus();
        case "Escape":
          return this.close();
      }
      return false;
    }

    // An entry inside a menu's panel.
    const menu = entry.parentElement;
    const siblings = entries_of(menu).filter(usable);
    const index = siblings.indexOf(entry);
    const go = (i) => siblings[(i + siblings.length) % siblings.length]?.focus();
    switch (key) {
      case "ArrowDown":
        return go(index + 1);
      case "ArrowUp":
        return go(index - 1);
      case "Home":
        return go(0);
      case "End":
        return go(siblings.length - 1);
      case "Enter":
      case " ":
        if (is_menu(entry)) return this.#open_menu(entry, "first");
        return this.#activate(entry, true);
      case "ArrowRight":
        if (is_menu(entry)) return this.#open_menu(entry, "first");
        return move_top(1, true);
      case "ArrowLeft":
        if (menu.top) return move_top(-1, true);
        this.#close_menu(menu);
        return menu.focus();
      case "Escape":
        this.#close_menu(menu);
        return menu.focus();
      case "Tab":
        this.close();
        return false; // let the focus move on
    }
    return false;
  }
}

customElements.define("gizmo-menu-item", GizmoMenuItem);
customElements.define("gizmo-menu", GizmoMenu);
customElements.define("gizmo-menubar", GizmoMenuBar);
