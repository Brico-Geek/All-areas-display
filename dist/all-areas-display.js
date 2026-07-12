// ==========================================
// 1. L'ÉDITEUR DE CODE YAML (ROBUSTE ET SIMPLE)
// ==========================================
class AllAreasDisplayEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._yamlEditor) {
      this._yamlEditor.hass = hass;
    }
  }

  _render() {
    if (this._yamlEditor) return;

    this.innerHTML = `
      <div class="card-config" style="padding: 10px; display: flex; flex-direction: column; gap: 15px;">
        <h3 style="margin: 0; color: var(--primary-color);">Configuration (Style Auto-Entities)</h3>
        <p style="margin: 0; font-size: 0.85em; color: var(--secondary-text-color);">
          Définissez la mise en page globale et le modèle de carte en YAML. Le modèle sera dupliqué pour chaque pièce détectée.
        </p>

        <!-- Zone d'injection de l'éditeur de code officiel -->
        <div id="yaml-editor-container"></div>

        <!-- Aide mémoire pour les variables -->
        <div style="font-size: 0.85em; color: var(--secondary-text-color); line-height: 1.4; background: var(--secondary-background-color); padding: 12px; border-radius: 6px; border: 1px dashed var(--divider-color);">
          <strong style="display: block; margin-bottom: 6px;">Variables disponibles dans votre YAML :</strong>
          <code style="display: block; margin-bottom: 4px;">[[area_name]]</code>
          <code style="display: block; margin-bottom: 4px;">[[area_icon]]</code>
          <code style="display: block; margin-bottom: 4px;">[[area_id]]</code>
          <code style="display: block; margin-bottom: 4px;">[[area_slug]]</code>
          <code style="display: block; margin-bottom: 4px;">[[area_temp]]</code>
          <code style="display: block; margin-bottom: 4px;">[[area_humidity]]</code>
          <code style="display: block;">[[default_entity]]</code>
        </div>
      </div>
    `;

    const container = this.querySelector("#yaml-editor-container");

    // Création de l'éditeur de code officiel de Home Assistant
    this._yamlEditor = document.createElement("ha-code-editor");
    this._yamlEditor.mode = "yaml";
    this._yamlEditor.autocompleteEntities = true;
    this._yamlEditor.autocompleteString = true;
    
    // On nettoie la config pour l'affichage de l'édition (on retire le type principal)
    const { type, ...cleanConfig } = this._config;
    // Utilisation de l'outil natif de HA pour transformer le JSON en chaîne YAML propre
    this._yamlEditor.value = window.jsyaml ? window.jsyaml.dump(cleanConfig) : JSON.stringify(cleanConfig, null, 2);

    this._yamlEditor.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      try {
        // Transformation du YAML de l'utilisateur en objet JSON
        const parsedConfig = window.jsyaml ? window.jsyaml.load(ev.detail.value) : JSON.parse(ev.detail.value);
        
        this.dispatchEvent(new CustomEvent("config-changed", {
          detail: {
            config: {
              type: "custom:all-areas-display",
              ...parsedConfig
            }
          },
          bubbles: true,
          composed: true,
        }));
      } catch (err) {
        // On ne fait rien pendant que l'utilisateur écrit pour éviter de faire crasher l'interface
      }
    });

    container.appendChild(this._yamlEditor);
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
      card_template: {
        type: "tile",
        name: "[[area_name]]",
        icon: "[[area_icon]]",
        entity: "[[default_entity]]"
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

    this._buildCards();
  }

  async _buildCards() {
    const config = this._config;
    const hass = this._hass;
    const areas = Object.values(hass.areas || {});

    if (areas.length === 0) {
      this.content.innerHTML = `<ha-alert alert-type="info">Aucune pièce détectée.</ha-alert>`;
      return;
    }

    // Préparation de la structure de mise en page globale
    const layoutConfig = {
      type: config.layout_type || 'grid',
      cards: []
    };
    
    if (layoutConfig.type === 'grid') {
      layoutConfig.columns = config.layout_options?.columns || 2;
      layoutConfig.square = false;
    }

    // Récupération du template de carte personnalisé (clé card_template)
    let templateToUse = config.card_template || { type: "tile", name: "[[area_name]]", entity: "[[default_entity]]" };

    areas.forEach(area => {
      const areaId = area.area_id;
      const areaName = area.name;
      const areaSlug = areaId.toLowerCase().replace(/ /g, '_');
      const areaIcon = area.icon || "mdi:home-outline";

      // Algorithme d'entité par défaut (Lumière, puis interrupteur, puis soleil)
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

      // Extraction des capteurs de température
      let areaTemp = "N/A";
      const tempEntity = Object.values(hass.states).find(state => 
        state.entity_id.startsWith('sensor.') && 
        (state.entity_id.includes('temperature') || state.attributes.device_class === 'temperature') && 
        hass.entities[state.entity_id]?.area_id === areaId
      );
      if (tempEntity) areaTemp = tempEntity.state + (tempEntity.attributes.unit_of_measurement || '°C');

      // Extraction des capteurs d'humidité
      let areaHumidity = "N/A";
      const humEntity = Object.values(hass.states).find(state => 
        state.entity_id.startsWith('sensor.') && 
        (state.entity_id.includes('humidity') || state.attributes.device_class === 'humidity') && 
        hass.entities[state.entity_id]?.area_id === areaId
      );
      if (humEntity) areaHumidity = humEntity.state + (humEntity.attributes.unit_of_measurement || '%');

      // Remplacement dynamique textuel des variables
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

      try {
        layoutConfig.cards.push(replaceVariables(templateToUse));
      } catch (e) {
        console.error("Erreur de traitement des variables YAML :", e);
      }
    });

    try {
      const helpers = await window.loadCardHelpers();
      const element = helpers.createCardElement(layoutConfig);
      element.hass = hass;

      this.content.innerHTML = '';
      this.content.appendChild(element);
      this._layoutElement = element;
    } catch (err) {
      console.error("Erreur rendu conteneur principal :", err);
    }
  }

  getCardSize() {
    return 4;
  }
}
customElements.define('all-areas-display', AllAreasDisplay);


// ==========================================
// 3. ENREGISTREMENT CATALOGUE
// ==========================================
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'all-areas-display')) {
  window.customCards.push({
    type: "all-areas-display",
    name: "All areas display",
    preview: true,
    description: "Générateur automatique de cartes basé sur du YAML et vos pièces Lovelace."
  });
}