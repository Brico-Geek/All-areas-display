// ==========================================
// 1. L'ÉDITEUR AVEC SÉLECTEUR DE CARTE NATIF
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
        
        <!-- 2. Sélecteur visuel de la carte modèle -->
        <div>
          <h3 style="margin: 0 0 5px 0; color: var(--primary-color); font-size: 1.1em;">2. Sélectionner le type de carte à dupliquer</h3>
          <p style="margin: 0 0 15px 0; font-size: 0.85em; color: var(--secondary-text-color);">
            Choisissez la carte de base qui sera générée automatiquement pour chaque pièce.
          </p>
          
          <div id="picker-container" style="max-height: 500px; overflow-y: auto; border: 1px solid var(--divider-color); border-radius: 8px; padding: 5px; background: var(--card-background-color);">
            <!-- Le composant natif Card Picker sera injecté ici -->
          </div>
        </div>

      </div>
    `;

    this._formElement = this.querySelector("#layout-form");
    const pickerContainer = this.querySelector("#picker-container");

    // Chargement et injection du sélecteur de carte officiel de Home Assistant
    const cardPicker = document.createElement("hui-card-picker");
    cardPicker.hass = this._hass;
    pickerContainer.appendChild(cardPicker);
    this._cardPicker = cardPicker;

    // Écouteur sur le choix de la mise en page (Grille, Horizontal, Vertical)
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

    // Écouteur magique : Quand l'utilisateur clique sur un type de carte dans le catalogue natif
    cardPicker.addEventListener("config-changed", (ev) => {
      ev.stopPropagation();
      const cardConfig = ev.detail.config;

      // On injecte des variables magiques par défaut dans la carte choisie pour qu'elle fonctionne directement
      if (cardConfig) {
        if (!cardConfig.name) cardConfig.name = "[[area_name]]";
        if (!cardConfig.icon) cardConfig.icon = "[[area_icon]]";
        if (!cardConfig.entity && !cardConfig.entities) cardConfig.entity = "[[default_entity]]";
      }

      this._config = {
        ...this._config,
        template_card: cardConfig
      };
      
      this._fireConfigChanged();
    });

    this._updateFormSchema();
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

      // Recherche d'une entité pour valider la pièce
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

      // Capteurs Température & Humidité
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

      // Remplacement des variables magiques dans la structure choisie
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
    description: "Multi-générateur automatique utilisant le catalogue de cartes natif de Home Assistant."
  });
}