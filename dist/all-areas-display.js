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
        
        <!-- 1. Choix de la Disposition globale -->
        <div>
          <h3 style="margin: 0 0 10px 0; color: var(--primary-color); font-size: 1.1em;">1. Disposition globale</h3>
          <ha-form id="layout-form"></ha-form>
        </div>
        
        <hr style="border: none; border-top: 1px solid var(--divider-color); margin: 0;">
        
        <!-- 2. Éditeur de carte avec bouton de bascule d'interface -->
        <div>
          <h3 style="margin: 0 0 10px 0; color: var(--primary-color); font-size: 1.1em;">2. Configuration de la carte modèle</h3>
          
          <div id="editor-container" style="min-height: 150px; border: 1px solid var(--divider-color); border-radius: 8px; padding: 10px; background: var(--card-background-color);">
            <!-- L'éditeur officiel (Visuel ou Code YAML) s'injecte ici -->
          </div>
          
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
      if (this._cardEditor) {
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

    const cardEditor = document.createElement("hui-card-element-editor");
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
// 2. LE GENERATEUR D'AFFICHAGE MULTI-ZONES (CORRIGÉ)
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

  set hass(hass) {
    const oldHass = this._hass;
    this._hass = hass;
    if (!this._config) return;

    if (!this.content) {
      this.innerHTML = `<div id="root"></div>`;
      this.content = this.querySelector('#root');
      this._buildCards();
    } else if (this._layoutElement) {
      // TRÈS IMPORTANT : On transmet le hass à l'élément de mise en page pour qu'il le propage à ses enfants
      this._layoutElement.hass = hass;
    }
  }

  async _buildCards() {
    if (!this._hass || !this._config) return;
    
    const config = this._config;
    const hass = this._hass;
    const template = config.template_card;

    if (!template || Object.keys(template).length === 0) {
      this.content.innerHTML = `<div style="padding:10px; color:var(--secondary-text-color);">Définissez une carte valide dans la configuration.</div>`;
      return;
    }

    const areas = Object.values(hass.areas || {});
    const mainLayoutConfig = {
      type: config.layout_type || 'grid',
      cards: []
    };
    
    if (mainLayoutConfig.type === 'grid') {
      mainLayoutConfig.columns = Math.max(2, config.layout_options?.columns || 2);
    }

    areas.forEach(area => {
      const areaId = area.area_id;

      let defaultEntity = null;
      const matchCard = Object.values(hass.states).find(s => 
        (s.entity_id.startsWith('light.') || s.entity_id.startsWith('switch.') || s.entity_id.startsWith('input_boolean.')) && 
        hass.entities[s.entity_id]?.area_id === areaId
      );
      if (matchCard) defaultEntity = matchCard.entity_id;

      if (!defaultEntity) return;

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

      mainLayoutConfig.cards.push(JSON.parse(raw));
    });

    try {
      const helpers = await window.loadCardHelpers();
      const element = helpers.createCardElement(mainLayoutConfig);
      
      // Assigner le hass avant l'injection
      element.hass = hass;

      this.content.innerHTML = '';
      this.content.appendChild(element);
      this._layoutElement = element;

      // LA CORRECTION : Laisser un tick au navigateur pour monter l'élément, puis ré-injecter hass
      // Cela force le déclenchement de la méthode customElement connectedCallback des sous-cartes
      await new Promise(r => setTimeout(r, 0));
      if (this._layoutElement) {
        this._layoutElement.hass = this._hass;
      }
    } catch (err) {
      this.content.innerHTML = `<p style="color:red; padding:10px;">Erreur d'affichage : ${err.message}</p>`;
    }
  }

  setConfig(config) {
    this._config = config;
    if (this.content) this._buildCards();
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