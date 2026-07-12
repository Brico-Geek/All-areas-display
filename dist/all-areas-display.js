// ==========================================
// 1. L'ÉDITEUR DE CODE ET COMPOSANTS VISUELS (VERSION SÉCURISÉE)
// ==========================================
class AllAreasDisplayEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    if (this._initialized) {
      this._updateUiFields();
    } else {
      this._render();
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (this._cardYamlEditor && !this._cardYamlEditor.hass) {
      this._cardYamlEditor.hass = hass;
    }
    this._updateExcludedCheckboxes();
  }

  async _render() {
    if (this._initialized) return;
    this._initialized = true;

    this.innerHTML = `
      <div class="card-config" style="padding: 10px; display: flex; flex-direction: column; gap: 16px; font-family: var(--paper-font-body1_-_font-family, sans-serif);">
        
        <!-- SECTION 1 : DISPOSITION -->
        <div style="display: flex; flex-direction: column; gap: 10px; border-bottom: 1px solid var(--divider-color); padding-bottom: 14px;">
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <label style="font-weight: bold; color: var(--primary-text-color);">Disposition des pièces :</label>
            <select id="layout-select" style="padding: 8px; border-radius: 4px; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color); width: 100%;">
              <option value="auto">Auto (Fluide et extensible)</option>
              <option value="grid">Grille (Grid)</option>
              <option value="vertical">Vertical Stack</option>
              <option value="horizontal">Horizontal Stack</option>
            </select>
          </div>

          <!-- Options dynamiques pour l'Auto (Largeur de carte) -->
          <div id="auto-options" style="display: none; align-items: center; gap: 8px; margin-top: 6px;">
            <label style="color: var(--primary-text-color); font-size: 0.9em;">Largeur cible des cartes :</label>
            <input id="auto-width" type="text" placeholder="150px" style="width: 70px; padding: 6px; border-radius: 4px; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color);" />
          </div>

          <!-- Options dynamiques pour la Grille -->
          <div id="grid-options" style="display: none; gap: 12px; align-items: center; margin-top: 6px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <label style="color: var(--primary-text-color); font-size: 0.9em;">Colonnes (Min 2) :</label>
              <input id="grid-columns" type="number" min="2" max="12" style="width: 50px; padding: 6px; border-radius: 4px; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color);" />
            </div>
          </div>

          <!-- Option Carré -->
          <div id="square-option-container" style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
            <input id="layout-square" type="checkbox" style="cursor: pointer;" />
            <label for="layout-square" style="color: var(--primary-text-color); font-size: 0.9em; cursor: pointer;">Afficher les cartes en carré</label>
          </div>
        </div>

        <!-- SECTION 2 : TRI -->
        <div style="display: flex; flex-direction: column; gap: 6px; border-bottom: 1px solid var(--divider-color); padding-bottom: 14px;">
          <label style="font-weight: bold; color: var(--primary-text-color);">Tri des pièces :</label>
          <select id="sort-select" style="padding: 8px; border-radius: 4px; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color); width: 100%;">
            <option value="asc">Nom (A -> Z)</option>
            <option value="desc">Nom (Z -> A)</option>
            <option value="none">Aucun (Ordre Home Assistant)</option>
          </select>
        </div>

        <!-- SECTION 3 : PIÈCES BANNIES -->
        <div style="display: flex; flex-direction: column; gap: 6px; border-bottom: 1px solid var(--divider-color); padding-bottom: 14px;">
          <label style="font-weight: bold; color: var(--primary-text-color);">Pièces bannies (Masquées) :</label>
          <div id="excluded-areas-container" style="max-height: 140px; overflow-y: auto; padding: 8px; border: 1px solid var(--divider-color); border-radius: 4px; display: flex; flex-direction: column; gap: 6px; background: var(--secondary-background-color);">
            <!-- Rempli dynamiquement -->
          </div>
        </div>

        <!-- SECTION 4 : ZONE DU CODE YAML -->
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <label style="font-weight: bold; color: var(--primary-text-color);">Modèle de la carte (YAML) :</label>
          <p style="margin: 0; font-size: 0.85em; color: var(--secondary-text-color);">
            Utilisez <code>this.area.id</code>, <code>this.area.name</code>.
          </p>
          <div id="card-yaml-editor-container"></div>
          <button id="apply-yaml-btn" style="padding: 10px; background: var(--accent-color, #03a9f4); color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; transition: background 0.2s;">
            Appliquer les modifications YAML
          </button>
        </div>

      </div>
    `;

    // Événements d'interaction de l'interface
    this.querySelector("#layout-select").addEventListener("change", () => this._handleLayoutUiChange());
    this.querySelector("#grid-columns").addEventListener("input", () => this._handleLayoutUiChange());
    this.querySelector("#auto-width").addEventListener("change", () => this._handleLayoutUiChange());
    this.querySelector("#layout-square").addEventListener("change", () => this._handleLayoutUiChange());
    this.querySelector("#sort-select").addEventListener("change", (e) => this._updateConfig({ sort_by: e.target.value }));
    this.querySelector("#apply-yaml-btn").addEventListener("click", () => this._saveYamlContent());

    const yamlContainer = this.querySelector("#card-yaml-editor-container");
    this._cardYamlEditor = document.createElement("ha-code-editor");
    this._cardYamlEditor.mode = "yaml";
    this._cardYamlEditor.autofocus = false;
    yamlContainer.appendChild(this._cardYamlEditor);

    // Laisse le temps au ha-code-editor d'exister proprement dans le DOM
    setTimeout(() => {
      this._updateUiFields();
      this._forceYamlDumpInEditor();
    }, 100);
  }

  _getParser() {
    if (window.jsyaml) return window.jsyaml;
    const haEditor = customElements.get("ha-code-editor");
    if (haEditor && haEditor.lazyBlaze) return haEditor.lazyBlaze;
    return null;
  }

  _forceYamlDumpInEditor() {
    if (!this._cardYamlEditor) return;
    const currentCardConfig = this._config.card || { type: "area", area: "this.area.id" };
    const parser = this._getParser();

    try {
      if (parser && typeof parser.dump === "function") {
        this._cardYamlEditor.value = parser.dump(currentCardConfig, { indent: 2, lineWidth: -1 }).trim();
      } else {
        // Fallback propre formaté et indenté manuellement si aucun parser n'est prêt
        this._cardYamlEditor.value = Object.entries(currentCardConfig)
          .map(([k, v]) => {
            if (typeof v === 'object') return `${k}:\n  ${JSON.stringify(v)}`;
            return `${k}: ${v}`;
          }).join('\n');
      }
    } catch (e) {
      console.warn("Erreur d'écriture initiale du YAML", e);
    }
  }

  _saveYamlContent() {
    const rawText = this._cardYamlEditor.value;
    const parser = this._getParser();

    try {
      let parsedCard = null;
      if (parser && typeof parser.load === "function") {
        parsedCard = parser.load(rawText);
      } else {
        // Fallback basique d'analyse si le parser HA est bloqué
        parsedCard = {};
        rawText.split('\n').forEach(line => {
          const parts = line.split(':');
          if (parts.length >= 2) {
            parsedCard[parts[0].trim()] = parts.slice(1).join(':').trim();
          }
        });
      }

      if (parsedCard && typeof parsedCard === 'object') {
        this._config = { ...this._config, card: parsedCard };
        this._fireConfigChanged();
        
        const btn = this.querySelector("#apply-yaml-btn");
        if (btn) {
          btn.style.background = "var(--success-color, #4caf50)";
          btn.textContent = "Appliqué avec succès !";
          setTimeout(() => {
            btn.style.background = "var(--accent-color, #03a9f4)";
            btn.textContent = "Appliquer les modifications YAML";
          }, 1500);
        }
      }
    } catch (err) {
      alert("Erreur de syntaxe YAML. Vérifiez l'indentation.");
    }
  }

  _updateUiFields() {
    if (!this._config) return;

    const select = this.querySelector("#layout-select");
    const autoOptions = this.querySelector("#auto-options");
    const gridOptions = this.querySelector("#grid-options");
    const squareContainer = this.querySelector("#square-option-container");
    const colsInput = this.querySelector("#grid-columns");
    const autoWidthInput = this.querySelector("#auto-width");
    const squareCheckbox = this.querySelector("#layout-square");
    const sortSelect = this.querySelector("#sort-select");

    if (!select) return;

    const layout = this._config.layout || { type: "auto" };
    if (sortSelect) sortSelect.value = this._config.sort_by || "asc";
    
    if (layout.type === "vertical-stack") {
      select.value = "vertical";
      if(autoOptions) autoOptions.style.display = "none";
      if(gridOptions) gridOptions.style.display = "none";
      if(squareContainer) squareContainer.style.display = "none";
    } else if (layout.type === "horizontal-stack") {
      select.value = "horizontal";
      if(autoOptions) autoOptions.style.display = "none";
      if(gridOptions) gridOptions.style.display = "none";
      if(squareContainer) squareContainer.style.display = "none";
    } else if (layout.type === "grid") {
      select.value = "grid";
      if(autoOptions) autoOptions.style.display = "none";
      if(gridOptions) gridOptions.style.display = "flex";
      if(squareContainer) squareContainer.style.display = "flex";
      if(colsInput) colsInput.value = Math.max(2, layout.columns || 2);
      if(squareCheckbox) squareCheckbox.checked = layout.square || false;
    } else {
      select.value = "auto";
      if(autoOptions) autoOptions.style.display = "flex";
      if(gridOptions) gridOptions.style.display = "none";
      if(squareContainer) squareContainer.style.display = "flex";
      if(autoWidthInput) autoWidthInput.value = layout.min_width || "150px";
      if(squareCheckbox) squareCheckbox.checked = layout.square || false;
    }
  }

  _handleLayoutUiChange() {
    const selectType = this.querySelector("#layout-select").value;
    const isSquare = this.querySelector("#layout-square").checked;
    let newLayout = { type: "grid" };

    if (selectType === "vertical") {
      newLayout = { type: "vertical-stack" };
    } else if (selectType === "horizontal") {
      newLayout = { type: "horizontal-stack" };
    } else if (selectType === "auto") {
      const widthVal = this.querySelector("#auto-width").value.trim() || "150px";
      newLayout = { type: "auto", min_width: widthVal };
    } else if (selectType === "grid") {
      const inputCols = parseInt(this.querySelector("#grid-columns").value) || 2;
      newLayout = { type: "grid", columns: Math.max(2, inputCols) };
    }

    if (selectType === "grid" || selectType === "auto") {
      newLayout.square = isSquare;
    }

    this._updateConfig({ layout: newLayout });
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
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    }));
  }
}
customElements.define('all-areas-display-editor', AllAreasDisplayEditor);


// ==========================================
// 2. LA CARTE PRINCIPALE (MOTEUR GENERIQUE)
// ==========================================
class AllAreasDisplay extends HTMLElement {
  static getConfigElement() {
    return document.createElement("all-areas-display-editor");
  }

  static getStubConfig() {
    return {
      type: "custom:all-areas-display",
      layout: { type: "auto", min_width: "150px" },
      exclude: [],
      sort_by: "asc",
      card: { type: "area", area: "this.area.id" }
    };
  }

  setConfig(config) {
    const oldConfigStr = this._configStr;
    this._configStr = JSON.stringify(config);
    this._config = config;

    if (oldConfigStr && oldConfigStr !== this._configStr) {
      this._renderedKey = null; 
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;

    if (!this.content) {
      this.innerHTML = `<div id="card-container"></div>`;
      this.content = this.querySelector('#card-container');
    }

    let areas = Object.values(hass.areas || {});
    const excludeList = (this._config.exclude || []).map(item => String(item).toLowerCase());
    
    areas = areas.filter(area => {
      const idMatch = excludeList.includes(area.area_id.toLowerCase());
      const nameMatch = area.name ? excludeList.includes(area.name.toLowerCase()) : false;
      return !idMatch && !nameMatch;
    });

    const sortOrder = this._config.sort_by || "asc";
    if (sortOrder === "asc") {
      areas.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else if (sortOrder === "desc") {
      areas.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
    }

    const currentRenderKey = `${this._configStr}-${areas.map(a => a.area_id).join(',')}`;

    if (this._renderedKey === currentRenderKey && this._childElements) {
      this._childElements.forEach(el => {
        if (el && el.hass !== hass) el.hass = hass;
      });
      return;
    }

    this._buildContainer(areas, currentRenderKey);
  }

  async _buildContainer(areas, currentRenderKey) {
    if (this._building) return;
    this._building = true;

    const config = this._config;
    const hass = this._hass;

    if (areas.length === 0) {
      this.content.innerHTML = `<ha-alert alert-type="info">Aucune pièce à afficher.</ha-alert>`;
      this._renderedKey = currentRenderKey;
      this._building = false;
      return;
    }

    const userLayout = config.layout || { type: "auto" };
    const childCardsRaw = [];

    areas.forEach(area => {
      const areaId = area.area_id;
      const areaName = area.name || areaId;
      const areaSlug = areaId.toLowerCase().replace(/ /g, '_');
      const areaIcon = area.icon || "mdi:home-outline";

      let defaultEntity = "sun.sun"; 
      const lightEntity = Object.values(hass.states).find(state => 
        state.entity_id.startsWith('light.') && hass.entities[state.entity_id]?.area_id === areaId
      );
      if (lightEntity) {
        defaultEntity = lightEntity.entity_id;
      } else {
        const switchEntity = Object.values(hass.states).find(state => 
          (state.entity_id.startsWith('switch.') || state.entity_id.startsWith('input_boolean.')) && 
          hass.entities[state.entity_id]?.area_id === areaId
        );
        if (switchEntity) defaultEntity = switchEntity.entity_id;
      }

      let areaTemp = "N/A";
      const tempEntity = Object.values(hass.states).find(state => 
        state.entity_id.startsWith('sensor.') && 
        (state.entity_id.includes('temperature') || state.attributes.device_class === 'temperature') && 
        hass.entities[state.entity_id]?.area_id === areaId
      );
      if (tempEntity) areaTemp = tempEntity.state + (tempEntity.attributes.unit_of_measurement || '°C');

      let areaHumidity = "N/A";
      const humEntity = Object.values(hass.states).find(state => 
        state.entity_id.startsWith('sensor.') && 
        (state.entity_id.includes('humidity') || state.attributes.device_class === 'humidity') && 
        hass.entities[state.entity_id]?.area_id === areaId
      );
      if (humEntity) areaHumidity = humEntity.state + (humEntity.attributes.unit_of_measurement || '%');

      const areaData = {
        id: areaId,
        name: areaName,
        slug: areaSlug,
        icon: areaIcon,
        entity: defaultEntity,
        temperature: areaTemp,
        humidity: areaHumidity
      };

      const processCard = (obj) => {
        let str = JSON.stringify(obj);
        str = str.replaceAll('this.area.id', areaData.id);
        str = str.replaceAll('this.area.name', areaData.name);
        str = str.replaceAll('this.area.slug', areaData.slug);
        str = str.replaceAll('this.area.icon', areaData.icon);
        str = str.replaceAll('this.area.entity', areaData.entity);
        str = str.replaceAll('this.area.temperature', areaData.temperature);
        str = str.replaceAll('this.area.humidity', areaData.humidity);
        return JSON.parse(str);
      };

      if (config.card) {
        try {
          childCardsRaw.push(processCard(config.card));
        } catch (e) {
          console.error("Erreur template All Areas Display :", e);
        }
      }
    });

    try {
      const helpers = await window.loadCardHelpers();
      this.content.innerHTML = '';
      this._childElements = [];

      if (userLayout.type === "auto") {
        const targetMinWidth = userLayout.min_width || "150px";
        
        const autoGridWrapper = document.createElement("div");
        autoGridWrapper.style.display = "grid";
        autoGridWrapper.style.gridTemplateColumns = `repeat(auto-fit, minmax(${targetMinWidth}, 1fr))`;
        autoGridWrapper.style.gap = "8px";
        autoGridWrapper.style.width = "100%";

        for (const cardConfig of childCardsRaw) {
          const cardEl = helpers.createCardElement(cardConfig);
          cardEl.hass = hass;
          if (userLayout.square) {
            cardEl.style.aspectRatio = "1 / 1";
          }
          autoGridWrapper.appendChild(cardEl);
          this._childElements.push(cardEl);
        }
        this.content.appendChild(autoGridWrapper);

      } else {
        const finalLayout = { ...userLayout };
        if (finalLayout.type === "grid" && finalLayout.columns) {
          finalLayout.columns = Math.max(2, finalLayout.columns);
        }

        const layoutConfig = { ...finalLayout, cards: childCardsRaw };
        const element = helpers.createCardElement(layoutConfig);
        element.hass = hass;
        this.content.appendChild(element);
        
        setTimeout(() => {
          if (element.shadowRoot) {
            this._childElements = Array.from(element.shadowRoot.querySelectorAll("*"));
          } else {
            this._childElements = Array.from(element.querySelectorAll("*"));
          }
        }, 50);
      }

      this._renderedKey = currentRenderKey;

    } catch (err) {
      console.error("Erreur de rendu :", err);
    } finally {
      this._building = false;
    }
  }

  getCardSize() { return 4; }
}
customElements.define('all-areas-display', AllAreasDisplay);

// Enregistrement de la carte
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'all-areas-display')) {
  window.customCards.push({
    type: "all-areas-display",
    name: "All areas display",
    preview: true,
    description: "Multiplie une carte pour chaque pièce Lovelace détectée."
  });
}