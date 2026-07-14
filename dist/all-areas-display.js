// ==========================================
// 1. L'ÉDITEUR DE CODE ET COMPOSANTS VISUELS
// ==========================================
class AllAreasDisplayEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._cardYamlEditor && !this._cardYamlEditor.hass) {
      this._cardYamlEditor.hass = hass;
    }
    this._updateExcludedCheckboxes();
  }

  // --- MOTEUR DE RENDU YAML LOCAL ---
  _stringifyYaml(obj, depth = 0) {
    const indent = "  ".repeat(depth);
    if (obj === null || obj === undefined) return "";
    
    if (Array.isArray(obj)) {
      if (obj.length === 0) return " []";
      return "\n" + obj.map(item => {
        if (typeof item === 'object' && item !== null) {
          const entries = Object.entries(item);
          if (entries.length === 0) return `${indent}- {}`;
          const first = `${indent}- ${entries[0][0]}:${this._stringifyYaml(entries[0][1], depth + 1)}`;
          const rest = entries.slice(1).map(([k, v]) => `${indent}  ${k}:${this._stringifyYaml(v, depth + 1)}`).join("\n");
          return rest ? `${first}\n${rest}` : first;
        }
        return `${indent}- ${item}`;
      }).join("\n");
    }
    
    if (typeof obj === 'object') {
      const entries = Object.entries(obj);
      if (entries.length === 0) return " {}";
      const content = entries.map(([k, v]) => {
        const valueStr = this._stringifyYaml(v, depth + 1);
        const separator = (valueStr.startsWith("\n") || valueStr.startsWith(" ")) ? "" : " ";
        return `${indent}${k}:${separator}${valueStr}`;
      }).join("\n");
      return depth === 0 ? content : "\n" + content;
    }
    
    const str = String(obj);
    if (str.includes('\n') || str.includes('#') || str.includes(':') || str === '') {
      return `"${str.replace(/"/g, '\\"')}"`;
    }
    return str;
  }

  async _render() {
    if (this._initialized) {
      this._updateUiFields();
      return;
    }
    this._initialized = true;

    this.innerHTML = `
      <div class="card-config" style="padding: 10px; display: flex; flex-direction: column; gap: 16px; font-family: sans-serif;">
        
        <!-- SECTION 1 : DISPOSITION ET NAVIGATION -->
        <div style="display: flex; flex-direction: column; gap: 10px; border-bottom: 1px solid var(--divider-color); padding-bottom: 14px;">
          
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <label style="font-weight: bold; color: var(--primary-text-color);">Disposition de la Pièce (Split-View) :</label>
            <select id="room-position-select" style="padding: 8px; border-radius: 4px; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color); width: 100%;">
              <option value="right">Pièce à Droite (Grille à gauche)</option>
              <option value="left">Pièce à Gauche (Grille à droite)</option>
              <option value="top">Pièce en Haut (Grille en bas)</option>
            </select>
            <span style="font-size: 0.8em; color: var(--secondary-text-color);">Sur mobile, la grille est automatiquement masquée lorsqu'une pièce est ouverte.</span>
          </div>

          <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
            <input id="show-tabs" type="checkbox" style="cursor: pointer;" />
            <label for="show-tabs" style="color: var(--primary-text-color); font-weight: bold; cursor: pointer;">Afficher les onglets d'Étages</label>
          </div>

          <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 8px;">
            <label style="font-weight: bold; color: var(--primary-text-color);">Entité de positionnement Auto (Optionnel) :</label>
            <input id="auto-entity" type="text" placeholder="ex: sensor.mon_telephone_location" style="padding: 8px; border-radius: 4px; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color); width: 100%;" />
            <span style="font-size: 0.8em; color: var(--secondary-text-color);">Ouvre automatiquement la pièce correspondant à l'état de cette entité.</span>
          </div>

        </div>

        <!-- SECTION 2 : TRI ET FILTRES -->
        <div style="display: flex; flex-direction: column; gap: 6px; border-bottom: 1px solid var(--divider-color); padding-bottom: 14px;">
          <label style="font-weight: bold; color: var(--primary-text-color);">Tri des pièces :</label>
          <select id="sort-select" style="padding: 8px; border-radius: 4px; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color); width: 100%;">
            <option value="asc">Nom (A -> Z)</option>
            <option value="desc">Nom (Z -> A)</option>
            <option value="none">Aucun</option>
          </select>
        </div>

        <div style="display: flex; flex-direction: column; gap: 6px; border-bottom: 1px solid var(--divider-color); padding-bottom: 14px;">
          <label style="font-weight: bold; color: var(--primary-text-color);">Pièces bannies :</label>
          <div id="excluded-areas-container" style="max-height: 140px; overflow-y: auto; padding: 8px; border: 1px solid var(--divider-color); border-radius: 4px; display: flex; flex-direction: column; gap: 6px; background: var(--secondary-background-color);"></div>
        </div>

        <!-- SECTION 3 : ZONE YAML -->
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <label style="font-weight: bold; color: var(--primary-text-color);">Configuration des Cartes (YAML) :</label>
          <p style="margin: 0; font-size: 0.85em; color: var(--secondary-text-color);">
            Variables dispo : <code>this.area.id</code>, <code>this.area.name</code>, <code>this.area.entity</code>, <code>this.floor.name</code>.
          </p>
          <div id="card-yaml-editor-container"></div>
        </div>

      </div>
    `;

    this.querySelector("#room-position-select").addEventListener("change", (e) => this._updateConfig({ room_position: e.target.value }));
    this.querySelector("#show-tabs").addEventListener("change", (e) => this._updateConfig({ show_tabs: e.target.checked }));
    this.querySelector("#auto-entity").addEventListener("change", (e) => this._updateConfig({ auto_entity: e.target.value.trim() }));
    this.querySelector("#sort-select").addEventListener("change", (e) => this._updateConfig({ sort_by: e.target.value }));

    const yamlContainer = this.querySelector("#card-yaml-editor-container");
    this._cardYamlEditor = document.createElement("ha-code-editor");
    this._cardYamlEditor.mode = "yaml";
    this._cardYamlEditor.autofocus = false;
    yamlContainer.appendChild(this._cardYamlEditor);

    this._cardYamlEditor.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      this._handleYamlChange(e.detail.value);
    });

    this._forceYamlDumpInEditor();
    this._updateUiFields();
  }

  _forceYamlDumpInEditor() {
    if (!this._cardYamlEditor) return;
    const defaultConfig = {
      button: this._config.button || { type: "tile", entity: "this.area.entity" },
      room: this._config.room || { cards: [{ type: "entities", entities: ["this.area.entity"] }] }
    };
    this._cardYamlEditor.value = this._stringifyYaml(defaultConfig).trim();
  }

  _handleYamlChange(rawText) {
    const hassYaml = window.jsyaml || customElements.get("ha-code-editor")?.lazyBlaze;
    if (!hassYaml || typeof hassYaml.load !== "function") return;
    try {
      const parsed = hassYaml.load(rawText);
      if (parsed && typeof parsed === 'object') {
        this._config = { ...this._config, button: parsed.button, room: parsed.room };
        this._fireConfigChanged();
      }
    } catch (err) {}
  }

  _updateUiFields() {
    if (!this._config) return;
    const posSelect = this.querySelector("#room-position-select");
    const tabsCheck = this.querySelector("#show-tabs");
    const autoInput = this.querySelector("#auto-entity");
    const sortSelect = this.querySelector("#sort-select");

    if (posSelect) posSelect.value = this._config.room_position || "left";
    if (tabsCheck) tabsCheck.checked = this._config.show_tabs !== false;
    if (autoInput) autoInput.value = this._config.auto_entity || "";
    if (sortSelect) sortSelect.value = this._config.sort_by || "asc";
  }

  _updateExcludedCheckboxes() {
    const container = this.querySelector("#excluded-areas-container");
    if (!container || !this._hass || !this._hass.areas) return;

    const currentExclusions = (this._config.exclude || []).map(item => String(item).toLowerCase());
    const areas = Object.values(this._hass.areas);

    if (container.children.length === areas.length) return;

    container.innerHTML = "";
    areas.sort((a, b) => (a.name || "").localeCompare(b.name || "")).forEach(area => {
      const label = document.createElement("label");
      label.style.display = "flex";
      label.style.alignItems = "center";
      label.style.gap = "8px";
      label.style.color = "var(--primary-text-color)";
      label.style.cursor = "pointer";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = currentExclusions.includes(area.area_id.toLowerCase()) || (area.name && currentExclusions.includes(area.name.toLowerCase()));
      
      checkbox.addEventListener("change", () => {
        let exclusions = [...(this._config.exclude || [])];
        if (checkbox.checked) {
          if (!exclusions.includes(area.area_id)) exclusions.push(area.area_id);
        } else {
          exclusions = exclusions.filter(item => item.toLowerCase() !== area.area_id.toLowerCase() && (area.name ? item.toLowerCase() !== area.name.toLowerCase() : true));
        }
        this._updateConfig({ exclude: exclusions });
      });

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(area.name || area.area_id));
      container.appendChild(label);
    });
  }

  _updateConfig(newProps) {
    this._config = { ...this._config, ...newProps };
    this._fireConfigChanged();
    this._updateUiFields();
  }

  _fireConfigChanged() {
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true }));
  }
}
customElements.define('all-areas-display-editor', AllAreasDisplayEditor);

// ==========================================
// 2. LA CARTE PRINCIPALE (MOTEUR GENERIQUE)
// ==========================================
class AllAreasDisplay extends HTMLElement {
  constructor() {
    super();
    this._selectedAreaId = null;
    this._activeFloorId = 'all';
    this._lastAutoState = null;
    this._gridCards = [];
    this._roomCards = [];
  }

  static getConfigElement() { return document.createElement("all-areas-display-editor"); }

  static getStubConfig() {
    return {
      type: "custom:all-areas-display",
      room_position: "left",
      show_tabs: true,
      button: { type: "tile", entity: "this.area.entity" },
      room: { cards: [{ type: "entities", entities: ["this.area.entity"] }] }
    };
  }

  setConfig(config) {
    this._config = Object.assign({}, config);
    if (this._config.show_tabs === undefined) this._config.show_tabs = true;
    if (!this._config.room_position) this._config.room_position = "left";
    this._renderBaseLayout();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;

    // 1. Gestion Automatique de la position
    if (this._config.auto_entity) {
      const autoStateObj = hass.states[this._config.auto_entity];
      if (autoStateObj && autoStateObj.state !== this._lastAutoState) {
        this._lastAutoState = autoStateObj.state;
        this._autoSelectArea(this._lastAutoState);
      }
    }

    // 2. Mise à jour de HASS dans toutes les sous-cartes
    [...this._gridCards, ...this._roomCards].forEach(card => {
      if (card && card.hass !== hass) {
        card.hass = hass;
      }
    });

    // 3. Premier rendu si vide
    if (!this._initialized) {
      this._initialized = true;
      this._updateTabs();
      this._updateGrid();
    }
  }

  _autoSelectArea(stateStr) {
    const areas = Object.values(this._hass.areas || {});
    const match = areas.find(a => a.name.toLowerCase() === stateStr.toLowerCase() || a.area_id.toLowerCase() === stateStr.toLowerCase());
    if (match) {
      if (match.floor_id) this._activeFloorId = match.floor_id;
      this._selectedAreaId = match.area_id;
      this._updateTabs();
      this._updateGrid();
      this._renderRoom();
      this._updateMobileVisibility();
    }
  }

  _renderBaseLayout() {
    if (!this.content) {
      const shadow = this.attachShadow({ mode: 'open' });
      
      const style = document.createElement('style');
      style.textContent = `
        .aad-container {
          display: flex;
          flex-direction: column;
          gap: 16px;
          --aad-mobile-breakpoint: 768px;
        }
        
        /* Layout des onglets */
        .aad-tabs {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          scrollbar-width: none; /* Firefox */
          padding-bottom: 4px;
        }
        .aad-tabs::-webkit-scrollbar { display: none; }
        .aad-tab {
          padding: 8px 16px;
          border-radius: 20px;
          background: var(--secondary-background-color);
          color: var(--primary-text-color);
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.2s;
        }
        .aad-tab:hover { background: var(--divider-color); }
        .aad-tab.active {
          background: var(--primary-color);
          color: var(--text-primary-color, #FFF);
        }

        /* Layout Split-View Principal */
        .aad-split-view {
          display: flex;
          gap: 16px;
          align-items: flex-start;
        }
        
        .aad-split-view.pos-left { flex-direction: row-reverse; }
        .aad-split-view.pos-right { flex-direction: row; }
        .aad-split-view.pos-top { flex-direction: column-reverse; }
        
        .aad-grid-panel {
          flex: 1;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 8px;
          width: 100%;
        }
        
        .aad-room-panel {
          flex: 1.5; /* Prend un peu plus de place que la grille */
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
          min-width: 300px;
        }

        /* Bouton Retour pour le mode Mobile */
        .aad-mobile-back {
          display: none;
          padding: 12px;
          border-radius: 12px;
          background: var(--secondary-background-color);
          color: var(--primary-text-color);
          text-align: center;
          font-weight: bold;
          cursor: pointer;
          margin-bottom: 8px;
        }

        /* Comportement Responsive / Mobile */
        @media (max-width: 768px) {
          .aad-split-view { flex-direction: column !important; }
          .aad-room-panel { min-width: 100%; }
          
          /* Quand une pièce est ouverte sur mobile, on cache la grille */
          .has-room .aad-grid-panel { display: none; }
          .has-room .aad-tabs { display: none; }
          .has-room .aad-mobile-back { display: block; }
        }
        
        /* Animation de clic sur les boutons de la grille */
        .grid-button-wrapper { cursor: pointer; transition: transform 0.1s; }
        .grid-button-wrapper:active { transform: scale(0.98); }
        .grid-button-wrapper.active-room {
           outline: 2px solid var(--primary-color);
           border-radius: var(--ha-card-border-radius, 12px);
        }
      `;
      shadow.appendChild(style);

      this.content = document.createElement('div');
      this.content.className = 'aad-container';
      
      this.content.innerHTML = `
        <div class="aad-tabs" id="tabs-container" style="display: ${this._config.show_tabs ? 'flex' : 'none'};"></div>
        <div class="aad-split-view pos-${this._config.room_position}" id="split-view">
          <div class="aad-grid-panel" id="grid-container"></div>
          <div class="aad-room-panel" id="room-container" style="display: none;">
            <div class="aad-mobile-back" id="mobile-back">
              <ha-icon icon="mdi:arrow-left"></ha-icon> Retour aux pièces
            </div>
            <div id="room-cards"></div>
          </div>
        </div>
      `;

      shadow.appendChild(this.content);
      
      shadow.getElementById('mobile-back').addEventListener('click', () => {
        this._selectedAreaId = null;
        this._updateGrid(); // Pour enlever la classe active
        this._updateMobileVisibility();
      });
    }
  }

  _updateMobileVisibility() {
    const splitView = this.content.querySelector('#split-view');
    const roomContainer = this.content.querySelector('#room-container');
    
    if (this._selectedAreaId) {
      splitView.classList.add('has-room');
      roomContainer.style.display = 'flex';
    } else {
      splitView.classList.remove('has-room');
      roomContainer.style.display = 'none';
      const roomCardsEl = this.content.querySelector('#room-cards');
      roomCardsEl.innerHTML = '';
      this._roomCards = [];
    }
  }

  _updateTabs() {
    if (!this._config.show_tabs) return;
    const tabsContainer = this.content.querySelector('#tabs-container');
    tabsContainer.innerHTML = '';

    // Détecter les étages depuis HA
    const floors = this._hass.floors ? Object.values(this._hass.floors) : [];
    
    // Tab "Toutes"
    const allTab = document.createElement('div');
    allTab.className = `aad-tab ${this._activeFloorId === 'all' ? 'active' : ''}`;
    allTab.innerText = "Toutes";
    allTab.onclick = () => { this._activeFloorId = 'all'; this._updateTabs(); this._updateGrid(); };
    tabsContainer.appendChild(allTab);

    floors.sort((a, b) => (a.level || 0) - (b.level || 0)).forEach(floor => {
      const tab = document.createElement('div');
      tab.className = `aad-tab ${this._activeFloorId === floor.floor_id ? 'active' : ''}`;
      tab.innerText = floor.name;
      tab.onclick = () => { this._activeFloorId = floor.floor_id; this._updateTabs(); this._updateGrid(); };
      tabsContainer.appendChild(tab);
    });
  }

  async _updateGrid() {
    const gridContainer = this.content.querySelector('#grid-container');
    let areas = Object.values(this._hass.areas || {});
    
    const excludeList = (this._config.exclude || []).map(item => String(item).toLowerCase());
    areas = areas.filter(area => !excludeList.includes(area.area_id.toLowerCase()) && !(area.name && excludeList.includes(area.name.toLowerCase())));

    if (this._activeFloorId !== 'all') {
      areas = areas.filter(area => area.floor_id === this._activeFloorId);
    }

    const sortOrder = this._config.sort_by || "asc";
    if (sortOrder === "asc") areas.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    else if (sortOrder === "desc") areas.sort((a, b) => (b.name || "").localeCompare(a.name || ""));

    const helpers = await window.loadCardHelpers();
    gridContainer.innerHTML = '';
    this._gridCards = [];

    const baseButtonConfig = this._config.button || { type: "tile", entity: "this.area.entity" };

    areas.forEach(area => {
      const wrapper = document.createElement('div');
      wrapper.className = `grid-button-wrapper ${this._selectedAreaId === area.area_id ? 'active-room' : ''}`;
      
      // On capture le clic en phase de "capture" pour déclencher l'ouverture de la pièce
      wrapper.addEventListener('click', () => {
        this._selectedAreaId = area.area_id;
        this._updateGrid(); // Met à jour la surbrillance
        this._renderRoom();
        this._updateMobileVisibility();
      }, { capture: true });

      const areaData = this._extractAreaData(area);
      const floorData = this._extractFloorData(area.floor_id);
      
      const processedConfig = this._processTemplate(baseButtonConfig, areaData, floorData);
      
      const cardEl = helpers.createCardElement(processedConfig);
      cardEl.hass = this._hass;
      wrapper.appendChild(cardEl);
      
      gridContainer.appendChild(wrapper);
      this._gridCards.push(cardEl);
    });
  }

  async _renderRoom() {
    if (!this._selectedAreaId) return;
    
    const roomCardsEl = this.content.querySelector('#room-cards');
    const area = this._hass.areas[this._selectedAreaId];
    if (!area) return;

    const areaData = this._extractAreaData(area);
    const floorData = this._extractFloorData(area.floor_id);
    const roomConfigs = this._config.room?.cards || [];

    const helpers = await window.loadCardHelpers();
    roomCardsEl.innerHTML = '';
    this._roomCards = [];

    for (const cardConfig of roomConfigs) {
      const processedConfig = this._processTemplate(cardConfig, areaData, floorData);
      const cardEl = helpers.createCardElement(processedConfig);
      cardEl.hass = this._hass;
      roomCardsEl.appendChild(cardEl);
      this._roomCards.push(cardEl);
    }
  }

  _extractAreaData(area) {
    const defaultEntityMatch = Object.values(this._hass.states).find(s => 
      s.entity_id.startsWith('light.') && this._hass.entities[s.entity_id]?.area_id === area.area_id
    ) || Object.values(this._hass.states).find(s => 
      (s.entity_id.startsWith('switch.') || s.entity_id.startsWith('input_boolean.')) && this._hass.entities[s.entity_id]?.area_id === area.area_id
    );

    return {
      id: area.area_id,
      name: area.name || area.area_id,
      entity: defaultEntityMatch ? defaultEntityMatch.entity_id : "sun.sun",
      icon: area.icon || "mdi:home-outline"
    };
  }

  _extractFloorData(floorId) {
    if (!floorId || !this._hass.floors || !this._hass.floors[floorId]) {
      return { id: "unknown", name: "Inconnu" };
    }
    const floor = this._hass.floors[floorId];
    return {
      id: floor.floor_id,
      name: floor.name || floor.floor_id
    };
  }

  _processTemplate(obj, areaData, floorData) {
    let str = JSON.stringify(obj);
    str = str.replaceAll('this.area.id', areaData.id);
    str = str.replaceAll('this.area.name', areaData.name);
    str = str.replaceAll('this.area.entity', areaData.entity);
    str = str.replaceAll('this.area.icon', areaData.icon);
    
    str = str.replaceAll('this.floor.id', floorData.id);
    str = str.replaceAll('this.floor.name', floorData.name);
    
    return JSON.parse(str);
  }

  getCardSize() { return 4; }
}
customElements.define('all-areas-display', AllAreasDisplay);

window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'all-areas-display')) {
  window.customCards.push({
    type: "all-areas-display",
    name: "All areas display",
    preview: true,
    description: "Tableau de bord multi-pièces avec Split-View et Onglets auto."
  });
}