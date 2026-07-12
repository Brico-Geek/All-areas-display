// ==========================================
// 1. L'ÉDITEUR AVANCÉ AVEC SAUVEGARDE DIRECTE
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
      this._updateEditorValue();
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
          <h3 style="margin: 0 0 5px 0; color: var(--primary-color); font-size: 1.1em;">2. Code du composant à dupliquer</h3>
          <p style="margin: 0 0 12px 0; font-size: 0.85em; color: var(--secondary-text-color);">
            Colle le YAML de ta Bubble Card ci-dessous. Clique sur une variable pour la copier, puis colle-la (Ctrl+V) dans le texte.
          </p>

          <!-- Palette complète de variables magiques -->
          <div style="margin-bottom: 12px; background: var(--secondary-background-color); padding: 10px; border-radius: 6px; border: 1px solid var(--divider-color);">
            <div style="font-size: 0.8em; font-weight: bold; margin-bottom: 8px; color: var(--primary-text-color);">
              Clique pour copier une variable :
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;" id="variables-palette">
              <button class="v-btn" data-v="[[area_name]]" style="font-size:0.75em; padding:5px 8px; cursor:pointer; border-radius:4px; background: var(--primary-color); color: white; border: none; font-weight:500;">Nom Pièce</button>
              <button class="v-btn" data-v="[[area_icon]]" style="font-size:0.75em; padding:5px 8px; cursor:pointer; border-radius:4px; background: var(--primary-color); color: white; border: none; font-weight:500;">Icône</button>
              <button class="v-btn" data-v="[[area_id]]" style="font-size:0.75em; padding:5px 8px; cursor:pointer; border-radius:4px; background: var(--primary-color); color: white; border: none; font-weight:500;">ID Zone</button>
              <button class="v-btn" data-v="[[area_slug]]" style="font-size:0.75em; padding:5px 8px; cursor:pointer; border-radius:4px; background: var(--primary-color); color: white; border: none; font-weight:500;">Slug</button>
              <button class="v-btn" data-v="[[default_entity]]" style="font-size:0.75em; padding:5px 8px; cursor:pointer; border-radius:4px; background: #e67e22; color: white; border: none; font-weight:500;">Lumière/Switch Auto</button>
              <button class="v-btn" data-v="[[area_temp]]" style="font-size:0.75em; padding:5px 8px; cursor:pointer; border-radius:4px; background: #2ecc71; color: white; border: none; font-weight:500;">Température</button>
              <button class="v-btn" data-v="[[area_humidity]]" style="font-size:0.75em; padding:5px 8px; cursor:pointer; border-radius:4px; background: #3498db; color: white; border: none; font-weight:500;">Humidité</button>
            </div>
          </div>
          
          <!-- Éditeur de code natif -->
          <div style="border: 1px solid var(--divider-color); border-radius: 6px; overflow: hidden;">
            <ha-code-editor id="code-editor" mode="yaml" autocomplete></ha-code-editor>
          </div>
        </div>
      </div>
    `;

    this._formElement = this.querySelector("#layout-form");
    this._codeEditor = this.querySelector("#code-editor");

    // Écouteur pour la mise en page
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

    // Écouteur de l'éditeur de code avec mise à jour forcée du YAML parent
    this._codeEditor.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      const rawValue = ev.detail.value;
      
      try {
        const parsedCard = window.jsyaml.load(rawValue);
        if (parsedCard && typeof parsedCard === 'object') {
          this._config = {
            ...this._config,
            template_card: parsedCard
          };
          this._fireConfigChanged();
        }
      } catch (e) {
        // En cours de frappe, le YAML peut être invalide temporairement
      }
    });

    // Copie de la variable au clic dans le presse-papier
    this.querySelector("#variables-palette").addEventListener("click", (ev) => {
      const btn = ev.target.closest(".v-btn");
      if (!btn) return;
      
      const variable = btn.getAttribute("data-v");
      
      // Utilisation de l'API Clipboard moderne
      navigator.clipboard.writeText(variable).then(() => {
        // Petit effet visuel temporaire pour confirmer la copie
        const originalText = btn.innerText;
        btn.innerText = "Copié !";
        btn.style.background = "#2c3e50";
        setTimeout(() => {
          btn.innerText = originalText;
          btn.style.background = "";
        }, 1000);
      }).catch(() => {
        // Fallback si l'API échoue
        alert(`Échec de la copie automatique. Variable à copier manuellement : ${variable}`);
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
        label: "Disposition globale",
        type: "select",
        options: [
          ["grid", "Grille (Grid)"],
          ["horizontal-stack", "Horizontal (Stack)"],
          ["vertical-stack", "Vertical (Stack)"]
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

    this._updateEditorValue();
  }

  _updateEditorValue() {
    if (!this._codeEditor || !this._config?.template_card) return;
    try {
      const yamlStr = window.jsyaml.dump(this._config.template_card);
      if (this._codeEditor.value !== yamlStr) {
        this._codeEditor.value = yamlStr;
      }
    } catch(e) {}
  }

  // Émission propre pour forcer l'enregistrement dans le code principal de la carte
  _fireConfigChanged() {
    const event = new CustomEvent("config-changed", {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
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

      // Filtrage des pièces sans entités
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

      // Remplacement propre
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
    description: "Générateur dynamique par pièce avec injection propre de variables."
  });
}