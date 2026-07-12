// ==========================================
// 1. L'ÉDITEUR DE CODE
// ==========================================
class AllAreasDisplayEditor extends HTMLElement {
  constructor() {
    super();
    this._isInternalUpdate = false;
  }

  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._cardYamlEditor && !this._cardYamlEditor.hass) this._cardYamlEditor.hass = hass;
  }

  // --- MOTEUR DE SYNCHRONISATION ---
  _forceYamlDumpInEditor() {
    if (!this._cardYamlEditor) return;
    this._isInternalUpdate = true;
    const yaml = window.jsyaml;
    if (yaml && yaml.dump) {
      this._cardYamlEditor.value = yaml.dump(this._config.card || { type: "area", area: "this.area.id" });
    }
    setTimeout(() => { this._isInternalUpdate = false; }, 100);
  }

  _handleYamlChange(rawText) {
    if (this._isInternalUpdate) return;
    const yaml = window.jsyaml;
    try {
      const parsedCard = yaml.load(rawText);
      if (parsedCard && typeof parsedCard === 'object') {
        this._config = { ...this._config, card: parsedCard };
        this._fireConfigChanged();
      }
    } catch (err) {}
  }

  // --- RENDU UI ---
  async _render() {
    if (this._initialized) return;
    this._initialized = true;

    this.innerHTML = `
      <div class="card-config" style="padding: 10px; display: flex; flex-direction: column; gap: 16px;">
        <div style="display: flex; flex-direction: column; gap: 10px; border-bottom: 1px solid var(--divider-color); padding-bottom: 14px;">
          <label style="font-weight: bold;">Configuration de mise en page</label>
          <select id="layout-select">
            <option value="auto">Auto</option>
            <option value="grid">Grille</option>
          </select>
          <input id="grid-columns" type="number" placeholder="Colonnes (ex: 2)" />
        </div>
        <div id="card-yaml-editor-container"></div>
      </div>
    `;

    // Initialisation éditeur
    const yamlContainer = this.querySelector("#card-yaml-editor-container");
    this._cardYamlEditor = document.createElement("ha-code-editor");
    this._cardYamlEditor.mode = "yaml";
    yamlContainer.appendChild(this._cardYamlEditor);

    this._cardYamlEditor.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      this._handleYamlChange(e.detail.value);
    });

    // Liaison UI simple
    this.querySelector("#layout-select").addEventListener("change", (e) => {
      this._config = { ...this._config, layout: { ...this._config.layout, type: e.target.value } };
      this._fireConfigChanged();
    });

    this.querySelector("#grid-columns").addEventListener("input", (e) => {
      this._config = { ...this._config, layout: { ...this._config.layout, columns: parseInt(e.target.value) } };
      this._fireConfigChanged();
    });

    this._forceYamlDumpInEditor();
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
        // Utilisation de auto-fill à la place de auto-fit pour forcer l'alignement uniforme
        autoGridWrapper.style.gridTemplateColumns = `repeat(auto-fill, minmax(${targetMinWidth}, 1fr))`;
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