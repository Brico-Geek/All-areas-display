// ==========================================
// 1. L'ÉDITEUR VISUEL (INTERFACE GRAPHIQUE)
// ==========================================
class AllAreasDisplayEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.content) {
      this.innerHTML = `
        <div class="card-config" style="padding: 10px; font-family: sans-serif; display: flex; flex-direction: column; gap: 15px;">
          <div style="display: flex; flex-direction: column; gap: 5px;">
            <label style="font-weight: bold; font-size: 0.9em; color: var(--secondary-text-color);">Nombre de colonnes :</label>
            <input type="number" id="columns" min="1" max="6" style="padding: 8px; border-radius: 4px; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color);">
          </div>
          <div style="font-size: 0.85em; color: var(--secondary-text-color); line-height: 1.4;">
            💡 Les templates de boutons (<code>button_template</code>) et de popups (<code>popup_template</code>) se configurent pour le moment directement via l'éditeur YAML ci-contre.
          </div>
        </div>
      `;
      this.content = this.querySelector('.card-config');
      
      // Gérer le changement de valeur du champ colonnes
      this.querySelector('#columns').addEventListener('change', (ev) => {
        if (!this._config) return;
        const newConfig = {
          ...this._config,
          layout_options: {
            ...this._config.layout_options,
            columns: parseInt(ev.target.value, 10) || 2
          }
        };
        // Déclencher l'événement de mise à jour pour HA
        const event = new CustomEvent("config-changed", {
          detail: { config: newConfig },
          bubbles: true,
          composed: true,
        });
        this.dispatchEvent(event);
      });
    }

    // Appliquer la valeur actuelle de la config dans l'input
    if (this._config) {
      this.querySelector('#columns').value = this._config.layout_options?.columns || 2;
    }
  }
}
customElements.define('all-areas-display-editor', AllAreasDisplayEditor);


// ==========================================
// 2. LA CARTE PRINCIPALE
// ==========================================
class AllAreasDisplay extends HTMLElement {
  // Indiquer à Home Assistant d'utiliser l'éditeur créé au-dessus
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
        name: "[[area_name]]",
        sub_name: "[[area_temp]]",
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

      // 🔍 1. Trouver une entité par défaut pour éviter le crash de Bubble Card
      let defaultEntity = "sun.sun"; 
      const lightEntity = Object.values(hass.states).find(state => 
        state.entity_id.startsWith('light.') && 
        hass.entities[state.entity_id]?.area_id === areaId
      );
      if (lightEntity) {
        defaultEntity = lightEntity.entity_id;
      } else {
        const switchEntity = Object.values(hass.states).find(state => 
          state.entity_id.startsWith('switch.') && 
          hass.entities[state.entity_id]?.area_id === areaId
        );
        if (switchEntity) defaultEntity = switchEntity.entity_id;
      }

      // 🌡️ 2. Récupérer la température de la pièce
      let areaTemp = "N/A";
      const tempEntity = Object.values(hass.states).find(state => 
        state.entity_id.startsWith('sensor.') && 
        state.entity_id.includes('temperature') && 
        hass.entities[state.entity_id]?.area_id === areaId
      );
      if (tempEntity) areaTemp = tempEntity.state + (tempEntity.attributes.unit_of_measurement || '°C');

      // 📝 3. Injection des variables dans le template
      const replaceVariables = (obj) => {
        let str = JSON.stringify(obj);
        str = str.replaceAll('[[area_id]]', areaId);
        str = str.replaceAll('[[area_name]]', areaName);
        str = str.replaceAll('[[area_slug]]', areaSlug);
        str = str.replaceAll('[[area_temp]]', areaTemp);
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
// 3. ENREGISTREMENT DANS LE CATALOGUE HA
// ==========================================
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'all-areas-display')) {
  window.customCards.push({
    type: "all-areas-display",
    name: "All areas display",
    preview: true,
    description: "Génère dynamiquement des grilles de cartes (Bubble Card, etc.) pour toutes vos pièces."
  });
}