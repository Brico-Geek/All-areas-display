// ==========================================
// 1. L'ÉDITEUR CONFIGURABLE (SANS BLOCAGE)
// ==========================================
class AllAreasDisplayEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._formElement) this._formElement.hass = hass;
    if (this._cardEditor) this._cardEditor.hass = hass;
  }

  async _render() {
    if (this.querySelector("#layout-form")) {
      this._updateEditorInstance();
      return;
    }

    this.innerHTML = `
      <div class="card-config" style="padding: 10px; display: flex; flex-direction: column; gap: 20px; font-family: var(--paper-font-body1_-_font-family, sans-serif);">
        
        <!-- 1. Disposition Globale -->
        <div>
          <h3 style="margin: 0 0 10px 0; color: var(--primary-color); font-size: 1.1em;">1. Disposition globale</h3>
          <ha-form id="layout-form"></ha-form>
        </div>
        
        <hr style="border: none; border-top: 1px solid var(--divider-color); margin: 0;">
        
        <!-- 2. Zone Éditeur de la Carte Modèle -->
        <div>
          <h3 style="margin: 0 0 5px 0; color: var(--primary-color); font-size: 1.1em;">2. Sélectionner et configurer la carte</h3>
          <p style="margin: 0 0 15px 0; font-size: 0.85em; color: var(--secondary-text-color);">
            Choisissez n'importe quelle carte disponible. Elle sera automatiquement déclinée pour chaque pièce.
          </p>
          
          <div id="editor-container" style="min-height: 200px; border: 1px solid var(--divider-color); border-radius: 8px; padding: 10px; background: var(--card-background-color);">
            <!-- Le sélecteur ou l'éditeur s'injecte ici -->
          </div>
        </div>

      </div>
    `;

    this._formElement = this.querySelector("#layout-form");
    this._setupLayoutForm();
    this._attachCardEditor();
  }

  _setupLayoutForm() {
    const currentLayout = this._config?.layout_type || "grid";
    const schema = [
      {
        name: "layout_type",
        label: "Type d'affichage global",
        type: "select",
        options: [
          ["grid", "Grille (Grid)"],
          ["horizontal-stack", "Alignement Horizontal"],
          ["vertical-stack", "Alignement Vertical"]
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
      columns: this._config?.layout_options?.columns || 2
    };

    this._formElement.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      const value = ev.detail.value;
      this._config = {
        ...this._config,
        layout_type: value.layout_type,
        layout_options: {
          columns: value.layout_type === "grid" ? Math.max(2, value.columns || 2) : undefined
        }
      };
      this._fireConfigChanged();
    });
  }

  async _attachCardEditor() {
    const container = this.querySelector("#editor-container");
    if (!container) return;

    const cardEditor = document.createElement("hui-card-element-editor");
    cardEditor.hass = this._hass;
    
    // IMPORTANT : Si aucune carte n'est enregistrée dans la config, on ne lui donne RIEN (undefined).
    // C'est ce qui force légitimement Home Assistant à afficher son écran de sélection de cartes (le Card Picker).
    if (this._config && this._config.template_card && Object.keys(this._config.template_card).length > 0) {
      cardEditor.value = this._config.template_card;
    }

    cardEditor.addEventListener("config-changed", (ev) => {
      ev.stopPropagation();
      
      this._config = {
        ...this._config,
        template_card: ev.detail.config
      };

      this._fireConfigChanged();
    });

    container.innerHTML = "";
    container.appendChild(cardEditor);
    this._cardEditor = cardEditor;
  }

  _updateEditorInstance() {
    if (this._cardEditor && this._hass) {
      this._cardEditor.hass = this._hass;
    }
  }

  _fireConfigChanged() {
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    }));
  }
}
customElements.define('all-areas-display-editor', AllAreasDisplayEditor);


// ==========================================
// 2. LE GENERATEUR D'AFFICHAGE MULTI-ZONES
// ==========================================
class AllAreasDisplay extends HTMLElement {
  static getConfigElement() {
    return document.createElement("all-areas-display-editor");
  }

  static getStubConfig() {
    // On nettoie le stub de démarrage pour éviter qu'une carte bouton ne se verrouille d'office
    return {
      type: "custom:all-areas-display",
      layout_type: "grid",
      layout_options: { columns: 2 }
    };
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;

    if (!this.content) {
      this.innerHTML = `<div id="root"></div>`;
      this.content = this.querySelector('#root');
      this._buildCards();
    } else {
      this._buildCards(); // On reconstruit pour mettre à jour l'affichage dynamique à droite en direct
    }
  }

  async _buildCards() {
    if (!this._hass || !this._config) return;
    
    const config = this._config;
    const hass = this._hass;
    const template = config.template_card;

    // Si aucune carte n'est encore sélectionnée, on affiche un message d'attente à droite plutôt qu'un écran blanc bugué
    if (!template || Object.keys(template).length === 0) {
      this.content.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--secondary-text-color); border: 2px dashed var(--divider-color); border-radius: 8px; margin: 10px;">
          En attente de la sélection d'une carte dans la colonne de gauche...
        </div>
      `;
      return;
    }

    const areas = Object.values(hass.areas || {});
    const mainLayoutConfig = {
      type: config.layout_type || 'grid',
      cards: []
    };
    
    if (mainLayoutConfig.type === 'grid') {
      mainLayoutConfig.columns = Math.max(2, config.layout_options?.columns || 2);
    }

    areas.forEach(area => {
      const areaId = area.area_id;

      let defaultEntity = null;
      const matchCard = Object.values(hass.states).find(s => 
        (s.entity_id.startsWith('light.') || s.entity_id.startsWith('switch.') || s.entity_id.startsWith('input_boolean.')) && 
        hass.entities[s.entity_id]?.area_id === areaId
      );
      if (matchCard) defaultEntity = matchCard.entity_id;

      if (!defaultEntity) return;

      const areaName = area.name;
      const areaIcon = area.icon || "mdi:home-outline";
      const areaSlug = areaId.toLowerCase().replace(/ /g, '_');

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

      let raw = JSON.stringify(template);
      raw = raw.replaceAll('[[area_id]]', areaId)
               .replaceAll('[[area_name]]', areaName)
               .replaceAll('[[area_icon]]', areaIcon)
               .replaceAll('[[area_slug]]', areaSlug)
               .replaceAll('[[area_temp]]', areaTemp)
               .replaceAll('[[area_humidity]]', areaHumidity)
               .replaceAll('[[default_entity]]', defaultEntity);

      mainLayoutConfig.cards.push(JSON.parse(raw));
    });

    try {
      const helpers = await window.loadCardHelpers();
      const element = helpers.createCardElement(mainLayoutConfig);
      element.hass = hass;

      this.content.innerHTML = '';
      this.content.appendChild(element);
    } catch (err) {
      this.content.innerHTML = `<p style="color:red; padding:10px;">Erreur de génération : ${err.message}</p>`;
    }
  }

  setConfig(config) {
    this._config = config;
    if (this.content) this._buildCards();
  }

  getCardSize() {
    return 3;
  }
}
customElements.define('all-areas-display', AllAreasDisplay);

window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'all-areas-display')) {
  window.customCards.push({
    type: "all-areas-display",
    name: "All Areas Display",
    preview: true,
    description: "Générateur multi-zones avec intégration du sélecteur universel."
  });
}