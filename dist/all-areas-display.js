// ==========================================
// 1. L'ÉDITEUR VISUEL COMPATIBLE HOME ASSISTANT (GUI)
// ==========================================
class AllAreasDisplayEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._formElement) {
      this._formElement.hass = hass;
    }
  }

  _render() {
    if (this._formElement) return;

    this.innerHTML = `
      <div class="card-config" style="padding: 8px;">
        <ha-form id="form"></ha-form>
        <div style="margin-top: 15px; font-size: 0.85em; color: var(--secondary-text-color); line-height: 1.4; border-left: 3px solid var(--primary-color); padding-left: 10px;">
          <strong>Variables dynamiques utilisables dans ton YAML :</strong><br>
          • <code>[[area_name]]</code> : Nom de la pièce<br>
          • <code>[[area_icon]]</code> : Icône de la pièce configurée dans HA<br>
          • <code>[[area_slug]]</code> : ID de navigation (ex: #salon)<br>
          • <code>[[area_temp]]</code> : Température trouvée automatiquement<br>
          • <code>[[area_humidity]]</code> : Humidité trouvée automatiquement<br>
          • <code>[[default_entity]]</code> : Première lumière ou interrupteur détecté
        </div>
      </div>
    `;

    this._formElement = this.querySelector("#form");

    // Définir les champs que l'éditeur visuel va afficher
    const schema = [
      {
        name: "columns",
        label: "Nombre de colonnes de la grille",
        type: "integer",
        default: 2,
        valueMin: 1,
        valueMax: 6
      }
    ];

    // Mapper les données actuelles de la config vers le formulaire
    const data = {
      columns: this._config?.layout_options?.columns || 2
    };

    this._formElement.schema = schema;
    this._formElement.data = data;

    // Écouter les changements faits depuis l'interface graphique
    this._formElement.addEventListener("value-changed", (ev) => {
      const value = ev.detail.value;
      const newConfig = {
        ...this._config,
        layout_options: {
          ...this._config.layout_options,
          columns: value.columns
        }
      };

      const event = new CustomEvent("config-changed", {
        detail: { config: newConfig },
        bubbles: true,
        composed: true,
      });
      this.dispatchEvent(event);
    });
  }
}
customElements.define('all-areas-display-editor', AllAreasDisplayEditor);


// ==========================================
// 2. LA CARTE PRINCIPALE (ALL AREAS DISPLAY)
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
      button_template: {
        type: "custom:bubble-card",
        card_type: "button",
        entity: "[[default_entity]]",
        icon: "[[area_icon]]",
        name: "[[area_name]]",
        sub_name: "[[area_temp]] - [[area_humidity]]",
        tap_action: {
          action: "navigate",
          navigation_path: "#[[area_slug]]"
        }
      }
    };
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;

    if (!this.content) {
      this.innerHTML = `<div id="card-container"></div>`;
      this.content = this.querySelector('#card-container');
    }

    if (this._initialized) {
      if (this._layoutElement) this._layoutElement.hass = hass;
      return;
    }
    this._initialized = true;

    this._buildCards();
  }

  async _buildCards() {
    const config = this._config;
    const hass = this._hass;
    const areas = Object.values(hass.areas || {});

    const layoutConfig = {
      type: config.layout_type || 'grid',
      columns: config.layout_options?.columns || 2,
      square: config.layout_options?.square || false,
      cards: []
    };

    areas.forEach(area => {
      const areaId = area.area_id;
      const areaName = area.name;
      const areaSlug = areaId.toLowerCase().replace(/ /g, '_');
      
      // 🎨 1. Récupérer l'icône de la pièce (ou icône maison par défaut)
      const areaIcon = area.icon || "mdi:home-outline";

      // 🔍 2. Trouver une entité de contrôle par défaut (Lumière, Prise ou Switch)
      let defaultEntity = "sun.sun"; 
      const lightEntity = Object.values(hass.states).find(state => 
        state.entity_id.startsWith('light.') && 
        hass.entities[state.entity_id]?.area_id === areaId
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

      // 🌡️ 3. Récupérer la température automatique de la pièce
      let areaTemp = "N/A";
      const tempEntity = Object.values(hass.states).find(state => 
        state.entity_id.startsWith('sensor.') && 
        (state.entity_id.includes('temperature') || state.attributes.device_class === 'temperature') && 
        hass.entities[state.entity_id]?.area_id === areaId
      );
      if (tempEntity) areaTemp = tempEntity.state + (tempEntity.attributes.unit_of_measurement || '°C');

      // 💧 4. Récupérer l'humidité automatique de la pièce
      let areaHumidity = "N/A";
      const humEntity = Object.values(hass.states).find(state => 
        state.entity_id.startsWith('sensor.') && 
        (state.entity_id.includes('humidity') || state.attributes.device_class === 'humidity') && 
        hass.entities[state.entity_id]?.area_id === areaId
      );
      if (humEntity) areaHumidity = humEntity.state + (humEntity.attributes.unit_of_measurement || '%');

      // 📝 5. Clonage et remplacement des variables dans les templates
      const replaceVariables = (obj) => {
        let str = JSON.stringify(obj);
        str = str.replaceAll('[[area_id]]', areaId);
        str = str.replaceAll('[[area_name]]', areaName);
        str = str.replaceAll('[[area_icon]]', areaIcon);
        str = str.replaceAll('[[area_slug]]', areaSlug);
        str = str.replaceAll('[[area_temp]]', areaTemp);
        str = str.replaceAll('[[area_humidity]]', areaHumidity);
        str = str.replaceAll('[[default_entity]]', defaultEntity);
        return JSON.parse(str);
      };

      if (config.button_template) {
        layoutConfig.cards.push(replaceVariables(config.button_template));
      }
      if (config.popup_template) {
        layoutConfig.cards.push(replaceVariables(config.popup_template));
      }
    });

    const helpers = await window.loadCardHelpers();
    const element = helpers.createCardElement(layoutConfig);
    element.hass = hass;

    this.content.innerHTML = '';
    this.content.appendChild(element);
    this._layoutElement = element;
  }

  setConfig(config) {
    if (!config.button_template) {
      throw new Error("Tu dois spécifier un 'button_template'.");
    }
    this._config = config;
  }

  getCardSize() {
    return 3;
  }
}

customElements.define('all-areas-display', AllAreasDisplay);


// ==========================================
// 3. DÉCLARATION OFFICIELLE CATALOGUE
// ==========================================
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'all-areas-display')) {
  window.customCards.push({
    type: "all-areas-display",
    name: "All areas display",
    preview: true,
    description: "Génère des grilles de cartes dynamiques basées sur vos pièces, températures et humidités."
  });
}