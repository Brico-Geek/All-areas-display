import { LitElement, html, css } from 'https://unpkg.com/lit-element@2.4.0/lit-element.js?module';

class AllAreasDisplay extends LitElement {
  
  // 1. Reçoit la configuration de l'utilisateur
  setConfig(config) {
    if (!config.card_template) {
      throw new Error("Vous devez définir un modèle de carte ('card_template')");
    }
    this._config = config;
  }

  // 2. Reçoit les données en temps réel de Home Assistant (les entités, les pièces, etc.)
  set hass(hass) {
    this._hass = hass;
    this.requestUpdate();
  }

  // 3. Rendu de la carte
  render() {
    if (!this._hass || !this._config) return html``;

    const areas = Object.values(this._hass.areas); // Récupère toutes les pièces
    const displayType = this._config.display_type || 'grid';
    const columns = this._config.columns || 2;

    // Génération des cartes enfants pour chaque pièce
    const renderedCards = areas.map(area => {
      const clonedTemplate = JSON.parse(JSON.stringify(this._config.card_template));
      
      // Fonction récursive pour remplacer les variables dans la configuration de la carte
      const replaceVariables = (obj) => {
        for (let key in obj) {
          if (typeof obj[key] === 'string') {
            obj[key] = obj[key]
              .replace(/\[\[area_id\]\]/g, area.area_id)
              .replace(/\[\[area_name\]\]/g, area.name)
              .replace(/\[\[area_icon\]\]/g, area.icon || 'mdi:room');
          } else if (typeof obj[key] === 'object') {
            replaceVariables(obj[key]);
          }
        }
      };

      replaceVariables(clonedTemplate);
      return clonedTemplate;
    });

    // Rendu selon le type d'affichage sélectionné
    if (displayType === 'vertical-stack') {
      return html`<hui-vertical-stack-card .hass=${this._hass} .cards=${renderedCards}></hui-vertical-stack-card>`;
    } else if (displayType === 'horizontal-stack') {
      return html`<hui-horizontal-stack-card .hass=${this._hass} .cards=${renderedCards}></hui-horizontal-stack-card>`;
    } else {
      // Mode Grille (par défaut)
      return html`
        <hui-grid-card 
          .hass=${this._hass} 
          .config=${{ type: 'grid', columns: columns, square: false }} 
          .cards=${renderedCards}>
        </hui-grid-card>
      `;
    }
  }

  // Permet à Home Assistant de lier ton éditeur custom à cette carte
  static getConfigElement() {
    return document.createElement("all-areas-display-editor");
  }

  static getStubConfig() {
    return {
      display_type: "grid",
      columns: 2,
      card_template: {
        type: "button",
        name: "[[area_name]]",
        icon: "[[area_icon]]"
      }
    };
  }
}

customElements.define('all-areas-display', AllAreasDisplay);