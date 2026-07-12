// ==========================================
// 1. LA CARTE PRINCIPALE (ALL AREAS DISPLAY)
// ==========================================
class AllAreasDisplay extends HTMLElement {
  
  // Cette ligne force Home Assistant à ouvrir DIRECTEMENT l'éditeur de code YAML
  // sans passer par l'interface visuelle qui casse tout avec des {}
  static getConfigElement() {
    return document.createElement("ha-card-editor");
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
    if (!config.card) {
      throw new Error("Vous devez définir une carte cible dans le paramètre 'card'.");
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
    
    // Attendre que les pièces soient chargées par Home Assistant
    if (!hass.areas) return;
    
    let areas = Object.values(hass.areas);
    
    // 1. Filtrer les exclusions (insensible à la casse)
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

    // 2. Préparer la structure du conteneur (grid par défaut)
    const layoutConfig = {
      ...(config.layout || { type: "grid", columns: 2 }),
      cards: []
    };

    // 3. Boucler sur les pièces et injecter les variables de manière brute
    areas.forEach(area => {
      const areaId = area.area_id;
      const areaName = area.name || areaId;
      const areaSlug = areaId.toLowerCase().replace(/ /g, '_');
      const areaIcon = area.icon || "mdi:home-outline";

      // Fonction de remplacement récursive pour traiter tout le bloc YAML de la carte
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
        console.error("Erreur d'injection dans la carte :", e);
      }
    });

    // 4. Génération et rendu via l'élément officiel de Home Assistant
    if (!this._layoutElement) {
      this._layoutElement = document.createElement("hui-element");
      this.content.innerHTML = '';
      this.content.appendChild(this._layoutElement);
    }
    
    // On met à jour la configuration globale du conteneur de cartes
    this._layoutElement.setConfig(layoutConfig);
    this._layoutElement.hass = hass;
  }

  getCardSize() { return 4; }
}

customElements.define('all-areas-display', AllAreasDisplay);

// Enregistrement dans le catalogue des cartes de Home Assistant
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'all-areas-display')) {
  window.customCards.push({
    type: "all-areas-display",
    name: "All areas display",
    preview: true,
    description: "Génère dynamiquement des cartes pour chaque pièce (façon auto-entities)."
  });
}