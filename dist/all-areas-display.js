// ==========================================
// 1. L'ÉDITEUR HYBRIDE (INTERFACE SIMPLE + YAML)
// ==========================================
class AllAreasDisplayEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._layoutFormElement) {
      this._layoutFormElement.hass = hass;
    }
    if (this._yamlEditor) {
      this._yamlEditor.hass = hass;
    }
  }

  _render() {
    if (this._layoutFormElement) {
      this._updateFormValues();
      return;
    }

    this.innerHTML = `
      <div class="card-config" style="padding: 10px; display: flex; flex-direction: column; gap: 20px;">
        
        <h3 style="margin: 0; color: var(--primary-color);">1. Structure de l'affichage</h3>
        <ha-form id="layout-form"></ha-form>
        
        <hr style="border: none; border-top: 1px solid var(--divider-color); margin: 0;">
        
        <h3 style="margin: 0; color: var(--primary-color);">2. Pièces à exclure (Bannir)</h3>
        <div style="font-size: 0.85em; color: var(--secondary-text-color); margin-bottom: 5px;">
          Entrez les IDs ou les noms des pièces à masquer, séparés par des virgules (ex: garage, cellier) :
        </div>
        <ha-textfield id="exclude-input" style="width: 100%;" placeholder="garage, couloir, exterieur"></ha-textfield>

        <hr style="border: none; border-top: 1px solid var(--divider-color); margin: 0;">

        <h3 style="margin: 0; color: var(--primary-color);">3. Modèle de la carte (YAML)</h3>
        <p style="margin: 0; font-size: 0.85em; color: var(--secondary-text-color);">
          Laissez les champs vides pour le comportement par défaut, ou utilisez <code>this.area.name</code>, <code>this.area.temperature</code>, etc.
        </p>

        <div id="yaml-editor-container"></div>
      </div>
    `;

    this._layoutFormElement = this.querySelector("#layout-form");
    const container = this.querySelector("#yaml-editor-container");
    const excludeInput = this.querySelector("#exclude-input");

    // Init champ exclusion
    excludeInput.value = this._config.exclude_areas ? this._config.exclude_areas.join(', ') : '';
    excludeInput.addEventListener("change", (ev) => {
      const list = ev.target.value.split(',').map(s => s.trim().toLowerCase()).filter(s => s.length > 0);
      this._fireConfigChanged({
        ...this._config,
        exclude_areas: list
      });
    });

    // Formulaire visuel pour la mise en page
    const layoutSchema = [
      {
        name: "layout_type",
        label: "Type d'affichage",
        selector: {
          select: {
            options: [
              { value: "grid", label: "Grille (Grid)" },
              { value: "horizontal-stack", label: "Pile Horizontale (Horizontal)" },
              { value: "vertical-stack", label: "Pile Verticale (Vertical)" }
            ]
          }
        }
      },
      {
        name: "columns",
        label: "Nombre de colonnes (Mode Grille)",
        selector: {
          number: { min: 1, max: 12, mode: "box" }
        }
      }
    ];

    this._layoutFormElement.schema = layoutSchema;
    this._updateFormValues();

    this._layoutFormElement.addEventListener("value-changed", (ev) => {
      const value = ev.detail.value;
      this._fireConfigChanged({
        ...this._config,
        layout_type: value.layout_type || "grid",
        layout_options: {
          ...this._config.layout_options,
          columns: value.columns || 2
        }
      });
    });

    // Éditeur de code pour la carte
    this._yamlEditor = document.createElement("ha-code-editor");
    this._yamlEditor.mode = "yaml";
    
    const cardTemplate = this._config.card_template || { type: "tile" };
    this._yamlEditor.value = window.jsyaml ? window.jsyaml.dump(cardTemplate) : JSON.stringify(cardTemplate, null, 2);

    this._yamlEditor.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      try {
        const parsedCard = window.jsyaml ? window.jsyaml.load(ev.detail.value) : JSON.parse(ev.detail.value);
        this._fireConfigChanged({
          ...this._config,
          card_template: parsedCard
        });
      } catch (err) {}
    });

    container.appendChild(this._yamlEditor);
  }

  _updateFormValues() {
    if (!this._layoutFormElement) return;
    this._layoutFormElement.data = {
      layout_type: this._config?.layout_type || "grid",
      columns: this._config?.layout_options?.columns || 2
    };
  }

  _fireConfigChanged(newConfig) {
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: newConfig },
      bubbles: true,
      composed: true,
    }));
  }
}
customElements.define('all-areas-display-editor', AllAreasDisplayEditor);


// ==========================================
// 2. LA CARTE PRINCIPALE (MOTEUR DE DYNAMISATION)
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
      exclude_areas: [],
      card_template: {
        type: "tile",
        entity: "",
        name: ""
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
    let areas = Object.values(hass.areas || {});
    const excludeList = config.exclude_areas || [];

    // Filtrer les pièces bannies (par ID ou par Nom)
    areas = areas.filter(area => {
      const idMatch = excludeList.includes(area.area_id.toLowerCase());
      const nameMatch = area.name ? excludeList.includes(area.name.toLowerCase()) : false;
      return !idMatch && !nameMatch;
    });

    if (areas.length === 0) {
      this.content.innerHTML = `<ha-alert alert-type="info">Aucune pièce à afficher (ou toutes bannies).</ha-alert>`;
      return;
    }

    const layoutConfig = {
      type: config.layout_type || 'grid',
      cards: []
    };
    
    if (layoutConfig.type === 'grid') {
      layoutConfig.columns = config.layout_options?.columns || 2;
      layoutConfig.square = false;
    }

    const templateToUse = config.card_template || { type: "tile" };

    areas.forEach(area => {
      const areaId = area.area_id;
      const areaName = area.name || areaId;
      const areaSlug = areaId.toLowerCase().replace(/ /g, '_');
      const areaIcon = area.icon || "mdi:home-outline";

      // Recherche des entités par défaut
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

      // Capteurs Température & Humidité
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

      // Création du dictionnaire de données de la pièce actuelle
      const areaData = {
        id: areaId,
        name: areaName,
        slug: areaSlug,
        icon: areaIcon,
        entity: defaultEntity,
        temperature: areaTemp,
        humidity: areaHumidity
      };

      // Remplacement récursif basé sur "this.area.xxx" ou les valeurs vides
      const processCard = (obj) => {
        let copy = JSON.parse(JSON.stringify(obj));

        // 1. Gestion des valeurs vides ou manquantes (Comportement intelligent demandé)
        if (!copy.hasOwnProperty('entity') || copy.entity === "") copy.entity = areaData.entity;
        if (!copy.hasOwnProperty('name') || copy.name === "") copy.name = areaData.name;
        if (!copy.hasOwnProperty('icon') || copy.icon === "") copy.icon = areaData.icon;

        // 2. Remplacement des expressions "this.area.xxx" partout dans l'objet
        let str = JSON.stringify(copy);
        str = str.replaceAll('this.area.id', areaData.id);
        str = str.replaceAll('this.area.name', areaData.name);
        str = str.replaceAll('this.area.slug', areaData.slug);
        str = str.replaceAll('this.area.icon', areaData.icon);
        str = str.replaceAll('this.area.entity', areaData.entity);
        str = str.replaceAll('this.area.temperature', areaData.temperature);
        str = str.replaceAll('this.area.humidity', areaData.humidity);

        return JSON.parse(str);
      };

      try {
        layoutConfig.cards.push(processCard(templateToUse));
      } catch (e) {
        console.error("Erreur parsing variables :", e);
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
      console.error("Erreur rendu :", err);
    }
  }

  getCardSize() {
    return 4;
  }
}
customElements.define('all-areas-display', AllAreasDisplay);

// Enregistrement catalogue Lovelace
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'all-areas-display')) {
  window.customCards.push({
    type: "all-areas-display",
    name: "All areas display",
    preview: true,
    description: "Affichage géré par l'interface, cartes configurées en YAML."
  });
}