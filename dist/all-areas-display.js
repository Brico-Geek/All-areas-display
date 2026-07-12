// ==========================================
// 1. L'ÉDITEUR DE CODE ET COMPOSANTS VISUELS
// ==========================================
class AllAreasDisplayEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._cardYamlEditor) this._cardYamlEditor.hass = hass;
    this._updateExcludedCheckboxes();
  }

  _render() {
    // ÉTAPPE DE SÉCURITÉ CRITIQUE : Si l'éditeur est déjà injecté dans le DOM,
    // on met juste à jour les valeurs sans toucher à la structure HTML.
    if (this._initialized) {
      this._updateValues();
      return;
    }
    this._initialized = true;

    this.innerHTML = `
      <div class="card-config" style="padding: 10px; display: flex; flex-direction: column; gap: 16px; font-family: var(--paper-font-body1_-_font-family, sans-serif);">
        
        <!-- SECTION 1 : DISPOSITION -->
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <label style="font-weight: bold; color: var(--primary-text-color);">Disposition des pièces :</label>
          <select id="layout-select" style="padding: 8px; border-radius: 4px; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color); width: 100%;">
            <option value="auto">Auto (S'adapte à l'espace disponible)</option>
            <option value="grid">Grille (Grid)</option>
            <option value="vertical">Vertical Stack</option>
            <option value="horizontal">Horizontal Stack</option>
          </select>
        </div>

        <!-- SECTION 2 : PIÈCES BANNIES -->
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <label style="font-weight: bold; color: var(--primary-text-color);">Pièces bannies (Masquées) :</label>
          <div id="excluded-areas-container" style="max-height: 140px; overflow-y: auto; padding: 8px; border: 1px solid var(--divider-color); border-radius: 4px; display: flex; flex-direction: column; gap: 6px; background: var(--secondary-background-color);">
            <!-- Rempli dynamiquement par JS -->
          </div>
        </div>

        <!-- SECTION 3 : ZONE DE COPIER-COLLER YAML DE LA CARTE ENFANT -->
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <label style="font-weight: bold; color: var(--primary-text-color);">Modèle de la carte (YAML) :</label>
          <p style="margin: 0 0 4px 0; font-size: 0.85em; color: var(--secondary-text-color);">
            Collez ici le YAML d'une carte classique. Utilisez <code>this.area.id</code>, <code>this.area.name</code>, <code>this.area.icon</code>.
          </p>
          <div id="card-yaml-editor-container"></div>
        </div>

      </div>
    `;

    // Gestion du changement de disposition
    this.querySelector("#layout-select").addEventListener("change", (ev) => {
      const val = ev.target.value;
      let newLayout = { type: "grid", columns: 2 };
      
      if (val === "vertical") newLayout = { type: "vertical-stack" };
      else if (val === "horizontal") newLayout = { type: "horizontal-stack" };
      else if (val === "auto") newLayout = { type: "grid", columns: null, square: false };
      else if (val === "grid") newLayout = { type: "grid", columns: 2, square: false };

      this._updateConfig({ layout: newLayout });
    });

    // Initialisation unique de l'éditeur de code
    const yamlContainer = this.querySelector("#card-yaml-editor-container");
    this._cardYamlEditor = document.createElement("ha-code-editor");
    this._cardYamlEditor.mode = "yaml";
    
    const initialCardConfig = this._config.card || { type: "tile", area: "this.area.id" };
    this._cardYamlEditor.value = window.jsyaml ? window.jsyaml.dump(initialCardConfig) : JSON.stringify(initialCardConfig, null, 2);

    this._cardYamlEditor.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      try {
        const parsedCard = window.jsyaml ? window.jsyaml.load(ev.detail.value) : JSON.parse(ev.detail.value);
        if (parsedCard && typeof parsedCard === 'object') {
          // On reconstruit une nouvelle config propre pour éviter les références circulaires
          const updatedConfig = {
            ...this._config,
            card: parsedCard
          };
          this.dispatchEvent(new CustomEvent("config-changed", {
            detail: { config: updatedConfig },
            bubbles: true,
            composed: true,
          }));
        }
      } catch (err) {
        // Mode silencieux pendant la saisie d'un YAML incomplet
      }
    });

    yamlContainer.appendChild(this._cardYamlEditor);
    this._updateValues();
  }

  _updateValues() {
    if (!this._config) return;
    const select = this.querySelector("#layout-select");
    if (select && this._config.layout) {
      const type = this._config.layout.type;
      if (type === "vertical-stack") select.value = "vertical";
      else if (type === "horizontal-stack") select.value = "horizontal";
      else if (type === "grid" && this._config.layout.columns === null) select.value = "auto";
      else select.value = "grid";
    }
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
      label.style.fontSize = "0.95em";
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
    const excludeList = (config.exclude || []).map(item => String(item).toLowerCase());
    areas = areas.filter(area => {
      const idMatch = excludeList.includes(area.area_id.toLowerCase());
      const nameMatch = area.name ? excludeList.includes(area.name.toLowerCase()) : false;
      return !idMatch && !nameMatch;
    });

    if (areas.length === 0) {
      this.content.innerHTML = `<ha-alert alert-type="info">Aucune pièce à afficher.</ha-alert>`;
      return;
    }

    // 2. Traitement de la disposition (Mise en page)
    const userLayout = config.layout || { type: "grid", columns: 2 };
    const layoutConfig = { ...userLayout, cards: [] };

    if (userLayout.type === "grid" && userLayout.columns === null) {
      delete layoutConfig.columns;
    }

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