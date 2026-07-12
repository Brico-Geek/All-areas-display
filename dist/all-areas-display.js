// ==========================================
// 1. L'ÉDITEUR VISUEL AVANCÉ (100% SANS YAML)
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
    // Propager Hass aux sous-éditeurs visuels des cartes
    const subEditors = this.querySelectorAll("hui-card-element-editor");
    subEditors.forEach(editor => { editor.hass = hass; });
  }

  _render() {
    if (this.querySelector("#layout-form")) {
      this._updateFormSchema();
      return;
    }

    this.innerHTML = `
      <div class="card-config" style="padding: 10px; display: flex; flex-direction: column; gap: 20px; font-family: var(--paper-font-body1_-_font-family, sans-serif);">
        
        <!-- 1. MISE EN PAGE -->
        <div>
          <h3 style="margin: 0 0 5px 0; color: var(--primary-color); font-size: 1.1em;">Configuration de la Mise en Page</h3>
          <ha-form id="layout-form"></ha-form>
        </div>
        
        <hr style="border: none; border-top: 1px solid var(--divider-color); margin: 0;">
        
        <!-- 2. GESTION DES COMPOSANTS PAR PIÈCE -->
        <div>
          <h3 style="margin: 0 0 5px 0; color: var(--primary-color); font-size: 1.1em;">Composants à répéter par pièce</h3>
          <p style="margin: 0 0 15px 0; font-size: 0.85em; color: var(--secondary-text-color);">
            Ajoute tes cartes. Chacune aura son éditeur visuel dédié en dessous (comme dans Bubble Card).
          </p>
          
          <!-- Conteneur des éditeurs visuels de cartes -->
          <div id="sub-editors-container" style="display: flex; flex-direction: column; gap: 20px; margin-bottom: 20px;"></div>

          <!-- Menu d'ajout rapide -->
          <div style="display: flex; gap: 10px; align-items: center; background: var(--secondary-background-color); padding: 12px; border-radius: 8px; border: 1px dashed var(--divider-color);">
            <select id="card-type-selector" style="flex-grow: 1; height: 40px; padding: 0 10px; border-radius: 4px; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color); font-size: 0.95em;">
              <option value="" disabled selected>Choisir un élément à ajouter...</option>
              <option value="tile">Carte Tuile (Tile)</option>
              <option value="button">Carte Bouton (Button)</option>
              <option value="entities">Carte Liste d'Entités (Entities)</option>
              <option value="custom:mushroom-template-card">Mushroom Template Card</option>
              <option value="custom:bubble-card">Bubble Card (Popup/Button)</option>
            </select>
            <button id="add-card-btn" style="background: var(--primary-color); color: white; border: none; border-radius: 4px; width: 40px; height: 40px; font-size: 1.5em; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold;">+</button>
          </div>
        </div>
      </div>
    `;

    this._formElement = this.querySelector("#layout-form");
    this._selector = this.querySelector("#card-type-selector");
    this._addButton = this.querySelector("#add-card-btn");

    // Événement : Changement du mode de mise en page globale
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

    // Événement : Clic sur "+" pour ajouter un composant
    this._addButton.addEventListener("click", () => {
      const type = this._selector.value;
      if (!type) return;

      const templates = [...(this._config?.templates || [])];
      
      // Configuration initiale par défaut
      let newCardConfig = { type: type };
      if (type === "tile" || type === "button") {
        newCardConfig.entity = "[[default_entity]]";
        newCardConfig.name = "[[area_name]]";
      }

      templates.push(newCardConfig);
      this._fireConfigChanged({ ...this._config, templates });
      this._selector.value = ""; 
    });

    this._updateFormSchema();
  }

  _updateFormSchema() {
    if (!this._formElement) return;

    const currentLayout = this._config?.layout_type || "grid";

    const schema = [
      {
        name: "layout_type",
        label: "Type de mise en page",
        type: "select",
        options: [
          ["grid", "Mode Grille (Grid)"],
          ["horizontal-stack", "Mode Horizontal"],
          ["vertical-stack", "Mode Vertical"]
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
      columns: Math.max(2, this._config?.layout_options?.columns || 2)
    };

    this._renderSubEditors();
  }

  // Génère dynamiquement l'éditeur visuel natif pour CHAQUE carte de la liste
  async _renderSubEditors() {
    const container = this.querySelector("#sub-editors-container");
    if (!container) return;

    const templates = this._config?.templates || [];
    if (templates.length === 0) {
      container.innerHTML = `
        <div style="font-size: 0.9em; color: var(--secondary-text-color); font-style: italic; text-align: center; padding: 15px; border: 1px dashed var(--divider-color); border-radius: 6px;">
          Aucun élément créé. Utilisez le menu d'ajout ci-dessous.
        </div>`;
      return;
    }

    container.innerHTML = "";
    
    // Charger l'outil de création d'éditeurs de Home Assistant
    const helpers = await window.loadCardHelpers();

    templates.forEach((tpl, index) => {
      const cardWrapper = document.createElement("div");
      cardWrapper.style = "border: 1px solid var(--divider-color); border-radius: 8px; background: var(--card-background-color); overflow: hidden; box-shadow: var(--ha-card-box-shadow, none);";
      
      // Barre de titre de l'élément avec bouton supprimer
      const header = document.createElement("div");
      header.style = "background: var(--secondary-background-color); padding: 10px 15px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--divider-color);";
      header.innerHTML = `
        <span style="font-weight: bold; font-size: 0.95em; color: var(--primary-text-color);">Élément #${index + 1} (${tpl.type})</span>
        <button style="background: var(--error-color); color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8em; font-weight: bold;">Supprimer</button>
      `;
      
      header.querySelector("button").addEventListener("click", () => {
        const newTemplates = [...templates];
        newTemplates.splice(index, 1);
        this._fireConfigChanged({ ...this._config, templates: newTemplates });
      });
      cardWrapper.appendChild(header);

      // Panneau d'aide pour insérer visuellement les variables sans YAML
      const helperBar = document.createElement("div");
      helperBar.style = "padding: 8px 15px; background: var(--info-background-color, #e8f4fd); display: flex; flex-wrap: wrap; gap: 5px; align-items: center; border-bottom: 1px solid var(--divider-color);";
      helperBar.innerHTML = `
        <span style="font-size: 0.8em; color: var(--primary-text-color); font-weight: 500; margin-right: 5px;">Copier une variable :</span>
        <button class="v-btn" data-v="[[area_name]]" style="font-size:0.75em; padding:2px 6px; cursor:pointer; border-radius:3px; border:1px solid var(--primary-color);">Nom Pièce</button>
        <button class="v-btn" data-v="[[area_icon]]" style="font-size:0.75em; padding:2px 6px; cursor:pointer; border-radius:3px; border:1px solid var(--primary-color);">Icône</button>
        <button class="v-btn" data-v="[[default_entity]]" style="font-size:0.75em; padding:2px 6px; cursor:pointer; border-radius:3px; border:1px solid var(--primary-color);">Lumière Auto</button>
        <button class="v-btn" data-v="[[area_temp]]" style="font-size:0.75em; padding:2px 6px; cursor:pointer; border-radius:3px; border:1px solid var(--primary-color);">Température</button>
      `;
      
      // Permet de copier rapidement dans le presse-papier pour le coller dans l'éditeur visuel juste en dessous
      helperBar.querySelectorAll(".v-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          navigator.clipboard.writeText(btn.getAttribute("data-v"));
          alert(`Copié : ${btn.getAttribute("data-v")} ! Tu peux le coller (Ctrl+V) dans un champ ci-dessous.`);
        });
      });
      cardWrapper.appendChild(helperBar);

      // CRÉATION DE L'ÉDITEUR VISUEL NATIF DE LA CARTE (Le Graal !)
      const editorElement = document.createElement("hui-card-element-editor");
      editorElement.hass = this._hass;
      editorElement.lovelace = { editMode: true };
      // On passe la config actuelle de la sous-carte à son éditeur dédié
      editorElement.value = tpl;
      editorElement.style = "display: block; padding: 15px;";

      // Écouter quand l'utilisateur change visuellement une option dans CE sous-éditeur
      editorElement.addEventListener("config-changed", (ev) => {
        ev.stopPropagation(); // Ne pas perturber l'éditeur parent
        const updatedSubConfig = ev.detail.config;
        
        const newTemplates = [...templates];
        newTemplates[index] = updatedSubConfig;
        
        this._fireConfigChanged({ ...this._config, templates: newTemplates });
      });

      cardWrapper.appendChild(editorElement);
      container.appendChild(cardWrapper);
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
// 2. LE RENDU DE LA CARTE PRINCIPALE
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

    const mainLayoutConfig = {
      type: config.layout_type || 'grid',
      cards: []
    };
    
    if (mainLayoutConfig.type === 'grid') {
      mainLayoutConfig.columns = Math.max(2, config.layout_options?.columns || 2);
    }

    areas.forEach(area => {
      const areaId = area.area_id;
      const areaName = area.name;
      const areaIcon = area.icon || "mdi:home-outline";
      const areaSlug = areaId.toLowerCase().replace(/ /g, '_');

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

      const localStack = {
        type: "vertical-stack",
        cards: []
      };

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

      if (localStack.cards.length > 0) {
        if (localStack.cards.length === 1) {
          mainLayoutConfig.cards.push(localStack.cards[0]);
        } else {
          mainLayoutConfig.cards.push(localStack);
        }
      }
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
    if (this.content) {
      this._buildCards();
    }
  }

  getCardSize() {
    return 3;
  }
}
customElements.define('all-areas-display', AllAreasDisplay);

// Enregistrement catalogue
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'all-areas-display')) {
  window.customCards.push({
    type: "all-areas-display",
    name: "All Areas Display",
    preview: true,
    description: "Générateur automatique par pièce avec support multi-cartes empilées."
  });
}