// ==========================================
// 1. L'ÉDITEUR VISUEL AVANCÉ (GUI COMPLET)
// ==========================================
class AllAreasDisplayEditor extends HTMLElement {
  async setConfig(config) {
    this._config = config;
    await this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._layoutFormElement) {
      this._layoutFormElement.hass = hass;
    }
    if (this._cardEditorElement) {
      this._cardEditorElement.hass = hass;
    }
  }

  async _render() {
    // Si l'élément de base est déjà là, on met à jour les données mais on ne recrée pas le DOM
    if (this._layoutFormElement) {
      this._updateFormValues();
      return;
    }

    this.innerHTML = `
      <div class="card-config" style="padding: 10px; display: flex; flex-direction: column; gap: 20px;">
        <h3 style="margin: 0; color: var(--primary-color);">Configuration de la Mise en Page</h3>
        <ha-form id="layout-form"></ha-form>
        
        <hr style="border: none; border-top: 1px solid var(--divider-color); margin: 5px 0;">
        
        <h3 style="margin: 0; color: var(--primary-color);">Configuration du Modèle de Carte</h3>
        <p style="margin: 0; font-size: 0.85em; color: var(--secondary-text-color);">
          Configurez ici la carte unique qui sera clonée et automatisée pour chaque pièce.
        </p>
        
        <!-- Conteneur pour le sélecteur graphique officiel de Home Assistant -->
        <div id="card-editor-container"></div>

        <div style="font-size: 0.85em; color: var(--secondary-text-color); line-height: 1.4; background: var(--secondary-background-color); padding: 10px; border-radius: 6px;">
          <strong>Variables dynamiques injectables :</strong><br>
          <code>[[area_name]]</code>, <code>[[area_icon]]</code>, <code>[[area_id]]</code>, <code>[[area_slug]]</code>, <code>[[area_temp]]</code>, <code>[[area_humidity]]</code>, <code>[[default_entity]]</code>
        </div>
      </div>
    `;

    this._layoutFormElement = this.querySelector("#layout-form");
    const editorContainer = this.querySelector("#card-editor-container");

    // Définition du schéma ha-form pour la structure globale
    const layoutSchema = [
      {
        name: "layout_type",
        label: "Type d'affichage",
        selector: {
          select: {
            options: [
              { value: "grid", label: "Grille (Grid)" },
              { value: "horizontal-stack", label: "Pile Horizontale (Horizontal Stack)" },
              { value: "vertical-stack", label: "Pile Verticale (Vertical Stack)" }
            ]
          }
        }
      },
      {
        name: "columns",
        label: "Nombre de colonnes (Mode Grille)",
        selector: {
          number: {
            min: 1,
            max: 12,
            mode: "box"
          }
        }
      }
    ];

    this._layoutFormElement.schema = layoutSchema;
    this._updateFormValues();

    // Écouteur sur le formulaire de mise en page
    this._layoutFormElement.addEventListener("value-changed", (ev) => {
      const value = ev.detail.value;
      const newConfig = {
        ...this._config,
        layout_type: value.layout_type || "grid",
        layout_options: {
          ...this._config.layout_options,
          columns: value.columns || 2
        }
      };
      this._fireConfigChanged(newConfig);
    });

    // Chargement et injection de l'éditeur de carte officiel (GUI) de Home Assistant
    try {
      const helpers = await window.loadCardHelpers();
      // Crée l'élément d'édition interne utilisé par l'UI Lovelace de HA
      this._cardEditorElement = document.createElement("hui-card-element-editor");
      this._cardEditorElement.hass = this._hass;
      
      // On lui passe la carte modèle actuelle
      this._cardEditorElement.value = this._config.button_template || { type: "tile", name: "[[area_name]]" };

      // Écouteur pour capturer les changements graphiques faits dans le sous-éditeur
      this._cardEditorElement.addEventListener("config-changed", (ev) => {
        ev.stopPropagation();
        const newConfig = {
          ...this._config,
          button_template: ev.detail.config
        };
        this._fireConfigChanged(newConfig);
      });

      editorContainer.appendChild(this._cardEditorElement);
    } catch (err) {
      console.error("Impossible de charger le sélecteur de carte HA", err);
      editorContainer.innerHTML = `<p style="color:red;">Erreur de chargement de l'éditeur visuel.</p>`;
    }
  }

  _updateFormValues() {
    if (!this._layoutFormElement) return;
    this._layoutFormElement.data = {
      layout_type: this._config?.layout_type || "grid",
      columns: this._config?.layout_options?.columns || 2
    };
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
      button_template: {
        type: "tile",
        name: "[[area_name]]",
        icon: "[[area_icon]]",
        tap_action: {
          action: "navigate",
          navigation_path: "#[[area_slug]]"
        }
      }
    };
  }

  set hass(hass) {
    const oldHass = this._hass;
    this._hass = hass;
    
    if (!this._config) return;

    // Premier rendu du conteneur de base
    if (!this.content) {
      this.innerHTML = `<div id="card-container"></div>`;
      this.content = this.querySelector('#card-container');
    }

    // Si HASS change mais que la structure est déjà construite, on transmet juste l'état aux enfants
    if (this._layoutElement && oldHass && oldHass.areas === hass.areas && oldHass.states === hass.states) {
      this._layoutElement.hass = hass;
      return;
    }

    this._buildCards();
  }

  async _buildCards() {
    const config = this._config;
    const hass = this._hass;
    const areas = Object.values(hass.areas || {});

    if (areas.length === 0) {
      this.content.innerHTML = `<ha-alert alert-type="info">Aucune pièce détectée dans Home Assistant.</ha-alert>`;
      return;
    }

    // Détermination de la structure d'alignement demandée
    const layoutConfig = {
      type: config.layout_type || 'grid',
      cards: []
    };
    
    if (layoutConfig.type === 'grid') {
      layoutConfig.columns = config.layout_options?.columns || 2;
      layoutConfig.square = false;
    }

    areas.forEach(area => {
      const areaId = area.area_id;
      const areaName = area.name;
      const areaSlug = areaId.toLowerCase().replace(/ /g, '_');
      const areaIcon = area.icon || "mdi:home-outline";

      // 🔍 1. Trouver une entité de contrôle par défaut (Lumière ou Switch) dans la pièce
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

      // 🌡️ 2. Récupérer la température automatique de la pièce
      let areaTemp = "N/A";
      const tempEntity = Object.values(hass.states).find(state => 
        state.entity_id.startsWith('sensor.') && 
        (state.entity_id.includes('temperature') || state.attributes.device_class === 'temperature') && 
        hass.entities[state.entity_id]?.area_id === areaId
      );
      if (tempEntity) areaTemp = tempEntity.state + (tempEntity.attributes.unit_of_measurement || '°C');

      // 💧 3. Récupérer l'humidité automatique de la pièce
      let areaHumidity = "N/A";
      const humEntity = Object.values(hass.states).find(state => 
        state.entity_id.startsWith('sensor.') && 
        (state.entity_id.includes('humidity') || state.attributes.device_class === 'humidity') && 
        hass.entities[state.entity_id]?.area_id === areaId
      );
      if (humEntity) areaHumidity = humEntity.state + (humEntity.attributes.unit_of_measurement || '%');

      // 🏗️ 4. Récupération du modèle défini dans l'éditeur visuel
      let templateToUse = config.button_template || { type: "tile", name: "[[area_name]]" };

      // 📝 5. Remplacement récursif propre des variables textuelles et d'objets
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

      layoutConfig.cards.push(replaceVariables(templateToUse));
    });

    // Rendu de l'élément global de mise en page via les helpers Lovelace
    try {
      const helpers = await window.loadCardHelpers();
      const element = helpers.createCardElement(layoutConfig);
      element.hass = hass;

      this.content.innerHTML = '';
      this.content.appendChild(element);
      this._layoutElement = element;
    } catch (err) {
      console.error("Erreur lors de la création de la vue d'ensemble", err);
    }
  }

  setConfig(config) {
    this._config = config;
  }

  getCardSize() {
    return 4;
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
    description: "Générateur automatique de tableaux de bord basés sur vos pièces Lovelace."
  });
}