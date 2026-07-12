// ==========================================
// 1. L'ÉDITEUR DE CODE (YAML STRICT)
// ==========================================
class AllAreasDisplayEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._yamlEditor) this._yamlEditor.hass = hass;
  }

  _render() {
    if (this._yamlEditor) return;

    this.innerHTML = `
      <div class="card-config" style="padding: 10px; display: flex; flex-direction: column; gap: 10px;">
        <h3 style="margin: 0; color: var(--primary-color);">Configuration All Areas Display</h3>
        <p style="margin: 0 0 10px 0; font-size: 0.85em; color: var(--secondary-text-color);">
          Configurez votre carte en pur YAML. Utilisez <code>this.area.id</code>, <code>this.area.name</code>, <code>this.area.icon</code>.
        </p>
        <div id="yaml-editor-container"></div>
      </div>
    `;

    const container = this.querySelector("#yaml-editor-container");

    this._yamlEditor = document.createElement("ha-code-editor");
    this._yamlEditor.mode = "yaml";
    this._yamlEditor.value = window.jsyaml ? window.jsyaml.dump(this._config) : JSON.stringify(this._config, null, 2);

    this._yamlEditor.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      try {
        const parsedConfig = window.jsyaml ? window.jsyaml.load(ev.detail.value) : JSON.parse(ev.detail.value);
        this.dispatchEvent(new CustomEvent("config-changed", {
          detail: { config: parsedConfig },
          bubbles: true,
          composed: true,
        }));
      } catch (err) {}
    });

    container.appendChild(this._yamlEditor);
  }
}
customElements.define('all-areas-display-editor', AllAreasDisplayEditor);


// ==========================================
// 2. LA CARTE PRINCIPALE
// ==========================================
class AllAreasDisplay extends HTMLElement {
  static getConfigElement() {
    return document.createElement("all-areas-display-editor");
  }

  static getStubConfig() {
    return {
      type: "custom:all-areas-display",
      layout: {
        type: "grid",
        columns: 2
      },
      exclude: [],
      card: {
        type: "tile",
        area: "this.area.id"
      }
    };
  }

  setConfig(config) {
    this._config = config;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config || !hass) return;

    if (!this.content) {
      this.innerHTML = `<div id="card-container"></div>`;
      this.content = this.querySelector('#card-container');
    }

    this._buildContainer();
  }

  async _buildContainer() {
    const config = this._config;
    const hass = this._hass;
    
    // Protection si les areas ne sont pas encore chargées par HA
    if (!hass.areas) return;
    
    let areas = Object.values(hass.areas);
    
    // 1. Filtrer les exclusions
    const excludeList = (config.exclude || []).map(item => item.toLowerCase());
    areas = areas.filter(area => {
      const idMatch = excludeList.includes(area.area_id.toLowerCase());
      const nameMatch = area.name ? excludeList.includes(area.name.toLowerCase()) : false;
      return !idMatch && !nameMatch;
    });

    if (areas.length === 0) {
      this.content.innerHTML = `<ha-alert alert-type="info">Aucune pièce à afficher.</ha-alert>`;
      return;
    }

    // 2. Préparer la structure du conteneur (ex: grid ou vertical-stack)
    const layoutConfig = {
      ...(config.layout || { type: "grid", columns: 2 }),
      cards: []
    };

    // 3. Générer les configurations de cartes en remplaçant les strings
    areas.forEach(area => {
      const areaId = area.area_id;
      const areaName = area.name || areaId;
      const areaSlug = areaId.toLowerCase().replace(/ /g, '_');
      const areaIcon = area.icon || "mdi:home-outline";

      const processCard = (obj) => {
        let str = JSON.stringify(obj);
        str = str.replaceAll('this.area.id', areaId);
        str = str.replaceAll('this.area.name', areaName);
        str = str.replaceAll('this.area.slug', areaSlug);
        str = str.replaceAll('this.area.icon', areaIcon);
        return JSON.parse(str);
      };

      if (config.card) {
        try {
          layoutConfig.cards.push(processCard(config.card));
        } catch (e) {
          console.error("Erreur de processing de la carte :", e);
        }
      }
    });

    // 4. Rendu via l'élément natif de HA (évite d'attendre loadCardHelpers)
    if (!this._layoutElement) {
      this._layoutElement = document.createElement("hui-element");
      this.content.innerHTML = '';
      this.content.appendChild(this._layoutElement);
    }
    
    this._layoutElement.setConfig(layoutConfig);
    this._layoutElement.hass = hass;
  }

  getCardSize() { return 4; }
}

customElements.define('all-areas-display', AllAreasDisplay);

// Enregistrement catalogue
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'all-areas-display')) {
  window.customCards.push({
    type: "all-areas-display",
    name: "All areas display",
    preview: true,
    description: "Multiplie une carte pour chaque pièce Lovelace détectée (Style auto-entities)."
  });
}