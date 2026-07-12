// ==========================================
// 1. L'ÉDITEUR 100% VISUEL (SANS CODE)
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
    if (this.querySelector("#config-form")) {
      this._updateFormSchema();
      return;
    }

    this.innerHTML = `
      <div class="card-config" style="padding: 10px; display: flex; flex-direction: column; gap: 15px; font-family: var(--paper-font-body1_-_font-family, sans-serif);">
        <h3 style="margin: 0; color: var(--primary-color); font-size: 1.2em;">Configuration Visuelle des Pièces</h3>
        <p style="margin: 0; font-size: 0.9em; color: var(--secondary-text-color);">
          Réglez l'apparence de base de vos boutons ici. Les choix s'appliqueront uniformément à toutes les zones détectées qui possèdent des équipements.
        </p>
        <ha-form id="config-form"></ha-form>
      </div>
    `;

    this._formElement = this.querySelector("#config-form");

    // Écouteur unique sur le formulaire visuel
    this._formElement.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      const data = ev.detail.value;
      
      // On reconstruit proprement la config Lovelace à partir des choix graphiques
      const newConfig = {
        type: "custom:all-areas-display",
        layout_type: data.layout_type || "grid",
        layout_options: {
          columns: data.layout_type === "grid" ? Math.max(2, data.columns || 2) : undefined
        },
        display_options: {
          show_icon: data.show_icon !== false,
          show_temp: data.show_temp === true,
          show_humidity: data.show_humidity === true,
          tap_action: data.tap_action || "toggle"
        }
      };

      this.dispatchEvent(new CustomEvent("config-changed", {
        detail: { config: newConfig },
        bubbles: true,
        composed: true,
      }));
    });

    this._updateFormSchema();
  }

  _updateFormSchema() {
    if (!this._formElement) return;

    const currentLayout = this._config?.layout_type || "grid";
    const displayOpts = this._config?.display_options || {};

    // Schéma de formulaire natif HA
    const schema = [
      {
        name: "layout_type",
        label: "Disposition des pièces",
        type: "select",
        options: [
          ["grid", "Grille (Grid)"],
          ["horizontal-stack", "Alignement Horizontal"],
          ["vertical-stack", "Alignement Vertical"]
        ]
      }
    ];

    // Si on est en grille, on affiche le choix des colonnes
    if (currentLayout === "grid") {
      schema.push({
        name: "columns",
        label: "Nombre de colonnes",
        type: "integer",
        default: 2,
        valueMin: 2
      });
    }

    // Options d'affichage des boutons de pièces
    schema.push(
      {
        name: "tap_action",
        label: "Action au clic sur la pièce",
        type: "select",
        options: [
          ["toggle", "Allumer / Éteindre la pièce"],
          ["more-info", "Ouvrir la fenêtre de détails (More Info)"],
          ["none", "Aucune action"]
        ]
      },
      {
        name: "show_icon",
        label: "Afficher l'icône de la pièce",
        type: "boolean",
        default: true
      },
      {
        name: "show_temp",
        label: "Afficher la température (si dispo)",
        type: "boolean",
        default: false
      },
      {
        name: "show_humidity",
        label: "Afficher l'humidité (si dispo)",
        type: "boolean",
        default: false
      }
    );

    this._formElement.schema = schema;
    this._formElement.data = {
      layout_type: currentLayout,
      columns: this._config?.layout_options?.columns || 2,
      tap_action: displayOpts.tap_action || "toggle",
      show_icon: displayOpts.show_icon !== false,
      show_temp: displayOpts.show_temp === true,
      show_humidity: displayOpts.show_humidity === true
    };
  }
}
customElements.define('all-areas-display-editor', AllAreasDisplayEditor);


// ==========================================
// 2. RENDU DU STRIP VISUEL AVEC OPTIONS
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
      display_options: {
        show_icon: true,
        show_temp: false,
        show_humidity: false,
        tap_action: "toggle"
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
    const displayOpts = config.display_options || {};

    const mainLayoutConfig = {
      type: config.layout_type || 'grid',
      cards: []
    };
    
    if (mainLayoutConfig.type === 'grid') {
      mainLayoutConfig.columns = Math.max(2, config.layout_options?.columns || 2);
    }

    areas.forEach(area => {
      const areaId = area.area_id;

      // 🔍 Recherche de l'entité pilote (lumière ou interrupteur) de la zone
      let defaultEntity = null;
      const matchCard = Object.values(hass.states).find(s => 
        (s.entity_id.startsWith('light.') || s.entity_id.startsWith('switch.') || s.entity_id.startsWith('input_boolean.')) && 
        hass.entities[s.entity_id]?.area_id === areaId
      );
      if (matchCard) defaultEntity = matchCard.entity_id;

      // Filtrer les pièces vides (pas toutes les pièces ne sont équipées)
      if (!defaultEntity) return;

      // Construction des informations secondaires (badges textuels si demandés)
      let secondaryText = "";
      
      if (displayOpts.show_temp) {
        const tSensor = Object.values(hass.states).find(s => 
          s.entity_id.startsWith('sensor.') && s.attributes.device_class === 'temperature' && 
          hass.entities[s.entity_id]?.area_id === areaId
        );
        if (tSensor) secondaryText += `${tSensor.state}${tSensor.attributes.unit_of_measurement || '°C'} `;
      }

      if (displayOpts.show_humidity) {
        const hSensor = Object.values(hass.states).find(s => 
          s.entity_id.startsWith('sensor.') && s.attributes.device_class === 'humidity' && 
          hass.entities[s.entity_id]?.area_id === areaId
        );
        if (hSensor) secondaryText += `${hSensor.state}${hSensor.attributes.unit_of_measurement || '%'}`;
      }

      // Génération d'une carte de type "button" native standardisée pour chaque pièce
      const areaCard = {
        type: "button",
        name: area.name,
        icon: displayOpts.show_icon ? (area.icon || "mdi:home-outline") : "none",
        entity: defaultEntity,
        show_state: secondaryText !== "",
        tap_action: {
          action: displayOpts.tap_action === "none" ? "none" : displayOpts.tap_action
        }
      };

      // Si on a du texte secondaire (temp/humidité), on triche proprement avec l'état affiché
      if (secondaryText !== "") {
        areaCard.show_state = true;
      }

      mainLayoutConfig.cards.push(areaCard);
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
    description: "Affichage des pièces automatisées via une interface 100% visuelle."
  });
}