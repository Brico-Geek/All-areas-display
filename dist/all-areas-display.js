// ==========================================
// 1. L'ÉDITEUR DE CODE (STYLE AUTO-ENTITIES)
// ==========================================
class AllAreasDisplayEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._yamlEditor) this._yamlEditor.hass = hass;
  }

  _render() {
    if (this._yamlEditor) return;

    this.innerHTML = `
      <div class="card-config" style="padding: 10px; display: flex; flex-direction: column; gap: 10px;">
        <h3 style="margin: 0; color: var(--primary-color);">Configuration All Areas Display</h3>
        <p style="margin: 0 0 10px 0; font-size: 0.85em; color: var(--secondary-text-color);">
          Configurez votre carte en pur YAML. Utilisez <code>this.area.id</code>, <code>this.area.name</code>, <code>this.area.icon</code>, etc.
        </p>
        <div id="yaml-editor-container"></div>
      </div>
    `;

    const container = this.querySelector("#yaml-editor-container");

    this._yamlEditor = document.createElement("ha-code-editor");
    this._yamlEditor.mode = "yaml";
    this._yamlEditor.value = window.jsyaml ? window.jsyaml.dump(this._config) : JSON.stringify(this._config, null, 2);

    this._yamlEditor.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      try {
        const parsedConfig = window.jsyaml ? window.jsyaml.load(ev.detail.value) : JSON.parse(ev.detail.value);
        this.dispatchEvent(new CustomEvent("config-changed", {
          detail: { config: parsedConfig },
          bubbles: true,
          composed: true,
        }));
      } catch (err) {}
    });

    container.appendChild(this._yamlEditor);
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
      layout: {
        type: "grid",
        columns: 2,
        square: false
      },
      exclude: [],
      card: {
        type: "tile",
        area: "this.area.id"
      }
    };
  }

  setConfig(config) {
    this._config = config;
  }

  set hass(hass) {
    const oldHass = this._hass;
    this._hass = hass;
    
    if (!this._config) return;

    if (!this.content) {
      this.innerHTML = `<div id="card-container"></div>`;
      this.content = this.querySelector('#card-container');
    }

    if (this._layoutElement && oldHass && oldHass.areas === hass.areas && oldHass.states === hass.states) {
      this._layoutElement.hass = hass;
      return;
    }

    this._buildContainer();
  }

  async _buildContainer() {
    const config = this._config;
    const hass = this._hass;
    let areas = Object.values(hass.areas || {});
    
    // 1. Filtrer les exclusions (par ID ou par Nom)
    const excludeList = (config.exclude || []).map(item => item.toLowerCase());
    areas = areas.filter(area => {
      const idMatch = excludeList.includes(area.area_id.toLowerCase());
      const nameMatch = area.name ? excludeList.includes(area.name.toLowerCase()) : false;
      return !idMatch && !nameMatch;
    });

    if (areas.length === 0) {
      this.content.innerHTML = `<ha-alert alert-type="info">Aucune pièce à afficher.</ha-alert>`;
      return;
    }

    // 2. Préparer la structure de mise en page (grid, vertical-stack, etc.)
    const layoutConfig = {
      ...(config.layout || { type: "grid", columns: 2 }),
      cards: []
    };

    // 3. Générer les cartes pour chaque pièce
    areas.forEach(area => {
      const areaId = area.area_id;
      const areaName = area.name || areaId;
      const areaSlug = areaId.toLowerCase().replace(/ /g, '_');
      const areaIcon = area.icon || "mdi:home-outline";

      // Recherche de l'entité par défaut (Light > Switch > Sun)
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

      // Extraction température & humidité
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

      // Remplacement des variables "this.area.xxx"
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
          layoutConfig.cards.push(processCard(config.card));
        } catch (e) {
          console.error("Erreur template All Areas Display :", e);
        }
      }
    });

    // 4. Rendu final du bloc
    try {
      const helpers = await window.loadCardHelpers();
      const element = helpers.createCardElement(layoutConfig);
      element.hass = hass;

      this.content.innerHTML = '';
      this.content.appendChild(element);
      this._layoutElement = element;
    } catch (err) {
      console.error("Erreur de rendu du container principal :", err);
    }
  }

  getCardSize() { return 4; }
}
customElements.define('all-areas-display', AllAreasDisplay);

// Enregistrement catalogue Lovelace
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'all-areas-display')) {
  window.customCards.push({
    type: "all-areas-display",
    name: "All areas display",
    preview: true,
    description: "Multiplie une carte pour chaque pièce Lovelace détectée (Style auto-entities)."
  });
}