// ==========================================
// 1. L'ÉDITEUR VISUEL AVANCÉ (GUI)
// ==========================================
class AllAreasDisplayEditor extends HTMLElement {
  async setConfig(config) {
    this._config = config;
    await this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._layoutFormElement) {
      this._layoutFormElement.hass = hass;
    }
    if (this._cardEditorElement) {
      this._cardEditorElement.hass = hass;
    }
  }

  async _render() {
    if (this._layoutFormElement) {
      this._updateFormValues();
      return;
    }

    this.innerHTML = `
      <div class="card-config" style="padding: 10px; display: flex; flex-direction: column; gap: 20px;">
        <h3 style="margin: 0; color: var(--primary-color);">Configuration de la Mise en Page</h3>
        <ha-form id="layout-form"></ha-form>
        
        <hr style="border: none; border-top: 1px solid var(--divider-color); margin: 5px 0;">
        
        <h3 style="margin: 0; color: var(--primary-color);">Configuration du Modèle de Carte</h3>
        <p style="margin: 0; font-size: 0.85em; color: var(--secondary-text-color);">
          Configurez ici la carte unique qui sera dupliquée pour chaque pièce détectée.
        </p>

        <!-- Sélecteur rapide de type de carte sans casser Lovelace -->
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <label style="font-weight: bold; font-size: 0.9em; color: var(--primary-text-color);">Changer le type de carte rapidement :</label>
          <select id="quick-card-type-selector" style="padding: 10px; border-radius: 4px; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color); width: 100%;">
            <option value="">-- Choisir un modèle --</option>
            <option value="tile">Tuile (Tile)</option>
            <option value="button">Bouton (Button)</option>
            <option value="custom:mushroom-template-card">Mushroom Template</option>
            <option value="custom:mushroom-chips-card">Mushroom Chips</option>
          </select>
        </div>
        
        <div id="card-editor-container"></div>

        <!-- Badges interactifs cliquables pour insérer les variables sans erreur -->
        <div style="font-size: 0.85em; color: var(--secondary-text-color); line-height: 1.4; background: var(--secondary-background-color); padding: 12px; border-radius: 6px; border: 1px dashed var(--divider-color);">
          <strong style="display: block; margin-bottom: 8px;">Variables dynamiques (Cliquez pour copier) :</strong>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;" id="variable-badges">
            <span class="var-badge" data-var="[[area_name]]" style="cursor:pointer; background: var(--primary-color); color: white; padding: 3px 8px; border-radius: 4px; font-family: monospace;">[[area_name]]</span>
            <span class="var-badge" data-var="[[area_icon]]" style="cursor:pointer; background: var(--primary-color); color: white; padding: 3px 8px; border-radius: 4px; font-family: monospace;">[[area_icon]]</span>
            <span class="var-badge" data-var="[[area_id]]" style="cursor:pointer; background: var(--primary-color); color: white; padding: 3px 8px; border-radius: 4px; font-family: monospace;">[[area_id]]</span>
            <span class="var-badge" data-var="[[area_slug]]" style="cursor:pointer; background: var(--primary-color); color: white; padding: 3px 8px; border-radius: 4px; font-family: monospace;">[[area_slug]]</span>
            <span class="var-badge" data-var="[[area_temp]]" style="cursor:pointer; background: var(--primary-color); color: white; padding: 3px 8px; border-radius: 4px; font-family: monospace;">[[area_temp]]</span>
            <span class="var-badge" data-var="[[area_humidity]]" style="cursor:pointer; background: var(--primary-color); color: white; padding: 3px 8px; border-radius: 4px; font-family: monospace;">[[area_humidity]]</span>
            <span class="var-badge" data-var="[[default_entity]]" style="cursor:pointer; background: var(--primary-color); color: white; padding: 3px 8px; border-radius: 4px; font-family: monospace;">[[default_entity]]</span>
          </div>
        </div>
      </div>
    `;

    this._layoutFormElement = this.querySelector("#layout-form");
    const editorContainer = this.querySelector("#card-editor-container");
    const quickSelector = this.querySelector("#quick-card-type-selector");

    // Écouteur pour changer le type de carte proprement
    quickSelector.addEventListener("change", (ev) => {
      const selectedType = ev.target.value;
      if (!selectedType) return;

      let baseConfig = { type: selectedType };
      
      if (selectedType === "tile" || selectedType === "button") {
        baseConfig.entity = "[[default_entity]]";
        baseConfig.name = "[[area_name]]";
        baseConfig.icon = "[[area_icon]]";
      } else if (selectedType.includes("mushroom-template")) {
        baseConfig.primary = "[[area_name]]";
        baseConfig.secondary = "[[area_temp]]";
        baseConfig.icon = "[[area_icon]]";
      }

      if (this._cardEditorElement) {
        this._cardEditorElement.value = baseConfig;
      }
      
      this._fireConfigChanged({
        ...this._config,
        button_template: baseConfig
      });
      
      quickSelector.value = ""; // Reset le sélecteur visuel
    });

    // Gestion du clic sur les badges pour copier directement
    this.querySelectorAll(".var-badge").forEach(badge => {
      badge.addEventListener("click", () => {
        const textToCopy = badge.getAttribute("data-var");
        navigator.clipboard.writeText(textToCopy);
        
        // Petit effet visuel sympa pour confirmer la copie
        const originalBackground = badge.style.background;
        badge.style.background = "#4caf50"; // Vert
        setTimeout(() => { badge.style.background = originalBackground; }, 800);
      });
    });

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
          number: {
            min: 1,
            max: 12,
            mode: "box"
          }
        }
      }
    ];

    this._layoutFormElement.schema = layoutSchema;
    this._updateFormValues();

    this._layoutFormElement.addEventListener("value-changed", (ev) => {
      const value = ev.detail.value;
      const newConfig = {
        ...this._config,
        layout_type: value.layout_type || "grid",
        layout_options: {
          ...this._config.layout_options,
          columns: value.columns || 2
        }
      };
      this._fireConfigChanged(newConfig);
    });

    try {
      const helpers = await window.loadCardHelpers();
      this._cardEditorElement = document.createElement("hui-card-element-editor");
      this._cardEditorElement.hass = this._hass;
      this._cardEditorElement.value = this._config.button_template || { type: "tile", name: "[[area_name]]" };

      this._cardEditorElement.addEventListener("config-changed", (ev) => {
        ev.stopPropagation();
        const newConfig = {
          ...this._config,
          button_template: ev.detail.config
        };
        this._fireConfigChanged(newConfig);
      });

      editorContainer.appendChild(this._cardEditorElement);
    } catch (err) {
      console.error("Erreur sélecteur HA:", err);
      editorContainer.innerHTML = `<p style="color:red;">Erreur de chargement de l'éditeur visuel.</p>`;
    }
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
        type: "tile",
        name: "[[area_name]]",
        icon: "[[area_icon]]"
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

    const layoutConfig = {
      type: config.layout_type || 'grid',
      cards: []
    };
    
    if (layoutConfig.type === 'grid') {
      layoutConfig.columns = config.layout_options?.columns || 2;
      layoutConfig.square = false;
    }

    let templateToUse = config.button_template || { type: "tile", name: "[[area_name]]" };

    areas.forEach(area => {
      const areaId = area.area_id;
      const areaName = area.name;
      const areaSlug = areaId.toLowerCase().replace(/ /g, '_');
      const areaIcon = area.icon || "mdi:home-outline";

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

      layoutConfig.cards.push(replaceVariables(templateToUse));
    });

    try {
      const helpers = await window.loadCardHelpers();
      const element = helpers.createCardElement(layoutConfig);
      element.hass = hass;

      this.content.innerHTML = '';
      this.content.appendChild(element);
      this._layoutElement = element;
    } catch (err) {
      console.error("Erreur rendu:", err);
    }
  }

  getCardSize() {
    return 4;
  }
}
customElements.define('all-areas-display', AllAreasDisplay);


// ==========================================
// 3. ENREGISTREMENT CATALOGUE (OK LOVELACE)
// ==========================================
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'all-areas-display')) {
  window.customCards.push({
    type: "all-areas-display",
    name: "All areas display",
    preview: true,
    description: "Générateur automatique de tableaux de bord basés sur vos pièces Lovelace."
  });
}