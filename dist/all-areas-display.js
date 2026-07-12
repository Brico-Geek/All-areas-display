// ==========================================
// 1. L'ÉDITEUR (VERSION STRICTE CODE / YAML)
// ==========================================
class AllAreasDisplayEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
  }

  set hass(hass) {
    this._hass = hass;
  }

  // Ce bloc indique à Home Assistant de ne pas essayer de générer 
  // d'interface visuelle (ce qui évitera l'apparition des {} parasites)
  getConfigForm() {
    return {
      schema: [],
    };
  }

  // On laisse l'élément graphique vide pour forcer l'affichage du code YAML
  focus() {}
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
    if (!config || !config.card) {
      throw new Error("Vous devez spécifier un modèle de carte dans 'card:'");
    }
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
    
    if (!hass.areas) return;
    
    let areas = Object.values(hass.areas);
    
    // 1. Filtrage des exclusions
    const excludeList = (config.exclude || []).map(item => String(item).toLowerCase());
    areas = areas.filter(area => {
      const idMatch = excludeList.includes(area.area_id.toLowerCase());
      const nameMatch = area.name ? excludeList.includes(area.name.toLowerCase()) : false;
      return !idMatch && !nameMatch;
    });

    if (areas.length === 0) {
      this.content.innerHTML = `<ha-alert alert-type="info">Aucune pièce à afficher.</ha-alert>`;
      return;
    }

    // 2. Configuration de la structure globale (Grid par défaut)
    const layoutConfig = {
      ...(config.layout || { type: "grid", columns: 2 }),
      cards: []
    };

    // 3. Remplacement des tags et duplication du modèle de carte
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

      try {
        layoutConfig.cards.push(processCard(config.card));
      } catch (e) {
        console.error("Erreur injection variables :", e);
      }
    });

    // 4. Rendu de la grille/pile via l'élément hui-element standard
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

// Enregistrement dans le catalogue
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'all-areas-display')) {
  window.customCards.push({
    type: "all-areas-display",
    name: "All areas display",
    preview: true,
    description: "Affiche des cartes dynamiques par pièce en pur YAML."
  });
}