// ==========================================
// 1. L'ÉDITEUR (MASQUE LE VISUEL PARASITE)
// ==========================================
class AllAreasDisplayEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
  }
  set hass(hass) {
    this._hass = hass;
  }
  getConfigForm() {
    return { schema: [] }; // Force Lovelace à basculer directement sur l'éditeur de code YAML
  }
  focus() {}
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
    const oldHass = this._hass;
    this._hass = hass;

    if (!this._config || !hass) return;

    // Création du point d'ancrage HTML si inexistant
    if (!this.content) {
      this.innerHTML = `<div id="card-container"></div>`;
      this.content = this.querySelector('#card-container');
    }

    // Si les données HA n'ont pas changé, on pousse juste le nouvel état aux cartes enfants sans tout reconstruire
    if (this._layoutElement && oldHass && oldHass.areas === hass.areas && oldHass.states === hass.states) {
      this._layoutElement.hass = hass;
      return;
    }

    this._buildContainer();
  }

  async _buildContainer() {
    const config = this._config;
    const hass = this._hass;

    // Protection si Home Assistant n'a pas encore chargé la liste des pièces
    if (!hass.areas) return;

    let areas = Object.values(hass.areas);

    // 1. Filtrage des pièces à exclure
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

    // 2. Préparation du layout global (Grid ou Vertical-Stack...)
    const layoutConfig = {
      ...(config.layout || { type: "grid", columns: 2 }),
      cards: []
    };

    // 3. Duplication du template de carte pour chaque pièce détectée
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
        console.error("Erreur d'injection dans la carte All Areas Display :", e);
      }
    });

    // 4. Rendu dynamique sécurisé en utilisant les Helpers officiels de Lovelace
    try {
      // On récupère ou on attend les helpers graphiques natifs de HA
      const helpers = window.cardHelpers || (window.loadCardHelpers ? await window.loadCardHelpers() : null);
      
      if (helpers) {
        const element = helpers.createCardElement(layoutConfig);
        element.hass = hass;
        
        this.content.innerHTML = '';
        this.content.appendChild(element);
        this._layoutElement = element;
      } else {
        // Fallback de secours si Lovelace n'est pas encore prêt (évite l'écran blanc permanent)
        this.content.innerHTML = `<ha-alert alert-type="warning">Chargement de l'interface...</ha-alert>`;
        setTimeout(() => this._buildContainer(), 500);
      }
    } catch (err) {
      console.error("Erreur critique de rendu All Areas Display :", err);
      this.content.innerHTML = `<ha-alert alert-type="error">Erreur d'affichage : ${err.message}</ha-alert>`;
    }
  }

  getCardSize() { return 4; }
}

customElements.define('all-areas-display', AllAreasDisplay);

// Enregistrement dans le catalogue Lovelace
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'all-areas-display')) {
  window.customCards.push({
    type: "all-areas-display",
    name: "All areas display",
    preview: true,
    description: "Génère automatiquement des cartes pour chaque pièce (Style auto-entities)."
  });
}