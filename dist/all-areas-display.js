// ==========================================
// 1. L'ÉDITEUR SIMPLE (VISUEL + CODE CONFIG)
// ==========================================
class AllAreasDisplayEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._formElement) this._formElement.hass = hass;
    if (this._cardEditor) this._cardEditor.hass = hass;
  }

  async _render() {
    if (this.querySelector("#layout-form")) {
      this._updateEditorHass();
      return;
    }

    this.innerHTML = `
      <div class="card-config" style="padding: 10px; display: flex; flex-direction: column; gap: 20px; font-family: var(--paper-font-body1_-_font-family, sans-serif);">
        <div>
          <h3 style="margin: 0 0 10px 0; color: var(--primary-color); font-size: 1.1em;">1. Disposition globale</h3>
          <ha-form id="layout-form"></ha-form>
        </div>
        
        <hr style="border: none; border-top: 1px solid var(--divider-color); margin: 0;">
        
        <div>
          <h3 style="margin: 0 0 10px 0; color: var(--primary-color); font-size: 1.1em;">2. Configuration de la carte modèle</h3>
          <div id="editor-container" style="min-height: 150px; border: 1px solid var(--divider-color); border-radius: 8px; padding: 10px; background: var(--card-background-color);"></div>
          <button id="toggle-editor-mode" style="
            margin-top: 12px;
            width: 100%;
            background: var(--secondary-background-color);
            color: var(--primary-text-color);
            border: 1px solid var(--divider-color);
            padding: 8px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
          ">
            🔄 Basculer entre Éditeur Visuel / Code (YAML)
          </button>
        </div>
      </div>
    `;

    this._formElement = this.querySelector("#layout-form");
    this._setupLayoutForm();
    await this._attachCardEditor();

    this.querySelector("#toggle-editor-mode").addEventListener("click", () => {
      if (this._cardEditor && typeof this._cardEditor.toggleMode === 'function') {
        this._cardEditor.toggleMode();
      }
    });
  }

  _setupLayoutForm() {
    const currentLayout = this._config?.layout_type || "grid";
    const schema = [
      {
        name: "layout_type",
        label: "Type d'affichage global",
        type: "select",
        options: [
          ["grid", "Grille (Grid)"],
          ["horizontal-stack", "Alignement Horizontal"],
          ["vertical-stack", "Alignement Vertical"]
        ]
      }
    ];

    if (currentLayout === "grid") {
      schema.push({
        name: "columns",
        label: "Nombre de colonnes",
        type: "integer",
        default: 2,
        valueMin: 2
      });
    }

    this._formElement.schema = schema;
    this._formElement.data = {
      layout_type: currentLayout,
      columns: this._config?.layout_options?.columns || 2
    };

    this._formElement.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      const value = ev.detail.value;
      this._config = {
        ...this._config,
        layout_type: value.layout_type,
        layout_options: {
          columns: value.layout_type === "grid" ? Math.max(2, value.columns || 2) : undefined
        }
      };
      this._fireConfigChanged();
    });
  }

  async _attachCardEditor() {
    const container = this.querySelector("#editor-container");
    if (!container) return;

    // Utilisation sécurisée du créateur d'éditeur de HA
    let cardEditor;
    if (window.loadCardHelpers) {
      const helpers = await window.loadCardHelpers();
      if (helpers && typeof helpers.createCardEditorElement === 'function') {
        cardEditor = helpers.createCardEditorElement(this._config?.template_card || { type: "button" });
      }
    }
    
    if (!cardEditor) {
      cardEditor = document.createElement("hui-card-element-editor");
    }

    cardEditor.hass = this._hass;
    cardEditor.value = this._config?.template_card || { 
      type: "button", 
      name: "[[area_name]]", 
      icon: "[[area_icon]]", 
      entity: "[[default_entity]]" 
    };

    cardEditor.addEventListener("config-changed", (ev) => {
      ev.stopPropagation();
      this._config = {
        ...this._config,
        template_card: ev.detail.config
      };
      this._fireConfigChanged();
    });

    container.innerHTML = "";
    container.appendChild(cardEditor);
    this._cardEditor = cardEditor;
  }

  _updateEditorHass() {
    if (this._cardEditor && this._hass) this._cardEditor.hass = this._hass;
    if (this._formElement && this._hass) this._formElement.hass = this._hass;
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
// 2. LE GENERATEUR D'AFFICHAGE MULTI-ZONES (RÉSOLU)
// ==========================================
class AllAreasDisplay extends HTMLElement {
  static getConfigElement() {
    return document.createElement("all-areas-display-editor");
  }

  static getStubConfig() {
    return {
      type: "custom:all-areas-display",
      layout_type: "grid",
      layout_options: { columns: 2 },
      template_card: {
        type: "button",
        name: "[[area_name]]",
        icon: "[[area_icon]]",
        entity: "[[default_entity]]"
      }
    };
  }

  constructor() {
    super();
    this.innerHTML = `<div id="root" style="width:100%;"></div>`;
    this.content = this.querySelector('#root');
    this._childElements = [];
  }

  // Obligatoire pour éviter que HA râle si le layout parent appelle setConfig sur l'instance globale
  setConfig(config) {
    this._config = config;
    if (this.content) this._buildCards();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;

    if (this._childElements.length > 0) {
      this._childElements.forEach(el => {
        if (el && 'hass' in el) el.hass = hass;
      });
    } else {
      this._buildCards();
    }
  }

  async _buildCards() {
    if (!this._hass || !this._config || !this.content) return;
    
    const config = this._config;
    const hass = this._hass;
    const template = config.template_card;

    if (!template || Object.keys(template).length === 0) {
      this.content.innerHTML = `<div style="padding:10px; color:var(--secondary-text-color);">Définissez une carte modèle.</div>`;
      this._childElements = [];
      return;
    }

    let helpers;
    try {
      if (window.loadCardHelpers) {
        helpers = await window.loadCardHelpers();
      } else {
        helpers = await document.createElement("hui-root").constructor.prototype.loadCardHelpers();
      }
    } catch (e) {
      console.error("Impossible de récupérer les cardHelpers", e);
    }

    if (!helpers) {
      this.content.innerHTML = `<div style="padding:10px; color:red;">Erreur système : Outils HA indisponibles.</div>`;
      return;
    }

    const areas = Object.values(hass.areas || {});
    this.content.innerHTML = '';
    this._childElements = [];

    const layoutType = config.layout_type || 'grid';
    const gridWrapper = document.createElement('div');

    // Mise en page native CSS pure pour contourner complètement le bug setConfig des stacks HA
    if (layoutType === 'grid') {
      const cols = config.layout_options?.columns || 2;
      gridWrapper.style.display = 'grid';
      gridWrapper.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
      gridWrapper.style.gap = '8px';
    } else if (layoutType === 'horizontal-stack') {
      gridWrapper.style.display = 'flex';
      gridWrapper.style.flexDirection = 'row';
      gridWrapper.style.gap = '8px';
      gridWrapper.style.width = '100%';
    } else if (layoutType === 'vertical-stack') {
      gridWrapper.style.display = 'flex';
      gridWrapper.style.flexDirection = 'column';
      gridWrapper.style.gap = '8px';
    }

    areas.forEach(area => {
      const areaId = area.area_id;

      let defaultEntity = null;
      const matchCard = Object.values(hass.states).find(s => 
        (s.entity_id.startsWith('light.') || s.entity_id.startsWith('switch.') || s.entity_id.startsWith('input_boolean.')) && 
        hass.entities[s.entity_id]?.area_id === areaId
      );
      if (matchCard) defaultEntity = matchCard.entity_id;

      if (!defaultEntity) {
        const anyEntity = Object.values(hass.states).find(s => hass.entities[s.entity_id]?.area_id === areaId);
        defaultEntity = anyEntity ? anyEntity.entity_id : 'sun.sun'; 
      }

      const areaName = area.name;
      const areaIcon = area.icon || "mdi:home-outline";
      const areaSlug = areaId.toLowerCase().replace(/ /g, '_');

      let areaTemp = "N/A";
      const tSensor = Object.values(hass.states).find(s => 
        s.entity_id.startsWith('sensor.') && s.attributes.device_class === 'temperature' && 
        hass.entities[s.entity_id]?.area_id === areaId
      );
      if (tSensor) areaTemp = tSensor.state + (tSensor.attributes.unit_of_measurement || '°C');

      let areaHumidity = "N/A";
      const hSensor = Object.values(hass.states).find(s => 
        s.entity_id.startsWith('sensor.') && s.attributes.device_class === 'humidity' && 
        hass.entities[s.entity_id]?.area_id === areaId
      );
      if (hSensor) areaHumidity = hSensor.state + (hSensor.attributes.unit_of_measurement || '%');

      let raw = JSON.stringify(template);
      raw = raw.replaceAll('[[area_id]]', areaId)
               .replaceAll('[[area_name]]', areaName)
               .replaceAll('[[area_icon]]', areaIcon)
               .replaceAll('[[area_slug]]', areaSlug)
               .replaceAll('[[area_temp]]', areaTemp)
               .replaceAll('[[area_humidity]]', areaHumidity)
               .replaceAll('[[default_entity]]', defaultEntity);

      const cardConfig = JSON.parse(raw);

      try {
        const cardElement = helpers.createCardElement(cardConfig);
        cardElement.hass = hass;
        
        // Sécurité critique : on s'assure que la sous-carte possède sa méthode setConfig si HA l'appelle à la volée
        if (typeof cardElement.setConfig !== 'function') {
          cardElement.setConfig = function(c) { this._config = c; };
        }

        gridWrapper.appendChild(cardElement);
        this._childElements.push(cardElement);
      } catch (e) {
        console.error("Erreur sous-carte:", e);
      }
    });

    if (this._childElements.length === 0) {
      this.content.innerHTML = `<div style="padding:10px; color:var(--secondary-text-color);">Aucune pièce trouvée.</div>`;
    } else {
      this.content.appendChild(gridWrapper);
    }
  }

  getCardSize() {
    return 3;
  }
}
customElements.define('all-areas-display', AllAreasDisplay);

window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'all-areas-display')) {
  window.customCards.push({
    type: "all-areas-display",
    name: "All Areas Display",
    preview: true,
    description: "Multi-générateur de cartes épuré."
  });
}