// ==========================================
// LA CARTE PRINCIPALE (ALL AREAS DISPLAY)
// ==========================================
class AllAreasDisplay extends HTMLElement {

  // On injecte directement la propriété native de Home Assistant 
  // pour bloquer l'éditeur visuel et forcer le mode code YAML.
  static get FORBID_VISUAL() {
    return true;
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

    // Création du conteneur HTML principal s'il n'existe pas
    if (!this.content) {
      this.innerHTML = `<div id="card-container"></div>`;
      this.content = this.querySelector('#card-container');
    }

    // Sécurité : Si les entités ou les pièces n'ont pas changé, on met juste à jour l'état 
    // des cartes enfants sans recréer tout le DOM (évite les clignotements et les crashs)
    if (this._layoutElement && oldHass && oldHass.areas === hass.areas && oldHass.states === hass.states) {
      this._layoutElement.hass = hass;
      return;
    }

    this._buildContainer();
  }

  async _buildContainer() {
    const config = this._config;
    const hass = this._hass;

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

    // 2. Préparation du layout de base (Grid, Vertical Stack, etc.)
    const layoutConfig = {
      ...(config.layout || { type: "grid", columns: 2 }),
      cards: []
    };

    // 3. Duplication et injection des variables dans le bloc de la carte cible
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
        console.error("Erreur d'injection All Areas Display :", e);
      }
    });

    // 4. Rendu sécurisé via les Card Helpers natifs de Home Assistant
    try {
      const helpers = window.cardHelpers || (window.loadCardHelpers ? await window.loadCardHelpers() : null);
      
      if (helpers) {
        const element = helpers.createCardElement(layoutConfig);
        element.hass = hass;
        
        this.content.innerHTML = '';
        this.content.appendChild(element);
        this._layoutElement = element;
      } else {
        // Si Lovelace n'est pas encore totalement prêt, on attend un instant
        this.content.innerHTML = `<ha-alert alert-type="info">Chargement des cartes...</ha-alert>`;
        setTimeout(() => this._buildContainer(), 250);
      }
    } catch (err) {
      console.error("Erreur de rendu critique :", err);
      this.content.innerHTML = `<ha-alert alert-type="error">Erreur : ${err.message}</ha-alert>`;
    }
  }

  getCardSize() { return 4; }
}

customElements.define('all-areas-display', AllAreasDisplay);

// Enregistrement dans le catalogue officiel des cartes
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'all-areas-display')) {
  window.customCards.push({
    type: "all-areas-display",
    name: "All areas display",
    preview: true,
    description: "Génère automatiquement des cartes pour chaque pièce en pur YAML."
  });
}