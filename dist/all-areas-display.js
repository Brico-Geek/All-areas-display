// ==========================================
// 1. L'ÉDITEUR VISUEL AVANCÉ (GUI)
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
    if (this._formElement) return;

    this.innerHTML = `
      <div class="card-config" style="padding: 10px; display: flex; flex-direction: column; gap: 20px;">
        <h3 style="margin: 0; color: var(--primary-color);">Configuration de la Mise en Page</h3>
        <ha-form id="layout-form"></ha-form>
        
        <hr style="border: none; border-top: 1px solid var(--divider-color); margin: 5px 0;">
        
        <h3 style="margin: 0; color: var(--primary-color);">Configuration du Bouton (Modèle par défaut)</h3>
        <p style="margin: 0; font-size: 0.85em; color: var(--secondary-text-color);">
          Configure l'action et l'affichage de base. Si tu utilises <code>button_template</code> en YAML, cela remplacera ces réglages graphiques.
        </p>
        <ha-form id="button-form"></ha-form>

        <div style="font-size: 0.85em; color: var(--secondary-text-color); line-height: 1.4; background: var(--secondary-background-color); padding: 10px; border-radius: 6px;">
          <strong>Variables utilisables (Éditeur YAML) :</strong><br>
          <code>[[area_name]]</code>, <code>[[area_icon]]</code>, <code>[[area_slug]]</code>, <code>[[area_temp]]</code>, <code>[[area_humidity]]</code>, <code>[[default_entity]]</code>
        </div>
      </div>
    `;

    this._formElement = this.querySelector("#layout-form");
    this._buttonFormElement = this.querySelector("#button-form");

    // Schéma pour la mise en page globale
    const layoutSchema = [
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
      },
      {
        name: "columns",
        label: "Nombre de colonnes (uniquement pour le mode Grille)",
        type: "integer",
        default: 2,
        valueMin: 1,
        valueMax: 6
      }
    ];

    // Schéma pour concevoir visuellement le comportement du bouton
    const buttonSchema = [
      {
        name: "nav_type",
        label: "Type de navigation",
        type: "select",
        options: [
          ["popup", "Ouvrir une Popup (#slug_de_la_pièce)"],
          ["path", "Aller vers un chemin / une page"]
        ],
        default: "popup"
      },
      {
        name: "base_path",
        label: "Chemin de base (ex: /lovelace-pieces/ ou laisser vide pour racine)",
        type: "string",
        default: ""
      }
    ];

    // Récupération des données existantes ou application des valeurs par défaut
    const layoutData = {
      layout_type: this._config?.layout_type || "grid",
      columns: this._config?.layout_options?.columns || 2
    };

    const buttonData = {
      nav_type: this._config?.gui_settings?.nav_type || "popup",
      base_path: this._config?.gui_settings?.base_path || ""
    };

    this._formElement.schema = layoutSchema;
    this._formElement.data = layoutData;

    this._buttonFormElement.schema = buttonSchema;
    this._buttonFormElement.data = buttonData;

    // Écouteur pour la mise en page
    this._formElement.addEventListener("value-changed", (ev) => {
      const value = ev.detail.value;
      
      // On adapte dynamiquement le type de conteneur interne de Home Assistant
      let targetType = "grid";
      if (value.layout_type === "horizontal") targetType = "horizontal-stack";
      if (value.layout_type === "vertical") targetType = "vertical-stack";

      const newConfig = {
        ...this._config,
        layout_type: targetType,
        layout_options: {
          ...this._config?.layout_options,
          columns: value.columns
        }
      };
      this._fireConfigChanged(newConfig);
    });

    // Écouteur pour la configuration graphique du bouton
    this._buttonFormElement.addEventListener("value-changed", (ev) => {
      const value = ev.detail.value;
      const newConfig = {
        ...this._config,
        gui_settings: {
          nav_type: value.nav_type,
          base_path: value.base_path
        }
      };
      this._fireConfigChanged(newConfig);
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
      gui_settings: {
        nav_type: "popup",
        base_path: ""
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

    // Détermination de la structure d'alignement demandée
    const layoutConfig = {
      type: config.layout_type || 'grid',
      cards: []
    };
    
    // N'ajouter les colonnes que si on est en mode grid standard
    if (layoutConfig.type === 'grid') {
      layoutConfig.columns = config.layout_options?.columns || 2;
      layoutConfig.square = config.layout_options?.square || false;
    }

    areas.forEach(area => {
      const areaId = area.area_id;
      const areaName = area.name;
      const areaSlug = areaId.toLowerCase().replace(/ /g, '_');
      const areaIcon = area.icon || "mdi:home-outline";

      // 🔍 1. Trouver une entité de contrôle par défaut (Lumière ou Switch)
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

      // 🌡️ 2. Récupérer la température automatique
      let areaTemp = "N/A";
      const tempEntity = Object.values(hass.states).find(state => 
        state.entity_id.startsWith('sensor.') && 
        (state.entity_id.includes('temperature') || state.attributes.device_class === 'temperature') && 
        hass.entities[state.entity_id]?.area_id === areaId
      );
      if (tempEntity) areaTemp = tempEntity.state + (tempEntity.attributes.unit_of_measurement || '°C');

      // 💧 3. Récupérer l'humidité automatique
      let areaHumidity = "N/A";
      const humEntity = Object.values(hass.states).find(state => 
        state.entity_id.startsWith('sensor.') && 
        (state.entity_id.includes('humidity') || state.attributes.device_class === 'humidity') && 
        hass.entities[state.entity_id]?.area_id === areaId
      );
      if (humEntity) areaHumidity = humEntity.state + (humEntity.attributes.unit_of_measurement || '%');

      // 🗺️ 4. Calcul de l'action de navigation basée sur l'éditeur visuel GUI
      const navType = config.gui_settings?.nav_type || "popup";
      const basePath = config.gui_settings?.base_path || "";
      let targetNavigationPath = `#${areaSlug}`; // Défaut type popup hash

      if (navType === "path") {
        targetNavigationPath = basePath ? `${basePath}${areaSlug}` : `/lovelace/${areaSlug}`;
      }

      // 🏗️ 5. Construction de la carte finale pour cette pièce
      let templateToUse = null;

      if (config.button_template) {
        // Mode Expert : L'utilisateur a fourni son propre template de carte en YAML
        templateToUse = config.button_template;
      } else {
        // Mode GUI : On génère une carte de tuile propre (Tile Card standard) native de HA
        templateToUse = {
          type: "tile",
          entity: defaultEntity,
          name: areaName,
          icon: areaIcon,
          hide_state: false,
          state_content: ["state"],
          tap_action: {
            action: "navigate",
            navigation_path: "[[navigation_path]]"
          }
        };
      }

      // 📝 6. Remplacement des variables dans la configuration de la sous-carte
      const replaceVariables = (obj) => {
        let str = JSON.stringify(obj);
        str = str.replaceAll('[[area_id]]', areaId);
        str = str.replaceAll('[[area_name]]', areaName);
        str = str.replaceAll('[[area_icon]]', areaIcon);
        str = str.replaceAll('[[area_slug]]', areaSlug);
        str = str.replaceAll('[[area_temp]]', areaTemp);
        str = str.replaceAll('[[area_humidity]]', areaHumidity);
        str = str.replaceAll('[[default_entity]]', defaultEntity);
        str = str.replaceAll('[[navigation_path]]', targetNavigationPath);
        return JSON.parse(str);
      };

      layoutConfig.cards.push(replaceVariables(templateToUse));
      
      // Ajouter une popup si elle est déclarée manuellement en YAML
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
    description: "Générateur dynamique de cartes par pièce avec gestion d'alignements fluides."
  });
}