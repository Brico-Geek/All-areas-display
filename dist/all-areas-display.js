// ==========================================
// 1. L'ÉDITEUR VISUEL NATIF ET AVANCÉ (GUI)
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
      this._updateFormSchema(); // Ajuster le schéma si la config ou le mode change
    }
    if (this._cardPicker) {
      this._cardPicker.hass = hass;
    }
  }

  _render() {
    if (this._formElement) return;

    this.innerHTML = `
      <div class="card-config" style="padding: 10px; display: flex; flex-direction: column; gap: 20px;">
        <h3 style="margin: 0; color: var(--primary-color); font-size: 1.1em;">Mise en Page Globale</h3>
        <ha-form id="layout-form"></ha-form>
        
        <hr style="border: none; border-top: 1px solid var(--divider-color); margin: 5px 0;">
        
        <h3 style="margin: 0; color: var(--primary-color); font-size: 1.1em;">Éléments à répéter par pièce</h3>
        <p style="margin: 0; font-size: 0.85em; color: var(--secondary-text-color);">
          Ajoute un ou plusieurs éléments (Bouton, Popup, Tuile, etc.). Ils seront dupliqués automatiquement dans chaque pièce avec leurs variables.
        </p>
        
        <!-- Zone d'affichage des sous-cartes déjà configurées -->
        <div id="cards-list" style="display: flex; flex-direction: column; gap: 10px;"></div>

        <!-- Le sélecteur officiel de cartes de Home Assistant -->
        <div style="border: 1px dashed var(--divider-color); padding: 15px; border-radius: 8px; text-align: center;">
          <h4 style="margin: 0 0 10px 0; font-size: 0.9em;">Ajouter un élément par pièce :</h4>
          <hui-card-picker id="card-picker"></hui-card-picker>
        </div>

        <div style="font-size: 0.85em; color: var(--secondary-text-color); line-height: 1.4; background: var(--secondary-background-color); padding: 10px; border-radius: 6px;">
          <strong>Variables injectées automatiquement :</strong><br>
          <code>[[area_name]]</code>, <code>[[area_icon]]</code>, <code>[[area_slug]]</code>, <code>[[area_temp]]</code>, <code>[[area_humidity]]</code>, <code>[[default_entity]]</code>
        </div>
      </div>
    `;

    this._formElement = this.querySelector("#layout-form");
    this._cardPicker = this.querySelector("#card-picker");

    this._updateFormSchema();

    // Gestion du changement de mise en page (Grille, Vertical, Horizontal)
    this._formElement.addEventListener("value-changed", (ev) => {
      const value = ev.detail.value;
      
      let targetType = "grid";
      if (value.layout_type === "horizontal") targetType = "horizontal-stack";
      if (value.layout_type === "vertical") targetType = "vertical-stack";

      const newConfig = {
        ...this._config,
        layout_type: targetType,
        layout_options: {
          ...this._config?.layout_options,
          columns: targetType === "grid" ? Math.max(2, value.columns || 2) : undefined
        }
      };
      this._fireConfigChanged(newConfig);
    });

    // Gestion de la sélection d'une nouvelle carte via le hui-card-picker
    this._cardPicker.addEventListener("config-changed", (ev) => {
      ev.stopPropagation();
      const cardConfig = ev.detail.config;
      if (!cardConfig) return;

      // Récupérer le tableau de templates existants ou en créer un nouveau
      const templates = [...(this._config?.templates || [])];
      templates.push(cardConfig);

      const newConfig = {
        ...this._config,
        templates: templates
      };
      
      // Réinitialiser le sélecteur après l'ajout
      this._cardPicker.value = "";
      this._fireConfigChanged(newConfig);
    });
  }

  _updateFormSchema() {
    if (!this._formElement) return;

    // Déterminer le type d'affichage actuel pour l'état du formulaire
    let currentLayout = "grid";
    if (this._config?.layout_type === "horizontal-stack") currentLayout = "horizontal";
    if (this._config?.layout_type === "vertical-stack") currentLayout = "vertical";

    // Construction dynamique du schéma
    const schema = [
      {
        name: "layout_type",
        label: "Type d'affichage",
        type: "select",
        options: [
          ["grid", "Grille (Grid)"],
          ["horizontal", "Alignement Horizontal (Stack)"],
          ["vertical", "Alignement Vertical (Stack)"]
        ],
        default: "grid"
      }
    ];

    // On ajoute le champ colonne UNIQUEMENT si on est en mode Grid
    if (currentLayout === "grid") {
      schema.push({
        name: "columns",
        label: "Nombre de colonnes (Minimum 2)",
        type: "integer",
        default: 2,
        valueMin: 2,
        valueMax: 6
      });
    }

    const data = {
      layout_type: currentLayout,
      columns: Math.max(2, this._config?.layout_options?.columns || 2)
    };

    this._formElement.schema = schema;
    this._formElement.data = data;

    // Rendu de la liste des cartes ajoutées pour pouvoir les supprimer
    this._renderCardsList();
  }

  _renderCardsList() {
    const listContainer = this.querySelector("#cards-list");
    if (!listContainer) return;

    const templates = this._config?.templates || [];
    if (templates.length === 0) {
      listContainer.innerHTML = `<div style="font-size: 0.9em; color: var(--secondary-text-color); font-style: italic; text-align: center; padding: 10px;">Aucun élément configuré. Utilisez le sélecteur ci-dessous.</div>`;
      return;
    }

    listContainer.innerHTML = "";
    templates.forEach((tpl, index) => {
      const cardRow = document.createElement("div");
      cardRow.style = "display: flex; justify-content: space-between; align-items: center; background: var(--secondary-background-color); padding: 8px 12px; border-radius: 6px; border: 1px solid var(--divider-color);";
      cardRow.innerHTML = `
        <span style="font-size: 0.9em; font-weight: bold;">#${index + 1} - ${tpl.type}</span>
        <button style="background: var(--error-color); color: white; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 0.8em;">Supprimer</button>
      `;

      cardRow.querySelector("button").addEventListener("click", () => {
        const newTemplates = [...templates];
        newTemplates.splice(index, 1);
        const newConfig = { ...this._config, templates: newTemplates };
        this._fireConfigChanged(newConfig);
      });

      listContainer.appendChild(cardRow);
    });
  }

  _fireConfigChanged(newConfig) {
    const event = new CustomEvent("config-changed", {
      detail: { config: newConfig },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
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
      templates: [
        {
          type: "tile",
          entity: "[[default_entity]]",
          name: "[[area_name]]",
          icon: "[[area_icon]]"
        }
      ]
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
    const templates = config.templates || [];

    // Conteneur principal (Grille, Vertical Stack, ou Horizontal Stack)
    const layoutConfig = {
      type: config.layout_type || 'grid',
      cards: []
    };
    
    if (layoutConfig.type === 'grid') {
      layoutConfig.columns = Math.max(2, config.layout_options?.columns || 2);
      layoutConfig.square = config.layout_options?.square || false;
    }

    // Boucler sur chaque pièce
    areas.forEach(area => {
      const areaId = area.area_id;
      const areaName = area.name;
      const areaSlug = areaId.toLowerCase().replace(/ /g, '_');
      const areaIcon = area.icon || "mdi:home-outline";

      // 🔍 1. Entité par défaut (Lumière / Switch)
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

      // 🌡️ 2. Température
      let areaTemp = "N/A";
      const tempEntity = Object.values(hass.states).find(state => 
        state.entity_id.startsWith('sensor.') && 
        (state.entity_id.includes('temperature') || state.attributes.device_class === 'temperature') && 
        hass.entities[state.entity_id]?.area_id === areaId
      );
      if (tempEntity) areaTemp = tempEntity.state + (tempEntity.attributes.unit_of_measurement || '°C');

      // 💧 3. Humidité
      let areaHumidity = "N/A";
      const humEntity = Object.values(hass.states).find(state => 
        state.entity_id.startsWith('sensor.') && 
        (state.entity_id.includes('humidity') || state.attributes.device_class === 'humidity') && 
        hass.entities[state.entity_id]?.area_id === areaId
      );
      if (humEntity) areaHumidity = humEntity.state + (humEntity.attributes.unit_of_measurement || '%');

      // Si l'utilisateur veut mettre plusieurs éléments au même endroit (Bouton + Popup),
      // on doit regrouper ces éléments dans un sous-conteneur vertical pour la pièce
      const areaContainer = {
        type: "vertical-stack",
        cards: []
      };

      // Remplacement des variables
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

      // Remplir le sous-conteneur de la pièce avec tous les templates choisis
      templates.forEach(tpl => {
        areaContainer.cards.push(replaceVariables(tpl));
      });

      // Si on a des éléments configurés, on les pousse dans l'affichage global
      if (areaContainer.cards.length > 0) {
        // Si un seul élément est demandé, pas besoin du vertical-stack intermédiaire
        if (areaContainer.cards.length === 1) {
          layoutConfig.cards.push(areaContainer.cards[0]);
        } else {
          layoutConfig.cards.push(areaContainer);
        }
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
    this._config = config;
  }

  getCardSize() {
    return 3;
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
    description: "Multi-générateur de cartes par pièces avec sélecteur graphique natif."
  });
}