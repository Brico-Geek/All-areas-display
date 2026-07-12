// ==========================================
// 1. L'ÉDITEUR AVEC APPEL DU DIALOGUE NATIF
// ==========================================
class AllAreasDisplayEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._formElement) this._formElement.hass = hass;
  }

  async _render() {
    if (this.querySelector("#layout-form")) {
      this._updatePreviewState();
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
        
        <!-- 2. Zone de Sélection de la carte via l'assistant officiel -->
        <div>
          <h3 style="margin: 0 0 5px 0; color: var(--primary-color); font-size: 1.1em;">2. Carte modèle</h3>
          <p style="margin: 0 0 15px 0; font-size: 0.85em; color: var(--secondary-text-color);">
            Ouvrez le catalogue de Home Assistant pour choisir et configurer n'importe quelle carte (bouton, tuile, carte personnalisée...).
          </p>
          
          <button id="open-picker-btn" style="
            width: 100%;
            background: var(--primary-color);
            color: var(--text-primary-color, white);
            border: none;
            padding: 12px;
            border-radius: 8px;
            font-weight: bold;
            font-size: 1em;
            cursor: pointer;
            box-shadow: var(--ha-card-box-shadow, none);
            transition: background 0.2s;
          " onmouseover="this.style.background='var(--accent-color)'" onmouseout="this.style.background='var(--primary-color)'">
            🔍 CHOISIR / MODIFIER LA CARTE MODÈLE
          </button>

          <div id="current-template-info" style="margin-top: 12px; font-size: 0.9em; color: var(--secondary-text-color); font-style: italic;">
            Aucune carte sélectionnée.
          </div>
        </div>

      </div>
    `;

    this._formElement = this.querySelector("#layout-form");
    this._setupLayoutForm();

    // Au clic, on déclenche l'assistant officiel de sélection de carte de Home Assistant
    this.querySelector("#open-picker-btn").addEventListener("click", () => {
      this._openNativeCardPicker();
    });

    this._updatePreviewState();
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

  // Appele l'assistant de carte officiel de HA au premier plan
  _openNativeCardPicker() {
    const event = new CustomEvent("show-dialog", {
      bubbles: true,
      composed: true,
      detail: {
        dialogTag: "hui-dialog-edit-card",
        dialogImport: () => import("/frontend_latest/hui-dialog-edit-card.js"),
        dialogParams: {
          lovelaceConfig: { cards: [] },
          // Si on a déjà choisi une carte, on la charge pour la modifier, sinon le sélecteur complet s'ouvre
          cardConfig: this._config?.template_card || undefined,
          saveCard: (newCardConfig) => {
            // Nettoyage rapide des variables injectées par HA lors de la configuration
            if (newCardConfig) {
              newCardConfig.name = "[[area_name]]";
              newCardConfig.icon = "[[area_icon]]";
              if (newCardConfig.type === "glance" || newCardConfig.type === "entities") {
                newCardConfig.entities = ["[[default_entity]]"];
              } else {
                newCardConfig.entity = "[[default_entity]]";
              }
            }

            this._config = {
              ...this._config,
              template_card: newCardConfig
            };
            this._updatePreviewState();
            this._fireConfigChanged();
          }
        }
      }
    });
    this.dispatchEvent(event);
  }

  _updatePreviewState() {
    const info = this.querySelector("#current-template-info");
    if (!info) return;
    if (this._config?.template_card?.type) {
      info.textContent = `Type sélectionné : ${this._config.template_card.type}`;
      info.style.color = "var(--success-color, green)";
    } else {
      info.textContent = "Aucune carte sélectionnée. Cliquez sur le bouton ci-dessus.";
      info.style.color = "var(--secondary-text-color)";
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
      this._buildCards();
    }
  }

  async _buildCards() {
    if (!this._hass || !this._config) return;
    
    const config = this._config;
    const hass = this._hass;
    const template = config.template_card;

    if (!template || Object.keys(template).length === 0) {
      this.content.innerHTML = `
        <div style="padding: 30px; text-align: center; color: var(--secondary-text-color); border: 2px dashed var(--divider-color); border-radius: 12px; margin: 10px;">
          <div style="font-size: 1.2em; font-weight: bold; margin-bottom: 8px;">Aucune carte modèle</div>
          Utilisez le bouton dans la colonne de gauche pour ouvrir l'assistant officiel et générer vos pièces.
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
    description: "Multi-générateur utilisant l'assistant officiel de cartes."
  });
}