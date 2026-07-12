// ==========================================
// 1. L'ÉDITEUR AVANCÉ ET STABLE
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
      return;
    }

    this.innerHTML = `
      <div class="card-config" style="padding: 10px; display: flex; flex-direction: column; gap: 20px; font-family: var(--paper-font-body1_-_font-family, sans-serif);">
        
        <div>
          <h3 style="margin: 0 0 5px 0; color: var(--primary-color); font-size: 1.1em;">1. Mise en Page Globale</h3>
          <ha-form id="layout-form"></ha-form>
        </div>
        
        <hr style="border: none; border-top: 1px solid var(--divider-color); margin: 0;">
        
        <div>
          <h3 style="margin: 0 0 5px 0; color: var(--primary-color); font-size: 1.1em;">2. Configuration du Modèle Unique</h3>
          <p style="margin: 0 0 10px 0; font-size: 0.85em; color: var(--secondary-text-color);">
            Colle ici le code de ton bouton ou de ta popup Bubble Card (récupéré via l'éditeur de code d'une carte normale). Les modifications s'appliqueront instantanément à toutes les pièces.
          </p>

          <!-- Zone de boutons d'insertion rapide -->
          <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; background: var(--secondary-background-color); padding: 8px; border-radius: 6px;">
            <span style="font-size: 0.8em; align-self: center; margin-right: 4px; font-weight: bold;">Variables :</span>
            <button class="v-btn" data-v="[[area_name]]" style="font-size:0.75em; padding:4px 8px; cursor:pointer; border-radius:4px; background: var(--primary-color); color: white; border: none;">Nom Pièce</button>
            <button class="v-btn" data-v="[[area_icon]]" style="font-size:0.75em; padding:4px 8px; cursor:pointer; border-radius:4px; background: var(--primary-color); color: white; border: none;">Icône</button>
            <button class="v-btn" data-v="[[default_entity]]" style="font-size:0.75em; padding:4px 8px; cursor:pointer; border-radius:4px; background: var(--primary-color); color: white; border: none;">Entité Auto</button>
          </div>
          
          <!-- Éditeur de code robuste intégré -->
          <div style="border: 1px solid var(--divider-color); border-radius: 6px; overflow: hidden;">
            <ha-code-editor id="code-editor" mode="yaml" autocomplete></ha-code-editor>
          </div>
        </div>
      </div>
    `;

    this._formElement = this.querySelector("#layout-form");
    this._codeEditor = this.querySelector("#code-editor");

    // Événement de mise en page
    this._formElement.addEventListener("value-changed", (ev) => {
      const value = ev.detail.value;
      const newConfig = {
        ...this._config,
        layout_type: value.layout_type,
        layout_options: {
          columns: value.layout_type === "grid" ? Math.max(2, value.columns || 2) : undefined
        }
      };
      this._fireConfigChanged(newConfig);
    });

    // Événement de modification du code YAML du modèle unique
    this._codeEditor.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      try {
        // Transformation du texte YAML en objet JavaScript propre
        const parsedCard = window.jsyaml.load(ev.detail.value);
        if (parsedCard && typeof parsedCard === 'object') {
          this._fireConfigChanged({
            ...this._config,
            template_card: parsedCard
          });
        }
      } catch (e) {
        // Évite de crasher pendant que l'utilisateur écrit
      }
    });

    // Gestion des boutons de variables magiques
    this.querySelectorAll(".v-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        navigator.clipboard.writeText(btn.getAttribute("data-v"));
        alert(`Copié : ${btn.getAttribute("data-v")}\nColle-le à l'endroit voulu dans le champ de texte ci-dessous.`);
      });
    });

    this._updateFormSchema();
  }

  _updateFormSchema() {
    if (!this._formElement) return;

    const currentLayout = this._config?.layout_type || "grid";
    const schema = [
      {
        name: "layout_type",
        label: "Disposition",
        type: "select",
        options: [
          ["grid", "Grille (Grid)"],
          ["horizontal-stack", "Horizontal"],
          ["vertical-stack", "Vertical"]
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

    // Charger la configuration existante dans l'éditeur de texte
    if (this._codeEditor && this._config?.template_card) {
      setTimeout(() => {
        const yamlStr = window.jsyaml.dump(this._config.template_card);
        if (this._codeEditor.value !== yamlStr) {
          this._codeEditor.value = yamlStr;
        }
      }, 50);
    }
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
// 2. RENDU ET FILTRAGE DES PIÈCES ACTIVES
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

      // 🔍 Recherche de l'entité par défaut (lumière ou switch) liée à cette pièce
      let defaultEntity = null;
      const matchCard = Object.values(hass.states).find(s => 
        (s.entity_id.startsWith('light.') || s.entity_id.startsWith('switch.') || s.entity_id.startsWith('input_boolean.')) && 
        hass.entities[s.entity_id]?.area_id === areaId
      );
      if (matchCard) defaultEntity = matchCard.entity_id;

      // 🛡️ CORRECTION : Si la pièce n'a aucune entité, on l'ignore complètement pour ne pas encombrer l'affichage
      if (!defaultEntity) return;

      const areaName = area.name;
      const areaIcon = area.icon || "mdi:home-outline";
      const areaSlug = areaId.toLowerCase().replace(/ /g, '_');

      // Récupération des capteurs secondaires
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

      // Remplacement global et propre des variables sur le modèle unique
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

// Enregistrement catalogue
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'all-areas-display')) {
  window.customCards.push({
    type: "all-areas-display",
    name: "All Areas Display",
    preview: true,
    description: "Générateur automatique par zone active avec modèle unique réplicable."
  });
}