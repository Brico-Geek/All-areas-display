// ==========================================
// 1. L'ÉDITEUR AVEC SÉLECTEUR VISUEL INTÉGRÉ
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

  _render() {
    if (this.querySelector("#layout-form")) {
      this._updateFormSchema();
      this._highlightSelectedCard();
      return;
    }

    // Liste des types de cartes principaux
    const cardTypes = [
      { type: "button", name: "Bouton", desc: "Un bouton simple pour piloter une entité" },
      { type: "tile", name: "Tuile (Tile)", desc: "La nouvelle carte standard de Home Assistant" },
      { type: "custom:bubble-card", name: "Bubble Card", desc: "Bouton ou icône au style épuré Bubble" },
      { type: "entity", name: "Entité", desc: "Affiche l'état complet d'une seule entité" },
      { type: "glance", name: "Coup d'œil (Glance)", desc: "Plusieurs entités alignées horizontalement" },
      { type: "heading", name: "Titre (Heading)", desc: "Un entête textuel propre pour vos sections" }
    ];

    let cardsHtml = cardTypes.map(c => `
      <div class="mock-card-btn" data-type="${c.type}" style="
        background: var(--secondary-background-color);
        border: 2px solid var(--divider-color);
        border-radius: 12px;
        padding: 16px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s ease-in-out;
      ">
        <div style="font-weight: bold; font-size: 1.1em; color: var(--primary-text-color); margin-bottom: 4px;">${c.name}</div>
        <div style="font-size: 0.85em; color: var(--secondary-text-color);">${c.desc}</div>
      </div>
    `).join('');

    this.innerHTML = `
      <div class="card-config" style="padding: 10px; display: flex; flex-direction: column; gap: 20px; font-family: var(--paper-font-body1_-_font-family, sans-serif);">
        
        <!-- 1. Choix de la disposition globale -->
        <div>
          <h3 style="margin: 0 0 10px 0; color: var(--primary-color); font-size: 1.1em;">1. Disposition globale</h3>
          <ha-form id="layout-form"></ha-form>
        </div>
        
        <hr style="border: none; border-top: 1px solid var(--divider-color); margin: 0;">
        
        <!-- 2. Grille de sélection visuelle -->
        <div>
          <h3 style="margin: 0 0 5px 0; color: var(--primary-color); font-size: 1.1em;">2. Sélectionner le type de carte à dupliquer</h3>
          <p style="margin: 0 0 15px 0; font-size: 0.85em; color: var(--secondary-text-color);">
            Choisissez la carte de base qui sera générée pour chaque pièce.
          </p>
          
          <div id="cards-grid" style="display: flex; flex-direction: column; gap: 12px; max-height: 400px; overflow-y: auto; padding-right: 5px;">
            ${cardsHtml}
          </div>
        </div>

      </div>
    `;

    this._formElement = this.querySelector("#layout-form");

    // Écouteur sur la mise en page
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

    // Écouteur au clic sur une des tuiles
    this.querySelector("#cards-grid").addEventListener("click", (ev) => {
      const btn = ev.target.closest(".mock-card-btn");
      if (!btn) return;

      const selectedType = btn.getAttribute("data-type");
      
      // Configuration de base propre au type choisi
      let cardConfig = { type: selectedType };
      
      if (selectedType === "custom:bubble-card") {
        cardConfig.card_type = "button";
        cardConfig.button_type = "slider";
      }
      
      // Injection automatique des variables
      cardConfig.name = "[[area_name]]";
      cardConfig.icon = "[[area_icon]]";
      
      if (selectedType === "glance" || selectedType === "entities") {
        cardConfig.entities = ["[[default_entity]]"];
      } else {
        cardConfig.entity = "[[default_entity]]";
      }

      this._config = {
        ...this._config,
        template_card: cardConfig
      };

      this._highlightSelectedCard();
      this._fireConfigChanged();
    });

    this._updateFormSchema();
    this._highlightSelectedCard();
  }

  _highlightSelectedCard() {
    const currentType = this._config?.template_card?.type || "button";
    this.querySelectorAll(".mock-card-btn").forEach(btn => {
      if (btn.getAttribute("data-type") === currentType) {
        btn.style.borderColor = "var(--primary-color)";
        btn.style.background = "var(--primary-color-light, rgba(3, 169, 244, 0.1))";
      } else {
        btn.style.borderColor = "var(--divider-color)";
        btn.style.background = "var(--secondary-background-color)";
      }
    });
  }

  _updateFormSchema() {
    if (!this._formElement) return;

    const currentLayout = this._config?.layout_type || "grid";
    const schema = [
      {
        name: "layout_type",
        label: "Type d'affichage global",
        type: "select",
        options: [
          ["grid", "Grille (Grid)"],
          ["horizontal-stack", "Alignement Horizontal (Horizontal Stack)"],
          ["vertical-stack", "Alignement Vertical (Vertical Stack)"]
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
      layout_options: { columns: 2 },
      template_card: {
        type: "button",
        name: "[[area_name]]",
        icon: "[[area_icon]]",
        entity: "[[default_entity]]"
      }
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
    const template = config.template_card || {};

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

    const helpers = await window.loadCardHelpers();
    const element = helpers.createCardElement(mainLayoutConfig);
    element.hass = hass;

    this.content.innerHTML = '';
    this.content.appendChild(element);
    this._layoutElement = element;
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
    description: "Multi-générateur automatique de pièces."
  });
}