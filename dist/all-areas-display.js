// ==========================================
// 1. L'ÉDITEUR VISUEL ET PARAMÉTRAGE (GUI)
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
    // Éviter de recréer l'interface inutilement à chaque cycle
    if (this.querySelector("#layout-form")) {
      this._updateFormSchema();
      return;
    }

    this.innerHTML = `
      <div class="card-config" style="padding: 10px; display: flex; flex-direction: column; gap: 20px; font-family: var(--paper-font-body1_-_font-family, sans-serif);">
        
        <div>
          <h3 style="margin: 0 0 5px 0; color: var(--primary-color); font-size: 1.1em;">1. Disposition Globale</h3>
          <ha-form id="layout-form"></ha-form>
        </div>
        
        <hr style="border: none; border-top: 1px solid var(--divider-color); margin: 0;">
        
        <div>
          <h3 style="margin: 0 0 5px 0; color: var(--primary-color); font-size: 1.1em;">2. Éléments par pièce</h3>
          <p style="margin: 0 0 15px 0; font-size: 0.85em; color: var(--secondary-text-color);">
            Ajoute les composants qui seront répétés dans chaque pièce (ex: Bouton + Popup au même endroit).
          </p>
          
          <!-- Liste des cartes configurées -->
          <div id="cards-list" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 15px;"></div>

          <!-- Sélecteur d'ajout rapide -->
          <div style="display: flex; gap: 10px; align-items: center; background: var(--secondary-background-color); padding: 12px; border-radius: 8px; border: 1px dashed var(--divider-color);">
            <ha-select id="card-type-selector" label="Ajouter un composant" style="flex-grow: 1;">
              <mwc-list-item value="tile">Carte Tuile (Tile)</mwc-list-item>
              <mwc-list-item value="button">Carte Bouton (Button)</mwc-list-item>
              <mwc-list-item value="entities">Carte Entités (Entities)</mwc-list-item>
              <mwc-list-item value="custom:mushroom-chips-card">Mushroom Chips (Si installé)</mwc-list-item>
              <mwc-list-item value="custom:bubble-card">Bubble Card Pop-up (Si installé)</mwc-list-item>
            </ha-select>
            <ha-icon-button id="add-card-btn" icon="mdi:plus" style="color: var(--primary-color);"></ha-icon-button>
          </div>
        </div>

        <div style="font-size: 0.85em; color: var(--secondary-text-color); line-height: 1.5; background: var(--secondary-background-color); padding: 12px; border-radius: 8px; border: 1px solid var(--divider-color);">
          <strong>💡 Variables magiques utilisables :</strong><br>
          <code>[[area_name]]</code>, <code>[[area_icon]]</code>, <code>[[default_entity]]</code>, <code>[[area_temp]]</code>, <code>[[area_humidity]]</code>
        </div>
      </div>
    `;

    this._formElement = this.querySelector("#layout-form");
    this._selector = this.querySelector("#card-type-selector");
    this._addButton = this.querySelector("#add-card-btn");

    // Événement sur le changement de la mise en page
    this._formElement.addEventListener("value-changed", (ev) => {
      const value = ev.detail.value;
      let targetLayout = value.layout_type;
      
      const newConfig = {
        ...this._config,
        layout_type: targetLayout,
        layout_options: {
          columns: targetLayout === "grid" ? Math.max(2, value.columns || 2) : undefined
        }
      };
      this._fireConfigChanged(newConfig);
    });

    // Événement d'ajout d'une carte
    this._addButton.addEventListener("click", () => {
      const type = this._selector.value;
      if (!type) return;

      const templates = [...(this._config?.templates || [])];
      
      // Configuration par défaut selon le type choisi
      let newCardConfig = { type: type };
      if (type === "tile" || type === "button") {
        newCardConfig.entity = "[[default_entity]]";
        newCardConfig.name = "[[area_name]]";
      }

      templates.push(newCardConfig);
      this._fireConfigChanged({ ...this._config, templates });
      this._selector.value = ""; // Reset
    });

    this._updateFormSchema();
  }

  _updateFormSchema() {
    if (!this._formElement) return;

    const currentLayout = this._config?.layout_type || "grid";

    const schema = [
      {
        name: "layout_type",
        label: "Mode d'alignement des pièces",
        type: "select",
        options: [
          ["grid", "Grille dynamique (Grid)"],
          ["horizontal-stack", "Colonne horizontale (Horizontal Stack)"],
          ["vertical-stack", "Colonne verticale (Vertical Stack)"]
        ]
      }
    ];

    // LA CONDITION : On affiche "Colonnes" UNIQUEMENT si "grid" est sélectionné
    if (currentLayout === "grid") {
      schema.push({
        name: "columns",
        label: "Nombre de colonnes (Minimum 2)",
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

    this._renderCardsList();
  }

  _renderCardsList() {
    const listContainer = this.querySelector("#cards-list");
    if (!listContainer) return;

    const templates = this._config?.templates || [];
    if (templates.length === 0) {
      listContainer.innerHTML = `
        <div style="font-size: 0.9em; color: var(--secondary-text-color); font-style: italic; text-align: center; padding: 15px; border: 1px dashed var(--divider-color); border-radius: 6px;">
          Aucun élément configuré pour le moment.
        </div>`;
      return;
    }

    listContainer.innerHTML = "";
    templates.forEach((tpl, index) => {
      const row = document.createElement("div");
      row.style = "display: flex; justify-content: space-between; align-items: center; background: var(--card-background-color); padding: 10px; border-radius: 6px; border: 1px solid var(--divider-color);";
      row.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <span style="font-size: 0.9em; font-weight: 500;">Composant #${index + 1}</span>
          <code style="font-size: 0.8em; color: var(--primary-color);">${tpl.type}</code>
        </div>
        <ha-icon-button class="delete-btn" icon="mdi:delete" style="color: var(--error-color);"></ha-icon-button>
      `;

      row.querySelector(".delete-btn").addEventListener("click", () => {
        const newTemplates = [...templates];
        newTemplates.splice(index, 1);
        this._fireConfigChanged({ ...this._config, templates: newTemplates });
      });

      listContainer.appendChild(row);
    });
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
// 2. LE COMPOSANT D'AFFICHAGE PRINCIPAL
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
      templates: [
        {
          type: "tile",
          entity: "[[default_entity]]",
          name: "[[area_name]]"
        }
      ]
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
    const templates = config.templates || [];

    // Configuration structurelle globale
    const mainLayoutConfig = {
      type: config.layout_type || 'grid',
      cards: []
    };
    
    if (mainLayoutConfig.type === 'grid') {
      mainLayoutConfig.columns = Math.max(2, config.layout_options?.columns || 2);
    }

    // Génération itérative par zone
    areas.forEach(area => {
      const areaId = area.area_id;
      const areaName = area.name;
      const areaIcon = area.icon || "mdi:home-outline";
      const areaSlug = areaId.toLowerCase().replace(/ /g, '_');

      // Extraction automatique des entités référencées dans la pièce
      let defaultEntity = "sun.sun";
      const matchCard = Object.values(hass.states).find(s => 
        (s.entity_id.startsWith('light.') || s.entity_id.startsWith('switch.')) && 
        hass.entities[s.entity_id]?.area_id === areaId
      );
      if (matchCard) defaultEntity = matchCard.entity_id;

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

      // Le conteneur interne qui empile les multi-éléments (Bouton + Popup par exemple) au même endroit
      const localStack = {
        type: "vertical-stack",
        cards: []
      };

      // Remplacement propre des chaînes de caractères de variables
      const bindVariables = (tpl) => {
        let raw = JSON.stringify(tpl);
        raw = raw.replaceAll('[[area_id]]', areaId)
                 .replaceAll('[[area_name]]', areaName)
                 .replaceAll('[[area_icon]]', areaIcon)
                 .replaceAll('[[area_slug]]', areaSlug)
                 .replaceAll('[[area_temp]]', areaTemp)
                 .replaceAll('[[area_humidity]]', areaHumidity)
                 .replaceAll('[[default_entity]]', defaultEntity);
        return JSON.parse(raw);
      };

      templates.forEach(tpl => {
        localStack.cards.push(bindVariables(tpl));
      });

      // Injection dans la structure racine si la pièce contient des éléments
      if (localStack.cards.length > 0) {
        if (localStack.cards.length === 1) {
          mainLayoutConfig.cards.push(localStack.cards[0]);
        } else {
          mainLayoutConfig.cards.push(localStack);
        }
      }
    });

    // Instanciation via le moteur de rendu natif Lovelace
    const helpers = await window.loadCardHelpers();
    const element = helpers.createCardElement(mainLayoutConfig);
    element.hass = hass;

    this.content.innerHTML = '';
    this.content.appendChild(element);
    this._layoutElement = element;
  }

  setConfig(config) {
    // Si la configuration change (ajout/suppression), on force la reconstruction
    this._config = config;
    if (this.content) {
      this._buildCards();
    }
  }

  getCardSize() {
    return 3;
  }
}
customElements.define('all-areas-display', AllAreasDisplay);

// Enregistrement de la carte
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'all-areas-display')) {
  window.customCards.push({
    type: "all-areas-display",
    name: "All Areas Display (Grille & Multi)",
    preview: true,
    description: "Générateur automatique par pièce. Supporte la grille paramétrable et l'empilement multi-cartes."
  });
}