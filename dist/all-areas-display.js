// ==========================================
// 1. L'ÉDITEUR AVEC ACCÈS AUX COMPOSANTS DE HA
// ==========================================
class AllAreasDisplayEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._formElement) this._formElement.hass = hass;
    if (this._cardPicker) this._cardPicker.hass = hass;
  }

  // Permet de récupérer la vraie configuration Lovelace de Home Assistant en remontant le DOM
  _getLovelace() {
    let root = document.querySelector("home-assistant");
    if (!root) return null;
    root = root.shadowRoot?.querySelector("home-assistant-main");
    root = root?.shadowRoot?.querySelector("ha-drawer") || root;
    root = root?.querySelector("partial-panel-resolver, ha-panel-lovelace");
    root = root?.shadowRoot?.querySelector("ha-panel-lovelace") || root;
    root = root?.shadowRoot?.querySelector("hui-root");
    return root?._lovelace || null;
  }

  async _render() {
    if (this.querySelector("#layout-form")) {
      this._updateFormSchema();
      return;
    }

    this.innerHTML = `
      <div class="card-config" style="padding: 10px; display: flex; flex-direction: column; gap: 20px; font-family: var(--paper-font-body1_-_font-family, sans-serif);">
        
        <!-- 1. Choix de la disposition globale -->
        <div>
          <h3 style="margin: 0 0 10px 0; color: var(--primary-color); font-size: 1.1em;">1. Disposition globale</h3>
          <ha-form id="layout-form"></ha-form>
        </div>
        
        <hr style="border: none; border-top: 1px solid var(--divider-color); margin: 0;">
        
        <!-- 2. Sélecteur visuel de cartes -->
        <div>
          <h3 style="margin: 0 0 5px 0; color: var(--primary-color); font-size: 1.1em;">2. Sélectionner le type de carte à dupliquer</h3>
          <p style="margin: 0 0 15px 0; font-size: 0.85em; color: var(--secondary-text-color);">
            Choisissez la carte de base qui sera générée automatiquement pour chaque pièce.
          </p>
          
          <div id="picker-container" style="max-height: 500px; overflow-y: auto; border: 1px solid var(--divider-color); border-radius: 8px; padding: 10px; background: var(--card-background-color);">
            <!-- Le sélecteur va s'injecter ici -->
          </div>
        </div>

      </div>
    `;

    this._formElement = this.querySelector("#layout-form");
    const pickerContainer = this.querySelector("#picker-container");

    const llInstance = this._getLovelace();

    // TENTATIVE 1 : Utilisation du sélecteur natif officiel rattaché au dashboard actuel
    if (llInstance) {
      try {
        const cardPicker = document.createElement("hui-card-picker");
        cardPicker.hass = this._hass;
        cardPicker.lovelace = llInstance;
        
        cardPicker.addEventListener("config-changed", (ev) => {
          ev.stopPropagation();
          this._applyTemplate(ev.detail.config);
        });

        pickerContainer.appendChild(cardPicker);
        this._cardPicker = cardPicker;
        this._updateFormSchema();
        return;
      } catch (e) {
        console.log("Échec du picker natif, bascule sur le rendu jumeau.", e);
      }
    }

    // TENTATIVE 2 : Fallback Jumeau - Si HA bloque l'accès, on génère le même visuel parfait que HA
    this._renderFallbackPicker(pickerContainer);
    this._updateFormSchema();
  }

  // Génère un catalogue visuel calqué à 100% sur le style et les classes de Home Assistant
  _renderFallbackPicker(container) {
    const coreCards = [
      { type: "button", name: "Bouton", desc: "PC fixe, Lumière, Prise..." },
      { type: "tile", name: "Tuile (Tile)", desc: "Affichage standardisé moderne avec fonctionnalités" },
      { type: "custom:bubble-card", name: "Bubble Card", desc: "Design épuré et sliders tactiles fluides" },
      { type: "entity", name: "Entité", desc: "Suivi d'état simple avec historique rapide" },
      { type: "heading", name: "Titre (Heading)", desc: "Entête textuel de section épuré" }
    ];

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="font-weight: 500; font-size: 1.1em; margin-bottom: -4px; color: var(--primary-text-color);">Cartes disponibles</div>
        ${coreCards.map(c => `
          <div class="ha-card-mock-btn" data-type="${c.type}" style="
            background: var(--ha-card-background, var(--card-background-color, white));
            border: 1px solid var(--ha-card-border-color, var(--divider-color, #e0e0e0));
            border-radius: var(--ha-card-border-radius, 12px);
            box-shadow: var(--ha-card-box-shadow, none);
            padding: 20px;
            text-align: center;
            cursor: pointer;
            transition: transform 0.15s ease, border-color 0.15s ease;
          " onmouseover="this.style.borderColor='var(--primary-color)'" onmouseout="this._updateBorders ? this._updateBorders() : this.style.borderColor=''">
            <div style="font-weight: bold; font-size: 1.2em; color: var(--primary-text-color); margin-bottom: 6px;">${c.name}</div>
            <div style="font-size: 0.9em; color: var(--secondary-text-color);">${c.desc}</div>
          </div>
        `).join('')}
      </div>
    `;

    container.addEventListener("click", (ev) => {
      const btn = ev.target.closest(".ha-card-mock-btn");
      if (!btn) return;

      const type = btn.getAttribute("data-type");
      let baseConf = { type: type };
      
      if (type === "custom:bubble-card") {
        baseConf.card_type = "button";
        baseConf.button_type = "slider";
      }

      this._applyTemplate(baseConf);
      
      // Feedback visuel de sélection
      container.querySelectorAll(".ha-card-mock-btn").forEach(b => {
        b.style.border = b === btn ? "2px solid var(--primary-color)" : "1px solid var(--ha-card-border-color)";
        b.style.background = b === btn ? "var(--primary-color-light, rgba(3, 169, 244, 0.05))" : "";
      });
    });
  }

  _applyTemplate(cardConfig) {
    if (!cardConfig) return;

    // Remplissage automatique des variables magiques
    cardConfig.name = "[[area_name]]";
    cardConfig.icon = "[[area_icon]]";

    if (cardConfig.type === "glance" || cardConfig.type === "entities") {
      cardConfig.entities = ["[[default_entity]]"];
    } else {
      cardConfig.entity = "[[default_entity]]";
    }

    this._config = {
      ...this._config,
      template_card: cardConfig
    };
    
    this._fireConfigChanged();
  }

  _updateFormSchema() {
    if (!this._formElement) return;

    const currentLayout = this._config?.layout_type || "grid";
    const schema = [
      {
        name: "layout_type",
        label: "Type d'affichage global",
        type: "select",
        options: [
          ["grid", "Grille (Grid)"],
          ["horizontal-stack", "Alignement Horizontal (Horizontal Stack)"],
          ["vertical-stack", "Alignement Vertical (Vertical Stack)"]
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
// 2. LE GENERATEUR D'AFFICHAGE MULTI-ZONES
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
    this._hass = hass;
    if (!this._config) return;

    if (!this.content) {
      this.innerHTML = `<div id="root"></div>`;
      this.content = this.querySelector('#root');
      this._buildCards();
    } else if (this._layoutElement) {
      this._layoutElement.hass = hass;
    }
  }

  async _buildCards() {
    const config = this._config;
    const hass = this._hass;
    const areas = Object.values(hass.areas || {});
    const template = config.template_card || {};

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

    const helpers = await window.loadCardHelpers();
    const element = helpers.createCardElement(mainLayoutConfig);
    element.hass = hass;

    this.content.innerHTML = '';
    this.content.appendChild(element);
    this._layoutElement = element;
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
    description: "Multi-générateur de pièces avec sélecteur graphique."
  });
}